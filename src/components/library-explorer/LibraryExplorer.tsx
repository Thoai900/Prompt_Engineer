import { toast } from '../common/Toaster';
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Compass, Search, X } from 'lucide-react';
import { CatalogEntry, CatalogCategory } from '../../data/skillCatalog';
import { staticCatalogSource } from '../../services/catalogService';
import { routeImport, ImportTarget } from '../../utils/skillCatalog';
import { persistImport } from '../../services/importService';
import CatalogCard from './CatalogCard';
import CatalogPreviewPanel from './CatalogPreviewPanel';

// Cache nội dung raw qua localStorage để mở lại tức thì giữa các phiên (spec Phần D).
const CACHE_PREFIX = 'gh_catalog_cache_';
function readCachedContent(id: string): string | null {
  try { return localStorage.getItem(CACHE_PREFIX + id); } catch { return null; }
}
function writeCachedContent(id: string, text: string): void {
  try { localStorage.setItem(CACHE_PREFIX + id, text); } catch { /* quota — bỏ qua */ }
}

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
  defaultCategory?: CatalogCategory;
  categories: CatalogCategory[];          // chip lọc hiển thị
  onImported: (target: ImportTarget) => void;
}

const CAT_LABEL: Record<CatalogCategory, string> = {
  skill: 'Skills', rule: 'Rules', config: 'Configs', guide: 'Guides',
};

export default function LibraryExplorer({ open, onClose, user, defaultCategory, categories, onImported }: Props) {
  const [category, setCategory] = useState<CatalogCategory | 'all'>(defaultCategory || 'all');
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [cache] = useState<Map<string, string>>(() => new Map());

  // Reset bộ lọc mặc định mỗi lần mở.
  useEffect(() => {
    if (open) { setCategory(defaultCategory || 'all'); setText(''); setSelected(null); setContent(''); setError(null); }
  }, [open, defaultCategory]);

  // Liệt kê theo bộ lọc.
  useEffect(() => {
    if (!open) return;
    staticCatalogSource
      .list({ category: category === 'all' ? undefined : category, text })
      .then(setEntries);
  }, [open, category, text]);

  // Tải nội dung khi chọn — cache trong phiên (Map) + localStorage (giữ giữa các phiên).
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const id = selected.id;
    const memo = cache.get(id) ?? readCachedContent(id);
    if (memo !== undefined && memo !== null) {
      cache.set(id, memo); setContent(memo); setError(null); setLoading(false); return;
    }
    setLoading(true); setError(null); setContent('');
    staticCatalogSource.fetchContent(selected)
      .then((t) => { cache.set(id, t); writeCachedContent(id, t); if (!cancelled) setContent(t); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Không tải được nội dung.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, cache]);

  const handleImport = async () => {
    if (!selected || !content) return;
    setImporting(true);
    try {
      const routed = routeImport(selected, content);
      await persistImport(routed, user);
      toast.success(`Đã nhập "${selected.title}" vào ${CAT_LABEL[selected.category]}.`);
      onImported(routed.target);
    } catch (e) {
      console.error(e);
      toast.error('Nhập thất bại. Vui lòng thử lại.');
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  const chips: (CatalogCategory | 'all')[] = ['all', ...categories];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Compass className="text-indigo-600 w-5 h-5" />
            <h2 className="font-bold text-sm text-slate-800 dark:text-white">Thư viện năng lực AI — Khám phá GitHub</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
            {chips.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  category === c ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {c === 'all' ? 'Tất cả' : CAT_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
            <Search size={13} className="text-slate-400" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tìm skill, rule, persona…"
              className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700 dark:text-slate-200" />
          </div>
        </div>

        {/* Body: list + preview */}
        <div className="flex-1 flex min-h-0">
          <div className="w-2/5 border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {entries.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3">Không có mục nào khớp bộ lọc.</p>
            ) : (
              entries.map((e) => (
                <CatalogCard key={e.id} entry={e} selected={selected?.id === e.id} onClick={() => setSelected(e)} />
              ))
            )}
          </div>
          <CatalogPreviewPanel entry={selected} content={content} loading={loading} error={error} importing={importing} onImport={handleImport} />
        </div>
      </div>
    </div>
  );
}
