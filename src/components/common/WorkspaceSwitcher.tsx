import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DEFAULT_WORKSPACE_ID } from '../../context/WorkspaceContext';
import { confirmDialog } from './ConfirmDialog';

/**
 * Bộ chọn Workspace có CRUD: chọn / thêm / đổi tên / xoá.
 * Dùng ở sidebar desktop (mở rộng) và drawer mobile. Trạng thái thu gọn của
 * sidebar dùng nút cycle riêng trong App.tsx nên không qua component này.
 */
export const WorkspaceSwitcher: React.FC = () => {
  const {
    workspaces, activeWorkspaceId, setActiveWorkspaceId,
    createWorkspace, renameWorkspace, deleteWorkspace,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
        setCreating(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setEditingId(null); setCreating(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const startRename = (id: string, current: string) => {
    setEditingId(id);
    setDraftName(current);
    setCreating(false);
  };

  const commitRename = () => {
    if (editingId && draftName.trim()) renameWorkspace(editingId, draftName.trim());
    setEditingId(null);
  };

  const commitCreate = () => {
    if (newName.trim()) {
      createWorkspace(newName.trim());
      setNewName('');
      setCreating(false);
      setOpen(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (await confirmDialog({ message: `Xoá workspace "${name}"? Các template/dự án bên trong sẽ chuyển về workspace mặc định.`, danger: true, confirmText: 'Xoá' })) {
      deleteWorkspace(id);
    }
  };

  return (
    <div className="w-full" ref={rootRef}>
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Workspace</h3>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Workspace hiện tại: ${active?.name}. Mở danh sách workspace`}
          className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850"
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: active?.color || '#10b981' }} />
            <span className="truncate">{active?.name}</span>
          </span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div role="menu" aria-label="Danh sách workspace" className="absolute left-0 right-0 top-full z-[90] mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {workspaces.map((w) => (
              <div key={w.id} className="group flex items-center gap-1">
                {editingId === w.id ? (
                  <div className="flex w-full items-center gap-1 p-1">
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                      className="w-full rounded-lg border border-emerald-400 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none dark:bg-slate-950 dark:text-slate-200"
                    />
                    <button onClick={commitRename} className="rounded-md p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Lưu"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Huỷ"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setActiveWorkspaceId(w.id); setOpen(false); }}
                      className={`flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                        w.id === activeWorkspaceId ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: w.color || '#94a3b8' }} />
                      <span className="flex-1 truncate">{w.name}</span>
                      {w.id === activeWorkspaceId && <Check size={13} className="shrink-0" />}
                    </button>
                    <button onClick={() => startRename(w.id, w.name)} className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-800" title="Đổi tên"><Pencil size={13} /></button>
                    {w.id !== DEFAULT_WORKSPACE_ID && (
                      <button onClick={() => handleDelete(w.id, w.name)} className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-950/30" title="Xoá"><Trash2 size={13} /></button>
                    )}
                  </>
                )}
              </div>
            ))}

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            {creating ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  autoFocus
                  value={newName}
                  placeholder="Tên workspace mới…"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
                  className="w-full rounded-lg border border-emerald-400 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none dark:bg-slate-950 dark:text-slate-200"
                />
                <button onClick={commitCreate} className="rounded-md p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Tạo"><Check size={14} /></button>
                <button onClick={() => { setCreating(false); setNewName(''); }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Huỷ"><X size={14} /></button>
              </div>
            ) : (
              <button
                onClick={() => { setCreating(true); setEditingId(null); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                <FolderPlus size={14} />
                Workspace mới
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSwitcher;
