import { describe, it, expect } from 'vitest';
import { RECENT_LS_KEY, loadRecentIds, recordRecentTemplate } from '../utils/recentTemplates';

function makeStorage(initial?: Record<string, string>) {
  const m = new Map<string, string>(Object.entries(initial || {}));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
}

describe('loadRecentIds', () => {
  it('rỗng khi chưa có gì', () => {
    expect(loadRecentIds(makeStorage())).toEqual([]);
  });

  it('rỗng khi JSON hỏng (không ném)', () => {
    expect(loadRecentIds(makeStorage({ [RECENT_LS_KEY]: '{bad' }))).toEqual([]);
  });

  it('lọc bỏ phần tử không phải chuỗi', () => {
    expect(loadRecentIds(makeStorage({ [RECENT_LS_KEY]: '["a",1,null,"b"]' }))).toEqual(['a', 'b']);
  });
});

describe('recordRecentTemplate', () => {
  it('đẩy id mới lên đầu', () => {
    const s = makeStorage({ [RECENT_LS_KEY]: '["a","b"]' });
    expect(recordRecentTemplate('c', s)).toEqual(['c', 'a', 'b']);
    expect(loadRecentIds(s)).toEqual(['c', 'a', 'b']);
  });

  it('khử trùng lặp — id đã có được đưa lên đầu', () => {
    const s = makeStorage({ [RECENT_LS_KEY]: '["a","b","c"]' });
    expect(recordRecentTemplate('c', s)).toEqual(['c', 'a', 'b']);
  });

  it('giữ tối đa 12 phần tử', () => {
    let s = makeStorage();
    for (let i = 0; i < 20; i++) recordRecentTemplate(`id-${i}`, s);
    const ids = loadRecentIds(s);
    expect(ids.length).toBe(12);
    expect(ids[0]).toBe('id-19'); // mới nhất ở đầu
  });

  it('id rỗng không thay đổi danh sách', () => {
    const s = makeStorage({ [RECENT_LS_KEY]: '["a"]' });
    expect(recordRecentTemplate('', s)).toEqual(['a']);
  });
});
