import React, { useState } from 'react';
import { Plus, LayoutGrid, Library, ChevronDown } from 'lucide-react';
import { AttrSlot } from '../../types';
import { ROOT_SLOTS, SLOT_COLORS, SLOT_LABELS } from '../../utils/graphCompile';

interface NodePaletteProps {
  onAddNode: (slot: AttrSlot) => void;
  onOpenImportTemplate: () => void;
  onAutoLayout: () => void;
  disabled?: boolean;
}

/**
 * Thanh công cụ nổi trên canvas: thêm node thuộc tính theo loại (tự cắm sẵn vào
 * Prompt Gốc), import từ Library, và auto-layout "Sắp xếp lại".
 */
export function NodePalette({ onAddNode, onOpenImportTemplate, onAutoLayout, disabled }: NodePaletteProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 select-none">
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={disabled}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-900/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <Plus size={14} />
            Thêm thuộc tính
            <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl border border-line/70 bg-[var(--color-panel,#fff)] dark:bg-slate-900 shadow-2xl p-1.5 z-50">
              {ROOT_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => { onAddNode(slot); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: SLOT_COLORS[slot] }} />
                  <span className="text-xs font-bold text-ink">{SLOT_LABELS[slot]}</span>
                  <span className="ml-auto text-[9px] text-faint font-semibold">tự cắm dây</span>
                </button>
              ))}
              <div className="my-1 border-t border-line/60" />
              <button
                onClick={() => { onOpenImportTemplate(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <Library size={13} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-ink">Từ thư viện Template…</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onAutoLayout}
          disabled={disabled}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-line/70 bg-[var(--color-panel,#fff)] dark:bg-slate-900 text-ink text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 hover:border-violet-400 disabled:opacity-50"
          title="Tự động sắp xếp các node theo cột, hết chồng lấp"
        >
          <LayoutGrid size={13} className="text-violet-500" />
          Sắp xếp lại
        </button>
      </div>
    </div>
  );
}
