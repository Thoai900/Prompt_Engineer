// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookmarks } from '../hooks/useBookmarks';
import { PromptTemplate } from '../types';

const tpl = (id: string) => ({ id, title: id, description: '', blocks: [] } as PromptTemplate);

beforeEach(() => localStorage.clear());

describe('useBookmarks (đăng xuất → localStorage)', () => {
  it('khởi tạo rỗng khi chưa lưu gì', () => {
    const { result } = renderHook(() => useBookmarks(null));
    expect(result.current.savedIds.size).toBe(0);
    expect(result.current.isSaved('x')).toBe(false);
  });

  it('toggleSave thêm rồi bỏ, đồng bộ localStorage', async () => {
    const { result } = renderHook(() => useBookmarks(null));

    await act(async () => { await result.current.toggleSave(tpl('a')); });
    expect(result.current.isSaved('a')).toBe(true);
    expect(JSON.parse(localStorage.getItem('pb_bookmarks')!)).toEqual(['a']);

    await act(async () => { await result.current.toggleSave(tpl('a')); });
    expect(result.current.isSaved('a')).toBe(false);
    expect(JSON.parse(localStorage.getItem('pb_bookmarks')!)).toEqual([]);
  });

  it('nạp sẵn từ localStorage có sẵn', () => {
    localStorage.setItem('pb_bookmarks', JSON.stringify(['b', 'c']));
    const { result } = renderHook(() => useBookmarks(null));
    expect(result.current.isSaved('b')).toBe(true);
    expect(result.current.isSaved('c')).toBe(true);
    expect(result.current.isSaved('a')).toBe(false);
  });

  it('lưu nhiều template độc lập', async () => {
    const { result } = renderHook(() => useBookmarks(null));
    await act(async () => { await result.current.toggleSave(tpl('a')); });
    await act(async () => { await result.current.toggleSave(tpl('b')); });
    expect(result.current.savedIds.size).toBe(2);
    expect(result.current.isSaved('a')).toBe(true);
    expect(result.current.isSaved('b')).toBe(true);
  });
});
