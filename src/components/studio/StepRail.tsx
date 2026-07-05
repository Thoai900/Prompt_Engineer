/**
 * "Xương sống dây chuyền" — chữ ký thị giác của Prompt Studio.
 * Rail dọc (desktop) / pill ngang (mobile): mỗi bước là một trạm lắp ráp,
 * đường nối lấp đầy gradient theo đóng góp THẬT của draft (stepDone),
 * kèm tóm tắt vi mô ("5 khối", "2 quy tắc"...). Bấm để nhảy bước tự do.
 */
import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { STUDIO_STEPS, StudioDraft, stepDone, stepSummary } from '../../utils/studioFlow';

interface StepRailProps {
  draft: StudioDraft;
  onSelect: (index: number) => void;
}

export function StepRailVertical({ draft, onSelect }: StepRailProps) {
  return (
    <nav aria-label="Các bước tạo prompt" className="flex flex-col">
      {STUDIO_STEPS.map((step, i) => {
        const done = stepDone(draft, step.key);
        const active = draft.currentStep === i;
        const summary = stepSummary(draft, step.key);
        const isLast = i === STUDIO_STEPS.length - 1;
        return (
          <div key={step.key} className="flex gap-3">
            {/* Cột trạm + đường nối */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => onSelect(i)}
                title={step.title}
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border text-xs font-bold transition-all ${
                  done
                    ? 'border-transparent bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-sm shadow-violet-500/25'
                    : active
                      ? 'border-violet-400/70 bg-panel text-ink ring-2 ring-violet-500/25'
                      : 'border-line bg-panel text-faint hover:text-muted'
                }`}
              >
                {done ? <Check size={15} strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
              </button>
              {!isLast && (
                <div className="relative my-1 w-px flex-1 min-h-8 bg-line">
                  <motion.div
                    className="absolute inset-x-0 top-0 w-px bg-gradient-to-b from-violet-500 to-cyan-500"
                    initial={false}
                    animate={{ height: done ? '100%' : '0%' }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                </div>
              )}
            </div>
            {/* Nhãn */}
            <button onClick={() => onSelect(i)} className={`cursor-pointer pb-6 text-left ${isLast ? 'pb-0' : ''}`}>
              <div className={`text-sm font-bold tracking-tight ${active ? 'text-ink' : done ? 'text-ink/80' : 'text-muted'}`}>
                {step.title}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-faint">
                {summary || step.subtitle}
              </div>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function StepRailHorizontal({ draft, onSelect }: StepRailProps) {
  return (
    <nav aria-label="Các bước tạo prompt" className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {STUDIO_STEPS.map((step, i) => {
        const done = stepDone(draft, step.key);
        const active = draft.currentStep === i;
        return (
          <button
            key={step.key}
            onClick={() => onSelect(i)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              active
                ? 'border-violet-400/60 bg-panel text-ink shadow-sm'
                : done
                  ? 'border-transparent bg-gradient-to-r from-violet-500/15 to-cyan-500/15 text-ink/80'
                  : 'border-line bg-panel/60 text-faint'
            }`}
          >
            {done
              ? <Check size={12} strokeWidth={3} className="text-violet-500" />
              : <span className={active ? 'text-violet-500' : ''}>{i + 1}</span>}
            {step.title}
          </button>
        );
      })}
    </nav>
  );
}
