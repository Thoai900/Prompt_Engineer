import React from 'react';
import { Wand2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { GhostTextInput } from '../common/GhostTextInput';
import StepNarrator from '../common/StepNarrator';

interface EmptyStateGeneratorProps {
  value: string;
  onValueChange: (next: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
  onRetry?: () => void;
}

const IDEA_SUGGESTIONS = [
  'Viết email xin việc chuyên nghiệp',
  'Lên kịch bản video TikTok viral',
  'Lập kế hoạch Digital Marketing',
  'Giải bài toán lập trình bằng Python',
];

/**
 * Empty-state của canvas Builder: nhập một câu ý tưởng → sinh khung multi-block
 * đổ thẳng vào canvas. Thuần trình bày — mọi logic AI nằm ở BuilderTab.
 */
export const EmptyStateGenerator: React.FC<EmptyStateGeneratorProps> = ({
  value,
  onValueChange,
  onGenerate,
  isGenerating,
  error,
  onRetry,
}) => {
  const canGenerate = value.trim().length > 0 && !isGenerating;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canGenerate) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="p-6 md:p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-5 py-12 mt-4 text-center">
      {isGenerating ? (
        <StepNarrator
          flowKey="quick-fill"
          isActive={isGenerating}
          placement="inline"
          className="w-80 max-w-full"
        />
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Wand2 size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Bắt đầu từ một ý tưởng
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Mô tả một câu, AI sẽ dựng khung Multi-block (Vai trò · Nhiệm vụ · Ràng buộc · Định dạng)
              và đổ thẳng vào canvas để bạn chỉnh sửa.
            </p>
          </div>

          <div className="w-full max-w-lg flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1 flex items-center bg-slate-50/50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-xl focus-within:ring-2 focus-within:ring-violet-500/40 focus-within:border-violet-500 transition-colors">
              <Sparkles className="absolute left-3 w-4 h-4 text-slate-400 dark:text-slate-550 pointer-events-none" />
              <GhostTextInput
                type="text"
                ghostMode="prose"
                placeholder="Bạn muốn tạo prompt để giải quyết bài toán gì?..."
                value={value}
                onValueChange={onValueChange}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                className="w-full pl-9 pr-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 focus:outline-none"
              />
            </div>
            <button
              onClick={onGenerate}
              disabled={!canGenerate}
              className="shrink-0 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-md shadow-violet-900/10 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <Wand2 size={15} /> Tạo prompt
            </button>
          </div>

          {error && (
            <div className="w-full max-w-lg p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{error}</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-colors cursor-pointer active:scale-95"
                >
                  <RefreshCw size={12} /> Thử lại
                </button>
              )}
            </div>
          )}

          <div className="w-full max-w-lg flex flex-wrap gap-2 justify-center">
            {IDEA_SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onValueChange(suggestion)}
                className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer active:scale-[0.98]"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full max-w-lg text-[11px] font-semibold text-slate-400 dark:text-slate-550 uppercase tracking-wider select-none">
            <span className="flex-1 h-px bg-slate-200 dark:bg-slate-850" />
            hoặc kéo thả khối từ cột trái
            <span className="flex-1 h-px bg-slate-200 dark:bg-slate-850" />
          </div>
        </>
      )}
    </div>
  );
};
