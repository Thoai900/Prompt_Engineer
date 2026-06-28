/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hệ thống toast dạng imperative singleton — thay cho `alert()` chặn luồng.
 * Dùng ở bất cứ đâu: `import { toast } from '.../Toaster'; toast.error('...')`.
 * Không cần Context/prop-drilling. Chỉ cần mount <Toaster /> một lần ở App.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  listeners.forEach((l) => l(toasts));
}

function remove(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function add(message: string, type: ToastType): number {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  emit();
  // Lỗi hiển thị lâu hơn để người dùng kịp đọc.
  setTimeout(() => remove(id), type === 'error' ? 6000 : 4000);
  return id;
}

/** API: toast('msg') ~ info; hoặc toast.success / toast.error / toast.info. */
export const toast = Object.assign(
  (message: string, type: ToastType = 'info') => add(message, type),
  {
    success: (m: string) => add(m, 'success'),
    error: (m: string) => add(m, 'error'),
    info: (m: string) => add(m, 'info'),
    dismiss: (id: number) => remove(id),
  },
);

const STYLES: Record<ToastType, { icon: React.ReactNode; ring: string }> = {
  success: { icon: <CheckCircle size={18} className="text-emerald-500" />, ring: 'border-emerald-200 dark:border-emerald-900/60' },
  error: { icon: <AlertTriangle size={18} className="text-rose-500" />, ring: 'border-rose-200 dark:border-rose-900/60' },
  info: { icon: <Info size={18} className="text-indigo-500" />, ring: 'border-indigo-200 dark:border-indigo-900/60' },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    const listener: Listener = (t) => setItems([...t]);
    listeners.add(listener);
    setItems([...toasts]);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-[var(--color-panel,#ffffff)] px-4 py-3 shadow-lg backdrop-blur-md ${STYLES[item.type].ring}`}
            role={item.type === 'error' ? 'alert' : 'status'}
          >
            <span className="mt-0.5 shrink-0">{STYLES[item.type].icon}</span>
            <p className="flex-1 text-sm font-medium leading-snug text-ink">{item.message}</p>
            <button
              onClick={() => remove(item.id)}
              className="shrink-0 rounded-md p-0.5 text-muted transition-colors hover:text-ink"
              aria-label="Đóng thông báo"
            >
              <X size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
