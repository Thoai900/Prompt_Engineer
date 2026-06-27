import React from 'react';
import { X, Layers, Wand2 } from 'lucide-react';
import StepNarrator from '../../common/StepNarrator';

interface QuickPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickPromptTopic: string;
  setQuickPromptTopic: (topic: string) => void;
  isGeneratingQuickPrompt: boolean;
  onConfirmGenerate: () => void;
  hasBlocks: boolean;
}

export const QuickPromptModal: React.FC<QuickPromptModalProps> = ({
  isOpen,
  onClose,
  quickPromptTopic,
  setQuickPromptTopic,
  isGeneratingQuickPrompt,
  onConfirmGenerate,
  hasBlocks,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div
        className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg border border-slate-200/50 dark:border-slate-800/50 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {isGeneratingQuickPrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <StepNarrator flowKey="quick-fill" isActive={isGeneratingQuickPrompt} placement="overlay" className="w-72 max-w-[90%]" />
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Wand2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tự động hoàn thiện</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bơm nội dung thông minh vào các khối hiện có</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-550 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            disabled={isGeneratingQuickPrompt}
          >
            <X size={18} />
          </button>
        </div>

        {!hasBlocks ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
              <Layers size={32} />
            </div>
            <h3 className="text-slate-800 dark:text-slate-200 font-bold mb-2">Chưa có khối nào</h3>
            <p className="text-slate-500 dark:text-slate-455 text-sm mb-6 leading-relaxed">
              Vui lòng thêm hoặc kéo thả các khối vào Workshop trước khi sử dụng tính năng này.
            </p>
            <button 
              onClick={onClose}
              className="px-6 py-2 text-sm font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-202 rounded-lg transition-colors cursor-pointer active:scale-95"
            >
              Đã hiểu
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-2 block">
                  Chủ đề / Yêu cầu
                </label>
                <textarea 
                  value={quickPromptTopic}
                  onChange={e => setQuickPromptTopic(e.target.value)}
                  placeholder="Vd: Viết email xin việc chuyên nghiệp, Lên kịch bản video TikTok viral..."
                  className="w-full text-sm py-3 px-4 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 resize-none min-h-[100px]"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-2 block">
                  Gợi ý nhanh
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Viết email xin việc chuyên nghiệp", "Lên kịch bản video TikTok", "Lập kế hoạch Digital Marketing", "Giải bài toán lập trình"].map((suggestion, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setQuickPromptTopic(suggestion)}
                      className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer active:scale-[0.98]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
                disabled={isGeneratingQuickPrompt}
              >
                Hủy
              </button>
              <button 
                onClick={onConfirmGenerate}
                disabled={!quickPromptTopic.trim() || isGeneratingQuickPrompt}
                className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg transition-all shadow-md shadow-violet-900/10 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                {isGeneratingQuickPrompt ? (
                  <>
                    <Wand2 size={16} className="animate-pulse" />
                    Đang bơm nội dung...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} /> Bắt đầu hoàn thiện
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
