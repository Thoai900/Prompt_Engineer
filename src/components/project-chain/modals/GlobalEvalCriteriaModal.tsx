import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, X } from 'lucide-react';
import { PromptProject } from '../../../types';

interface GlobalEvalCriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: PromptProject | null;
  newCriteriaText: string;
  setNewCriteriaText: (t: string) => void;
  handleAddCriteria: (text: string) => void;
  handleDeleteCriteria: (idx: number) => void;
}

export const GlobalEvalCriteriaModal: React.FC<GlobalEvalCriteriaModalProps> = ({
  isOpen,
  onClose,
  activeProject,
  newCriteriaText,
  setNewCriteriaText,
  handleAddCriteria,
  handleDeleteCriteria,
}) => {
  return (
    <AnimatePresence>
      {isOpen && activeProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-955/50 backdrop-blur-xs"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Settings size={16} className="text-purple-500" />
                Quản lý Quy chuẩn Đánh giá Toàn cục
              </h3>
              <button 
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 my-4 pr-1 min-h-[200px]">
              <p className="text-[11px] text-slate-400 dark:text-slate-550 leading-normal">
                Các quy chuẩn này sẽ tự động được gửi kèm khi chạy thử nháp (Draft) với AI để đối chiếu và kiểm tra tính đúng đắn của prompt.
              </p>

              {(activeProject.globalEvalCriteria || []).length === 0 ? (
                <p className="text-xs italic text-slate-400 dark:text-slate-500 text-center py-6">Chưa cấu hình quy chuẩn đánh giá nào cho dự án này.</p>
              ) : (
                <div className="space-y-2">
                  {(activeProject.globalEvalCriteria || []).map((crit, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/50 p-2.5 dark:border-slate-850 dark:bg-slate-955/40 text-xs text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex-1 pr-3 leading-relaxed">{crit}</span>
                      <button
                        onClick={() => handleDeleteCriteria(idx)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                        title="Xóa quy chuẩn"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 dark:border-slate-800 flex gap-2 shrink-0">
              <input
                type="text"
                placeholder="Nhập quy chuẩn đánh giá mới (vd: Phải có ví dụ LaTeX...)"
                value={newCriteriaText}
                onChange={(e) => setNewCriteriaText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCriteria(newCriteriaText);
                }}
                className="flex-1 rounded-xl border border-slate-250 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-955 dark:text-slate-300"
              />
              <button
                onClick={() => handleAddCriteria(newCriteriaText)}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-550 transition-all cursor-pointer shadow-sm active:scale-95 text-[11px]"
              >
                Thêm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
