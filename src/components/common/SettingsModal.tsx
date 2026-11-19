import React, { useEffect } from 'react';
import { Settings, Sparkles, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import BackupPanel from './BackupPanel';
import UsageStatsPanel from './UsageStatsPanel';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Cài đặt app — gom các tuỳ chọn không thuộc Thư viện (trước nằm trong tab LLM Config):
 * gợi ý gõ nhanh (ghost-text), sao lưu/khôi phục (H6), thống kê sử dụng AI (M2).
 */
export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { ghostTextEnabled, setGhostTextEnabled } = useWorkspace();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><Settings size={16} /> Cài đặt</h2>
          <button onClick={onClose} aria-label="Đóng cài đặt" className="rounded-lg p-1.5 text-muted hover:bg-hover hover:text-ink"><X size={16} /></button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Sparkles size={14} className="text-emerald-500" /> Gợi ý gõ nhanh</span>
              <span className="mt-0.5 block text-xs text-muted">AI gợi ý phần tiếp theo khi bạn gõ prompt (chữ mờ). Nhấn Tab để điền.</span>
            </span>
            <input
              type="checkbox"
              checked={ghostTextEnabled}
              onChange={(e) => setGhostTextEnabled(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-emerald-600"
            />
          </label>
          <BackupPanel />
          <UsageStatsPanel />
        </div>
      </div>
    </div>
  );
}
