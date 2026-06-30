/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hộp thoại xác nhận dạng imperative — thay cho window.confirm() chặn luồng.
 * Dùng: `if (await confirmDialog({ message: '...' })) { ... }`.
 * Mount <ConfirmDialogHost /> một lần ở App. Cùng triết lý với Toaster (singleton).
 *
 * Lưu ý: KHÔNG dùng AnimatePresence (xem CommandPalette) — render có điều kiện,
 * unmount tức thì khi đóng để tránh overlay zombie chặn click.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Tô đỏ nút xác nhận cho hành động phá huỷ (xoá…). */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
}

type Listener = (state: ConfirmState | null) => void;

let current: ConfirmState | null = null;
let resolver: ((value: boolean) => void) | null = null;
let listener: Listener | null = null;
let nextId = 1;

function emit() {
  listener?.(current);
}

function settle(value: boolean) {
  const r = resolver;
  resolver = null;
  current = null;
  emit();
  r?.(value);
}

/** Mở hộp thoại xác nhận; resolve true nếu người dùng đồng ý, false nếu huỷ. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Nếu có hộp thoại đang mở chưa giải quyết, coi như huỷ nó trước.
  if (resolver) settle(false);
  return new Promise<boolean>((resolve) => {
    resolver = resolve;
    current = { ...options, id: nextId++ };
    emit();
  });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<ConfirmState | null>(current);

  useEffect(() => {
    listener = setState;
    setState(current);
    return () => {
      listener = null;
    };
  }, []);

  // Esc = huỷ, Enter = xác nhận, khi đang mở.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); settle(false); }
      else if (e.key === 'Enter') { e.preventDefault(); settle(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  if (!state) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => settle(false)}
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-[var(--color-panel,#ffffff)] shadow-2xl dark:border-slate-800"
        role="alertdialog"
        aria-label={state.title || 'Xác nhận'}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className={`mt-0.5 shrink-0 ${state.danger ? 'text-rose-500' : 'text-amber-500'}`}>
            <AlertTriangle size={20} />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-ink">{state.title || 'Xác nhận hành động'}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{state.message}</p>
          </div>
          <button
            onClick={() => settle(false)}
            className="shrink-0 rounded-md p-0.5 text-slate-400 transition-colors hover:text-ink"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-150 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <button
            onClick={() => settle(false)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 cursor-pointer"
          >
            {state.cancelText || 'Huỷ'}
          </button>
          <button
            autoFocus
            onClick={() => settle(true)}
            className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer ${
              state.danger
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {state.confirmText || 'Xác nhận'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
