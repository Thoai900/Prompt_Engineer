import type { LintIssue } from '../services/aiService';

/** Hàm thuần dùng chung cho mọi nơi hiển thị kết quả lint prompt (Inspector, Studio). */

export type LintSeverity = LintIssue['severity'];

export const SEVERITY_LABELS: Record<LintSeverity, string> = {
  high: 'Nghiêm trọng',
  medium: 'Trung bình',
  low: 'Nhẹ',
};

const SEV_ORDER: Record<LintSeverity, number> = { high: 0, medium: 1, low: 2 };

/** Sắp theo mức độ (nghiêm trọng trước), giữ nguyên thứ tự trong cùng mức. Không đổi mảng gốc. */
export function sortIssues(issues: LintIssue[]): LintIssue[] {
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => SEV_ORDER[a.issue.severity] - SEV_ORDER[b.issue.severity] || a.i - b.i)
    .map((x) => x.issue);
}

export function countBySeverity(issues: LintIssue[]): Record<LintSeverity, number> {
  const counts: Record<LintSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return counts;
}
