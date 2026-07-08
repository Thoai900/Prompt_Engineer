import React, { useState } from 'react';
import { Plus, LayoutGrid, Library, ChevronDown, ListOrdered, Globe } from 'lucide-react';
import { AttrSlot } from '../../types';
import { SLOT_COLORS, SLOT_LABELS } from '../../utils/graphCompile';
import { NODE_PRESETS } from '../../utils/graphPresets';

interface NodePaletteProps {
  onAddNode: (slot: AttrSlot) => void;
  onAddPresetNode: (presetId: string) => void;
  onAddFewShotNode: () => void;
  onAddWebNode: () => void;
  onOpenImportTemplate: () => void;
  onAutoLayout: () => void;
  disabled?: boolean;
}

/** Các loại node "Lõi" — xương sống của prompt. */
const CORE_SLOTS: AttrSlot[] = ['task', 'role', 'context'];
/** Các loại text tự do còn lại (khi không dùng preset). */
const FREE_TEXT_SLOTS: AttrSlot[] = ['format', 'tone', 'constraints', 'fix', 'custom'];

/**
 * Thanh công cụ nổi trên canvas (v3.2): menu Thêm node phân 4 nhóm —
 * Lõi (Task/Vai trò/Ngữ cảnh) · Tinh chỉnh (Modifier presets: chỉnh bằng
 * dropdown/slider, không cần viết) · Dữ liệu & Ví dụ (Few-Shot, Template) ·
 * Text tự do. Node mới tự cắm dây sẵn vào Prompt Gốc.
 */
export function NodePalette({
  onAddNode, onAddPresetNode, onAddFewShotNode, onAddWebNode, onOpenImportTemplate, onAutoLayout, disabled,
}: NodePaletteProps) {
  const [open, setOpen] = useState(false);

  const GroupLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="px-2.5 pt-2 pb-1 text-[9px] font-extrabold uppercase tracking-widest text-faint">
      {children}
    </div>
  );

  return (
    <div className="flex items-center gap-2 select-none">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-900/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
        >
          <Plus size={14} />
          Thêm node
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 w-64 max-h-[70vh] overflow-y-auto custom-scrollbar rounded-2xl border border-line/70 bg-[var(--color-panel,#fff)] dark:bg-slate-900 shadow-2xl p-1.5 z-50">
            {/* LÕI */}
            <GroupLabel>Lõi</GroupLabel>
            {CORE_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => { onAddNode(slot); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: SLOT_COLORS[slot] }} />
                <span className="text-xs font-bold text-ink">{SLOT_LABELS[slot]}{slot === 'task' ? ' (Task)' : ''}</span>
                <span className="ml-auto text-[9px] text-faint font-semibold">tự cắm dây</span>
              </button>
            ))}

            {/* TINH CHỈNH — Modifier presets */}
            <GroupLabel>Tinh chỉnh (Modifier)</GroupLabel>
            {NODE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => { onAddPresetNode(preset.id); setOpen(false); }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <span className="text-sm leading-none mt-0.5 shrink-0">{preset.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-ink">{preset.title}</span>
                  <span className="block text-[9px] text-faint leading-snug">{preset.description}</span>
                </span>
              </button>
            ))}

            {/* DỮ LIỆU & VÍ DỤ */}
            <GroupLabel>Dữ liệu & Ví dụ</GroupLabel>
            <button
              onClick={() => { onAddFewShotNode(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <ListOrdered size={13} className="shrink-0" style={{ color: SLOT_COLORS.example }} />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-ink">Ví dụ mẫu (Few-Shot)</span>
                <span className="block text-[9px] text-faint leading-snug">Cặp Đầu vào → Đầu ra để AI học theo</span>
              </span>
            </button>
            <button
              onClick={() => { onAddWebNode(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <Globe size={13} className="shrink-0" style={{ color: SLOT_COLORS.context }} />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-ink">Dữ liệu từ URL (Web)</span>
                <span className="block text-[9px] text-faint leading-snug">Cào nội dung trang web làm Ngữ cảnh</span>
              </span>
            </button>
            <button
              onClick={() => { onOpenImportTemplate(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <Library size={13} className="text-emerald-500 shrink-0" />
              <span className="text-xs font-bold text-ink">Từ thư viện Template…</span>
            </button>

            {/* TEXT TỰ DO */}
            <GroupLabel>Text tự do</GroupLabel>
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
              {FREE_TEXT_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => { onAddNode(slot); setOpen(false); }}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors hover:text-ink"
                  style={{ borderColor: `${SLOT_COLORS[slot]}55`, color: SLOT_COLORS[slot] }}
                >
                  {SLOT_LABELS[slot]}
                </button>
              ))}
            </div>
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
  );
}
