/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal chọn một PromptTemplate trong thư viện để nạp vào Node hiện tại.
 * Tách ra khỏi ProjectChainTab (vốn quá lớn) — chỉ nhận dữ liệu/callback qua props,
 * không giữ state riêng để hành vi giữ nguyên 100%.
 */
import React from 'react';
import { Upload, X } from 'lucide-react';
import { PromptTemplate } from '../../types';

interface ImportTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  templates: PromptTemplate[];
  onSelectTemplate: (template: PromptTemplate) => void;
}

export function ImportTemplateModal({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  templates,
  onSelectTemplate,
}: ImportTemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-left max-h-[80vh]"
      >
        <div className="px-5 py-4 border-b border-slate-250 dark:border-slate-855 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-cyan-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Nạp mẫu Prompt vào Node</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm mẫu theo tên hoặc mô tả..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {templates.length === 0 ? (
            <p className="text-xs italic text-slate-400 text-center py-8">Không tìm thấy mẫu phù hợp.</p>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => onSelectTemplate(tpl)}
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950/40 hover:border-cyan-400 dark:hover:border-cyan-600 p-3 transition-colors cursor-pointer"
              >
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{tpl.title}</span>
                <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{tpl.description}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
