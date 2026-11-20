import { describe, it, expect } from 'vitest';
import { normalizeDraftTests, findSuiteForTemplate, normalizeSplitBlocks, MAX_SUITE_TESTS } from '../utils/healthUtils';
import type { HealthSuite } from '../types';

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

describe('findSuiteForTemplate', () => {
  it('trả suite cập nhật gần nhất có nguồn là template (bỏ qua sharedApp), hoặc null', () => {
    const list = [
      suite({ id: 'old', source: { kind: 'template', id: 't' }, updatedAt: '2026-01-01' }),
      suite({ id: 'new', source: { kind: 'template', id: 't' }, updatedAt: '2026-06-01' }),
      suite({ id: 'other', source: { kind: 'template', id: 'x' }, updatedAt: '2026-12-01' }),
      suite({ id: 'app', source: { kind: 'sharedApp', id: 't' }, updatedAt: '2026-12-01' }),
    ];
    expect(findSuiteForTemplate(list, 't')?.id).toBe('new');
    expect(findSuiteForTemplate(list, 'none')).toBeNull();
    expect(findSuiteForTemplate(list, undefined)).toBeNull();
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
