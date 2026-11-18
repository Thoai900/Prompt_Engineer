import { describe, it, expect } from 'vitest';
import {
  normalizeDraftTests, needsOptimization, pickOptimizerSeedFromRun, findSuiteForTemplate,
  suiteWriteFields, normalizeSplitBlocks, MAX_SUITE_TESTS,
} from '../utils/healthUtils';
import type { HealthRun, HealthSuite } from '../types';

let n = 0;
const gid = () => `id${++n}`;

const suite = (over: Partial<HealthSuite> = {}): HealthSuite => ({
  id: 's1', name: 'Blog SEO', prompt: 'P', model: 'm',
  testCases: [
    { id: 'a', input: 'in-a', criteria: ['c1', 'c2'] },
    { id: 'b', input: 'in-b', criteria: ['c2', 'c3'] },
    { id: 'c', input: 'in-c', criteria: ['c4'] },
    { id: 'd', input: 'in-d', criteria: ['c5'] },
  ],
  runs: [], ...over,
});
const run = (scores: Record<string, number>): HealthRun => {
  const results = Object.entries(scores).map(([testId, score]) => ({ testId, score }));
  return { at: '2026-11-18T00:00:00Z', model: 'm', avgScore: Math.round(results.reduce((s, r) => s + r.score, 0) / results.length), results };
};

describe('normalizeDraftTests', () => {
  it('bỏ test rỗng/trùng/sai kiểu, cắt criteria ≤5 và lọc chuỗi rỗng', () => {
    const out = normalizeDraftTests([
      { input: '  hỏi A ', criteria: ['x', '', 1, ' y ', 'z', 'w', 'v', 'u'] },
      { input: 'hỏi A', criteria: ['dup'] },
      { input: '', criteria: ['x'] },
      null,
      { input: 'hỏi B' },
    ], gid);
    expect(out.map((t) => t.input)).toEqual(['hỏi A', 'hỏi B']);
    expect(out[0].criteria).toEqual(['x', 'y', 'z', 'w', 'v']);
    expect(out[1].criteria).toEqual([]);
  });

  it(`giữ tối đa ${MAX_SUITE_TESTS} test; không phải mảng → []`, () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ input: `q${i}`, criteria: [] }));
    expect(normalizeDraftTests(many, gid)).toHaveLength(MAX_SUITE_TESTS);
    expect(normalizeDraftTests({ tests: [] }, gid)).toEqual([]);
  });
});

describe('needsOptimization', () => {
  it('trung bình < 70 hoặc có test < 60 thì gợi ý; chưa chạy thì không', () => {
    expect(needsOptimization(undefined)).toBe(false);
    expect(needsOptimization(run({ a: 65, b: 70 }))).toBe(true);   // avg 68
    expect(needsOptimization(run({ a: 95, b: 55 }))).toBe(true);   // avg 75 nhưng có test 55
    expect(needsOptimization(run({ a: 80, b: 70 }))).toBe(false);
  });
});

describe('pickOptimizerSeedFromRun', () => {
  it('lấy ≤3 test tệ nhất (tệ nhất trước), hợp nhất criteria bỏ trùng, mang suite/template id', () => {
    const s = suite({ templateId: 'tpl1' });
    const seed = pickOptimizerSeedFromRun(s, run({ a: 50, b: 30, c: 90, d: 70 }));
    expect(seed.testInputs).toEqual(['in-b', 'in-a', 'in-d']);
    expect(seed.criteria).toEqual(['c2', 'c3', 'c1', 'c5']);
    expect(seed).toMatchObject({ prompt: 'P', suiteId: 's1', templateId: 'tpl1', templateTitle: 'Blog SEO' });
  });

  it('bỏ kết quả của test đã bị xoá khỏi suite', () => {
    const seed = pickOptimizerSeedFromRun(suite(), run({ gone: 0, c: 40 }));
    expect(seed.testInputs).toEqual(['in-c']);
  });
});

describe('findSuiteForTemplate', () => {
  it('trả suite cập nhật gần nhất của template, hoặc null', () => {
    const list = [
      suite({ id: 'old', templateId: 't', updatedAt: '2026-01-01' }),
      suite({ id: 'new', templateId: 't', updatedAt: '2026-06-01' }),
      suite({ id: 'other', templateId: 'x', updatedAt: '2026-12-01' }),
    ];
    expect(findSuiteForTemplate(list, 't')?.id).toBe('new');
    expect(findSuiteForTemplate(list, 'none')).toBeNull();
    expect(findSuiteForTemplate(list, undefined)).toBeNull();
  });
});

describe('suiteWriteFields', () => {
  it('ghi templateId/workspaceId khi có, cắt runs theo giới hạn', () => {
    const s = suite({ templateId: 'tpl1', workspaceId: 'w1', runs: [run({ a: 1 }), run({ a: 2 }), run({ a: 3 })] });
    const f = suiteWriteFields('u1', s, 2);
    expect(f).toMatchObject({ userId: 'u1', templateId: 'tpl1', workspaceId: 'w1', cronEnabled: false });
    expect((f.runs as unknown[]).length).toBe(2);
  });

  it('không có templateId thì không ghi khoá đó', () => {
    expect('templateId' in suiteWriteFields('u1', suite(), 10)).toBe(false);
  });
});

describe('normalizeSplitBlocks', () => {
  it('giữ khối hợp lệ, loại lạ → custom, title rỗng → "Khối"', () => {
    const { blocks, fellBack } = normalizeSplitBlocks([
      { type: 'role', title: 'Vai trò', content: ' Bạn là… ' },
      { type: 'weird', title: '', content: 'X' },
      { type: 'task', title: 'T', content: '   ' },
    ], 'fallback', 1);
    expect(fellBack).toBe(false);
    expect(blocks.map((b) => [b.type, b.title, b.content])).toEqual([['role', 'Vai trò', 'Bạn là…'], ['custom', 'Khối', 'X']]);
  });

  it('không có khối nào → 1 khối task chứa nguyên văn, fellBack', () => {
    const { blocks, fellBack } = normalizeSplitBlocks('not array', '  toàn bộ prompt ', 1);
    expect(fellBack).toBe(true);
    expect(blocks).toEqual([{ id: 'opt-1-0', type: 'task', title: 'Prompt', content: 'toàn bộ prompt' }]);
  });
});
