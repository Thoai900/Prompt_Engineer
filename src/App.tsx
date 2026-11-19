/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Briefcase, Drama, FlaskConical, GraduationCap, Home, Library, LogIn, LogOut, Loader2, Moon, Sun, Zap, X, SquarePen, MoreHorizontal, ScrollText, PenTool, Workflow, ChevronLeft, ChevronRight, Settings, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDocFromServer, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { PromptTemplate, TabType } from './types';
import { useWorkspace } from './context/WorkspaceContext';
import WorkspaceSwitcher from './components/common/WorkspaceSwitcher';
import PersonaManagerModal from './components/common/PersonaManagerModal';
import SettingsModal from './components/common/SettingsModal';
import HomeTab from './components/tabs/HomeTab'; // eager: là màn hình đầu tiên (landing)
// Các tab còn lại tải lười (code-split) để giảm bundle khởi động — three.js/motion nặng
// chỉ được tải khi người dùng thực sự mở tab tương ứng.
const BuilderTab = lazy(() => import('./components/tabs/BuilderTab'));
const LearnTab = lazy(() => import('./components/tabs/LearnTab'));
// Thư viện: gộp Library · Rules & Skills · LLM Config (spec 2026-11-18-unified-library-design).
const LibraryHub = lazy(() => import('./components/library/LibraryHub'));
const ProjectChainTab = lazy(() => import('./components/tabs/ProjectChainTab'));
const LabTab = lazy(() => import('./components/tabs/LabTab'));
const StudioTab = lazy(() => import('./components/tabs/StudioTab'));
import { Toaster, toast } from './components/common/Toaster';
import { ConfirmDialogHost } from './components/common/ConfirmDialog';
import CommandPalette from './components/common/CommandPalette';
import { auth, db, handleFirestoreError, loginWithGoogle, logoutUser } from './firebase';
import { initSuggestionSync } from './services/suggestionSync';
import { learnFromTemplate } from './services/suggestionStore';
import { DEFAULT_REASONING_MODEL } from './config/models';
import { buildSearchEntries, type SearchEntry } from './utils/globalSearch';
import { loadLocalProjects } from './services/chainAppService';
import { rulesStore, skillsStore, startCollectionStores } from './services/collectionStore';
import { bumpTemplateUsage } from './services/metricsService';
import { blocksChanged, pushVersion, snapshotVersion } from './utils/templateVersionUtils';
import { PRESET_RULES, PRESET_SKILLS } from './presets';
import { LLM_CONFIG_PRESETS } from './data/llmConfigPresets';
import { openLibrary } from './services/libraryNav';
import { NAV_GROUPS, groupOfTab, targetTabForGroup, resolveLegacyTab, type NavGroupId } from './utils/navGroups';
import type { AiRule, AiSkill, CustomProfile } from './types';

// Deep-linking: đồng bộ tab hiện tại với URL hash (vd: #builder) để chia sẻ link
// và dùng nút back/forward của trình duyệt. Không phụ thuộc thư viện router.
const VALID_TABS: TabType[] = ['studio', 'home', 'builder', 'projectchain', 'library', 'learn', 'lab'];

// Hash rỗng → Studio (màn hình chính mới); #home vẫn mở landing page cũ.
// Hash của tab đã gỡ (#enhancer, #aifuture) được chuyển hướng để link cũ không hỏng.
function getTabFromHash(): TabType {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const legacy = resolveLegacyTab(raw, window.location.search);
  if (legacy) {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(legacy.params ?? {})) url.searchParams.set(k, v);
    url.hash = legacy.tab === 'studio' ? '' : legacy.tab;
    window.history.replaceState(null, '', url);
    return legacy.tab;
  }
  return (VALID_TABS as string[]).includes(raw) ? (raw as TabType) : 'studio';
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('mentor_ai_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('mentor_ai_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const cleanup = initSuggestionSync();
    startCollectionStores();
    return cleanup;
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromHash());
  // Tab đã từng được mở: chỉ những tab này mới được mount (lazy). Sau khi mount thì
  // giữ nguyên (ẩn bằng CSS) để không mất state khi chuyển qua lại giữa các tab.
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set<TabType>(['home', getTabFromHash()]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // Tab dùng gần nhất của từng nhóm điều hướng — bấm lại nhóm trên thanh đáy mobile sẽ quay về đúng tab đó.
  const [lastTabByGroup, setLastTabByGroup] = useState<Partial<Record<NavGroupId, TabType>>>({});
  useEffect(() => {
    const g = groupOfTab(activeTab);
    if (g) setLastTabByGroup((prev) => (prev[g.id] === activeTab ? prev : { ...prev, [g.id]: activeTab }));
  }, [activeTab]);
  const activeGroup = groupOfTab(activeTab);

  // Ghi tab hiện tại lên URL hash khi đổi tab (không tạo thêm entry rác cho 'studio' lúc mới vào).
  useEffect(() => {
    const target = activeTab === 'studio' ? '#' : `#${activeTab}`;
    if (window.location.hash !== target && !(activeTab === 'studio' && window.location.hash === '')) {
      window.history.pushState(null, '', target);
    }
  }, [activeTab]);

  // Đồng bộ ngược URL → tab: back/forward (popstate) và sửa hash trực tiếp (hashchange).
  useEffect(() => {
    const sync = () => setActiveTab(getTabFromHash());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loadedTemplate, setLoadedTemplate] = useState<PromptTemplate | null>(null);
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Workspaces & personas đến từ WorkspaceContext (nguồn chân lý duy nhất, đồng bộ Firestore).
  const {
    workspaces, activeWorkspaceId, setActiveWorkspaceId,
    activePersona, isInActiveWorkspace,
  } = useWorkspace();
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Template hiển thị theo workspace đang chọn (lọc client-side, không migrate).
  const visibleTemplates = useMemo(
    () => customTemplates.filter((t) => isInActiveWorkspace(t.workspaceId)),
    [customTemplates, isInActiveWorkspace],
  );

  // Đợt 3 — Cộng đồng thật: template PUBLIC của NGƯỜI KHÁC, KHÔNG lọc theo workspace
  // (workspace là phân vùng cá nhân của người xem, không áp cho nội dung cộng đồng).
  const communityTemplates = useMemo(
    () => customTemplates.filter((t) => t.isPublic && !!t.userId && t.userId !== user?.uid),
    [customTemplates, user?.uid],
  );

  // Điều hướng một màu: icon xám trung tính, chỉ mục đang chọn mang màu nhấn duy nhất (emerald).
  const NAV_ACTIVE = 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 border-emerald-600/20';
  const NAV_ICON = 'text-faint';
  const navigationItems = useMemo(() => [
    { tab: 'studio' as TabType, label: 'Studio', icon: <PenTool size={18} />, active: NAV_ACTIVE, iconColor: NAV_ICON },
    { tab: 'home' as TabType, label: 'Home', icon: <Home size={18} />, active: NAV_ACTIVE, iconColor: NAV_ICON },
    { tab: 'builder' as TabType, label: 'Prompt Builder', icon: <Briefcase size={18} />, active: NAV_ACTIVE, iconColor: NAV_ICON },
    { tab: 'projectchain' as TabType, label: 'Project Chain', icon: <Workflow size={18} />, active: NAV_ACTIVE, iconColor: NAV_ICON },
    { tab: 'library' as TabType, label: 'Thư viện', icon: <Library size={18} />, active: NAV_ACTIVE, iconColor: NAV_ICON },
    { tab: 'learn' as TabType, label: 'Learn', icon: <GraduationCap size={18} />, active: NAV_ACTIVE, iconColor: NAV_ICON },
    { tab: 'lab' as TabType, label: 'Lab', icon: <FlaskConical size={18} />, active: NAV_ACTIVE, iconColor: NAV_ICON },
  ], []);

  // Lệnh palette mở thẳng từng loại trong Thư viện (thay cho tab Rules & Skills / LLM Config cũ).
  const libraryCommands = useMemo(() => [
    { id: 'lib-rules', label: 'Thư viện › Rule', icon: <ScrollText size={16} />, run: () => openLibrary('rules') },
    { id: 'lib-skills', label: 'Thư viện › Skill', icon: <Wrench size={16} />, run: () => openLibrary('skills') },
    { id: 'lib-configs', label: 'Thư viện › LLM Config', icon: <Zap size={16} />, run: () => openLibrary('configs') },
    { id: 'settings', label: 'Mở Cài đặt', icon: <Settings size={16} />, run: () => setIsSettingsOpen(true) },
  ], []);

  const navItemByTab = useMemo(
    () => Object.fromEntries(navigationItems.map((it) => [it.tab, it])) as Record<TabType, (typeof navigationItems)[number]>,
    [navigationItems],
  );

  const GROUP_ICONS: Record<NavGroupId, React.ReactNode> = {
    create: <SquarePen size={20} />,
    library: <Library size={20} />,
    experiment: <FlaskConical size={20} />,
    learn: <GraduationCap size={20} />,
  };

  // Danh sách điều hướng chia nhóm — dùng chung cho sidebar desktop và menu trượt mobile.
  const renderGroupedNav = (collapsed: boolean, onSelect: (tab: TabType) => void) => {
    const renderItem = (tab: TabType) => {
      const item = navItemByTab[tab];
      return (
        <NavItem
          key={tab}
          icon={item.icon}
          label={item.label}
          isActive={activeTab === tab}
          onClick={() => onSelect(tab)}
          activeColorClass={item.active}
          iconColorClass={item.iconColor}
          isCollapsed={collapsed}
        />
      );
    };
    return (
      <div className="space-y-1">
        {renderItem('home')}
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className="pt-3">
            {collapsed ? (
              <div className="mx-3 mb-2 border-t border-line" aria-hidden />
            ) : (
              <div className="px-3 pb-1 text-xs font-medium text-faint">{g.label}</div>
            )}
            <div className="space-y-0.5">{g.tabs.map(renderItem)}</div>
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    }

    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    // M3 (lát cắt real-time): onSnapshot thay cho getDocs một-lần — sửa/thêm template
    // ở thiết bị khác (hoặc do cron/metrics bump) tự cập nhật UI, kèm latency
    // compensation + offline cache (M4). C3: public vẫn cap limit(100), không orderBy
    // để khỏi cần composite index.
    const PUBLIC_TEMPLATES_LIMIT = 100;

    const toTemplate = (id: string, data: any): PromptTemplate => ({
      id,
      title: data.title,
      description: data.description || '',
      category: data.category,
      blocks: data.blocks || [],
      tags: data.tags || [],
      language: data.language,
      isPublic: data.isPublic,
      status: data.status,
      version: data.version,
      metrics: data.metrics,
      variables: data.variables,
      aiConfig: data.aiConfig,
      // Chủ sở hữu: cần để phân biệt "của tôi" vs "cộng đồng" ở LibraryTab (Đợt 3).
      userId: data.userId,
      authorId: data.authorId,
      authorName: data.authorName,
      workspaceId: data.workspaceId,
      versions: data.versions,
      forkedFrom: data.forkedFrom,
    });

    // Hai listener ghi vào hai map riêng; publish gộp (doc của mình thắng bản public trùng id).
    const publicMap = new Map<string, PromptTemplate>();
    const ownMap = new Map<string, PromptTemplate>();
    const publish = () => {
      const merged = new Map(publicMap);
      for (const [id, t] of ownMap) merged.set(id, t);
      setCustomTemplates([...merged.values()]);
    };
    const onError = (err: unknown) => {
      try { handleFirestoreError(err, 'list'); } catch (e: any) { console.error('Failed to load templates:', e.message); }
    };

    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(
      query(collection(db, 'templates'), where('isPublic', '==', true), limit(PUBLIC_TEMPLATES_LIMIT)),
      (snap) => {
        publicMap.clear();
        snap.forEach((d) => publicMap.set(d.id, toTemplate(d.id, d.data())));
        publish();
      },
      onError,
    ));
    if (user) {
      // Lấy MỌI template của mình (cả public) — không phụ thuộc việc template public
      // của mình có lọt vào nhóm limit(100) public ở trên hay không.
      unsubs.push(onSnapshot(
        query(collection(db, 'templates'), where('userId', '==', user.uid)),
        (snap) => {
          ownMap.clear();
          snap.forEach((d) => ownMap.set(d.id, toTemplate(d.id, d.data())));
          publish();
        },
        onError,
      ));
    }

    return () => unsubs.forEach((u) => u());
  }, [user, authReady]);

  const saveTemplateAndStay = (template: PromptTemplate) => handleSaveTemplate(template, { stay: true });

  const handleSelectTemplate = (template: PromptTemplate) => {
    setLoadedTemplate(template);
    setActiveTab('builder');

    // H1: đếm lượt dùng THẬT — chỉ với template public nằm trên Firestore
    // (template built-in/demo không có doc để bump). Fire-and-forget + optimistic.
    const isFirestoreTemplate = customTemplates.some((t) => t.id === template.id);
    if (user && isFirestoreTemplate && template.isPublic) {
      bumpTemplateUsage(template.id).then((ok) => {
        if (!ok) return;
        setCustomTemplates((current) => current.map((t) => t.id === template.id
          ? { ...t, metrics: { ...(t.metrics || { usageCount: 0, upvotes: 0 }), usageCount: (t.metrics?.usageCount || 0) + 1 } }
          : t));
      });
    }
  };

  // Tìm kiếm toàn cục (H4): gom template hiển thị + chain/rule/skill.
  // Gọi mỗi lần MỞ palette (không phải mỗi render); rule/skill lấy từ collectionStore.
  const getSearchEntries = (): SearchEntry[] => {
    const localRules = rulesStore.getSnapshot().items;
    const localSkills = skillsStore.getSnapshot().items;
    // LLM Config (chưa vào collectionStore): localStorage thay toàn bộ preset khi đã có (giống ConfigsView).
    let storedConfigs: CustomProfile[] = LLM_CONFIG_PRESETS;
    try {
      const raw = localStorage.getItem('llm_custom_profiles');
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) storedConfigs = parsed;
    } catch { /* dữ liệu hỏng → dùng preset */ }
    const dedupe = <T extends { id: string }>(preset: T[], custom: T[]): T[] => {
      const ids = new Set(custom.map((x) => x.id));
      return [...custom, ...preset.filter((p) => !ids.has(p.id))];
    };
    return buildSearchEntries({
      templates: visibleTemplates,
      projects: loadLocalProjects(),
      rules: dedupe(PRESET_RULES, localRules),
      skills: dedupe(PRESET_SKILLS, localSkills),
      configs: storedConfigs,
    });
  };

  const handleSelectSearchEntry = (entry: SearchEntry) => {
    if (entry.kind === 'template' && entry.template) handleSelectTemplate(entry.template);
    else if (entry.kind === 'rule') openLibrary('rules', entry.itemId);
    else if (entry.kind === 'skill') openLibrary('skills', entry.itemId);
    else if (entry.kind === 'config') openLibrary('configs', entry.itemId);
    else setActiveTab(entry.tab);
  };

  // `stay`: lưu xong ở lại tab hiện tại (Lab — vòng chất lượng còn chạy lại Health;
  // Studio — bước Hoàn tất còn nút "Kiểm thử chất lượng"). Mặc định chuyển sang Library như cũ.
  const handleSaveTemplate = async (template: PromptTemplate, opts?: { stay?: boolean }) => {
    if (!user) {
      toast('Please login to save templates.');
      return;
    }

    const templateRef = doc(db, 'templates', template.id);

    // Xác định tạo mới hay cập nhật: rules giữ createdAt bất biến, nên khi
    // cập nhật ta KHÔNG được ghi đè createdAt (incoming().createdAt phải == existing().createdAt).
    let isUpdate = false;
    let existingData: any = null;
    try {
      const snap = await getDocFromServer(templateRef);
      isUpdate = snap.exists();
      if (isUpdate) existingData = snap.data();
    } catch (err) {
      try {
        handleFirestoreError(err, 'get', `templates/${template.id}`);
      } catch (handlerErr: any) {
        console.error('Failed to check existing template:', handlerErr.message);
        toast('Could not save this template.');
      }
      return;
    }

    // Đóng dấu workspace: giữ workspaceId sẵn có, nếu chưa có thì gán workspace đang chọn.
    const workspaceId = template.workspaceId || activeWorkspaceId;

    // H2: lịch sử phiên bản — TRƯỚC khi ghi đè bản đã có, chụp snapshot blocks CŨ
    // đẩy vào đầu versions (bỏ qua nếu nội dung không đổi, giữ tối đa 10 bản).
    let versions = existingData?.versions || template.versions || [];
    if (isUpdate && existingData && blocksChanged(existingData.blocks, template.blocks)) {
      versions = pushVersion(
        existingData.versions,
        snapshotVersion({ blocks: existingData.blocks || [], version: existingData.version }),
      );
    }

    const baseData = {
      userId: user.uid,
      title: template.title,
      description: template.description || '',
      category: template.category || 'My templates',
      blocks: template.blocks,
      tags: template.tags || [],
      language: template.language || 'vi',
      isPublic: template.isPublic || false,
      status: template.status || 'Published',
      version: template.version || 'v1.0',
      authorId: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Unknown',
      metrics: template.metrics || { usageCount: 0, upvotes: 0 },
      variables: template.variables || [],
      aiConfig: template.aiConfig || { recommendedModels: [DEFAULT_REASONING_MODEL], temperature: 0.7 },
      workspaceId,
      versions,
      // Phase 4: giữ vết fork (remix từ template nào) nếu có.
      ...(template.forkedFrom ? { forkedFrom: template.forkedFrom } : {}),
      updatedAt: serverTimestamp(),
    };

    try {
      if (isUpdate) {
        // merge: true để giữ nguyên createdAt hiện có; chỉ updatedAt được làm mới.
        await setDoc(templateRef, baseData, { merge: true });
      } else {
        await setDoc(templateRef, { ...baseData, createdAt: serverTimestamp() });
      }

      // Cá nhân hoá: dạy taste model từ chính prompt người dùng lưu (sync tự ghi sau).
      learnFromTemplate(template.blocks);

      // Upsert vào state cục bộ (kèm workspaceId + versions vừa đóng dấu, không cần refetch).
      const stampedTemplate = { ...template, workspaceId, versions };
      setCustomTemplates((current) => {
        const idx = current.findIndex((t) => t.id === template.id);
        if (idx === -1) return [...current, stampedTemplate];
        const next = [...current];
        next[idx] = stampedTemplate;
        return next;
      });
      if (!opts?.stay) setActiveTab('library');
    } catch (err) {
      try {
        handleFirestoreError(err, isUpdate ? 'update' : 'create', `templates/${template.id}`);
      } catch (handlerErr: any) {
        console.error('Failed to save template:', handlerErr.message);
        toast('Could not save this template.');
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-surface font-sans text-ink md:flex-row">
      <Toaster />
      <ConfirmDialogHost />
      <CommandPalette
        items={navigationItems.map((it) => ({ tab: it.tab, label: it.label, icon: it.icon }))}
        commands={libraryCommands}
        onNavigate={setActiveTab}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        getSearchEntries={getSearchEntries}
        onSelectEntry={handleSelectSearchEntry}
      />
      {/* Header tĩnh trên Mobile — ẩn ở trang chủ để landing page chiếm trọn màn hình */}
      {activeTab !== 'home' && (
      <header className="z-50 flex w-full items-center justify-between border-b border-line bg-panel p-3 md:hidden shrink-0">
        <div className="flex cursor-pointer items-center space-x-2.5" onClick={() => setActiveTab('home')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">P</div>
          <h1 className="text-base font-semibold tracking-tight text-ink">PromptBuilder</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="touch-manipulation rounded-xl p-2 text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900 cursor-pointer"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>
      )}

      {/* Tab con của nhóm đang mở (mobile) — chỉ hiện khi nhóm có từ 2 tab */}
      {activeTab !== 'home' && activeGroup && activeGroup.tabs.length > 1 && (
        <div className="md:hidden shrink-0 border-b border-line bg-panel">
          <div className="flex overflow-x-auto px-2 no-scrollbar" role="tablist" aria-label={activeGroup.label}>
            {activeGroup.tabs.map((tab) => {
              const item = navItemByTab[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  className={`touch-manipulation shrink-0 whitespace-nowrap min-h-11 px-3 text-sm border-b-2 transition-colors cursor-pointer ${
                    isActive ? 'border-emerald-600 font-semibold text-ink' : 'border-transparent font-medium text-muted'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawer trượt trên Mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Lớp phủ mờ nền */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-[70] bg-slate-950/40 md:hidden"
            />
            {/* Khung menu trượt */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 top-0 z-[80] flex w-72 flex-col bg-panel p-5 shadow-xl border-r border-line md:hidden"
            >
              {/* Header Drawer */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex cursor-pointer items-center space-x-2.5" onClick={() => { setActiveTab('home'); setIsMobileMenuOpen(false); }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">P</div>
                  <h1 className="text-base font-semibold tracking-tight text-ink">PromptBuilder</h1>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="touch-manipulation rounded-xl p-2 text-slate-650 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900 cursor-pointer"
                  title="Đóng Menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Workspace + Persona trong Drawer */}
              <div className="my-4 space-y-2">
                <WorkspaceSwitcher />
                <button
                  onClick={() => { setIsPersonaModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  <span className="flex items-center gap-2"><Drama size={14} className="text-faint" /> Persona</span>
                  <span className="truncate text-xs text-slate-400">{activePersona?.name || 'Không dùng'}</span>
                </button>
                <button
                  onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  <Settings size={14} className="text-faint" /> Cài đặt
                </button>
              </div>

              {/* Tabs trong Drawer */}
              <div className="flex-1 overflow-y-auto pr-1">
                {renderGroupedNav(false, (tab) => { setActiveTab(tab); setIsMobileMenuOpen(false); })}
              </div>

              {/* Footer Drawer */}
              <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
                {user ? (
                  <div className="flex flex-col gap-3">
                    <div className="truncate px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{user.email}</div>
                    <button
                      onClick={() => { logoutUser(); setIsMobileMenuOpen(false); }}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-650 border border-slate-200/50 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-400 dark:hover:bg-rose-950/20 dark:hover:text-rose-400"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { loginWithGoogle(); setIsMobileMenuOpen(false); }}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  >
                    <LogIn size={15} />
                    Sign in to sync
                  </button>
                )}
                <p className="mt-4 px-1 text-xs font-semibold text-slate-400 dark:text-slate-500">V2.4 INTERNATIONAL STD</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

       {/* Sidebar trên Desktop — ẩn ở trang chủ để người dùng tập trung vào landing page */}
      {activeTab !== 'home' && (
      <nav className={`hidden md:flex md:flex-col md:items-stretch md:justify-start md:border-r md:p-4 z-[60] border-line bg-panel transition-all duration-300 ease-in-out shrink-0 ${
        isSidebarCollapsed ? 'md:w-20' : 'md:w-64'
      }`}>
        <div className={`flex md:mb-6 md:px-2 shrink-0 ${
          isSidebarCollapsed ? 'flex-col items-center justify-center gap-2.5' : 'flex-row items-center justify-between'
        }`}>
          <div className="flex cursor-pointer items-center space-x-3 overflow-hidden" onClick={() => setActiveTab('home')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">P</div>
            {!isSidebarCollapsed && (
              <h1 className="text-base font-semibold tracking-tight text-ink">PromptBuilder</h1>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 cursor-pointer transition-colors"
            title={isSidebarCollapsed ? "Mở rộng" : "Thu gọn"}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col space-y-1">
          <div className="mb-4 px-2 flex flex-col items-center gap-2">
            {!isSidebarCollapsed ? (
              <>
                <WorkspaceSwitcher />
                <button
                  onClick={() => setIsPersonaModalOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850"
                  title="Quản lý Persona"
                >
                  <span className="flex items-center gap-2"><Drama size={14} className="text-faint" /> Persona</span>
                  <span className="max-w-[90px] truncate text-xs text-slate-400">{activePersona?.name || 'Không dùng'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    const currentIndex = workspaces.findIndex(w => w.id === activeWorkspaceId);
                    const nextIndex = (currentIndex + 1) % workspaces.length;
                    setActiveWorkspaceId(workspaces[nextIndex].id);
                  }}
                  title={`Workspace: ${workspaces.find(w => w.id === activeWorkspaceId)?.name} (Bấm để chuyển)`}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-bold text-slate-750 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  {workspaces.find(w => w.id === activeWorkspaceId)?.name.charAt(0) || 'W'}
                </button>
                <button
                  onClick={() => setIsPersonaModalOpen(true)}
                  title={`Persona: ${activePersona?.name || 'Không dùng'}`}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-hover text-muted border border-line cursor-pointer hover:text-ink transition-colors"
                >
                  <Drama size={15} />
                </button>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            {renderGroupedNav(isSidebarCollapsed, setActiveTab)}
          </div>
        </div>

        <div className="mt-auto w-full border-t border-slate-100 px-2 pt-4 dark:border-slate-900">
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Cài đặt: gợi ý gõ nhanh, sao lưu, thống kê sử dụng"
            className={`mb-2 flex cursor-pointer items-center gap-2 rounded-xl text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-ink ${
              isSidebarCollapsed ? 'h-9 w-9 justify-center px-0 mx-auto' : 'w-full px-3.5 py-2'
            }`}
          >
            <Settings size={15} />
            {!isSidebarCollapsed && <span>Cài đặt</span>}
          </button>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Chuyển sang Giao diện tối' : 'Chuyển sang Giao diện sáng'}
            className={`mb-3 flex cursor-pointer items-center rounded-xl border border-slate-200/50 bg-slate-50/50 text-xs font-semibold text-slate-650 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 ${
              isSidebarCollapsed ? 'h-9 w-9 justify-center px-0 mx-auto' : 'w-full px-3.5 py-2.5 justify-between'
            }`}
          >
            <div className="flex items-center gap-2">
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
              {!isSidebarCollapsed && <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-450 dark:bg-slate-800">
                {theme === 'light' ? 'Off' : 'On'}
              </span>
            )}
          </button>

          {user ? (
            <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center' : 'flex-col gap-2'}`}>
              {!isSidebarCollapsed && <div className="truncate px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{user.email}</div>}
              <button
                onClick={logoutUser}
                title={isSidebarCollapsed ? `Đăng xuất (${user.email})` : undefined}
                className={`flex cursor-pointer items-center gap-2 rounded-lg text-xs font-medium text-slate-655 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-955/20 dark:hover:text-rose-400 ${
                  isSidebarCollapsed ? 'h-8 w-8 justify-center px-0 mx-auto' : 'w-full px-3 py-1.5'
                }`}
              >
                <LogOut size={14} />
                {!isSidebarCollapsed && <span>Sign out</span>}
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              title={isSidebarCollapsed ? "Đăng nhập để đồng bộ" : undefined}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 ${
                isSidebarCollapsed ? 'h-8 w-8 px-0 mx-auto' : 'w-full px-3 py-2'
              }`}
            >
              <LogIn size={15} />
              {!isSidebarCollapsed && <span>Sign in to sync</span>}
            </button>
          )}
          {!isSidebarCollapsed && <p className="mt-4 px-1 text-xs font-semibold text-slate-400 dark:text-slate-550">V2.4 INTERNATIONAL STD</p>}
        </div>
      </nav>
      )}

      <main className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-surface">
        <Suspense fallback={<TabLoader />}>
          <TabPanel isActive={activeTab === 'home'} mounted={visitedTabs.has('home')}>
            <HomeTab
              onSelectTemplate={handleSelectTemplate}
              onSaveTemplate={handleSaveTemplate}
              user={user}
              onNavigateToBuilder={() => setActiveTab('builder')}
              onNavigateToTab={setActiveTab}
              theme={theme}
              onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            />
          </TabPanel>
          <TabPanel isActive={activeTab === 'builder'} mounted={visitedTabs.has('builder')}>
            <BuilderTab
              initialTemplate={loadedTemplate}
              onSaveTemplate={handleSaveTemplate}
              user={user}
              onNavigateToTab={setActiveTab}
            />
          </TabPanel>
          <TabPanel isActive={activeTab === 'library'} mounted={visitedTabs.has('library')}>
            <LibraryHub
              user={user}
              customTemplates={visibleTemplates}
              communityTemplates={communityTemplates}
              activeWorkspaceId={activeWorkspaceId}
              onSelectTemplate={handleSelectTemplate}
              onSaveTemplate={handleSaveTemplate}
              onNavigateToTab={setActiveTab}
              getSearchEntries={getSearchEntries}
            />
          </TabPanel>
          <TabPanel isActive={activeTab === 'learn'} mounted={visitedTabs.has('learn')}>
            <LearnTab libraryTemplates={visibleTemplates} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'projectchain'} mounted={visitedTabs.has('projectchain')}>
            <ProjectChainTab theme={theme} user={user} customTemplates={visibleTemplates} onSaveTemplate={handleSaveTemplate} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'lab'} mounted={visitedTabs.has('lab')}>
            <LabTab libraryTemplates={visibleTemplates} onApplyTemplate={handleSelectTemplate} onSaveTemplate={saveTemplateAndStay} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'studio'} mounted={visitedTabs.has('studio')}>
            <StudioTab
              user={user}
              authReady={authReady}
              onSaveTemplate={saveTemplateAndStay}
              onOpenInBuilder={handleSelectTemplate}
              onNavigateToTab={setActiveTab}
              onLogin={loginWithGoogle}
            />
          </TabPanel>
        </Suspense>
      </main>

      {/* Thanh tab đáy (mobile): 4 nhóm + "Thêm" (menu đầy đủ: workspace, persona, đăng nhập) */}
      {activeTab !== 'home' && (
        <nav className="md:hidden shrink-0 border-t border-line bg-panel pb-safe" aria-label="Điều hướng chính">
          <div className="grid grid-cols-5">
            {NAV_GROUPS.map((g) => {
              const isActive = activeGroup?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveTab(isActive ? activeTab : targetTabForGroup(g.id, lastTabByGroup))}
                  aria-current={isActive ? 'page' : undefined}
                  className={`touch-manipulation flex min-h-14 flex-col items-center justify-center gap-1 text-xs cursor-pointer ${
                    isActive ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'font-medium text-muted'
                  }`}
                >
                  {GROUP_ICONS[g.id]}
                  <span>{g.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              title="Mở Menu"
              className="touch-manipulation flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium text-muted cursor-pointer"
            >
              <MoreHorizontal size={20} />
              <span>Thêm</span>
            </button>
          </div>
        </nav>
      )}

      <PersonaManagerModal isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} />
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

function TabPanel({ isActive, mounted = true, children }: { isActive: boolean; mounted?: boolean; children: React.ReactNode }) {
  // Chưa từng mở thì không render (tránh tải code-split & chạy effect của tab nặng).
  if (!mounted) return null;
  return (
    <div className={`${isActive ? 'flex animate-fade-in' : 'hidden'} relative z-10 h-full w-full flex-1 flex-col overflow-hidden`}>
      {children}
    </div>
  );
}

function TabLoader() {
  return (
    <div className="relative z-10 flex h-full w-full flex-1 items-center justify-center">
      <Loader2 size={28} className="animate-spin text-emerald-500" />
    </div>
  );
}

function NavItem({
  icon,
  label,
  isActive,
  onClick,
  activeColorClass,
  iconColorClass,
  isCollapsed,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  activeColorClass: string;
  iconColorClass: string;
  isCollapsed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={`relative flex w-full items-center rounded-lg border border-transparent min-h-11 md:min-h-0 py-2 text-sm font-medium transition-colors duration-200 ${
        isCollapsed ? 'justify-center px-0' : 'space-x-3 px-3'
      } ${
        isActive
          ? `${activeColorClass} font-semibold`
          : 'cursor-pointer text-muted hover:bg-hover hover:text-ink'
      }`}
    >
      <span className={`shrink-0 ${isActive ? '' : iconColorClass}`}>
        {icon}
      </span>
      <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap text-left ${
        isCollapsed ? 'w-0 opacity-0 max-w-0 pointer-events-none' : 'w-auto opacity-100 max-w-xs ml-3'
      }`}>
        {label}
      </span>
    </button>
  );
}
