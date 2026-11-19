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
  /** Có template của tôi đang mở → cho chọn cập nhật nó (giữ lịch sử) hay lưu thành template mới. */
  updateTarget?: { title: string; versionCount: number } | null;
  saveMode?: 'update' | 'new';
  setSaveMode?: (mode: 'update' | 'new') => void;
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
  updateTarget,
  saveMode = 'new',
  setSaveMode,
}) => {
  const isUpdate = !!updateTarget && saveMode === 'update';
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-3 border border-glass-edge rounded-2xl w-full max-w-md p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
        <h3 className="text-xl font-bold mb-1 text-slate-800 dark:text-slate-100">{isUpdate ? 'Cập nhật Template' : 'Lưu Template Mới'}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {isUpdate
            ? 'Bản đang có được giữ lại trong lịch sử phiên bản — xem và khôi phục được bất cứ lúc nào.'
            : 'Template của bạn sẽ được lưu vào Thư viện riêng và có thể tái sử dụng bất cứ lúc nào.'}
        </p>

        {updateTarget && setSaveMode && (
          <div className="mb-5 flex flex-col gap-2" role="radiogroup" aria-label="Cách lưu">
            {([
              ['update', `Cập nhật “${updateTarget.title}”`, `Giữ lịch sử phiên bản (đang có ${updateTarget.versionCount} bản trước).`],
              ['new', 'Lưu thành template mới', 'Tạo một bản sao riêng, template gốc không đổi.'],
            ] as const).map(([mode, label, hint]) => (
              <label key={mode} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs ${saveMode === mode ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                <input type="radio" name="saveMode" checked={saveMode === mode} onChange={() => setSaveMode(mode)} className="mt-0.5 accent-emerald-600" />
                <span>
                  <span className="block font-bold text-slate-700 dark:text-slate-200">{label}</span>
                  <span className="text-slate-500 dark:text-slate-400">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 mb-8">
          <div>
            <label className="text-xs font-bold text-slate-550 dark:text-slate-400 mb-1.5 block">
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
            <label className="text-xs font-bold text-slate-550 dark:text-slate-400 mb-1.5 block">
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
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Ngôn ngữ</label>
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
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">
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
            className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Save size={14} />
            {isUpdate ? 'Cập nhật template' : 'Lưu template'}
          </button>
        </div>
      </div>
    </div>
  );
};
