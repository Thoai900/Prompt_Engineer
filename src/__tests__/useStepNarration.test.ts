// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStepNarration } from '../hooks/useStepNarration';
import type { NarrativeScript } from '../utils/generationNarratives';
import { Sparkles } from 'lucide-react';

const script: NarrativeScript = {
  accent: 'violet',
  steps: [
    { icon: Sparkles, label: 'Bước 1', durationMs: 1000 },
    { icon: Sparkles, label: 'Bước 2', durationMs: 1000 },
    { icon: Sparkles, label: 'Bước 3', durationMs: 1000 },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  // Mặc định: không bật reduced-motion.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useStepNarration', () => {
  it('bắt đầu ở bước 0 khi active', () => {
    const { result } = renderHook(() => useStepNarration(script, true));
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.step?.label).toBe('Bước 1');
    expect(result.current.isComplete).toBe(false);
  });

  it('tăng bước theo thời gian', () => {
    const { result } = renderHook(() => useStepNarration(script, true));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.stepIndex).toBe(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.stepIndex).toBe(2);
  });

  it('giữ bước cuối, không tràn mảng khi vẫn active', () => {
    const { result } = renderHook(() => useStepNarration(script, true));
    // Tiến từng nhịp (passive effect lên lịch timer kế sau mỗi lần render).
    for (let i = 0; i < 5; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    expect(result.current.stepIndex).toBe(2);
    expect(result.current.step?.label).toBe('Bước 3');
    expect(result.current.progress).toBe(1);
  });

  it('ẩn step và báo streamStarted khi chunk đầu về', () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: boolean }) => useStepNarration(script, true, { streamStarted: s }),
      { initialProps: { s: false } }
    );
    expect(result.current.step).not.toBeNull();
    rerender({ s: true });
    expect(result.current.step).toBeNull();
  });

  it('phát nhịp Hoàn tất rồi về idle khi tắt active', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useStepNarration(script, active),
      { initialProps: { active: true } }
    );
    rerender({ active: false });
    expect(result.current.isComplete).toBe(true);
    act(() => { vi.advanceTimersByTime(900); });
    expect(result.current.isComplete).toBe(false);
    expect(result.current.step).toBeNull();
  });

  it('không chạy timer tăng bước khi reduced-motion', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;
    const { result } = renderHook(() => useStepNarration(script, true));
    expect(result.current.reducedMotion).toBe(true);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.stepIndex).toBe(0);
  });
});
