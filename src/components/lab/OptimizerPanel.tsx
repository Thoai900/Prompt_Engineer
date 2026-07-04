import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, Plus, X, Copy, Check, AlertCircle, TrendingUp, ChevronDown, Briefcase, Save } from 'lucide-react';
import { optimizePrompt, type OptimizeResult } from '../../services/aiProxy';
import { PromptTemplate } from '../../types';
import { promptToTemplate } from '../../utils/labUtils';
import { toast } from '../common/Toaster';

interface OptimizerPanelProps {
  /** Prompt mồi (vd gửi sang từ Linter) — điền sẵn vào ô prompt gốc. */
  initialPrompt?: string;
  /** Mở prompt kết quả trong Builder. */
  onApplyTemplate?: (t: PromptTemplate) => void;
  /** Lưu prompt kết quả vào thư viện. */
  onSaveTemplate?: (t: PromptTemplate) => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

/**
 * Auto-Optimizer (mũi nhọn Tầng 1): mô tả "thế nào là tốt" (tiêu chí + input thử),
 * backend tự sinh biến thể prompt → chấm điểm → tiến hoá → trả prompt tốt nhất.
 */
export default function OptimizerPanel({ initialPrompt, onApplyTemplate, onSaveTemplate }: OptimizerPanelProps) {
  const [basePrompt, setBasePrompt] = useState(initialPrompt || '');

  // Prompt mồi thay đổi (gửi lại từ Linter) → cập nhật ô nhập.
  useEffect(() => {
    if (initialPrompt) setBasePrompt(initialPrompt);
  }, [initialPrompt]);
  const [testInput, setTestInput] = useState('');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [criterionDraft, setCriterionDraft] = useState('');
  const [populationN, setPopulationN] = useState(3);
  const [rounds, setRounds] = useState(2);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [copied, setCopied] = useState(false);
  // M6: dòng trạng thái tiến trình sống từ SSE (baseline → từng vòng).
  const [progressText, setProgressText] = useState('');

  const addCriterion = () => {
    const c = criterionDraft.trim();
    if (!c) return;
    setCriteria((prev) => [...prev, c]);
    setCriterionDraft('');
  };

  const runOptimize = async () => {
    if (!basePrompt.trim()) { toast.error('Hãy nhập prompt gốc cần tối ưu.'); return; }
    setRunning(true);
    setError('');
    setResult(null);
    setProgressText('Đang chấm điểm prompt gốc (baseline)…');
    try {
      const r = await optimizePrompt(
        {
          basePrompt: basePrompt.trim(),
          criteria,
          testInput: testInput.trim() || undefined,
          populationN,
          rounds,
        },
        (p) => {
          if (p.type === 'baseline') {
            setProgressText(`Baseline: ${p.score}/100 · đang sinh biến thể vòng 1/${p.rounds}…`);
          } else if (p.type === 'round') {
            const next = (p.round || 0) < (p.rounds || 0) ? ` · đang chạy vòng ${(p.round || 0) + 1}/${p.rounds}…` : ' · đang chốt kết quả…';
            setProgressText(`Vòng ${p.round}/${p.rounds} xong — điểm tốt nhất ${p.bestScore}/100${next}`);
          }
        },
      );
      setResult(r);
    } catch (e: any) {
      setError(e?.message || 'Tối ưu thất bại. Hãy đăng nhập và thử lại.');
    } finally {
      setRunning(false);
      setProgressText('');
    }
  };

  const copyBest = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.bestPrompt)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error('Không sao chép được.'));
  };

  return (
    <>
      <p className="mb-4 text-sm text-muted">Bạn không viết prompt — bạn mô tả <span className="font-semibold text-ink">thế nào là tốt</span>. Hệ thống tự sinh biến thể, chấm điểm và tiến hoá để tìm prompt tối ưu. <span className="text-faint">(Chạy trên server, cần đăng nhập.)</span></p>

      <div className="mb-6 rounded-2xl border border-line bg-panel p-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Prompt gốc</label>
        <textarea
          value={basePrompt}
          onChange={(e) => setBasePrompt(e.target.value)}
          rows={4}
          placeholder="Vd: Bạn là trợ lý viết email. Viết email cho người dùng."
          className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Đầu vào thử (tuỳ chọn)</label>
        <textarea
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          rows={2}
          placeholder="Một ví dụ đầu vào điển hình để chấm các biến thể trên cùng bối cảnh."
          className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Tiêu chí "thế nào là tốt" <span className="font-normal normal-case text-faint">(trống = tiêu chí mặc định)</span></label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {criteria.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {c}
              <button onClick={() => setCriteria((prev) => prev.filter((_, j) => j !== i))} className="text-emerald-500 hover:text-emerald-700" aria-label={`Xoá tiêu chí ${c}`}><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="mb-4 flex gap-2">
          <input
            value={criterionDraft}
            onChange={(e) => setCriterionDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCriterion(); } }}
            placeholder="Vd: Giọng chuyên nghiệp, có CTA rõ ràng, dưới 150 từ…"
            className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button onClick={addCriterion} className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-hover"><Plus size={14} /> Thêm</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-muted">
            Số biến thể/vòng
            <select value={populationN} onChange={(e) => setPopulationN(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink">
              {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Số vòng tiến hoá
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink">
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <button
          onClick={runOptimize}
          disabled={running}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {running ? 'Đang tiến hoá prompt…' : 'Tối ưu prompt'}
        </button>
        {running && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Loader2 size={12} className="animate-spin" />
            {progressText || 'Đang khởi động…'}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Tóm tắt cải thiện */}
          <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-emerald-300 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">prompt gốc</div>
              <div className={`text-2xl font-black ${scoreColor(result.baselineScore)}`}>{result.baselineScore}</div>
            </div>
            <TrendingUp size={24} className="text-emerald-500" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">prompt tối ưu</div>
              <div className={`text-2xl font-black ${scoreColor(result.bestScore)}`}>{result.bestScore}</div>
            </div>
            <div className="ml-auto rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">
              {result.improvement >= 0 ? '+' : ''}{result.improvement} điểm
            </div>
          </div>

          {/* Prompt tốt nhất */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">Prompt tốt nhất</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={copyBest} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-hover">
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />} {copied ? 'Đã chép' : 'Sao chép'}
                </button>
                {onApplyTemplate && (
                  <button
                    onClick={() => onApplyTemplate(promptToTemplate(result.bestPrompt, 'auto-optimizer'))}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
                  >
                    <Briefcase size={13} /> Dùng ở Builder
                  </button>
                )}
                {onSaveTemplate && (
                  <button
                    onClick={() => onSaveTemplate(promptToTemplate(result.bestPrompt, 'auto-optimizer'))}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    <Save size={13} /> Lưu vào thư viện
                  </button>
                )}
              </div>
            </div>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 font-mono text-xs leading-relaxed text-ink">{result.bestPrompt}</pre>
          </div>

          {/* Lịch sử tiến hoá */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Lịch sử tiến hoá</h3>
            <div className="space-y-3">
              {result.history.map((h) => (
                <details key={h.round} className="rounded-xl border border-line bg-surface p-3">
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-ink">
                    <span className="flex items-center gap-2"><ChevronDown size={14} className="text-faint" /> Vòng {h.round}</span>
                    <span className={`font-black ${scoreColor(h.best.score)}`}>tốt nhất: {h.best.score}</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    {h.candidates.map((c, i) => (
                      <div key={i} className="rounded-lg border border-line bg-panel p-2.5">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-muted">Biến thể {i + 1}</span>
                          <span className={`text-sm font-bold ${scoreColor(c.score)}`}>{c.score}</span>
                        </div>
                        {c.feedback && <p className="mb-1 text-[11px] italic text-faint">{c.feedback}</p>}
                        <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded bg-surface p-2 font-mono text-[10px] leading-relaxed text-muted">{c.prompt}</pre>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
