/**
 * Thẻ đề xuất AI — giải phẫu DÙNG CHUNG cho mọi đề xuất trong Studio
 * (Rules/Skills ở bước Tăng cường, bản sửa ở bước Kiểm tra). Đây chính là
 * "action card" mà copilot đợt 3 sẽ bấm hộ — giữ một giải phẫu duy nhất.
 */
import React from 'react';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';

interface SuggestionCardProps {
  icon: React.ReactNode;
  eyebrow: string;          // vd: 'QUY TẮC' / 'KỸ NĂNG' / 'BẢN SỬA'
  title: string;
  description: string;
  /** Lý do gợi ý (từ khoá trùng khớp) — minh bạch vì sao thẻ này xuất hiện. */
  reason?: string;
  applyLabel?: string;
  busy?: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export default function SuggestionCard({
  icon, eyebrow, title, description, reason,
  applyLabel = 'Áp dụng', busy = false, onApply, onDismiss,
}: SuggestionCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex gap-3 rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-violet-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-faint">{eyebrow}</div>
        <div className="mt-0.5 text-sm font-bold tracking-tight text-ink">{title}</div>
        {description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{description}</p>}
        {reason && <p className="mt-1.5 text-[11px] text-violet-500/90">Vì sao: {reason}</p>}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onApply}
            disabled={busy}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <Check size={13} /> {applyLabel}
          </button>
          <button
            onClick={onDismiss}
            disabled={busy}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-50"
          >
            <X size={13} /> Bỏ qua
          </button>
        </div>
      </div>
    </motion.div>
  );
}
