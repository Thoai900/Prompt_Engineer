import { describe, expect, it } from 'vitest';
import { LIKED_LS_KEY, isLikedLocally, loadLikedIds, toggleLikedLocally } from '../utils/likedTemplates';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe('likedTemplates', () => {
  it('toggle bật rồi tắt, trạng thái phản ánh đúng', () => {
    const storage = fakeStorage();
    expect(isLikedLocally('t1', storage)).toBe(false);
    expect(toggleLikedLocally('t1', storage)).toBe(true);
    expect(isLikedLocally('t1', storage)).toBe(true);
    expect(toggleLikedLocally('t1', storage)).toBe(false);
    expect(isLikedLocally('t1', storage)).toBe(false);
  });

  it('nhiều id độc lập nhau', () => {
    const storage = fakeStorage();
    toggleLikedLocally('a', storage);
    toggleLikedLocally('b', storage);
    toggleLikedLocally('a', storage);
    expect([...loadLikedIds(storage)]).toEqual(['b']);
  });

  it('dữ liệu hỏng / storage null không ném lỗi', () => {
    expect([...loadLikedIds(fakeStorage({ [LIKED_LS_KEY]: 'oops' }))]).toEqual([]);
    expect([...loadLikedIds(fakeStorage({ [LIKED_LS_KEY]: '[1,"x"]' }))]).toEqual(['x']);
    expect(loadLikedIds(null).size).toBe(0);
    expect(toggleLikedLocally('t', null)).toBe(true); // không persist nhưng không crash
  });
});
