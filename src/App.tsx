/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Brain, Briefcase, Drama, FlaskConical, GraduationCap, Home, Library, LogIn, LogOut, Loader2, Moon, Sparkles, Sun, Zap, Menu, X, ScrollText, Workflow, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDocFromServer, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { PromptTemplate, TabType } from './types';
import { useWorkspace } from './context/WorkspaceContext';
import WorkspaceSwitcher from './components/common/WorkspaceSwitcher';
import PersonaManagerModal from './components/common/PersonaManagerModal';
import HomeTab from './components/tabs/HomeTab'; // eager: là màn hình đầu tiên (landing)
// Các tab còn lại tải lười (code-split) để giảm bundle khởi động — three.js/motion nặng
// chỉ được tải khi người dùng thực sự mở tab tương ứng.
const AIFutureTab = lazy(() => import('./components/tabs/AIFutureTab'));
const BuilderTab = lazy(() => import('./components/tabs/BuilderTab'));
const EnhancerTab = lazy(() => import('./components/tabs/EnhancerTab'));
const LearnTab = lazy(() => import('./components/tabs/LearnTab'));
const LibraryTab = lazy(() => import('./components/tabs/LibraryTab'));
const UtilityBeltTab = lazy(() => import('./components/tabs/UtilityBeltTab'));
const RulesSkillsTab = lazy(() => import('./components/tabs/RulesSkillsTab'));
const ProjectChainTab = lazy(() => import('./components/tabs/ProjectChainTab'));
const LabTab = lazy(() => import('./components/tabs/LabTab'));
import AuroraBackground from './components/common/AuroraBackground';
import GrainOverlay from './components/common/GrainOverlay';
import { Toaster, toast } from './components/common/Toaster';
import { ConfirmDialogHost } from './components/common/ConfirmDialog';
import CommandPalette from './components/common/CommandPalette';
import { auth, db, handleFirestoreError, loginWithGoogle, logoutUser } from './firebase';
import { initSuggestionSync } from './services/suggestionSync';
import { learnFromTemplate } from './services/suggestionStore';
import { DEFAULT_REASONING_MODEL } from './config/models';
import { buildSearchEntries, type SearchEntry } from './utils/globalSearch';
import { loadLocalProjects } from './services/chainAppService';
import { bumpTemplateUsage } from './services/metricsService';
import { blocksChanged, pushVersion, snapshotVersion } from './utils/templateVersionUtils';
import { PRESET_RULES, PRESET_SKILLS } from './presets';
import type { AiRule, AiSkill } from './types';

// Deep-linking: đồng bộ tab hiện tại với URL hash (vd: #builder) để chia sẻ link
// và dùng nút back/forward của trình duyệt. Không phụ thuộc thư viện router.
const VALID_TABS: TabType[] = ['home', 'builder', 'projectchain', 'rulesskills', 'utilitybelt', 'library', 'enhancer', 'learn', 'lab', 'aifuture'];

function getTabFromHash(): TabType {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (VALID_TABS as string[]).includes(raw) ? (raw as TabType) : 'home';
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
    return cleanup;
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>(() => getTabFromHash());
  // Tab đã từng được mở: chỉ những tab này mới được mount (lazy). Sau khi mount thì
  // giữ nguyên (ẩn bằng CSS) để không mất state khi chuyển qua lại giữa các tab.
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set<TabType>(['home', getTabFromHash()]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // Ghi tab hiện tại lên URL hash khi đổi tab (không tạo thêm entry rác cho 'home' lúc mới vào).
  useEffect(() => {
    const target = activeTab === 'home' ? '#' : `#${activeTab}`;
    if (window.location.hash !== target && !(activeTab === 'home' && window.location.hash === '')) {
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

  // Template hiển thị theo workspace đang chọn (lọc client-side, không migrate).
  const visibleTemplates = useMemo(
    () => customTemplates.filter((t) => isInActiveWorkspace(t.workspaceId)),
    [customTemplates, isInActiveWorkspace],
  );

  const navigationItems = useMemo(() => [
    { tab: 'home' as TabType, label: 'Home', icon: <Home size={18} />, active: 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800', iconColor: 'text-slate-400' },
    { tab: 'builder' as TabType, label: 'Prompt Builder', icon: <Briefcase size={18} />, active: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50', iconColor: 'text-indigo-500' },
    { tab: 'projectchain' as TabType, label: 'Project Chain', icon: <Workflow size={18} />, active: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-100 dark:border-cyan-900/50', iconColor: 'text-cyan-500' },
    { tab: 'rulesskills' as TabType, label: 'Rules & Skills', icon: <ScrollText size={18} />, active: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900/50', iconColor: 'text-violet-500' },
    { tab: 'utilitybelt' as TabType, label: 'LLM Config', icon: <Zap size={18} />, active: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-900/50', iconColor: 'text-orange-500' },
    { tab: 'library' as TabType, label: 'Library', icon: <Library size={18} />, active: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50', iconColor: 'text-emerald-500' },
    { tab: 'enhancer' as TabType, label: 'AI Enhancer', icon: <Sparkles size={18} />, active: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-900/50', iconColor: 'text-teal-500' },
    { tab: 'learn' as TabType, label: 'Learn', icon: <GraduationCap size={18} />, active: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/50', iconColor: 'text-blue-500' },
    { tab: 'lab' as TabType, label: 'Lab', icon: <FlaskConical size={18} />, active: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50', iconColor: 'text-emerald-500' },
    { tab: 'aifuture' as TabType, label: 'AI Future', icon: <Brain size={18} />, active: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/50', iconColor: 'text-purple-500' },
  ], []);

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
      unsubs.push(onSnapshot(
        query(collection(db, 'templates'), where('userId', '==', user.uid), where('isPublic', '==', false)),
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

  // Tìm kiếm toàn cục (H4): gom template hiển thị + chain/rule/skill cục bộ.
  // Gọi mỗi lần MỞ palette (không phải mỗi render) nên đọc localStorage tại chỗ là rẻ.
  const getSearchEntries = (): SearchEntry[] => {
    const readLs = <T,>(key: string): T[] => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch { return []; }
    };
    const localRules = readLs<AiRule>('custom_rules');
    const localSkills = readLs<AiSkill>('custom_skills');
    const dedupe = <T extends { id: string }>(preset: T[], custom: T[]): T[] => {
      const ids = new Set(custom.map((x) => x.id));
      return [...custom, ...preset.filter((p) => !ids.has(p.id))];
    };
    return buildSearchEntries({
      templates: visibleTemplates,
      projects: loadLocalProjects(),
      rules: dedupe(PRESET_RULES, localRules),
      skills: dedupe(PRESET_SKILLS, localSkills),
    });
  };

  const handleSelectSearchEntry = (entry: SearchEntry) => {
    if (entry.kind === 'template' && entry.template) handleSelectTemplate(entry.template);
    else setActiveTab(entry.tab);
  };

  const handleSaveTemplate = async (template: PromptTemplate) => {
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
      setActiveTab('library');
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
      <GrainOverlay />
      <Toaster />
      <ConfirmDialogHost />
      <CommandPalette
        items={navigationItems.map((it) => ({ tab: it.tab, label: it.label, icon: it.icon }))}
        onNavigate={setActiveTab}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        getSearchEntries={getSearchEntries}
        onSelectEntry={handleSelectSearchEntry}
      />
      {/* Header tĩnh trên Mobile — ẩn ở trang chủ để landing page chiếm trọn màn hình */}
      {activeTab !== 'home' && (
      <header className="z-50 flex w-full items-center justify-between border-b border-line/50 bg-glass/70 p-3.5 backdrop-blur-md md:hidden shrink-0">
        <div className="flex cursor-pointer items-center space-x-2.5" onClick={() => setActiveTab('home')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white shadow-sm">
            <span className="text-sm">P</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-ink">Prompt<span className="text-emerald-500">Builder</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="touch-manipulation rounded-xl p-2 text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900 cursor-pointer"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <Moon size={18} className="text-violet-500" /> : <Sun size={18} className="text-amber-500" />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="touch-manipulation rounded-xl p-2 text-slate-650 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900 cursor-pointer"
            title="Mở Menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
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
              className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-xs md:hidden"
            />
            {/* Khung menu trượt */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 top-0 z-[80] flex w-72 flex-col bg-panel/95 p-5 shadow-2xl backdrop-blur-lg border-r border-line/50 md:hidden"
            >
              {/* Header Drawer */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex cursor-pointer items-center space-x-2.5" onClick={() => { setActiveTab('home'); setIsMobileMenuOpen(false); }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white shadow-sm">
                    <span className="text-sm">P</span>
                  </div>
                  <h1 className="text-base font-bold tracking-tight text-ink">Prompt<span className="text-emerald-500">Builder</span></h1>
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
                  <span className="flex items-center gap-2"><Drama size={14} className="text-violet-500" /> Persona</span>
                  <span className="truncate text-[11px] text-slate-400">{activePersona?.name || 'Không dùng'}</span>
                </button>
              </div>

              {/* Tabs trong Drawer */}
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                {navigationItems.map((item) => (
                  <button
                    key={item.tab}
                    onClick={() => {
                      setActiveTab(item.tab);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center space-x-3.5 rounded-xl border border-transparent px-3.5 py-3 text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === item.tab
                        ? `${item.active} font-bold shadow-sm`
                        : 'text-muted hover:bg-hover'
                    }`}
                  >
                    <span className={activeTab === item.tab ? 'scale-110' : item.iconColor}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
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
                <p className="mt-4 px-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">V2.4 INTERNATIONAL STD</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

       {/* Sidebar trên Desktop — ẩn ở trang chủ để người dùng tập trung vào landing page */}
      {activeTab !== 'home' && (
      <nav className={`hidden md:flex md:flex-col md:items-stretch md:justify-start md:border-r md:p-4 z-[60] border-line/50 bg-glass/70 backdrop-blur-md transition-all duration-300 ease-in-out shrink-0 ${
        isSidebarCollapsed ? 'md:w-20' : 'md:w-64'
      }`}>
        <div className={`flex md:mb-6 md:px-2 shrink-0 ${
          isSidebarCollapsed ? 'flex-col items-center justify-center gap-2.5' : 'flex-row items-center justify-between'
        }`}>
          <div className="flex cursor-pointer items-center space-x-3 overflow-hidden" onClick={() => setActiveTab('home')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white shadow-sm">
              <span className="text-sm">P</span>
            </div>
            {!isSidebarCollapsed && (
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white md:text-xl">
                Prompt<span className="text-emerald-500">Builder</span>
              </h1>
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

        <div className="flex flex-1 flex-col space-y-1">
          <div className="mb-4 px-2 flex flex-col items-center gap-2">
            {!isSidebarCollapsed ? (
              <>
                <WorkspaceSwitcher />
                <button
                  onClick={() => setIsPersonaModalOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850"
                  title="Quản lý Persona"
                >
                  <span className="flex items-center gap-2"><Drama size={14} className="text-violet-500" /> Persona</span>
                  <span className="max-w-[90px] truncate text-[11px] text-slate-400">{activePersona?.name || 'Không dùng'}</span>
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
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-500 border border-violet-100 dark:border-violet-900/50 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                >
                  <Drama size={15} />
                </button>
              </>
            )}
          </div>

          {navigationItems.map((item) => (
            <NavItem
              key={item.tab}
              icon={item.icon}
              label={item.label}
              isActive={activeTab === item.tab}
              onClick={() => setActiveTab(item.tab)}
              activeColorClass={item.active}
              iconColorClass={item.iconColor}
              isCollapsed={isSidebarCollapsed}
            />
          ))}
        </div>

        <div className="mt-auto w-full border-t border-slate-100 px-2 pt-4 dark:border-slate-900">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Chuyển sang Giao diện tối' : 'Chuyển sang Giao diện sáng'}
            className={`mb-3 flex cursor-pointer items-center rounded-xl border border-slate-200/50 bg-slate-50/50 text-xs font-semibold text-slate-650 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 ${
              isSidebarCollapsed ? 'h-9 w-9 justify-center px-0 mx-auto' : 'w-full px-3.5 py-2.5 justify-between'
            }`}
          >
            <div className="flex items-center gap-2">
              {theme === 'light' ? <Moon size={15} className="text-violet-500" /> : <Sun size={15} className="text-amber-500" />}
              {!isSidebarCollapsed && <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-450 dark:bg-slate-800">
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
          {!isSidebarCollapsed && <p className="mt-4 px-1 text-[10px] font-semibold text-slate-400 dark:text-slate-550">V2.4 INTERNATIONAL STD</p>}
        </div>
      </nav>
      )}

      <main className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-surface">
        <AuroraBackground />

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
            <LibraryTab
              onSelectTemplate={handleSelectTemplate}
              customTemplates={visibleTemplates}
              user={user}
              onNavigateToTab={setActiveTab}
            />
          </TabPanel>
          <TabPanel isActive={activeTab === 'enhancer'} mounted={visitedTabs.has('enhancer')}>
            <EnhancerTab onApplyTemplate={handleSelectTemplate} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'learn'} mounted={visitedTabs.has('learn')}>
            <LearnTab libraryTemplates={visibleTemplates} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'aifuture'} mounted={visitedTabs.has('aifuture')}>
            <AIFutureTab theme={theme} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'utilitybelt'} mounted={visitedTabs.has('utilitybelt')}>
            <UtilityBeltTab user={user} onSaveTemplate={handleSaveTemplate} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'rulesskills'} mounted={visitedTabs.has('rulesskills')}>
            <RulesSkillsTab user={user} onApplyTemplate={handleSelectTemplate} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'projectchain'} mounted={visitedTabs.has('projectchain')}>
            <ProjectChainTab theme={theme} user={user} customTemplates={visibleTemplates} onSaveTemplate={handleSaveTemplate} />
          </TabPanel>
          <TabPanel isActive={activeTab === 'lab'} mounted={visitedTabs.has('lab')}>
            <LabTab libraryTemplates={visibleTemplates} onApplyTemplate={handleSelectTemplate} onSaveTemplate={handleSaveTemplate} />
          </TabPanel>
        </Suspense>
      </main>

      <PersonaManagerModal isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} />
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
      className={`relative flex w-full items-center rounded-xl border border-transparent py-2.5 text-xs font-semibold transition-colors duration-200 ${
        isCollapsed ? 'justify-center px-0' : 'space-x-3 px-3'
      } ${
        isActive
          ? `${activeColorClass} font-bold`
          : 'cursor-pointer text-muted hover:bg-hover hover:text-ink'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="navPill"
          className={`absolute inset-0 -z-10 rounded-xl border shadow-sm ${activeColorClass}`}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <span className={`transition-transform duration-200 shrink-0 ${isActive ? 'scale-110' : iconColorClass}`}>
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
