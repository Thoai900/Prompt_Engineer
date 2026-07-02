import React, { useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, AlertTriangle, Info, CheckCircle2, Sparkles } from 'lucide-react';
import { lintPrompt, type LintIssue } from '../../services/aiService';
import { toast } from '../common/Toaster';

interface LinterPanelProps {
  /** Gửi prompt hiện tại sang Auto-Optimizer (LabTab chuyển mode + mồi sẵn). */
  onOptimize?: (prompt: string) => void;
}

const SEV_ORDER: Record<LintIssue['severity'], number> = { high: 0, medium: 1, low: 2 };

function sevStyle(sev: LintIssue['severity']) {
  if (sev === 'high') return { icon: AlertCircle, badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-900', label: 'Nghiêm trọng' };
  if (sev === 'medium') return { icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-900', label: 'Trung bình' };
  return { icon: Info, badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', border: 'border-line', label: 'Nhẹ' };
}

/** Phân tích tĩnh một prompt và chỉ ra điểm yếu trước khi chạy (như ESLint cho prompt). */
export default function LinterPanel({ onOptimize }: LinterPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [issues, setIssues] = useState<LintIssue[] | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!prompt.trim()) { toast.error('Hãy nhập prompt cần phân tích.'); return; }
    setRunning(true);
    setError('');
    setIssues(null);
    try {
      const result = await lintPrompt(prompt.trim());
      setIssues([...result].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]));
    } catch (e: any) {
      setError(e?.message || 'Phân tích thất bại. Hãy đăng nhập và thử lại.');
    } finally {
      setRunning(false);
    }
  };

  const counts = issues
    ? { high: issues.filter((i) => i.severity === 'high').length, medium: issues.filter((i) => i.severity === 'medium').length, low: issues.filter((i) => i.severity === 'low').length }
    : null;

  return (
    <>
      <p className="mb-4 text-sm text-muted">Phân tích <span className="font-semibold text-ink">tĩnh</span> một prompt — bắt mâu thuẫn, mơ hồ, thiếu ngữ cảnh, ràng buộc thừa <span className="font-semibold text-ink">trước khi chạy</span>, kèm gợi ý sửa.</p>

      <div className="mb-6 rounded-2xl border border-line bg-panel p-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Prompt cần kiểm tra</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="Dán prompt của bạn vào đây…"
          className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={run} disabled={running} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
            {running ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {running ? 'Đang phân tích…' : 'Phân tích prompt'}
          </button>
          {onOptimize && (
            <button
              onClick={() => onOptimize(prompt.trim())}
              disabled={running || !prompt.trim()}
              title="Gửi prompt này sang Auto-Optimizer để tự tiến hoá"
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-muted hover:bg-hover disabled:opacity-50"
            >
              <Sparkles size={15} /> Tối ưu bằng Auto-Optimizer
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {issues && issues.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/60 p-5 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 size={20} /> Không phát hiện vấn đề rõ ràng — prompt đã khá chắc.
        </div>
      )}

      {issues && issues.length > 0 && (
        <div className="space-y-3">
          {counts && (
            <div className="mb-1 flex flex-wrap gap-2 text-xs font-bold">
              {counts.high > 0 && <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{counts.high} nghiêm trọng</span>}
              {counts.medium > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">{counts.medium} trung bình</span>}
              {counts.low > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{counts.low} nhẹ</span>}
            </div>
          )}
          {issues.map((issue, i) => {
            const s = sevStyle(issue.severity);
            const Icon = s.icon;
            return (
              <div key={i} className={`rounded-2xl border bg-panel p-4 ${s.border}`}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon size={15} className="shrink-0" />
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.badge}`}>{s.label}</span>
                  <span className="text-xs font-semibold text-muted">{issue.category}</span>
                </div>
                <p className="mb-2 text-sm text-ink">{issue.message}</p>
                {issue.suggestion && (
                  <p className="rounded-lg bg-surface p-2.5 text-xs leading-relaxed text-muted"><span className="font-bold text-emerald-600 dark:text-emerald-400">Gợi ý: </span>{issue.suggestion}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
