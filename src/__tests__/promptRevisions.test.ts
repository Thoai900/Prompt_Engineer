import { describe, it, expect } from 'vitest';
import {
  hashPrompt, commitRevision, restoreRevision, trimRevisions, scoreByRevision, bestRevision,
  blameByTest, migrateSuite, hasUncommittedPrompt, headRevision, MAX_REVISIONS,
  pickFailingTests, judgeRevision,
} from '../utils/promptRevisions';
import { HealthRun, HealthSuite, PromptRevision } from '../types';

const suite = (over: Partial<HealthSuite> = {}): HealthSuite => ({
  id: 's1', name: 'S', prompt: '', model: 'm1',
  testCases: [{ id: 't1', input: 'a', criteria: [] }, { id: 't2', input: 'b', criteria: [] }],
  runs: [], ...over,
});
const run = (revisionId: string | undefined, avg: number, scores: [number, number], model = 'm1'): HealthRun => ({
  at: new Date().toISOString(), model, avgScore: avg, revisionId,
  results: [{ testId: 't1', score: scores[0] }, { testId: 't2', score: scores[1] }],
});
const rev = (id: string, content = id, parentId?: string): PromptRevision => ({
  id, at: '2026-01-01T00:00:00.000Z', content, hash: hashPrompt(content), origin: 'manual', parentId,
});

describe('hashPrompt', () => {
  it('ổn định, bỏ qua khoảng trắng đầu/cuối, khác nội dung → khác hash', () => {
    expect(hashPrompt('abc')).toBe(hashPrompt('  abc\n'));
    expect(hashPrompt('abc')).not.toBe(hashPrompt('abd'));
    expect(hashPrompt('abc')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('commitRevision', () => {
  it('tạo revision đầu, đặt head, cập nhật prompt', () => {
    const s = commitRevision(suite(), 'P1', 'manual');
    expect(s.revisions).toHaveLength(1);
    expect(s.headRevisionId).toBe(s.revisions![0].id);
    expect(s.prompt).toBe('P1');
    expect(s.revisions![0].parentId).toBeUndefined();
  });

  it('trùng head → trả nguyên suite', () => {
    const s1 = commitRevision(suite(), 'P1', 'manual');
    expect(commitRevision(s1, 'P1 ', 'manual')).toBe(s1);
  });

  it('bản mới trỏ parentId về head cũ', () => {
    const s1 = commitRevision(suite(), 'P1', 'manual');
    const s2 = commitRevision(s1, 'P2', 'optimizer', 'ghi chú');
    expect(s2.revisions).toHaveLength(2);
    expect(s2.revisions![0].parentId).toBe(s1.headRevisionId);
    expect(s2.revisions![0].origin).toBe('optimizer');
    expect(s2.revisions![0].note).toBe('ghi chú');
  });

  it('trùng một revision CŨ → không nhân bản, chỉ chuyển head', () => {
    const s1 = commitRevision(suite(), 'P1', 'manual');
    const firstId = s1.headRevisionId;
    const s2 = commitRevision(s1, 'P2', 'manual');
    const s3 = commitRevision(s2, 'P1', 'manual');
    expect(s3.revisions).toHaveLength(2);
    expect(s3.headRevisionId).toBe(firstId);
    expect(s3.prompt).toBe('P1');
  });
});

describe('trimRevisions', () => {
  it('bỏ bản cũ nhất không được tham chiếu trước, giữ bản có run và head', () => {
    // mới nhất ở đầu: r3 (head), r2, r1 (có run), r0
    const revs = [rev('r3'), rev('r2'), rev('r1'), rev('r0')];
    const out = trimRevisions(revs, [run('r1', 50, [50, 50])], 'r3', 2);
    expect(out.map((r) => r.id)).toEqual(['r3', 'r1']);
  });

  it('không vượt cap thì giữ nguyên', () => {
    const revs = [rev('a'), rev('b')];
    expect(trimRevisions(revs, [], 'a')).toBe(revs);
  });

  it('nội dung quá lớn → cắt còn 10', () => {
    const big = 'x'.repeat(30_000);
    const revs = Array.from({ length: 15 }, (_, i) => rev(`r${i}`, big + i));
    expect(trimRevisions(revs, [], 'r0')).toHaveLength(10);
  });

  it('commit liên tục không vượt MAX_REVISIONS', () => {
    let s = suite();
    for (let i = 0; i < MAX_REVISIONS + 5; i++) s = commitRevision(s, `P${i}`, 'manual');
    expect(s.revisions).toHaveLength(MAX_REVISIONS);
    expect(headRevision(s)?.content).toBe(`P${MAX_REVISIONS + 4}`);
  });
});

describe('restoreRevision / hasUncommittedPrompt', () => {
  it('khôi phục đặt head + prompt; id lạ → giữ nguyên', () => {
    const s = suite({ revisions: [rev('b', 'B', 'a'), rev('a', 'A')], headRevisionId: 'b', prompt: 'B' });
    const r = restoreRevision(s, 'a');
    expect(r.headRevisionId).toBe('a');
    expect(r.prompt).toBe('A');
    expect(restoreRevision(s, 'zzz')).toBe(s);
  });

  it('phát hiện prompt đã sửa mà chưa ghi', () => {
    const s = suite({ revisions: [rev('a', 'A')], headRevisionId: 'a', prompt: 'A' });
    expect(hasUncommittedPrompt(s)).toBe(false);
    expect(hasUncommittedPrompt({ ...s, prompt: 'A2' })).toBe(true);
    expect(hasUncommittedPrompt(suite({ prompt: 'X' }))).toBe(true);
    expect(hasUncommittedPrompt(suite({ prompt: '  ' }))).toBe(false);
  });
});

describe('scoreByRevision / bestRevision', () => {
  const s = suite({
    revisions: [rev('b', 'B', 'a'), rev('a', 'A')],
    headRevisionId: 'b',
    runs: [run('b', 60, [40, 80]), run('a', 75, [80, 70]), run('a', 70, [70, 70]), run(undefined, 10, [10, 10])],
  });

  it('gom run theo revision, delta so với cha', () => {
    const sc = scoreByRevision(s);
    const b = sc.find((x) => x.revision.id === 'b')!;
    const a = sc.find((x) => x.revision.id === 'a')!;
    expect(a.lastScore).toBe(75);
    expect(a.bestScore).toBe(75);
    expect(a.runs).toHaveLength(2);
    expect(b.deltaVsParent).toBe(-15);
    expect(a.deltaVsParent).toBeNull();
  });

  it('bản tốt nhất theo điểm lần chạy gần nhất', () => {
    expect(bestRevision(s)?.id).toBe('a');
    expect(bestRevision(suite())).toBeNull();
  });

  it('lọc theo model', () => {
    const s2 = { ...s, runs: [...s.runs, run('b', 99, [99, 99], 'm2')] };
    expect(bestRevision(s2, 'm2')?.id).toBe('b');
    expect(bestRevision(s2, 'm1')?.id).toBe('a');
  });
});

describe('blameByTest', () => {
  it('delta từng test, tụt nhiều nhất lên đầu', () => {
    const s = suite({ runs: [run('b', 60, [40, 80]), run('a', 75, [80, 70])] });
    const rows = blameByTest(s, 'a', 'b');
    expect(rows[0]).toEqual({ testId: 't1', scoreA: 80, scoreB: 40, delta: -40 });
    expect(rows[1].delta).toBe(10);
  });

  it('thiếu run một bên → delta null, xếp cuối', () => {
    const s = suite({ runs: [run('a', 75, [80, 70])] });
    const rows = blameByTest(s, 'a', 'b');
    expect(rows.every((r) => r.delta === null && r.scoreB === null)).toBe(true);
  });
});

describe('migrateSuite', () => {
  it('suite cũ → 1 revision head, run cũ không bị gán revisionId', () => {
    const old = suite({ prompt: 'OLD', runs: [run(undefined, 50, [50, 50])] });
    const m = migrateSuite(old);
    expect(m.revisions).toHaveLength(1);
    expect(m.headRevisionId).toBe(m.revisions![0].id);
    expect(m.runs[0].revisionId).toBeUndefined();
  });

  it('đã có revisions hoặc prompt rỗng → giữ nguyên', () => {
    const s = suite({ revisions: [rev('a')], headRevisionId: 'a', prompt: 'a' });
    expect(migrateSuite(s)).toBe(s);
    const empty = suite();
    expect(migrateSuite(empty)).toBe(empty);
  });
});

describe('pickFailingTests', () => {
  const tests = [{ id: 't1', input: 'a', criteria: [] }, { id: 't2', input: 'b', criteria: [] }, { id: 't3', input: 'c', criteria: [] }];
  const r = (revisionId: string, scores: number[], model = 'm1'): HealthRun => ({
    at: '', model, avgScore: 0, revisionId, results: scores.map((score, i) => ({ testId: `t${i + 1}`, score })),
  });

  it('lấy test < 70 ở run gần nhất của head, trượt nặng trước', () => {
    const s = suite({ testCases: tests, headRevisionId: 'h', runs: [r('h', [65, 90, 30]), r('h', [10, 10, 10])] });
    expect(pickFailingTests(s).map((x) => [x.test.id, x.score])).toEqual([['t3', 30], ['t1', 65]]);
  });

  it('bỏ run khác model / khác revision; không có head → rỗng', () => {
    const s = suite({ testCases: tests, headRevisionId: 'h', runs: [r('h', [10, 10, 10], 'm2'), r('x', [10, 10, 10])] });
    expect(pickFailingTests(s)).toEqual([]);
    expect(pickFailingTests(suite({ runs: [r('h', [10])] }))).toEqual([]);
  });

  it('giới hạn số lượng', () => {
    const s = suite({ testCases: tests, headRevisionId: 'h', runs: [r('h', [1, 2, 3])] });
    expect(pickFailingTests(s, 'h', 70, 2)).toHaveLength(2);
  });
});

describe('judgeRevision', () => {
  it('đạt khi TB không giảm và không test nào tụt > 15', () => {
    const s = suite({ runs: [run('new', 80, [70, 90]), run('old', 70, [80, 60])] });
    const v = judgeRevision(s, 'old', 'new');
    expect(v).toMatchObject({ ready: true, ok: true, avgDelta: 10 });
    expect(v.regressions).toEqual([]);
  });

  it('không đạt khi một test tụt > 15 dù TB tăng', () => {
    const s = suite({ runs: [run('new', 75, [50, 100]), run('old', 70, [80, 60])] });
    const v = judgeRevision(s, 'old', 'new');
    expect(v.ok).toBe(false);
    expect(v.regressions.map((b) => b.testId)).toEqual(['t1']);
  });

  it('không đạt khi TB giảm; chưa đủ run → ready=false', () => {
    expect(judgeRevision(suite({ runs: [run('new', 60, [60, 60]), run('old', 65, [65, 65])] }), 'old', 'new').ok).toBe(false);
    expect(judgeRevision(suite({ runs: [run('old', 65, [65, 65])] }), 'old', 'new').ready).toBe(false);
  });
});
