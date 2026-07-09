import React from 'react';
import { CatalogEntry } from '../../data/skillCatalog';

interface Props {
  entry: CatalogEntry;
  selected: boolean;
  onClick: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  skill: 'Skill', rule: 'Rule', config: 'Config', guide: 'Guide',
};

export default function CatalogCard({ entry, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
        selected
          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-900/60 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate flex items-center gap-1.5">
          <span>{entry.icon || '📦'}</span>{entry.title}
        </span>
        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-full shrink-0">
          {CATEGORY_LABEL[entry.category]}
        </span>
      </div>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2">{entry.description}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] text-slate-400">{entry.repo}</span>
        {entry.license && (
          <span className="text-[9px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{entry.license}</span>
        )}
      </div>
    </button>
  );
}
