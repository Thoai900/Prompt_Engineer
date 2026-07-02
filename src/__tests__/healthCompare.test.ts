// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { compareRuns } from '../services/healthService';
import { HealthRun } from '../types';

const run = (avg: number, model: string, results: { testId: string; score: number }[]): HealthRun => ({
  at: new Date().toISOString(), model, avgScore: avg,
  results: results.map((r) => ({ ...r })),
});

describe('compareRuns (Prompt Health)', () => {
  it('không có run mới → null', () => {
    const c = compareRuns(undefined, undefined);
    expect(c.avgDelta).toBeNull();
    expect(c.modelChanged).toBe(false);
  });

  it('có run mới nhưng chưa có run trước → avgDelta null', () => {
    const c = compareRuns(run(80, 'm', [{ testId: 't1', score: 80 }]), undefined);
    expect(c.avgDelta).toBeNull();
  });

  it('tính chênh lệch trung bình + theo từng test', () => {
    const latest = run(70, 'gemini-2.5-flash', [{ testId: 't1', score: 60 }, { testId: 't2', score: 80 }]);
    const prev = run(85, 'gemini-2.5-flash', [{ testId: 't1', score: 90 }, { testId: 't2', score: 80 }]);
    const c = compareRuns(latest, prev);
    expect(c.avgDelta).toBe(-15);
    expect(c.perTest.t1).toBe(-30);
    expect(c.perTest.t2).toBe(0);
    expect(c.modelChanged).toBe(false);
  });

  it('phát hiện đổi model', () => {
    const latest = run(70, 'gemini-2.5-pro', [{ testId: 't1', score: 70 }]);
    const prev = run(70, 'gemini-2.5-flash', [{ testId: 't1', score: 70 }]);
    expect(compareRuns(latest, prev).modelChanged).toBe(true);
  });
});
