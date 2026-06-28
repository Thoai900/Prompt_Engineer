/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawer lịch sử phiên bản của một dự án: liệt kê phiên bản, cho khôi phục và
 * xem diff so với nội dung hiện tại. Tách khỏi ProjectChainTab — prop-driven,
 * không giữ state riêng nên hành vi giữ nguyên.
 */
import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Clock, X } from 'lucide-react';
import { PromptVersion } from '../../types';
import { computeUnifiedDiff } from '../../utils/chainUtils';

interface VersionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  versions: PromptVersion[];
  selectedVersion: PromptVersion | null;
  onSelectVersion: (version: PromptVersion | null) => void;
  onRestore: (version: PromptVersion) => void;
  /** Nội dung hiện tại để so sánh diff với phiên bản được chọn. */
  currentContent: string;
}

export function VersionDrawer({
  isOpen,
  onClose,
  versions,
  selectedVersion,
  onSelectVersion,
  onRestore,
  currentContent,
}: VersionDrawerProps) {
  const handleClose = () => {
    onClose();
    onSelectVersion(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-850 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 text-slate-800 dark:text-slate-100"
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-855 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-violet-600 dark:text-violet-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-355">Lịch sử phiên bản</h3>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              {versions.length === 0 ? (
                <div className="m-auto text-center py-12 text-slate-400 my-auto">
                  <Clock size={24} className="mx-auto opacity-30 mb-2" />
                  <p className="text-xs">Chưa có lịch sử phiên bản nào được ghi nhận.</p>
                </div>
              ) : (
                <>
                  {/* Version List */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Danh sách phiên bản ({versions.length})</span>
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar p-0.5">
                      {versions.map((ver) => {
                        const isSelected = selectedVersion?.id === ver.id;
                        return (
                          <div
                            key={ver.id}
                            onClick={() => onSelectVersion(ver)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 relative group
                              ${isSelected
                                ? 'bg-violet-50 dark:bg-violet-955/15 border-violet-400 dark:border-violet-500/50'
                                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800'}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200">
                                {new Date(ver.timestamp).toLocaleString()}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRestore(ver);
                                }}
                                className="py-1 px-2.5 bg-violet-600 dark:bg-violet-650 hover:bg-violet-500 text-white text-[9.5px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Khôi phục
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed font-semibold">
                              {ver.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Diff Viewer panel */}
                  {selectedVersion && (
                    <div className="flex-1 flex flex-col gap-2 min-h-[250px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
                        So sánh khác biệt (So với Hiện tại)
                      </span>
                      <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-y-auto custom-scrollbar font-mono text-[10px] text-left select-text whitespace-pre-wrap leading-relaxed">
                        {computeUnifiedDiff(selectedVersion.content, currentContent).map((line, idx) => {
                          if (line.type === 'added') {
                            return (
                              <div key={idx} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 border-l-2 border-emerald-500/50">
                                + {line.text}
                              </div>
                            );
                          } else if (line.type === 'removed') {
                            return (
                              <div key={idx} className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1 border-l-2 border-rose-500/50 line-through">
                                - {line.text}
                              </div>
                            );
                          } else {
                            return (
                              <div key={idx} className="text-slate-500 dark:text-slate-400 px-1">
                                &nbsp;&nbsp;{line.text}
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
