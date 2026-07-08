import React, { useEffect, useState } from 'react';
import { PromptTemplate } from '../../types';
import { TemplateCollection } from '../../utils/collections';
import { X, FolderPlus, Check, Plus } from 'lucide-react';
import { toast } from '../common/Toaster';

interface AddToCollectionModalProps {
  isOpen: boolean;
  template: PromptTemplate | null;
  collections: TemplateCollection[];
  onToggle: (collectionId: string, templateId: string) => void;
  onCreate: (name: string) => TemplateCollection | null;
  onClose: () => void;
}

export default function AddToCollectionModal({
  isOpen,
  template,
  collections,
  onToggle,
  onCreate,
  onClose,
}: AddToCollectionModalProps) {
  const [newName, setNewName] = useState('');

  // a11y: Escape để đóng.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setNewName('');
  }, [isOpen, template?.id]);

  if (!isOpen || !template) return null;

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const created = onCreate(name);
    if (created) {
      onToggle(created.id, template.id);
      toast.success(`Đã tạo "${created.name}" và thêm template.`);
      setNewName('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:w-[440px] max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Thêm vào bộ sưu tập"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">Thêm vào bộ sưu tập</h3>
              <p className="text-[11px] text-slate-400 font-medium line-clamp-1">{template.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {collections.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium text-center py-6">
              Chưa có bộ sưu tập nào. Tạo bộ sưu tập đầu tiên bên dưới.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {collections.map((c) => {
                const inside = c.templateIds.includes(template.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => onToggle(c.id, template.id)}
                    aria-pressed={inside}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                      inside
                        ? 'border-indigo-200 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-700 line-clamp-1">{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{c.templateIds.length} mẫu</div>
                    </div>
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border ${
                        inside ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="Tên bộ sưu tập mới..."
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Tạo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
