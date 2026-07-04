import { describe, expect, it } from 'vitest';
import {
  BAKEOFF_LS_KEY, MAX_BAKEOFF_ENTRIES,
  bakeoffCsvFileName, clearBakeoffHistory, entryToCsv, loadBakeoffHistory, pushBakeoffEntry,
} from '../utils/bakeoffHistory';
import type { BakeoffEntry } from '../utils/bakeoffHistory';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

const entry = (id: string): BakeoffEntry => ({
  id,
  at: '2026-07-03T08:30:00.000Z',
  prompt: 'Bạn là chuyên gia tóm tắt.',
  input: 'Văn bản thử',
  criteria: ['Đúng trọng tâm'],
  results: [
    { model: 'gemini-2.5-flash', score: 82, latencyMs: 1234.6, costUSD: 0.000123 },
    { model: 'llama-3.1-8b-instant', error: 'Lỗi, có "ngoặc kép"' },
  ],
});

describe('pushBakeoffEntry / loadBakeoffHistory', () => {
  it('mới nhất đứng đầu, giữ tối đa cap', () => {
    const storage = fakeStorage();
    for (let i = 0; i < MAX_BAKEOFF_ENTRIES + 3; i++) pushBakeoffEntry(entry(`e${i}`), storage);
    const all = loadBakeoffHistory(storage);
    expect(all).toHaveLength(MAX_BAKEOFF_ENTRIES);
    expect(all[0].id).toBe(`e${MAX_BAKEOFF_ENTRIES + 2}`);
  });

  it('cắt prompt/input quá dài trước khi lưu', () => {
    const storage = fakeStorage();
    pushBakeoffEntry({ ...entry('big'), prompt: 'x'.repeat(5000), input: 'y'.repeat(3000) }, storage);
    const saved = loadBakeoffHistory(storage)[0];
    expect(saved.prompt).toHaveLength(2000);
    expect(saved.input).toHaveLength(1000);
  });

  it('dữ liệu hỏng trả mảng rỗng; clear xoá sạch', () => {
    expect(loadBakeoffHistory(fakeStorage({ [BAKEOFF_LS_KEY]: 'oops' }))).toEqual([]);
    const storage = fakeStorage();
    pushBakeoffEntry(entry('a'), storage);
    clearBakeoffHistory(storage);
    expect(loadBakeoffHistory(storage)).toEqual([]);
  });
});

describe('entryToCsv', () => {
  it('đúng header, escape ngoặc kép, làm tròn latency', () => {
    const csv = entryToCsv(entry('e1'));
    const lines = csv.split('\n');
    expect(lines[0]).toBe('model,score,latency_ms,cost_usd_per_run,error');
    expect(lines[1]).toBe('gemini-2.5-flash,82,1235,0.000123,');
    expect(lines[2]).toContain('"Lỗi, có ""ngoặc kép"""');
  });

  it('tên file theo thời điểm chạy', () => {
    expect(bakeoffCsvFileName(entry('e1'))).toBe('bakeoff-2026-07-03-08-30.csv');
  });
});
