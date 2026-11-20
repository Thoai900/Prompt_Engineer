import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Library, LayoutGrid, ScrollText, Search, Sparkles, Wrench, X, Zap } from 'lucide-react';
import { User } from 'firebase/auth';
import { PromptTemplate, TabType } from '../../types';
import { DEFAULT_MODEL } from '../../config/models';
import LibraryExplorer from '../library-explorer/LibraryExplorer';
import AuthoringWizard from '../authoring/AuthoringWizard';
import DomainChips from '../common/DomainChips';
import { filterByDomain } from '../../utils/presetFilter';
import { KIND_LABELS, buildSearchEntries, filterSearchEntries, type SearchEntry, type SearchKind } from '../../utils/globalSearch';
import { TEMPLATES } from '../../data';
import {
  LIBRARY_OPEN_EVENT, notifyLibraryChanged, parseLibraryKind, writeLibraryParams,
  type LibraryKind, type LibraryOpenDetail,
} from '../../services/libraryNav';
import TemplatesView from './TemplatesView';
import RulesSkillsView from './RulesSkillsView';
import ConfigsView from './ConfigsView';

type HubKind = LibraryKind | 'all';

const KINDS: { id: HubKind; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'Tất cả', icon: <LayoutGrid size={14} /> },
  { id: 'templates', label: 'Mẫu prompt', icon: <Library size={14} /> },
  { id: 'rules', label: 'Rule', icon: <ScrollText size={14} /> },
  { id: 'skills', label: 'Skill', icon: <Wrench size={14} /> },
  { id: 'configs', label: 'LLM Config', icon: <Zap size={14} /> },
];

const SEARCH_TO_LIB: Partial<Record<SearchKind, LibraryKind>> = {
  template: 'templates', rule: 'rules', skill: 'skills', config: 'configs',
};
const LIB_TO_SEARCH: Record<LibraryKind, SearchKind> = {
  templates: 'template', rules: 'rule', skills: 'skill', configs: 'config',
};
// Mặc định của Explorer / Wizard theo loại đang xem.
const EXPLORER_DEFAULT: Partial<Record<HubKind, 'rule' | 'skill' | 'config'>> = { rules: 'rule', skills: 'skill', configs: 'config' };
const IMPORT_TO_LIB: Record<'rule' | 'skill' | 'config', LibraryKind> = { rule: 'rules', skill: 'skills', config: 'configs' };

interface LibraryHubProps {
  user: User | null;
  customTemplates: PromptTemplate[];
  communityTemplates: PromptTemplate[];
  activeWorkspaceId?: string;
  onSelectTemplate: (t: PromptTemplate) => void;
  onSaveTemplate: (t: PromptTemplate) => Promise<void>;
  onNavigateToTab: (tab: TabType) => void;
  /** Nguồn tìm kiếm chung (App — cùng nguồn với Command Palette). */
  getSearchEntries: () => SearchEntry[];
}

interface Focus { kind: LibraryKind; id: string; nonce: number }

function initialState(): { kind: LibraryKind; focus: Focus | null } {
  const params = new URLSearchParams(window.location.search);
  const kind = parseLibraryKind(params.get('lib')) || 'templates';
  const id = params.get('id');
  return { kind, focus: id ? { kind, id, nonce: 1 } : null };
}

/**
 * Tab Thư viện — gộp Mẫu prompt · Rule · Skill · LLM Config (spec 2026-11-18-unified-library-design).
 * Khung mỏng: bộ chọn loại (URL `?lib=`), ô tìm chung cho mọi loại, một Explorer/Wizard dùng chung.
 * Mỗi loại giữ giao diện riêng của nó; view đã mở được giữ mounted (ẩn bằng CSS) để không mất state.
 */
export default function LibraryHub(props: LibraryHubProps) {
  const { user, getSearchEntries } = props;
  const [init] = useState(initialState);
  const [kind, setKind] = useState<HubKind>(init.kind);
  const [visited, setVisited] = useState<Set<LibraryKind>>(() => new Set([init.kind]));
  const [rsSub, setRsSub] = useState<'rules' | 'skills'>(init.kind === 'skills' ? 'skills' : 'rules');
  const [focus, setFocus] = useState<Focus | null>(init.focus);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [entries, setEntries] = useState<SearchEntry[]>([]);

  const go = (next: HubKind, focusId?: string) => {
    setKind(next);
    if (next !== 'all') {
      setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
      if (next === 'rules' || next === 'skills') setRsSub(next);
      writeLibraryParams(next);
      if (focusId) setFocus((f) => ({ kind: next, id: focusId, nonce: (f?.nonce || 0) + 1 }));
    }
  };

  // openLibrary() từ nơi khác (Command Palette, Studio, link cũ) khi hub đang mount.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const { kind: k, id } = (e as CustomEvent<LibraryOpenDetail>).detail;
      setQuery('');
      go(k, id);
    };
    window.addEventListener(LIBRARY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(LIBRARY_OPEN_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showResults = kind === 'all' || query.trim() !== '';

  // Nạp lại nguồn tìm kiếm mỗi lần mở kết quả (rule/skill/config nằm ở localStorage).
  // Nguồn chung (App) chỉ có template của tôi → bổ sung mẫu dựng sẵn + cộng đồng (bỏ trùng id).
  useEffect(() => {
    if (!showResults) return;
    const base = getSearchEntries().filter((e) => SEARCH_TO_LIB[e.kind]);
    const seen = new Set(base.map((e) => e.id));
    const extra = buildSearchEntries({ templates: [...props.communityTemplates, ...TEMPLATES] }).filter((e) => !seen.has(e.id) && (seen.add(e.id), true));
    setEntries([...base, ...extra]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, kind, props.communityTemplates]);

  const results = useMemo(() => {
    const scoped = kind === 'all' ? entries : entries.filter((e) => SEARCH_TO_LIB[e.kind] === kind);
    const matched = query.trim() ? filterSearchEntries(scoped, query, 200) : scoped;
    return filterByDomain(matched, domain);
  }, [entries, kind, query, domain]);

  const openEntry = (e: SearchEntry) => {
    const target = SEARCH_TO_LIB[e.kind];
    if (!target) return;
    setQuery('');
    go(target, e.itemId);
  };

  const onLibraryChanged = (target: 'rule' | 'skill' | 'config') => {
    notifyLibraryChanged(target);
    go(IMPORT_TO_LIB[target]);
  };

  const focusFor = (k: LibraryKind) => (focus && focus.kind === k ? focus : null);
  const rsFocus = focus && (focus.kind === 'rules' || focus.kind === 'skills') ? focus : null;
  const viewVisible = (k: LibraryKind) => !showResults && kind === k;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface">
      {/* Khung chung: tiêu đề, tìm kiếm, Khám phá / Tạo bằng AI, bộ chọn loại */}
      <div className="shrink-0 border-b border-line bg-panel px-4 pt-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Thư viện</h2>
            <p className="text-xs text-muted">Mẫu prompt, rule, skill và cấu hình LLM tái sử dụng — một chỗ để tìm và quản lý.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full md:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => {
                  // Ô tìm luôn tìm mọi loại: bắt đầu gõ thì chuyển sang "Tất cả".
                  if (!query && e.target.value.trim() && kind !== 'all') setKind('all');
                  setQuery(e.target.value);
                }}
                placeholder="Tìm trong toàn bộ thư viện…"
                aria-label="Tìm trong thư viện"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-8 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Xoá tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink">
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              onClick={() => setExplorerOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted hover:bg-hover hover:text-ink"
              title="Khám phá & nhập rule / skill / cấu hình từ GitHub"
            >
              <Compass size={14} /> Khám phá GitHub
            </button>
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              title="Tạo rule / skill / cấu hình bằng AI từ 1 câu mô tả"
            >
              <Sparkles size={14} /> Tạo bằng AI
            </button>
          </div>
        </div>

        <div className="mt-3 flex overflow-x-auto no-scrollbar" role="tablist" aria-label="Loại tài sản">
          {KINDS.map((k) => (
            <button
              key={k.id}
              role="tab"
              aria-selected={kind === k.id}
              onClick={() => go(k.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                kind === k.id ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {k.icon} {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Kết quả tìm kiếm / chế độ "Tất cả" */}
        {showResults && (
          <div className="h-full overflow-y-auto p-4 md:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-muted">
                {results.length} mục{query.trim() ? ` khớp “${query.trim()}”` : ''}{kind !== 'all' ? ` · chỉ ${KIND_LABELS[LIB_TO_SEARCH[kind]]}` : ''}
              </span>
              <DomainChips items={entries} value={domain} onChange={setDomain} />
            </div>
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-sm text-muted">Không tìm thấy mục nào.</div>
            ) : (
              <div role="list" aria-label="Kết quả thư viện" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openEntry(e)}
                    className="flex flex-col items-start gap-1.5 rounded-2xl border border-glass-edge glass-1 p-4 text-left transition-colors hover:border-emerald-400 hover:bg-hover"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{KIND_LABELS[e.kind]}</span>
                      {e.domain && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{e.domain}</span>}
                    </div>
                    <span className="text-sm font-bold text-ink line-clamp-1">{e.title}</span>
                    {e.subtitle && <span className="text-xs text-muted line-clamp-2">{e.subtitle}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Các view theo loại — giữ mounted sau lần mở đầu để không mất state */}
        {visited.has('templates') && (
          <div className={viewVisible('templates') ? 'flex h-full flex-col overflow-hidden' : 'hidden'}>
            <TemplatesView
              embedded
              focus={focusFor('templates')}
              onSelectTemplate={props.onSelectTemplate}
              customTemplates={props.customTemplates}
              communityTemplates={props.communityTemplates}
              user={user}
              onNavigateToTab={props.onNavigateToTab}
              activeWorkspaceId={props.activeWorkspaceId}
            />
          </div>
        )}
        {(visited.has('rules') || visited.has('skills')) && (
          <div className={viewVisible('rules') || viewVisible('skills') ? 'flex h-full flex-col overflow-hidden' : 'hidden'}>
            <RulesSkillsView user={user} onApplyTemplate={props.onSelectTemplate} subTab={rsSub} focus={rsFocus} />
          </div>
        )}
        {visited.has('configs') && (
          <div className={viewVisible('configs') ? 'flex h-full flex-col overflow-hidden' : 'hidden'}>
            <ConfigsView user={user} onSaveTemplate={props.onSaveTemplate} focus={focusFor('configs')} />
          </div>
        )}
      </div>

      <LibraryExplorer
        key={`explorer-${kind}`}
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        user={user}
        defaultCategory={EXPLORER_DEFAULT[kind]}
        categories={['skill', 'rule', 'guide', 'config']}
        onImported={(target) => { setExplorerOpen(false); onLibraryChanged(target); }}
      />
      <AuthoringWizard
        key={`wizard-${kind}`}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        user={user}
        defaultKind={EXPLORER_DEFAULT[kind] || 'rule'}
        model={DEFAULT_MODEL}
        onCreated={(k) => onLibraryChanged(k)}
      />
    </div>
  );
}
