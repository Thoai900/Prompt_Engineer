import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Search, X } from 'lucide-react';
import { PromptTemplate } from '../../../types';

interface LibraryImportPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchTemplateQuery: string;
  setSearchTemplateQuery: (q: string) => void;
  filteredTemplates: PromptTemplate[];
  handleImportTemplateIntoNode: (tpl: PromptTemplate) => void;
}

export const LibraryImportPickerModal: React.FC<LibraryImportPickerModalProps> = ({
  isOpen,
  onClose,
  searchTemplateQuery,
  setSearchTemplateQuery,
  filteredTemplates,
  handleImportTemplateIntoNode,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
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
                <Database size={16} className="text-cyan-500" />
                Nạp Prompt từ thư viện mẫu
              </h3>
              <button 
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative my-3 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm mẫu prompt..."
                value={searchTemplateQuery}
                onChange={(e) => setSearchTemplateQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-955 dark:text-slate-300"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[300px]">
              {filteredTemplates.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Không tìm thấy mẫu phù hợp.</p>
              ) : (
                filteredTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => handleImportTemplateIntoNode(tpl)}
                    className="group cursor-pointer rounded-xl border border-slate-200/60 p-3 hover:border-cyan-500 hover:bg-cyan-500/5 dark:border-slate-800 dark:hover:border-cyan-500/30 transition-all text-xs"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-slate-900 group-hover:text-cyan-600 dark:text-slate-100 dark:group-hover:text-cyan-400 transition-colors">
                        {tpl.title}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-105 dark:bg-slate-800 dark:text-slate-500 px-1 rounded">
                        {tpl.category || 'Mẫu'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-455 dark:text-slate-450 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
