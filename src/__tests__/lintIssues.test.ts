import { describe, it, expect } from 'vitest';
import { sortIssues, countBySeverity } from '../utils/lintIssues';
import type { LintIssue } from '../services/aiService';

const mk = (severity: LintIssue['severity'], message: string): LintIssue => ({ severity, category: 'x', message, suggestion: '' });

describe('lintIssues', () => {
  it('sortIssues: nghiêm trọng trước, giữ thứ tự trong cùng mức, không đổi mảng gốc', () => {
    const input = [mk('low', 'a'), mk('high', 'b'), mk('medium', 'c'), mk('high', 'd')];
    expect(sortIssues(input).map((i) => i.message)).toEqual(['b', 'd', 'c', 'a']);
    expect(input[0].message).toBe('a');
  });

  it('countBySeverity đếm đủ 3 mức', () => {
    expect(countBySeverity([mk('high', 'a'), mk('low', 'b'), mk('low', 'c')])).toEqual({ high: 1, medium: 0, low: 2 });
    expect(countBySeverity([])).toEqual({ high: 0, medium: 0, low: 0 });
  });
});
