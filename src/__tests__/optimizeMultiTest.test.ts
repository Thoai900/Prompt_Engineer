import { describe, it, expect } from 'vitest';
import { normalizeTests, combineEvals, estimateCalls } from '../../api/optimize';

describe('api/optimize — tối ưu nhiều test', () => {
  it('không có tests → null (đường cũ testInput)', () => {
    expect(normalizeTests(undefined, [])).toBeNull();
    expect(normalizeTests([], ['x'])).toBeNull();
  });

  it('gộp tiêu chí chung + riêng, bỏ trùng; input rỗng → trigger; cắt 5 test', () => {
    const out = normalizeTests(
      Array.from({ length: 7 }, (_, i) => ({ input: i === 0 ? '  ' : `in${i}`, criteria: ['chung', `r${i}`, ''] })),
      ['chung'],
    )!;
    expect(out).toHaveLength(5);
    expect(out[0].input).toMatch(/chỉ dẫn hệ thống/);
    expect(out[1]).toEqual({ input: 'in1', criteria: ['chung', 'r1'] });
  });

  it('input quá dài → ném lỗi', () => {
    expect(() => normalizeTests([{ input: 'x'.repeat(50_001) }], [])).toThrow(/quá dài/);
  });

  it('điểm TB làm tròn, output/feedback từ test yếu nhất', () => {
    const c = combineEvals('P', [
      { score: 80, feedback: 'tốt', output: 'o1' },
      { score: 41, feedback: 'thiếu ví dụ', output: 'o2' },
    ]);
    expect(c.score).toBe(61);
    expect(c.output).toBe('o2');
    expect(c.feedback).toContain('thiếu ví dụ');
    expect(combineEvals('P', []).score).toBe(0);
  });

  it('ước tính lời gọi', () => {
    expect(estimateCalls(1, 3, 2)).toBe(2 * 1 * 7 + 2);
    expect(estimateCalls(5, 2, 1)).toBe(31);
  });
});
