import { useEffect, useRef, useState } from 'react';
import type { NarrativeScript, NarrationStep } from '../utils/generationNarratives';

const DEFAULT_STEP_MS = 1500;
const DONE_BEAT_MS = 800;

export interface UseStepNarrationOpts {
  /** Khi luồng có streaming và chunk đầu đã về → narrator nhường chỗ cho text thật. */
  streamStarted?: boolean;
}

export interface StepNarrationState {
  stepIndex: number;
  step: NarrationStep | null;
  /** 0..1 ước lượng theo bước (bước cuối ≈ 1). */
  progress: number;
  /** true trong nhịp "Hoàn tất" ngắn sau khi isActive tắt. */
  isComplete: boolean;
  reducedMotion: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Điều phối "kể chuyện theo bước" cho một luồng sinh nội dung AI.
 *
 * - Khi `isActive` bật: chạy lần lượt các bước theo `durationMs`; tới bước cuối
 *   mà vẫn active thì GIỮ bước cuối (không tràn mảng, không đứng hình).
 * - Khi `streamStarted` bật: consumer dùng tín hiệu này để ẩn narrator.
 * - Khi `isActive` tắt: phát một nhịp `isComplete` ngắn rồi về idle (`step=null`).
 * - Tôn trọng `prefers-reduced-motion`.
 */
export function useStepNarration(
  script: NarrativeScript,
  isActive: boolean,
  opts: UseStepNarrationOpts = {}
): StepNarrationState {
  const { streamStarted = false } = opts;
  const steps = script.steps;

  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(prefersReducedMotion);

  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActiveRef = useRef(false);

  // Theo dõi prefers-reduced-motion realtime.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const clearStepTimer = () => {
    if (stepTimerRef.current) { clearTimeout(stepTimerRef.current); stepTimerRef.current = null; }
  };

  // Vòng đời chính: bắt đầu / dừng theo isActive.
  useEffect(() => {
    if (isActive) {
      // Bắt đầu một phiên mới.
      if (!wasActiveRef.current) {
        wasActiveRef.current = true;
        setIsComplete(false);
        setStepIndex(0);
        if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
      }
    } else if (wasActiveRef.current) {
      // Kết thúc phiên: phát nhịp "Hoàn tất".
      wasActiveRef.current = false;
      clearStepTimer();
      setIsComplete(true);
      doneTimerRef.current = setTimeout(() => setIsComplete(false), DONE_BEAT_MS);
    }
  }, [isActive]);

  // Tăng bước theo thời gian khi đang active và chưa nhường cho stream.
  useEffect(() => {
    clearStepTimer();
    if (!isActive || streamStarted || reducedMotion) return;
    if (stepIndex >= steps.length - 1) return; // giữ bước cuối

    const dur = steps[stepIndex]?.durationMs ?? DEFAULT_STEP_MS;
    stepTimerRef.current = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, dur);

    return clearStepTimer;
  }, [isActive, streamStarted, reducedMotion, stepIndex, steps]);

  // Dọn dẹp khi unmount.
  useEffect(() => () => {
    clearStepTimer();
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
  }, []);

  const showing = isActive && !streamStarted;
  const step = showing ? (steps[stepIndex] ?? null) : null;
  const progress = steps.length > 1 ? Math.min(stepIndex / (steps.length - 1), 1) : 1;

  return { stepIndex, step, progress, isComplete, reducedMotion };
}
