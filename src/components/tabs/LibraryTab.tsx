import React, { useState, useMemo, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { TEMPLATES } from '../../data';
import { PromptTemplate } from '../../types';
import { Search, TrendingUp, Sparkles, Bookmark, History, Eye, X, Code2, Video, Brain, GraduationCap, FileText, Layout, Folder, FolderPlus, Plus, Trash2 } from 'lucide-react';
import PromptCard from '../common/PromptCard';
import PromptDetailModal from '../modals/PromptDetailModal';
import ExamplePreviewModal from '../modals/ExamplePreviewModal';
import AddToProjectModal from '../modals/AddToProjectModal';
import AddToCollectionModal from '../modals/AddToCollectionModal';
import { useBookmarks } from '../../hooks/useBookmarks';
import { useCollections } from '../../hooks/useCollections';
import { collectionsContaining } from '../../utils/collections';
import { openProjectInGraph } from '../../services/graphExportService';
import { templateToGraphProject } from '../../utils/graphMigration';
import { confirmDialog } from '../common/ConfirmDialog';
import { toast } from '../common/Toaster';
import {
  buildShareUrl,
  parseSharedTemplateId,
  prepareRemixTemplate,
  filterAndSortTemplates,
  collectFacets,
  isOwnTemplate,
  type FacetOption,
  type LibrarySource,
} from '../../utils/libraryUtils';
import { loadRecentIds, recordRecentTemplate } from '../../utils/recentTemplates';
import { loadLikedIds } from '../../utils/likedTemplates';
import { toggleTemplateLike } from '../../services/metricsService';

interface LibraryTabProps {
  onSelectTemplate: (template: PromptTemplate) => void;
  customTemplates?: PromptTemplate[];
  /** Template PUBLIC của người khác (Đợt 3) — KHÔNG lọc theo workspace. */
  communityTemplates?: PromptTemplate[];
  user: any;
  onNavigateToTab: (tab: any) => void;
  activeWorkspaceId?: string;
}

const CATEGORIES = ['Tất cả', 'Công thức Prompt', 'Học sinh/Sinh viên', 'Người đi làm', 'Sáng tạo nội dung', 'Phát triển cá nhân', 'Mẫu của tôi'];

// Icon cho từng loại kết quả (dùng ở khối "Dùng gần đây").
const OUTPUT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code2,
  video: Video,
  mindmap: Brain,
  tutor: GraduationCap,
  text: FileText,
  ui: Layout,
};

// Nhóm chip lọc facet — chỉ render khi có tiêu chí (facets tự lọc tiêu chí rỗng).
function FacetGroup({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: FacetOption[];
  active: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 w-24 pt-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = active.includes(o.value);
          return (
            <button
              key={o.value}
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              className={`px-3 py-1 text-[11px] font-bold rounded-full border transition-all ${
                on
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {o.label} <span className={on ? 'text-white/70' : 'text-slate-400'}>{o.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LibraryTab({ onSelectTemplate, customTemplates = [], communityTemplates = [], user, onNavigateToTab, activeWorkspaceId }: LibraryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [activeTab, setActiveTab] = useState<'trending' | 'new' | 'saved'>('trending');
  const [sourceFilter, setSourceFilter] = useState<'all' | LibrarySource>('all');

  // Bộ lọc facet (Đợt 1 — Khám phá). Rỗng = không lọc.
  const [outputTypes, setOutputTypes] = useState<string[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<PromptTemplate | null>(null);
  const [isAddToProjOpen, setIsAddToProjOpen] = useState(false);
  const [addToProjTemplate, setAddToProjTemplate] = useState<PromptTemplate | null>(null);

  // "Dùng gần đây" — tín hiệu THẬT: id các template vừa mở/xem/remix (localStorage).
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecentIds());
  const markRecent = (t: PromptTemplate) => setRecentIds(recordRecentTemplate(t.id));
  const openDetail = (t: PromptTemplate) => {
    setSelectedPrompt(t);
    markRecent(t);
  };

  const { savedIds, isSaved, toggleSave } = useBookmarks(user);

  // Bộ sưu tập cá nhân (Đợt 2 — tổ chức). Filter theo bộ sưu tập đang chọn.
  const { collections, create: createCollection, remove: removeCollection, toggleTemplate: toggleTemplateInCollection } = useCollections();
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [collectionTemplate, setCollectionTemplate] = useState<PromptTemplate | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const openCollectionModal = (t: PromptTemplate) => setCollectionTemplate(t);

  const handleCreateCollection = () => {
    const created = createCollection(newCollectionName);
    if (created) {
      toast.success(`Đã tạo bộ sưu tập "${created.name}".`);
      setNewCollectionName('');
      setIsCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (id: string, name: string) => {
    const ok = await confirmDialog({
      message: `Xoá bộ sưu tập "${name}"? Template bên trong không bị xoá, chỉ gỡ khỏi bộ sưu tập.`,
      danger: true,
      confirmText: 'Xoá bộ sưu tập',
    });
    if (!ok) return;
    removeCollection(id);
    if (activeCollectionId === id) setActiveCollectionId(null);
    toast.success('Đã xoá bộ sưu tập.');
  };

  // "Mở trong Prompt Graph": chuyển template → project đồ thị rồi bơm vào tab Prompt Graph.
  const handleOpenInGraph = async (t: PromptTemplate) => {
    try {
      const project = templateToGraphProject(t, activeWorkspaceId || undefined);
      await openProjectInGraph(project, user || undefined);
      markRecent(t);
      setSelectedPrompt(null);
      toast.success('Đã mở template trong Prompt Graph.');
      onNavigateToTab('projectchain');
    } catch {
      toast.error('Không mở được trong Prompt Graph.');
    }
  };

  // H1: like THẬT — trạng thái "tôi đã thích" giữ cục bộ, tổng đếm nằm ở Firestore.
  const [likedIds, setLikedIds] = useState<Set<string>>(() => loadLikedIds());
  const handleToggleLike = async (template: PromptTemplate): Promise<boolean | null> => {
    if (!user) {
      toast.info('Đăng nhập để thích template.');
      return null;
    }
    const result = await toggleTemplateLike(template.id);
    if (result !== null) setLikedIds(loadLikedIds());
    else toast.error('Không cập nhật được lượt thích — thử lại sau.');
    return result;
  };

  const handleShare = (template: PromptTemplate) => {
    navigator.clipboard.writeText(buildShareUrl(window.location.origin, window.location.pathname, template.id))
      .then(() => toast.success('Đã sao chép liên kết chia sẻ.'))
      .catch(() => toast.error('Không sao chép được liên kết.'));
  };

  // ── Ba NGUỒN template (Đợt 3) ──────────────────────────────────────────────
  // "Của tôi": template thuộc user hiện tại (đã lọc workspace ở App). Chỉ template
  // của mình mới được gán nhãn "Tôi (Chính bạn)" / "Mẫu của tôi".
  const myTemplates = useMemo(
    () =>
      customTemplates
        .filter((t) => isOwnTemplate(t, user?.uid))
        .map((t) => ({
          ...t,
          category: t.category || 'Mẫu của tôi',
          authorName: t.authorName || 'Tôi (Chính bạn)',
          authorAvatar: t.authorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
          isVerified: true,
          metrics: t.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 },
          createdAt: t.createdAt || new Date().toISOString(),
        })),
    [customTemplates, user?.uid],
  );

  // "Cộng đồng": template PUBLIC của người khác — GIỮ tác giả thật, KHÔNG ép nhãn
  // "Mẫu của tôi", KHÔNG bịa verified. Không lọc theo workspace (đã lo ở App).
  const communityProcessed = useMemo(
    () =>
      (communityTemplates || []).map((t) => ({
        ...t,
        authorName: t.authorName || 'Người dùng cộng đồng',
        isVerified: t.isVerified ?? false,
        metrics: t.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 },
      })),
    [communityTemplates],
  );

  // Đợt 1 — TRUNG THỰC: template built-in là nội dung tuyển chọn chính thức "PromptBuilder".
  const enrichedTemplates = useMemo(() => TEMPLATES.map((t) => ({
    ...t,
    authorName: t.authorName || 'PromptBuilder',
    authorAvatar: t.authorAvatar,
    isVerified: t.isVerified ?? true,
    metrics: t.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 },
  })), []);

  // Gộp + khử trùng lặp id + bản đồ nguồn (mine thắng community thắng builtin).
  const { allTemplates, sourceMap } = useMemo(() => {
    const map = new Map<string, LibrarySource>();
    const seen = new Set<string>();
    const out: PromptTemplate[] = [];
    const push = (list: PromptTemplate[], source: LibrarySource) => {
      for (const t of list) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        map.set(t.id, source);
        out.push(t);
      }
    };
    push(myTemplates, 'mine');
    push(communityProcessed, 'community');
    push(enrichedTemplates, 'builtin');
    return { allTemplates: out, sourceMap: map };
  }, [myTemplates, communityProcessed, enrichedTemplates]);

  const sourceCounts = useMemo(() => {
    let mine = 0, community = 0;
    for (const s of sourceMap.values()) {
      if (s === 'mine') mine++;
      else if (s === 'community') community++;
    }
    return { all: sourceMap.size, mine, community };
  }, [sourceMap]);

  // Lọc theo nguồn đang chọn (Tất cả / Của tôi / Cộng đồng).
  const sourcedTemplates = useMemo(
    () => (sourceFilter === 'all' ? allTemplates : allTemplates.filter((t) => sourceMap.get(t.id) === sourceFilter)),
    [allTemplates, sourceFilter, sourceMap],
  );

  // Facet chỉ liệt kê tiêu chí CÓ dữ liệu thật (loại kết quả, framework, thẻ phổ biến).
  const facets = useMemo(() => collectFacets(allTemplates), [allTemplates]);

  const filteredTemplates = useMemo(
    () =>
      filterAndSortTemplates(
        sourcedTemplates,
        {
          search: searchTerm,
          category: selectedCategory,
          outputTypes,
          frameworks,
          tags,
          onlySaved: activeTab === 'saved',
          savedIds,
        },
        activeTab,
      ),
    [sourcedTemplates, searchTerm, selectedCategory, outputTypes, frameworks, tags, activeTab, savedIds],
  );

  // Lớp lọc thêm theo bộ sưu tập đang chọn (post-filter, không đụng filterAndSortTemplates).
  const activeCollection = collections.find((c) => c.id === activeCollectionId) || null;
  const displayedTemplates = useMemo(() => {
    if (!activeCollection) return filteredTemplates;
    const ids = new Set(activeCollection.templateIds);
    return filteredTemplates.filter((t) => ids.has(t.id));
  }, [filteredTemplates, activeCollection]);

  // Resolve id gần đây → template thật (bỏ id không còn tồn tại), tối đa 8 ô hiển thị.
  const recentTemplates = useMemo(
    () => recentIds.map((id) => allTemplates.find((t) => t.id === id)).filter(Boolean).slice(0, 8) as PromptTemplate[],
    [recentIds, allTemplates],
  );

  const toggleFacet = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, value: string) =>
    set(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  const hasActiveFacets = outputTypes.length > 0 || frameworks.length > 0 || tags.length > 0;
  const clearFacets = () => {
    setOutputTypes([]);
    setFrameworks([]);
    setTags([]);
    setActiveCollectionId(null);
  };

  // Deep-link: mở chi tiết template khi URL có ?t=<id> (kể cả template công khai chưa nạp sẵn).
  useEffect(() => {
    const id = parseSharedTemplateId(window.location.search);
    if (!id) return;

    const local = allTemplates.find((tpl) => tpl.id === id);
    if (local) {
      setSelectedPrompt(local as PromptTemplate);
    } else {
      getDoc(doc(db, 'templates', id))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data() as any;
            setSelectedPrompt({ id: snap.id, ...data } as PromptTemplate);
          } else {
            toast.error('Không tìm thấy template được chia sẻ.');
          }
        })
        .catch(() => toast.error('Không tải được template được chia sẻ.'));
    }

    // Dọn query param để không mở lại khi đổi tab / tải lại.
    const cleanUrl = `${window.location.pathname}${window.location.hash || '#library'}`;
    window.history.replaceState(null, '', cleanUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTemplates]);

  return (
    <div className="flex-1 p-6 flex flex-col overflow-y-auto bg-[#fafafa]">
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Thư viện Prompt <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-sm">Beta</span>
            </h2>
            <p className="text-slate-500 mt-2 text-sm font-medium">Khám phá mẫu prompt tuyển chọn, chỉnh sửa (remix) và lưu bộ sưu tập của riêng bạn.</p>
          </div>
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Tìm theo tên, tác giả, thẻ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm font-medium border-2 border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Dùng gần đây — tín hiệu THẬT (thay khối "Kết quả của bạn" seed cứng cũ) */}
        {recentTemplates.length > 0 && (
          <div className="mb-8 bg-white border border-slate-200/60 rounded-3xl p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100/85">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                  Dùng gần đây
                  <span className="text-indigo-600 text-[10px] font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {recentTemplates.length} mẫu
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Những mẫu bạn vừa mở, xem thử hoặc remix — bấm để mở lại.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentTemplates.map((t) => {
                const Icon = OUTPUT_TYPE_ICONS[t.outputExample?.type || ''] || FileText;
                return (
                  <button
                    key={t.id}
                    onClick={() => openDetail(t)}
                    className="group text-left flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-500/5 transition-all"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-indigo-500">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold text-slate-700 line-clamp-1 group-hover:text-indigo-600 transition-colors">{t.title}</div>
                      <div className="text-[10px] text-slate-400 font-semibold line-clamp-1">{t.category || 'Mẫu'}</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 flex items-center gap-0.5">
                      <Eye className="w-3.5 h-3.5" />Mở lại
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nguồn (Đợt 3): Tất cả / Của tôi / Cộng đồng */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Nguồn</span>
          {([['all', 'Tất cả', sourceCounts.all], ['mine', 'Của tôi', sourceCounts.mine], ['community', 'Cộng đồng', sourceCounts.community]] as const).map(([key, label, count]) => {
            const on = sourceFilter === key;
            return (
              <button
                key={key}
                onClick={() => setSourceFilter(key)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full border transition-all ${
                  on ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {label} <span className={on ? 'text-white/60' : 'text-slate-400'}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Social Tabs */}
        <div className="flex gap-6 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('trending')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'trending' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <TrendingUp className="w-4 h-4" /> Trending
            {activeTab === 'trending' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'new' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Sparkles className="w-4 h-4" /> Mới nhất
            {activeTab === 'new' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'saved' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Bookmark className="w-4 h-4" /> Đã lưu{savedIds.size > 0 ? ` (${savedIds.size})` : ''}
            {activeTab === 'saved' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                selectedCategory === category
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Bộ sưu tập cá nhân (Đợt 2) — chip lọc + tạo/xoá */}
        <div className="mt-4 flex items-start gap-3">
          <span className="shrink-0 w-24 pt-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Bộ sưu tập</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {collections.map((c) => {
              const on = activeCollectionId === c.id;
              return (
                <div
                  key={c.id}
                  className={`flex items-center rounded-full border transition-all ${
                    on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  <button
                    onClick={() => setActiveCollectionId(on ? null : c.id)}
                    className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-[11px] font-bold"
                  >
                    <Folder className="w-3 h-3" />
                    {c.name}
                    <span className={on ? 'text-white/70' : 'text-slate-400'}>{c.templateIds.length}</span>
                  </button>
                  {on && (
                    <button
                      onClick={() => handleDeleteCollection(c.id, c.name)}
                      title="Xoá bộ sưu tập"
                      className="pr-2 pl-0.5 py-1 text-white/80 hover:text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {isCreatingCollection ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCollection();
                    if (e.key === 'Escape') { setIsCreatingCollection(false); setNewCollectionName(''); }
                  }}
                  placeholder="Tên bộ sưu tập..."
                  className="w-40 px-2.5 py-1 text-[11px] font-semibold border border-indigo-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
                />
                <button
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim()}
                  className="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Tạo
                </button>
                <button onClick={() => { setIsCreatingCollection(false); setNewCollectionName(''); }} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingCollection(true)}
                className="flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all"
              >
                <Plus className="w-3 h-3" /> Bộ sưu tập
              </button>
            )}
          </div>
        </div>

        {/* Facet Filters — chỉ hiện tiêu chí có dữ liệu thật */}
        {(facets.outputTypes.length > 0 || facets.frameworks.length > 0 || facets.tags.length > 0) && (
          <div className="mt-4 flex flex-col gap-3">
            {facets.outputTypes.length > 0 && (
              <FacetGroup label="Loại kết quả" options={facets.outputTypes} active={outputTypes} onToggle={(v) => toggleFacet(outputTypes, setOutputTypes, v)} />
            )}
            {facets.frameworks.length > 0 && (
              <FacetGroup label="Framework" options={facets.frameworks} active={frameworks} onToggle={(v) => toggleFacet(frameworks, setFrameworks, v)} />
            )}
            {facets.tags.length > 0 && (
              <FacetGroup label="Thẻ phổ biến" options={facets.tags} active={tags} onToggle={(v) => toggleFacet(tags, setTags, v)} />
            )}
          </div>
        )}

        {/* Result count + clear */}
        <div className="flex items-center justify-between mt-5">
          <span className="text-xs font-bold text-slate-500">
            {displayedTemplates.length} mẫu prompt{activeCollection ? ` · ${activeCollection.name}` : ''}
          </span>
          {(hasActiveFacets || activeCollection) && (
            <button onClick={clearFacets} className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1">
              <X className="w-3.5 h-3.5" />Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
        {displayedTemplates.map((template) => (
          <PromptCard
            key={template.id}
            template={template as PromptTemplate}
            onSelect={(t) => openDetail(t)}
            onRemix={(t) => {
              // Phase 4: remix template người khác → bản fork (id mới + forkedFrom).
              markRecent(t);
              onSelectTemplate(prepareRemixTemplate(t, user?.uid));
            }}
            onPreview={(t) => {
              setPreviewPrompt(t);
              markRecent(t);
            }}
            isSaved={isSaved(template.id)}
            onToggleSave={toggleSave}
            onShare={handleShare}
            onAddToCollection={openCollectionModal}
            collectionCount={collectionsContaining(collections, template.id).length}
          />
        ))}

        {displayedTemplates.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-100">
             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-300" />
             </div>
             {sourceFilter === 'community' && sourceCounts.community === 0 ? (
               <>
                 <p className="text-sm font-bold text-slate-600">Chưa có template cộng đồng nào.</p>
                 <p className="text-xs mt-1">Hãy bật "Chia sẻ công khai" khi lưu template để trở thành người đầu tiên chia sẻ.</p>
               </>
             ) : (
               <>
                 <p className="text-sm font-bold text-slate-600">Opps! Trống ở đây.</p>
                 <p className="text-xs mt-1">Không tìm thấy mẫu nào phù hợp với bộ lọc hiện tại.</p>
               </>
             )}
          </div>
        )}
      </div>

      {selectedPrompt && (
        <PromptDetailModal
          template={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          onRemix={(t) => {
            setSelectedPrompt(null);
            markRecent(t);
            onSelectTemplate(prepareRemixTemplate(t, user?.uid));
          }}
          onAddToProject={(t) => {
            setSelectedPrompt(null);
            setAddToProjTemplate(t);
            setIsAddToProjOpen(true);
          }}
          onAddToCollection={openCollectionModal}
          onOpenInGraph={handleOpenInGraph}
          isSaved={isSaved(selectedPrompt.id)}
          onToggleSave={toggleSave}
          onShare={handleShare}
          liked={likedIds.has(selectedPrompt.id)}
          onToggleLike={selectedPrompt.isPublic ? () => handleToggleLike(selectedPrompt) : undefined}
        />
      )}

      {previewPrompt && (
        <ExamplePreviewModal
          template={previewPrompt}
          onClose={() => setPreviewPrompt(null)}
        />
      )}

      <AddToProjectModal
        isOpen={isAddToProjOpen}
        onClose={() => setIsAddToProjOpen(false)}
        user={user}
        template={addToProjTemplate}
        onNavigateToTab={onNavigateToTab || (() => {})}
      />

      <AddToCollectionModal
        isOpen={!!collectionTemplate}
        template={collectionTemplate}
        collections={collections}
        onToggle={toggleTemplateInCollection}
        onCreate={createCollection}
        onClose={() => setCollectionTemplate(null)}
      />
    </div>
  );
}
