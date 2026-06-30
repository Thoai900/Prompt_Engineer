import React, { useEffect, useRef, useState } from 'react';
import { Check, Drama, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useWorkspace, isPresetPersona } from '../../context/WorkspaceContext';
import { confirmDialog } from './ConfirmDialog';

interface PersonaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Quản lý Persona toàn cục: chọn persona đang active + CRUD persona tuỳ chỉnh.
 * Persona đang active được chèn làm system instruction ở mọi luồng chạy AI.
 */
export const PersonaManagerModal: React.FC<PersonaManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    personas, activePersonaId, setActivePersonaId,
    createPersona, updatePersona, deletePersona,
  } = useWorkspace();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Đóng bằng phím Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Đưa focus vào hộp thoại khi mở (cho người dùng bàn phím / screen reader).
  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => { setEditingId(null); setFormName(''); setFormInstructions(''); };

  const startCreate = () => { setEditingId('__new__'); setFormName(''); setFormInstructions(''); };
  const startEdit = (id: string, name: string, instructions: string) => {
    setEditingId(id); setFormName(name); setFormInstructions(instructions);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    if (editingId === '__new__') {
      await createPersona({ name: formName.trim(), systemInstructions: formInstructions });
    } else if (editingId) {
      await updatePersona(editingId, { name: formName.trim(), systemInstructions: formInstructions });
    }
    resetForm();
  };

  const handleDelete = async (id: string, name: string) => {
    if (await confirmDialog({ message: `Xoá persona "${name}"?`, danger: true, confirmText: 'Xoá' })) {
      await deletePersona(id);
      if (editingId === id) resetForm();
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-955/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-modal-title"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200/50 bg-white/90 p-6 text-slate-900 shadow-2xl backdrop-blur-md outline-none dark:border-slate-800/50 dark:bg-slate-900/90 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Drama size={20} />
            </div>
            <h3 id="persona-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Quản lý Persona</h3>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Đóng"><X size={18} /></button>
        </div>
        <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
          Persona đang chọn sẽ được chèn làm chỉ dẫn hệ thống cho mọi lần chạy AI (Builder, Enhancer, Project Chain).
        </p>

        {isEditing ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Tên persona</label>
              <input
                autoFocus
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Vd: Senior Coder"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-850 dark:bg-slate-955 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Chỉ dẫn hệ thống (System Instructions)</label>
              <textarea
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                rows={6}
                placeholder="Bạn là một kỹ sư phần mềm cấp cao. Ưu tiên TypeScript, trả lời súc tích…"
                className="min-h-[120px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-slate-850 dark:bg-slate-955 dark:text-slate-200"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={resetForm} className="rounded-lg border border-transparent px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Huỷ</button>
              <button
                onClick={handleSave}
                disabled={!formName.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
              >
                <Save size={14} />
                {editingId === '__new__' ? 'Tạo persona' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1">
              {/* Tuỳ chọn: không dùng persona */}
              <button
                onClick={() => setActivePersonaId('')}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                  activePersonaId === '' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">—</span>
                <span className="flex-1 text-sm font-semibold text-slate-600 dark:text-slate-300">Không dùng persona</span>
                {activePersonaId === '' && <Check size={16} className="text-emerald-500" />}
              </button>

              {personas.map((p) => {
                const preset = isPresetPersona(p.id);
                const isActive = activePersonaId === p.id;
                return (
                  <div key={p.id} className={`group flex items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-colors ${isActive ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <button onClick={() => setActivePersonaId(p.id)} className="flex flex-1 items-center gap-3 text-left">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10 text-violet-500"><Drama size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {p.name}
                          {preset && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">Preset</span>}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">{p.systemInstructions}</span>
                      </span>
                      {isActive && <Check size={16} className="shrink-0 text-emerald-500" />}
                    </button>
                    {!preset && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button onClick={() => startEdit(p.id, p.name, p.systemInstructions)} className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-700" title="Sửa"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-950/30" title="Xoá"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={startCreate}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-violet-600 dark:hover:text-violet-400"
            >
              <Plus size={15} />
              Tạo persona mới
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PersonaManagerModal;
