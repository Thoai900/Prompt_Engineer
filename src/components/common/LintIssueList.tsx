import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { LintIssue } from '../../services/aiService';
import { SEVERITY_LABELS, countBySeverity, sortIssues, type LintSeverity } from '../../utils/lintIssues';

const SEV_STYLE: Record<LintSeverity, { icon: typeof Info; badge: string; border: string }> = {
  high: { icon: AlertCircle, badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-900' },
  medium: { icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-900' },
  low: { icon: Info, badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', border: 'border-line' },
};

/** Đếm theo mức độ, dạng chip. */
export function LintCounts({ issues }: { issues: LintIssue[] }) {
  const counts = countBySeverity(issues);
  return (
    <div className="flex flex-wrap gap-1.5 text-xs font-bold">
      {(['high', 'medium', 'low'] as const).filter((s) => counts[s] > 0).map((s) => (
        <span key={s} className={`rounded-full px-2.5 py-0.5 ${SEV_STYLE[s].badge}`}>
          {counts[s]} {SEVERITY_LABELS[s].toLowerCase()}
        </span>
      ))}
    </div>
  );
}

/** Danh sách lỗi lint prompt — dùng chung cho Prompt Inspector và bước Kiểm tra của Studio. */
export default function LintIssueList({ issues }: { issues: LintIssue[] }) {
  return (
    <div className="space-y-2">
      {sortIssues(issues).map((issue, i) => {
        const s = SEV_STYLE[issue.severity];
        const Icon = s.icon;
        return (
          <div key={i} className={`rounded-xl border bg-panel p-3 ${s.border}`}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Icon size={14} className="shrink-0" />
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.badge}`}>{SEVERITY_LABELS[issue.severity]}</span>
              <span className="text-xs font-semibold text-muted">{issue.category}</span>
            </div>
            <p className="text-sm leading-relaxed text-ink">{issue.message}</p>
            {issue.suggestion && (
              <p className="mt-1.5 rounded-lg bg-surface p-2 text-xs leading-relaxed text-muted">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Gợi ý: </span>{issue.suggestion}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
