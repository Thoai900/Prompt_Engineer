import React, { useState } from 'react';
import { GitCommitHorizontal, Loader2, RotateCcw, TrendingDown, TrendingUp, Minus, AlertTriangle, X } from 'lucide-react';
import { PromptBlock, PromptTemplate } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { splitPromptIntoBlocks } from '../../services/aiService';
import { loadHealthSuites, runHealthCheck, saveHealthSuite } from '../../services/healthService';
import { normalizeSplitBlocks } from '../../utils/healthUtils';
import { blocksToText } from '../../utils/templateVersionUtils';
import { computeUnifiedDiff } from '../../utils/chainUtils';
import { toast } from '../common/Toaster';

interface SaveAsVersionPanelProps {
  /** Template gốc (bản mới nhất từ App). */
  template: PromptTemplate;
  /** Health suite đã gửi prompt sang Optimizer — có thì chạy lại sau khi lưu. */
  suiteId?: string;
  bestPrompt: string;
  onSaveTemplate: (t: PromptTemplate) => Promise<void> | void;
}

type Phase = 'idle' | 'splitting' | 'review' | 'saving' | 'rechecking' | 'done';

interface Recheck { before: number | null; after: number }

/**
 * Bước cuối vòng chất lượng: chia bản tối ưu thành khối (giữ câu chữ) → xem khác biệt →
 * lưu thành phiên bản mới của CÙNG template (App tự chụp bản cũ vào `versions`) →
 * chạy lại Health suite và so điểm; điểm giảm thì cho khôi phục bản trước.
 */
export default function SaveAsVersionPanel({ template, suiteId, bestPrompt, onSaveTemplate }: SaveAsVersionPanelProps) {
  const { user, geminiApiKey, groqApiKey, openaiApiKey, useSystemGeminiKey } = useWorkspace();
  const [phase, setPhase] = useState<Phase>('idle');
  const [newBlocks, setNewBlocks] = useState<PromptBlock[] | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const [recheck, setRecheck] = useState<Recheck | null>(null);
  // Bản trước khi lưu — để khôi phục nếu điểm giảm.
  const [previous, setPrevious] = useState<{ blocks: PromptBlock[]; suitePrompt: string | null } | null>(null);
  const [restored, setRestored] = useState(false);

  const prepare = async () => {
    setPhase('splitting');
    try {
      const raw = await splitPromptIntoBlocks(bestPrompt, template.blocks.map((b) => ({ type: b.type, title: b.title })));
      const res = normalizeSplitBlocks(raw, bestPrompt);
      setNewBlocks(res.blocks);
      setFellBack(res.fellBack);
    } catch {
      // AI lỗi → vẫn cho lưu, gộp thành 1 khối.
      const res = normalizeSplitBlocks([], bestPrompt);
      setNewBlocks(res.blocks);
      setFellBack(true);
    }
    setPhase('review');
  };

  const apiKeys = () => ({
    gemini: useSystemGeminiKey ? undefined : (geminiApiKey || undefined),
    groq: groqApiKey || undefined,
    openai: openaiApiKey || undefined,
  });

  const save = async () => {
    if (!newBlocks) return;
    if (!user) { toast.error('Cần đăng nhập để lưu phiên bản.'); return; }
    const oldBlocks = template.blocks;
    setPhase('saving');
    try {
      await onSaveTemplate({ ...template, blocks: newBlocks });
    } catch {
      toast.error('Không lưu được phiên bản.');
      setPhase('review');
      return;
    }
    toast.success(`Đã lưu phiên bản mới cho "${template.title}".`);

    const suite = suiteId ? (await loadHealthSuites(user)).find((s) => s.id === suiteId) : undefined;
    setPrevious({ blocks: oldBlocks, suitePrompt: suite ? suite.prompt : null });
    if (!suite) { setPhase('done'); return; }

    setPhase('rechecking');
    try {
      const updated = { ...suite, prompt: blocksToText(newBlocks) };
      const run = await runHealthCheck(updated, apiKeys());
      await saveHealthSuite(user, { ...updated, runs: [run, ...updated.runs].slice(0, 10) });
      setRecheck({ before: suite.runs[0]?.avgScore ?? null, after: run.avgScore });
    } catch {
      toast.error('Đã lưu phiên bản nhưng chạy lại Health thất bại — mở Prompt Health để chạy tay.');
    }
    setPhase('done');
  };

  const restore = async () => {
    if (!previous || !user) return;
    try {
      await onSaveTemplate({ ...template, blocks: previous.blocks });
      if (suiteId && previous.suitePrompt !== null) {
        const suite = (await loadHealthSuites(user)).find((s) => s.id === suiteId);
        if (suite) await saveHealthSuite(user, { ...suite, prompt: previous.suitePrompt });
      }
      setRestored(true);
      toast.success('Đã khôi phục phiên bản trước (bản tối ưu vẫn nằm trong lịch sử phiên bản).');
    } catch {
      toast.error('Không khôi phục được.');
    }
  };

  const delta = recheck && recheck.before !== null ? recheck.after - recheck.before : null;

  return (
    <div className="rounded-2xl border border-emerald-300 bg-panel p-5 dark:border-emerald-900">
      <div className="mb-2 flex items-center gap-2">
        <GitCommitHorizontal size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-bold text-ink">Lưu thành phiên bản mới của “{template.title}”</h3>
      </div>

      {phase === 'idle' && (
        <>
          <p className="mb-3 text-xs text-muted">AI chia bản tối ưu thành các khối như template gốc (giữ nguyên câu chữ), bạn xem khác biệt rồi mới lưu. Bản hiện tại được giữ trong lịch sử phiên bản.</p>
          <button onClick={prepare} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">
            Xem khác biệt
          </button>
        </>
      )}

      {phase === 'splitting' && (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Đang chia khối…</p>
      )}

      {(phase === 'review' || phase === 'saving') && newBlocks && (
        <>
          {fellBack && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Không chia được thành khối — bản tối ưu sẽ được lưu thành một khối duy nhất.
            </p>
          )}
          <p className="mb-1.5 text-xs text-faint">{template.blocks.length} khối → {newBlocks.length} khối · <span className="text-rose-500">− bản hiện tại</span> / <span className="text-emerald-600">+ bản tối ưu</span></p>
          <div className="mb-3 max-h-72 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed">
            {computeUnifiedDiff(blocksToText(template.blocks), blocksToText(newBlocks)).map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap ${line.type === 'added' ? 'text-emerald-400' : line.type === 'removed' ? 'text-rose-400' : 'text-slate-500'}`}>
                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '− ' : '  '}{line.text}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={phase === 'saving'} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
              {phase === 'saving' && <Loader2 size={14} className="animate-spin" />} Lưu phiên bản mới{suiteId ? ' & chạy lại Health' : ''}
            </button>
            <button onClick={() => { setPhase('idle'); setNewBlocks(null); }} disabled={phase === 'saving'} className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-muted hover:bg-hover">
              <X size={14} /> Huỷ
            </button>
          </div>
        </>
      )}

      {phase === 'rechecking' && (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Đã lưu — đang chạy lại Prompt Health trên phiên bản mới…</p>
      )}

      {phase === 'done' && (
        <div className="space-y-3">
          {recheck ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted">Điểm Health:</span>
              <span className="font-black text-ink">{recheck.before ?? '—'} → {recheck.after}</span>
              {delta !== null && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${delta > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : delta < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}{delta > 0 ? '+' : ''}{delta}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Đã lưu phiên bản mới.{suiteId ? '' : ' Prompt này chưa có Health suite — mở template trong Library để tạo bộ test.'}</p>
          )}
          {previous && !restored && (delta === null || delta < 0) && (
            <button onClick={restore} className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <RotateCcw size={14} /> Khôi phục phiên bản trước
            </button>
          )}
          {restored && <p className="text-xs text-muted">Đã khôi phục. Bản tối ưu vẫn xem được trong lịch sử phiên bản của template.</p>}
        </div>
      )}
    </div>
  );
}
