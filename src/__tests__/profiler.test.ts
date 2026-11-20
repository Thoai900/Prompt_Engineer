import { describe, it, expect } from 'vitest';
import {
  tokenize, similarity, consistencyScore, checkFormat, hasFormatCheck, percentile, profileModel, runWithConcurrency,
} from '../utils/profiler';
import { GEMINI_FLASH } from '../config/models';

describe('tokenize / similarity / consistencyScore', () => {
  it('giữ dấu tiếng Việt, bỏ dấu câu', () => {
    expect(tokenize('Xin chào, Việt Nam! 2026')).toEqual(['xin', 'chào', 'việt', 'nam', '2026']);
  });

  it('giống hệt = 1, khác hẳn = 0, rỗng cả hai = 1', () => {
    expect(similarity('một hai ba', 'Một, hai, ba!')).toBe(1);
    expect(similarity('một hai ba', 'bốn năm sáu')).toBe(0);
    expect(similarity('', '')).toBe(1);
    const s = similarity('con mèo ngồi trên thảm', 'con mèo nằm trên thảm');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it('consistencyScore: < 2 output → null; trung bình mọi cặp', () => {
    expect(consistencyScore(['a'])).toBeNull();
    expect(consistencyScore(['x y', 'x y', 'x y'])).toBe(100);
    expect(consistencyScore(['a b', 'a b', 'c d'])).toBe(33); // (1+0+0)/3
  });
});

describe('checkFormat', () => {
  it('JSON: chấp nhận khối ```json, từ chối văn bản thường / JSON hỏng', () => {
    expect(checkFormat('{"a":1}', { kind: 'json' })).toBe(true);
    expect(checkFormat('```json\n[1,2]\n```', { kind: 'json' })).toBe(true);
    expect(checkFormat('Đây là kết quả: {"a":1}', { kind: 'json' })).toBe(false);
    expect(checkFormat('{"a":', { kind: 'json' })).toBe(false);
  });

  it('danh sách: cần ≥ 2 mục', () => {
    expect(checkFormat('- một\n- hai', { kind: 'list' })).toBe(true);
    expect(checkFormat('1. một\n2) hai', { kind: 'list' })).toBe(true);
    expect(checkFormat('- chỉ một', { kind: 'list' })).toBe(false);
  });

  it('cụm từ bắt buộc, không phân biệt hoa thường; cụm rỗng bị bỏ qua', () => {
    expect(checkFormat('Kết Luận: ổn', { kind: 'none', requiredPhrases: ['kết luận', ' '] })).toBe(true);
    expect(checkFormat('ổn', { kind: 'none', requiredPhrases: ['kết luận'] })).toBe(false);
    expect(hasFormatCheck({ kind: 'none', requiredPhrases: ['  '] })).toBe(false);
    expect(hasFormatCheck({ kind: 'none', requiredPhrases: ['x'] })).toBe(true);
  });
});

describe('percentile', () => {
  it('nearest-rank', () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([5, 1, 3, 2, 4], 0.95)).toBe(5);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20);
  });
});

describe('profileModel', () => {
  const same = (text: string, latencyMs = 100) => ({ text, latencyMs });

  it('output giống nhau, đúng định dạng → Ổn định', () => {
    const p = profileModel(GEMINI_FLASH, [same('{"nhan":"tot"}'), same('{"nhan":"tot"}', 300), same('{"nhan":"tot"}', 200)], 'prompt', { kind: 'json' }, 'same');
    expect(p.verdict).toBe('stable');
    expect(p.consistency).toBe(100);
    expect(p.formatPassRate).toBe(1);
    expect(p.latencyMean).toBe(200);
    expect(p.latencyP95).toBe(300);
    expect(p.costPerRun).toBeGreaterThan(0);
  });

  it('sai định dạng nhiều → Giòn, ghi lần chạy sai', () => {
    const p = profileModel(GEMINI_FLASH, [same('{"a":1}'), same('không phải json'), same('cũng không')], 'p', { kind: 'json' }, 'same');
    expect(p.verdict).toBe('brittle');
    expect(p.formatFailures).toEqual([1, 2]);
    expect(p.reasons.join(' ')).toMatch(/33% output đúng định dạng/);
  });

  it("kỳ vọng 'diverse': output khác nhau không bị trừ", () => {
    const outs = [same('trăng sáng trên đồi cao'), same('gió thổi qua cánh đồng'), same('mưa rơi bên hiên nhà')];
    expect(profileModel(GEMINI_FLASH, outs, 'p', { kind: 'none' }, 'diverse').verdict).toBe('stable');
    expect(profileModel(GEMINI_FLASH, outs, 'p', { kind: 'none' }, 'same').verdict).toBe('brittle');
  });

  it('lỗi: > 20% → Giòn; tất cả lỗi → Giòn, không có số liệu', () => {
    const p = profileModel(GEMINI_FLASH, [same('a b'), { error: 'x' }, { error: 'y' }], 'p', { kind: 'none' }, 'same');
    expect(p.verdict).toBe('brittle');
    expect(p.errors).toBe(2);
    const all = profileModel(GEMINI_FLASH, [{ error: 'x' }], 'p', { kind: 'none' }, 'same');
    expect(all.verdict).toBe('brittle');
    expect(all.consistency).toBeNull();
    expect(all.reasons).toEqual(['Mọi lần chạy đều lỗi.']);
  });

  it('độ dài dao động vừa → Dao động', () => {
    const p = profileModel(GEMINI_FLASH, [same('a b c d e f'), same('a b c d e f g h i j k l')], 'p', { kind: 'none' }, 'diverse');
    expect(p.verdict).toBe('wobbly');
    expect(p.reasons).toContain('Độ dài output dao động.');
  });
});

describe('runWithConcurrency', () => {
  it('giữ thứ tự, không vượt giới hạn đồng thời', async () => {
    let active = 0;
    let peak = 0;
    const tasks = [30, 10, 20, 5].map((ms, i) => async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, ms));
      active--;
      return i;
    });
    expect(await runWithConcurrency(tasks, 2)).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
  });
});
