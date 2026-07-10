import { toast } from '../common/Toaster';
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Compass, Search, X, Github, ChevronLeft, RefreshCw } from 'lucide-react';
import { CatalogEntry, CatalogCategory } from '../../data/skillCatalog';
import { staticCatalogSource, searchRepos, listRepoFiles, RepoHit } from '../../services/catalogService';
import { routeImport, routeImportAs, ImportTarget } from '../../utils/skillCatalog';
import { buildInstallCommands } from '../../utils/agentInstall';
import { persistImport } from '../../services/importService';
import CatalogCard from './CatalogCard';
import CatalogPreviewPanel from './CatalogPreviewPanel';
import RepoCard from './RepoCard';
import RepoCommandsPanel from './RepoCommandsPanel';

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
const TARGET_LABEL: Record<ImportTarget, string> = { skill: 'Skills', rule: 'Rules', config: 'LLM Config' };

export default function LibraryExplorer({ open, onClose, user, defaultCategory, categories, onImported }: Props) {
  const [mode, setMode] = useState<'curated' | 'search'>('curated');
  const [category, setCategory] = useState<CatalogCategory | 'all'>(defaultCategory || 'all');
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<CatalogEntry[]>([]);

  // Live search state
  const [repoQuery, setRepoQuery] = useState('');
  const [repos, setRepos] = useState<RepoHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeRepo, setActiveRepo] = useState<RepoHit | null>(null);
  const [repoFiles, setRepoFiles] = useState<CatalogEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Shared preview state
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [cache] = useState<Map<string, string>>(() => new Map());

  // Reset mỗi lần mở.
  useEffect(() => {
    if (!open) return;
    setMode('curated');
    setCategory(defaultCategory || 'all'); setText('');
    setRepoQuery(''); setRepos([]); setSearchError(null); setActiveRepo(null); setRepoFiles([]); setFilesError(null);
    setSelected(null); setContent(''); setError(null);
  }, [open, defaultCategory]);

  // Liệt kê catalog tĩnh (chỉ chế độ Tuyển chọn).
  useEffect(() => {
    if (!open || mode !== 'curated') return;
    staticCatalogSource
      .list({ category: category === 'all' ? undefined : category, text })
      .then(setEntries);
  }, [open, mode, category, text]);

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

  const switchMode = (m: 'curated' | 'search') => {
    setMode(m); setSelected(null); setContent(''); setError(null);
  };

  const runSearch = async () => {
    const q = repoQuery.trim();
    if (!q) return;
    setSearching(true); setSearchError(null); setActiveRepo(null); setRepoFiles([]); setSelected(null); setContent('');
    try {
      setRepos(await searchRepos(q));
    } catch (e: any) {
      setSearchError(e?.message || 'Tìm GitHub thất bại.');
      setRepos([]);
    } finally {
      setSearching(false);
    }
  };

  const openRepo = async (repo: RepoHit) => {
    setActiveRepo(repo); setSelected(null); setContent('');
    setFilesLoading(true); setFilesError(null); setRepoFiles([]);
    try {
      setRepoFiles(await listRepoFiles(repo));
    } catch (e: any) {
      setFilesError(e?.message || 'Duyệt repo thất bại.');
    } finally {
      setFilesLoading(false);
    }
  };

  const runImport = async (routed: ReturnType<typeof routeImport>, label: string) => {
    setImporting(true);
    try {
      await persistImport(routed, user);
      toast.success(`Đã nhập "${selected!.title}" vào ${label}.`);
      onImported(routed.target);
    } catch (e) {
      console.error(e);
      toast.error('Nhập thất bại. Vui lòng thử lại.');
    } finally {
      setImporting(false);
    }
  };

  const handleImport = () => {
    if (!selected || !content) return;
    const routed = routeImport(selected, content);
    runImport(routed, TARGET_LABEL[routed.target]);
  };

  const handleImportAs = (target: 'rule' | 'config') => {
    if (!selected || !content) return;
    runImport(routeImportAs(selected, content, target), TARGET_LABEL[target]);
  };

  if (!open) return null;

  const chips: (CatalogCategory | 'all')[] = ['all', ...categories];
  const installCommands = selected?.category === 'skill' ? buildInstallCommands(selected) : undefined;

  const modeBtn = (m: 'curated' | 'search', label: React.ReactNode) => (
    <button onClick={() => switchMode(m)}
      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
        mode === m ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}>
      {label}
    </button>
  );

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

        {/* Mode + filter bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
            {modeBtn('curated', 'Tuyển chọn')}
            {modeBtn('search', <><Github size={12} /> Tìm GitHub</>)}
          </div>

          {mode === 'curated' ? (
            <>
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
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <div className="flex items-center gap-1.5 flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
                <Search size={13} className="text-slate-400" />
                <input value={repoQuery} onChange={(e) => setRepoQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                  placeholder="Tìm repo GitHub (vd: agent skills, cursor rules)…"
                  className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700 dark:text-slate-200" />
              </div>
              <button onClick={runSearch} disabled={searching || !repoQuery.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
                {searching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />} Tìm
              </button>
            </div>
          )}
        </div>

        {/* Body: list + preview */}
        <div className="flex-1 flex min-h-0">
          <div className="w-2/5 border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {mode === 'curated' ? (
              entries.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3">Không có mục nào khớp bộ lọc.</p>
              ) : (
                entries.map((e) => (
                  <CatalogCard key={e.id} entry={e} selected={selected?.id === e.id} onClick={() => setSelected(e)} />
                ))
              )
            ) : !activeRepo ? (
              searching ? (
                <p className="text-xs text-slate-400 italic p-3 flex items-center gap-2"><RefreshCw size={12} className="animate-spin" /> Đang tìm repo…</p>
              ) : searchError ? (
                <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3">{searchError}</div>
              ) : repos.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3">Nhập từ khoá rồi bấm Tìm để tìm repo trên GitHub.</p>
              ) : (
                repos.map((r) => (
                  <RepoCard key={r.fullName} repo={r} selected={false} onClick={() => openRepo(r)} />
                ))
              )
            ) : (
              <>
                <button onClick={() => { setActiveRepo(null); setRepoFiles([]); setSelected(null); setContent(''); }}
                  className="w-full text-left text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 px-1 py-1 hover:underline cursor-pointer">
                  <ChevronLeft size={13} /> {activeRepo.fullName}
                </button>
                {filesLoading ? (
                  <p className="text-xs text-slate-400 italic p-3 flex items-center gap-2"><RefreshCw size={12} className="animate-spin" /> Đang liệt kê file…</p>
                ) : filesError ? (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3">{filesError}</div>
                ) : repoFiles.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3">Repo này không có file skill/rule/config nhận diện được.</p>
                ) : (
                  repoFiles.map((e) => (
                    <CatalogCard key={e.id} entry={e} selected={selected?.id === e.id} onClick={() => setSelected(e)} />
                  ))
                )}
              </>
            )}
          </div>
          {mode === 'search' && activeRepo && !selected ? (
            <RepoCommandsPanel repo={activeRepo} />
          ) : (
            <CatalogPreviewPanel
              entry={selected} content={content} loading={loading} error={error} importing={importing}
              onImport={handleImport} installCommands={installCommands} onImportAs={handleImportAs}
            />
          )}
        </div>
      </div>
    </div>
  );
}
