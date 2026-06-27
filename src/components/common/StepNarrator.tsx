import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';
import {
  GENERATION_NARRATIVES, ACCENT_CLASSES, type GenerationFlowKey,
} from '../../utils/generationNarratives';
import { useStepNarration } from '../../hooks/useStepNarration';

export interface StepNarratorProps {
  flowKey: GenerationFlowKey;
  isActive: boolean;
  placement: 'overlay' | 'inline' | 'compact';
  /** Luồng có streaming: chunk đầu đã về → ẩn narrator nhường cho text thật. */
  streamStarted?: boolean;
  className?: string;
}

const DONE_LABEL = 'Hoàn tất';

export const StepNarrator: React.FC<StepNarratorProps> = ({
  flowKey,
  isActive,
  placement,
  streamStarted = false,
  className = '',
}) => {
  const script = GENERATION_NARRATIVES[flowKey];
  const accent = ACCENT_CLASSES[script.accent];
  const { stepIndex, step, progress, isComplete, reducedMotion } = useStepNarration(
    script, isActive, { streamStarted }
  );

  const visible = step !== null || isComplete;
  const Icon = isComplete ? Check : step?.icon;
  const label = isComplete ? DONE_LABEL : step?.label ?? '';
  const hint = isComplete ? undefined : step?.hint;
  const orbAnim = !reducedMotion && !isComplete ? 'animate-[orb-breathe_2.2s_ease-in-out_infinite]' : '';

  // ── COMPACT: nhúng trong nút, tối giản ──
  if (placement === 'compact') {
    return (
      <AnimatePresence mode="wait">
        {visible && Icon && (
          <motion.span
            key={isComplete ? 'done' : stepIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={`inline-flex items-center gap-1.5 ${className}`}
          >
            <Icon size={11} className={reducedMotion || isComplete ? '' : 'animate-pulse'} />
            <span className="whitespace-nowrap">{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    );
  }

  // ── INLINE: dải mảnh trong block / ô chat ──
  if (placement === 'inline') {
    return (
      <AnimatePresence>
        {visible && Icon && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex items-center gap-2.5 overflow-hidden rounded-xl border ${accent.border} ${accent.bg} px-3 py-2 ${className}`}
          >
            <span className={`shrink-0 ${accent.text} ${orbAnim}`}>
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isComplete ? 'done' : stepIndex}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                  className={`text-[11px] font-bold ${accent.text} truncate`}
                >
                  {label}
                </motion.div>
              </AnimatePresence>
              {/* Shimmer line gợi cảm giác đang xử lý */}
              {!isComplete && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800/60">
                  {reducedMotion ? (
                    <div className={`h-full ${accent.bar} rounded-full transition-all duration-500`} style={{ width: `${Math.max(progress * 100, 12)}%` }} />
                  ) : (
                    <div className={`h-full w-1/3 ${accent.bar} rounded-full animate-[shimmer-sweep_1.6s_linear_infinite]`} />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── OVERLAY: thẻ đầy đủ có tường thuật + progress + danh sách bước ──
  return (
    <AnimatePresence>
      {visible && Icon && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`flex flex-col items-center gap-4 rounded-2xl border ${accent.border} bg-panel/80 p-6 text-center shadow-lg ${accent.glow} backdrop-blur-md ${className}`}
        >
          <div className={`flex h-14 w-14 items-center justify-center rounded-full border ${accent.border} ${accent.bg} ${accent.text} ${orbAnim}`}>
            <Icon size={26} className={isComplete ? '' : reducedMotion ? '' : 'animate-pulse'} />
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <AnimatePresence mode="wait">
              <motion.span
                key={isComplete ? 'done' : stepIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className={`text-sm font-bold ${accent.text}`}
              >
                {label}
              </motion.span>
            </AnimatePresence>
            {hint && (
              <span className="text-[11px] font-medium text-muted">{hint}</span>
            )}

            {/* Progress bar */}
            <div className="mx-auto mt-2 h-1.5 w-44 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800/70">
              <div
                className={`h-full ${accent.bar} rounded-full transition-all duration-700 ease-out`}
                style={{ width: isComplete ? '100%' : `${Math.max(progress * 100, 10)}%` }}
              />
            </div>
          </div>

          {/* Bước kế tiếp (mờ) */}
          {!isComplete && (
            <div className="flex items-center gap-1.5">
              {script.steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === stepIndex ? `w-5 ${accent.bar}` : i < stepIndex ? `w-1.5 ${accent.bar} opacity-50` : 'w-1.5 bg-slate-300/60 dark:bg-slate-700/60'
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StepNarrator;
