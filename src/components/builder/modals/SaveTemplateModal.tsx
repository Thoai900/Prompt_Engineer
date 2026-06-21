import React from 'react';
import { Save } from 'lucide-react';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSave: () => void;
  templateTitle: string;
  setTemplateTitle: (title: string) => void;
  templateDesc: string;
  setTemplateDesc: (desc: string) => void;
  templateLanguage: string;
  setTemplateLanguage: (lang: string) => void;
  templateTags: string;
  setTemplateTags: (tags: string) => void;
  isPublicTemplate: boolean;
  setIsPublicTemplate: (isPublic: boolean) => void;
}

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  isOpen,
  onClose,
  onConfirmSave,
  templateTitle,
  setTemplateTitle,
  templateDesc,
  setTemplateDesc,
  templateLanguage,
  setTemplateLanguage,
  templateTags,
  setTemplateTags,
  isPublicTemplate,
  setIsPublicTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
        <h3 className="text-xl font-bold mb-1 text-slate-800 dark:text-slate-100">Lưu Template Mới</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Template của bạn sẽ được lưu vào Thư viện riêng và có thể tái sử dụng bất cứ lúc nào.
        </p>

        <div className="flex flex-col gap-4 mb-8">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 block">
              Tên Template
            </label>
            <input
              type="text"
              value={templateTitle}
              onChange={e => setTemplateTitle(e.target.value)}
              placeholder="Vd: Template Chuyên gia Tối ưu SEO"
              className="w-full text-sm py-2 px-3 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-650"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 block">
              Mô tả (Không bắt buộc)
            </label>
            <textarea
              value={templateDesc}
              onChange={e => setTemplateDesc(e.target.value)}
              placeholder="Mô tả cụ thể mục đích của template này..."
              className="w-full text-sm py-2 px-3 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 min-h-[60px] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Ngôn ngữ</label>
              <select
                value={templateLanguage}
                onChange={e => setTemplateLanguage(e.target.value)}
                className="w-full text-sm py-2 px-3 border border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-colors bg-slate-950 text-slate-200"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Tags (phẩy để tách)
              </label>
              <input
                type="text"
                value={templateTags}
                onChange={e => setTemplateTags(e.target.value)}
                placeholder="vd: seo, marketing"
                className="w-full text-sm py-2 px-3 border border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-colors bg-slate-950 text-slate-200 placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublicToggle"
                checked={isPublicTemplate}
                onChange={e => setIsPublicTemplate(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-800 text-violet-650 focus:ring-violet-550"
              />
              <label htmlFor="isPublicToggle" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                Chia sẻ template này công khai với mọi người
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={onConfirmSave}
            className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-colors shadow-md shadow-violet-900/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Save size={14} />
            Lưu template
          </button>
        </div>
      </div>
    </div>
  );
};
