import { describe, expect, it } from 'vitest';
import {
  USAGE_RETENTION_DAYS, dayKey, estimateCostFromChars, loadUsage, recordUsage, summarizeUsage,
} from '../utils/usageStats';
import { GEMINI_FLASH, MODEL_COSTS } from '../config/models';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe('recordUsage / loadUsage', () => {
  it('cộng dồn lượt gọi theo ngày và model', () => {
    const storage = fakeStorage();
    const now = new Date('2026-07-02T08:00:00Z');
    recordUsage(GEMINI_FLASH, 400, 100, storage, now);
    recordUsage(GEMINI_FLASH, 600, 200, storage, now);
    const data = loadUsage(storage);
    expect(data[dayKey(now)][GEMINI_FLASH]).toEqual({ calls: 2, inChars: 1000, outChars: 300 });
  });

  it('cắt dữ liệu cũ hơn kỳ lưu trữ', () => {
    const storage = fakeStorage();
    const old = new Date('2026-05-01T08:00:00Z');
    const now = new Date('2026-07-02T08:00:00Z');
    recordUsage(GEMINI_FLASH, 100, 0, storage, old);
    recordUsage(GEMINI_FLASH, 100, 0, storage, now);
    const data = loadUsage(storage);
    expect(Object.keys(data)).toEqual([dayKey(now)]);
    expect(now.getTime() - old.getTime()).toBeGreaterThan(USAGE_RETENTION_DAYS * 86_400_000);
  });

  it('storage null / dữ liệu hỏng không ném lỗi', () => {
    expect(() => recordUsage(GEMINI_FLASH, 100, 0, null)).not.toThrow();
    expect(loadUsage(fakeStorage({ pb_usage_stats: 'not-json' }))).toEqual({});
  });
});

describe('estimateCostFromChars', () => {
  it('tính đúng theo bảng giá; model lạ trả 0', () => {
    const cost = MODEL_COSTS[GEMINI_FLASH];
    // 4tr ký tự vào = 1tr token vào; 4tr ký tự ra = 1tr token ra.
    expect(estimateCostFromChars(GEMINI_FLASH, 4_000_000, 4_000_000))
      .toBeCloseTo(cost.inputPer1M + cost.outputPer1M, 6);
    expect(estimateCostFromChars('model-la', 1000, 1000)).toBe(0);
  });
});

describe('summarizeUsage', () => {
  it('tổng hợp theo model và theo ngày (đủ số ngày, cũ → mới)', () => {
    const storage = fakeStorage();
    const now = new Date('2026-07-02T08:00:00Z');
    const yesterday = new Date('2026-07-01T08:00:00Z');
    recordUsage(GEMINI_FLASH, 400, 400, storage, yesterday);
    recordUsage(GEMINI_FLASH, 400, 400, storage, now);
    recordUsage('llama-3.1-8b-instant', 100, 100, storage, now);

    const s = summarizeUsage(loadUsage(storage), 7, now);
    expect(s.totalCalls).toBe(3);
    expect(s.perModel[0].model).toBe(GEMINI_FLASH); // nhiều lượt hơn đứng đầu
    expect(s.perDay).toHaveLength(7);
    expect(s.perDay[6]).toEqual({ date: dayKey(now), calls: 2 });
    expect(s.perDay[5]).toEqual({ date: dayKey(yesterday), calls: 1 });
    expect(s.totalCostUSD).toBeGreaterThan(0);
  });
});
