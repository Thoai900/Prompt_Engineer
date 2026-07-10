import React from 'react';
import { listDomains } from '../../utils/presetFilter';

interface Props<T extends { domain?: string }> {
  items: T[];
  value: string | null;
  onChange: (d: string | null) => void;
}

// Hàng chip lọc theo ngành (domain). Ẩn nếu chỉ có ≤1 domain (không cần lọc).
export default function DomainChips<T extends { domain?: string }>({ items, value, onChange }: Props<T>) {
  const domains = listDomains(items);
  if (domains.length <= 1) return null;

  const chip = (active: boolean) =>
    `px-2 py-0.5 text-[9px] font-bold rounded-full border cursor-pointer transition-colors ${
      active
        ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-300'
        : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 dark:bg-slate-900 dark:border-slate-800'
    }`;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      <button onClick={() => onChange(null)} className={chip(value === null)}>Tất cả</button>
      {domains.map((d) => (
        <button key={d} onClick={() => onChange(d)} className={chip(value === d)}>{d}</button>
      ))}
    </div>
  );
}
