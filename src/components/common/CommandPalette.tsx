/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Command Palette (⌘K / Ctrl+K): điều hướng nhanh giữa các tab và vài hành động.
 * Tự quản lý trạng thái mở + phím tắt toàn cục, chỉ nhận danh sách tab & callback
 * qua props nên gắn vào App với footprint tối thiểu.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Moon, Sun, CornerDownLeft } from 'lucide-react';
import { TabType } from '../../types';

interface CommandItem {
  tab: TabType;
  label: string;
  icon: React.ReactNode;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onNavigate: (tab: TabType) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

type Action =
  | { kind: 'nav'; id: string; label: string; icon: React.ReactNode; tab: TabType }
  | { kind: 'theme'; id: string; label: string; icon: React.ReactNode };

export default function CommandPalette({ items, onNavigate, theme, onToggleTheme }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Phím tắt toàn cục mở/đóng palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset truy vấn + focus input mỗi lần mở.
  useEffect(() => {
    if (isOpen) {
      setQueryText('');
      setActiveIndex(0);
      // focus sau khi modal gắn vào DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const actions = useMemo<Action[]>(() => {
    const navActions: Action[] = items.map((it) => ({
      kind: 'nav', id: `nav-${it.tab}`, label: it.label, icon: it.icon, tab: it.tab,
    }));
    const themeAction: Action = {
      kind: 'theme',
      id: 'action-theme',
      label: theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng',
      icon: theme === 'light' ? <Moon size={16} /> : <Sun size={16} />,
    };
    return [...navActions, themeAction];
  }, [items, theme]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, queryText]);

  // Giữ activeIndex hợp lệ khi danh sách lọc thay đổi.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const runAction = (action: Action | undefined) => {
    if (!action) return;
    if (action.kind === 'nav') onNavigate(action.tab);
    else if (action.kind === 'theme') onToggleTheme();
    setIsOpen(false);
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAction(filtered[activeIndex]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[150] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-[12vh]"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onListKeyDown}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-[var(--color-panel,#ffffff)] shadow-2xl dark:border-slate-800"
            role="dialog"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-150 px-4 py-3 dark:border-slate-800">
              <Search size={17} className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Đi tới… (gõ tên tab hoặc hành động)"
                className="w-full bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700 sm:block">ESC</kbd>
            </div>

            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs italic text-slate-400">Không có kết quả phù hợp.</li>
              ) : (
                filtered.map((action, idx) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => runAction(action)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        idx === activeIndex
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'text-muted hover:bg-hover'
                      }`}
                    >
                      <span className="shrink-0 opacity-80">{action.icon}</span>
                      <span className="flex-1 font-medium">{action.label}</span>
                      {idx === activeIndex && <CornerDownLeft size={14} className="shrink-0 opacity-60" />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
