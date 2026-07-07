import { toast } from '../common/Toaster';
import { confirmDialog } from '../common/ConfirmDialog';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Layers, X } from 'lucide-react';
import { collection, doc, getDocs, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PromptProject, PromptTemplate } from '../../types';
import { TEMPLATES } from '../../data';
import { useWorkspace } from '../../context/WorkspaceContext';
import { GraphWorkspace } from '../project-chain/GraphWorkspace';
import { createEmptyGraphProject, isGraphProject, migrateProjectToGraph, parseRawPromptToGraph } from '../../utils/graphMigration';
import { GRAPH_SAMPLE_PROJECTS } from '../../utils/graphSamples';

/**
 * Project Chain v3 — "Prompt Graph": shell của tab, chỉ còn quản lý danh sách
 * dự án + đồng bộ Firestore. Toàn bộ canvas/panel nằm trong GraphWorkspace.
 * (Chế độ Wizard tuyến tính và cây tiến hoá v2 đã được thay bằng đồ thị;
 * project cũ được migrate tự động khi mở, bản gốc backup vào localStorage.)
 */

const LOCAL_KEY = 'mentor_ai_prompt_projects';
const BACKUP_KEY = 'mentor_ai_projects_backup_v2';

interface ProjectChainTabProps {
  theme?: 'light' | 'dark';
  user: any;
  customTemplates?: PromptTemplate[];
  onSaveTemplate?: (template: PromptTemplate) => Promise<void>;
}

/** Backup 1 lần trước khi migrate, rồi chuyển mọi project legacy sang v3. */
function migrateAll(list: PromptProject[]): { list: PromptProject[]; migratedCount: number } {
  const legacyCount = list.filter((p) => !isGraphProject(p)).length;
  if (legacyCount > 0 && !localStorage.getItem(BACKUP_KEY)) {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); } catch (e) { console.error(e); }
  }
  return { list: list.map(migrateProjectToGraph), migratedCount: legacyCount };
}

export default function ProjectChainTab({ theme = 'dark', user, customTemplates = [], onSaveTemplate }: ProjectChainTabProps) {
  const { activeWorkspaceId, isInActiveWorkspace } = useWorkspace();
  const [projects, setProjects] = useState<PromptProject[]>([]);
  const [activeProject, setActiveProject] = useState<PromptProject | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'local' | 'error'>('local');

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPaste, setNewProjectPaste] = useState('');

  const allAvailableTemplates = [...TEMPLATES, ...(customTemplates || [])];

  const saveProjectState = async (proj: PromptProject) => {
    // Đóng dấu workspace: giữ workspaceId sẵn có, nếu chưa có thì gán workspace đang chọn.
    const updatedProj: PromptProject = { ...proj, workspaceId: proj.workspaceId || activeWorkspaceId };
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === updatedProj.id ? updatedProj : p));
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch (e) { console.error(e); }
      return next;
    });
    setActiveProject(updatedProj);

    if (user) {
      setSyncStatus('saving');
      try {
        await setDoc(doc(db, 'projects', updatedProj.id), {
          ...updatedProj,
          userId: user.uid,
          updatedAt: new Date().toISOString(),
        });
        setSyncStatus('synced');
      } catch (err) {
        console.error('Lỗi Firestore:', err);
        setSyncStatus('error');
      }
    }
  };

  // ── Tải dữ liệu (localStorage + Firestore) và migrate v2 → v3 ──────────────
  useEffect(() => {
    async function loadProjects() {
      let localProjects: PromptProject[] = [];
      try {
        const saved = localStorage.getItem(LOCAL_KEY);
        if (saved) localProjects = JSON.parse(saved);
      } catch (e) {
        console.error('Lỗi parse local projects:', e);
      }

      if (localProjects.length === 0) {
        localProjects = [...GRAPH_SAMPLE_PROJECTS];
      }

      let finalList = localProjects;

      if (user) {
        setSyncStatus('saving');
        try {
          const snap = await getDocs(query(collection(db, 'projects'), where('userId', '==', user.uid)));
          const dbProjects: PromptProject[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any;
            dbProjects.push({
              id: docSnap.id,
              name: data.name,
              description: data.description || '',
              globalEvalCriteria: data.globalEvalCriteria || [],
              nodes: data.nodes || [],
              schemaVersion: data.schemaVersion,
              graphNodes: data.graphNodes,
              edges: data.edges,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
              userId: data.userId,
              workspaceId: data.workspaceId,
              testCases: data.testCases || [],
              versions: data.versions || [],
            });
          });

          if (dbProjects.length > 0) {
            finalList = dbProjects;
          } else {
            // Lần đầu đăng nhập: đẩy danh sách cục bộ lên cloud.
            for (const p of localProjects) {
              await setDoc(doc(db, 'projects', p.id), { ...p, userId: user.uid });
            }
          }
          setSyncStatus('synced');
        } catch (err) {
          console.error('Lỗi load Firestore:', err);
          setSyncStatus('local');
        }
      } else {
        setSyncStatus('local');
      }

      const migrated = migrateAll(finalList);
      finalList = migrated.list;

      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(finalList)); } catch (e) { console.error(e); }

      setProjects(finalList);
      const activeId = localStorage.getItem('active_project_id');
      setActiveProject(finalList.find((p) => p.id === activeId) || finalList[0] || null);

      if (migrated.migratedCount > 0) {
        toast.info(`${migrated.migratedCount} dự án đã chuyển sang mô hình đồ thị mới. Các nhánh cũ nằm trên canvas ở trạng thái TẮT — cắm dây để dùng lại (bản gốc đã được sao lưu).`);
      }
    }

    loadProjects();
  }, [user]);

  // Prompt Studio xuất template → Prompt Graph: tab này mount-giữ-state nên nhận
  // project mới qua sự kiện (Studio đã tự lưu localStorage + Firestore trước đó).
  useEffect(() => {
    const onProjectAdded = (e: Event) => {
      const proj = (e as CustomEvent<PromptProject>).detail;
      if (!proj?.id) return;
      setProjects((prev) => {
        const next = [...prev.filter((p) => p.id !== proj.id), proj];
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch (err) { console.error(err); }
        return next;
      });
      setActiveProject(proj);
    };
    window.addEventListener('pb:project-added', onProjectAdded);
    return () => window.removeEventListener('pb:project-added', onProjectAdded);
  }, []);

  // Đổi workspace: nếu dự án đang mở không thuộc workspace mới → chuyển sang dự án đầu tiên hiển thị.
  useEffect(() => {
    if (activeProject && !isInActiveWorkspace(activeProject.workspaceId)) {
      setActiveProject(projects.find((p) => isInActiveWorkspace(p.workspaceId)) || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (activeProject) localStorage.setItem('active_project_id', activeProject.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  // ── Quản lý dự án ──────────────────────────────────────────────────────────
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    // Có dán prompt sẵn (từ Builder/ChatGPT/web...) → parse thành đồ thị:
    // section [X] / heading markdown thành node cắm sẵn, không marker → vào lõi.
    const newProj = newProjectPaste.trim()
      ? parseRawPromptToGraph(newProjectName, newProjectDesc, newProjectPaste, activeWorkspaceId)
      : createEmptyGraphProject(newProjectName, newProjectDesc, activeWorkspaceId);

    const nextProjects = [...projects, newProj];
    setProjects(nextProjects);
    setActiveProject(newProj);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(nextProjects));

    if (user) {
      setDoc(doc(db, 'projects', newProj.id), { ...newProj, userId: user.uid })
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }

    if (newProjectPaste.trim()) {
      const attrCount = (newProj.graphNodes || []).filter((n) => n.kind === 'attribute').length;
      toast.success(attrCount > 0
        ? `Đã tách prompt thành ${attrCount} node thuộc tính cắm sẵn vào Prompt Gốc.`
        : 'Đã đưa prompt vào Prompt Gốc — cắm thêm node để nâng cấp.');
    }

    setIsNewProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectPaste('');
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await confirmDialog({ message: 'Bạn có chắc chắn muốn xóa dự án này?', danger: true, confirmText: 'Xoá' }))) return;

    const nextProjects = projects.filter((p) => p.id !== id);
    setProjects(nextProjects);
    if (activeProject?.id === id) setActiveProject(nextProjects[0] || null);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(nextProjects));

    if (user) {
      deleteDoc(doc(db, 'projects', id))
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden w-full h-full relative md:flex-row flex-col bg-white dark:bg-slate-950">

      {/* 1. SIDEBAR — DANH SÁCH DỰ ÁN */}
      <div className="w-full md:w-72 shrink-0 border-r border-line/60 flex flex-col h-full overflow-hidden bg-slate-50/60 dark:bg-slate-900/10">
        <div className="p-4 border-b border-line/60 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-violet-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-muted">Danh Sách Dự Án</span>
          </div>
          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="p-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-violet-900/10"
            title="Tạo dự án mới"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 custom-scrollbar text-left">
          {projects.filter((proj) => isInActiveWorkspace(proj.workspaceId)).map((proj) => {
            const isActive = activeProject?.id === proj.id;
            return (
              <div
                key={proj.id}
                onClick={() => setActiveProject(proj)}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-white dark:bg-slate-900 border-violet-500/40 shadow-md shadow-violet-900/5'
                    : 'bg-white dark:bg-slate-900/30 border-line/70 hover:border-line'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <h4 className={`text-xs font-bold transition-colors ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-ink'}`}>
                    {proj.name}
                  </h4>
                  <button
                    onClick={(e) => handleDeleteProject(proj.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-faint hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                    title="Xóa dự án"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-muted mt-1.5 line-clamp-2 leading-relaxed">
                  {proj.description || 'Không có mô tả.'}
                </p>
                <div className="mt-2 text-[9px] font-bold text-faint">
                  {(proj.graphNodes || []).length} node · {(proj.edges || []).length} dây nối
                </div>
                {isActive && (
                  <div className="absolute right-3 bottom-3 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500"></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Trạng thái đồng bộ */}
        <div className="p-3 border-t border-line/60 flex justify-between items-center text-[10px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === 'synced' ? 'bg-emerald-500' :
              syncStatus === 'saving' ? 'bg-amber-500 animate-pulse' :
              syncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-500'
            }`} />
            <span className="font-medium uppercase tracking-wider text-[8px]">
              {syncStatus === 'synced' ? 'Đã đồng bộ Cloud' :
               syncStatus === 'saving' ? 'Đang sao lưu...' :
               syncStatus === 'error' ? 'Lỗi Firestore' : 'Chế độ ngoại tuyến'}
            </span>
          </div>
          <span className="text-faint">v3 · Prompt Graph</span>
        </div>
      </div>

      {/* 2. WORKSPACE CHÍNH */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {!activeProject ? (
          <div className="m-auto text-center flex flex-col items-center justify-center p-8 max-w-sm gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center mx-auto">
              <Layers size={24} className="text-violet-500" />
            </div>
            <p className="text-sm text-muted">Chọn hoặc tạo một dự án từ sidebar để bắt đầu.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-line/60 flex items-center gap-3 shrink-0 text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-ink truncate">{activeProject.name}</h2>
                  <span className="text-[9px] bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded-full border border-violet-500/20 font-bold uppercase tracking-wider">
                    Prompt Graph v3
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 truncate">
                  {activeProject.description || 'Cắm các node thuộc tính vào Prompt Gốc — xem prompt lắp ráp realtime ở tab "Prompt".'}
                </p>
              </div>
            </div>

            <GraphWorkspace
              key={activeProject.id}
              activeProject={activeProject}
              setActiveProject={setActiveProject}
              setProjects={setProjects}
              saveProjectState={saveProjectState}
              theme={theme}
              onSaveTemplate={onSaveTemplate}
              allAvailableTemplates={allAvailableTemplates}
            />
          </>
        )}
      </div>

      {/* 3. MODAL TẠO DỰ ÁN */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-line/70 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-left"
          >
            <div className="px-5 py-4 border-b border-line/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Tạo dự án Prompt Graph mới</h3>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-faint hover:text-ink transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wide">Tên dự án <span className="text-rose-500">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
                  placeholder="Ví dụ: Prompt viết email marketing..."
                  className="text-xs px-3.5 py-2.5 border border-line/70 focus:border-violet-500 bg-transparent text-ink rounded-xl focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wide">Mô tả dự án</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu của prompt này..."
                  className="text-xs px-3.5 py-2.5 border border-line/70 focus:border-violet-500 bg-transparent text-ink rounded-xl focus:outline-none resize-none h-20 transition-colors custom-scrollbar"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wide">
                  Dán prompt có sẵn <span className="text-faint normal-case font-semibold">(tuỳ chọn — từ Builder, ChatGPT, web...)</span>
                </label>
                <textarea
                  value={newProjectPaste}
                  onChange={(e) => setNewProjectPaste(e.target.value)}
                  placeholder={'Dán prompt vào đây. Nếu prompt có các phần dạng [Vai trò], [Nhiệm vụ]... hoặc heading Markdown (## Vai trò), mỗi phần sẽ tự tách thành một node cắm sẵn vào Prompt Gốc.'}
                  className="text-xs px-3.5 py-2.5 border border-line/70 focus:border-violet-500 bg-transparent text-ink rounded-xl focus:outline-none resize-y h-28 transition-colors custom-scrollbar font-mono"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-line/60 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="py-2 px-4 border border-line/70 text-muted hover:text-ink font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Tạo dự án
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
