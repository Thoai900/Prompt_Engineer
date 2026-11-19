import React, { useState } from 'react';
import { GitCommitHorizontal, Loader2, AlertTriangle, X } from 'lucide-react';
import { PromptBlock, PromptTemplate } from '../../types';
import { splitPromptIntoBlocks } from '../../services/aiService';
import { normalizeSplitBlocks } from '../../utils/healthUtils';
import { blocksToText } from '../../utils/templateVersionUtils';
import { computeUnifiedDiff } from '../../utils/chainUtils';
import { toast } from '../common/Toaster';

interface SaveAsVersionPanelProps {
  /** Template nguồn của suite (của tôi, bản mới nhất từ App). */
  template: PromptTemplate;
  /** Prompt phiên bản hiện hành của suite (vd bản Optimizer vừa được chấp nhận). */
  prompt: string;
  onSaveTemplate: (t: PromptTemplate) => Promise<void> | void;
  /** Lưu xong — HealthPanel ghi revision 'source-sync' để suite khớp lại với template. */
  onSaved: (blocks: PromptBlock[]) => void;
}

type Phase = 'idle' | 'splitting' | 'review' | 'saving';

/**
 * Lưu prompt hiện hành của Health suite về template nguồn (spec 2026-11-18-quality-loop-design,
 * gộp vào Prompt Git): chia lại khối giữ nguyên câu chữ → xem khác biệt → lưu thành phiên bản mới
 * của CÙNG template (App tự chụp bản cũ vào `versions`, khôi phục được trong chi tiết template).
 */
export default function SaveAsVersionPanel({ template, prompt, onSaveTemplate, onSaved }: SaveAsVersionPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [newBlocks, setNewBlocks] = useState<PromptBlock[] | null>(null);
  const [fellBack, setFellBack] = useState(false);

  const prepare = async () => {
    setPhase('splitting');
    try {
      const raw = await splitPromptIntoBlocks(prompt, template.blocks.map((b) => ({ type: b.type, title: b.title })));
      const res = normalizeSplitBlocks(raw, prompt);
      setNewBlocks(res.blocks);
      setFellBack(res.fellBack);
    } catch {
      // AI lỗi → vẫn cho lưu, gộp thành 1 khối.
      const res = normalizeSplitBlocks([], prompt);
      setNewBlocks(res.blocks);
      setFellBack(true);
    }
    setPhase('review');
  };

  const save = async () => {
    if (!newBlocks) return;
    setPhase('saving');
    try {
      await onSaveTemplate({ ...template, blocks: newBlocks });
    } catch {
      toast.error('Không lưu được phiên bản.');
      setPhase('review');
      return;
    }
    toast.success(`Đã lưu phiên bản mới cho "${template.title}" — bản cũ nằm trong lịch sử phiên bản của template.`);
    onSaved(newBlocks);
    setPhase('idle');
    setNewBlocks(null);
  };

  return (
    <div className="rounded-2xl border border-emerald-300 bg-panel p-5 dark:border-emerald-900">
      <div className="mb-2 flex items-center gap-2">
        <GitCommitHorizontal size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-bold text-ink">Phiên bản hiện hành khác template “{template.title}”</h3>
      </div>

      {phase === 'idle' && (
        <>
          <p className="mb-3 text-xs text-muted">Lưu nó về template: AI chia lại thành các khối như template (giữ nguyên câu chữ), bạn xem khác biệt rồi mới lưu.</p>
          <button onClick={prepare} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">
            Xem khác biệt &amp; lưu về template
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
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Không chia được thành khối — sẽ lưu thành một khối duy nhất.
            </p>
          )}
          <p className="mb-1.5 text-xs text-faint">{template.blocks.length} khối → {newBlocks.length} khối · <span className="text-rose-500">− template hiện tại</span> / <span className="text-emerald-600">+ phiên bản của suite</span></p>
          <div className="mb-3 max-h-72 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed">
            {computeUnifiedDiff(blocksToText(template.blocks), blocksToText(newBlocks)).map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap ${line.type === 'added' ? 'text-emerald-400' : line.type === 'removed' ? 'text-rose-400' : 'text-slate-500'}`}>
                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '− ' : '  '}{line.text}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={phase === 'saving'} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
              {phase === 'saving' && <Loader2 size={14} className="animate-spin" />} Lưu phiên bản mới cho template
            </button>
            <button onClick={() => { setPhase('idle'); setNewBlocks(null); }} disabled={phase === 'saving'} className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-muted hover:bg-hover">
              <X size={14} /> Huỷ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
