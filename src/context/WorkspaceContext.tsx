import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../firebase';
import { toast } from '../components/common/Toaster';
import { AiPersona, Workspace } from '../types';

// ----------------------------------------------------------------------------
// Workspaces & Personas (mô hình CÁ NHÂN — mỗi doc thuộc về 1 userId)
//
// Workspace mặc định là ẢO (id 'default'): luôn tồn tại, KHÔNG lưu Firestore.
// Mọi template/project chưa gán workspaceId được coi là thuộc workspace mặc định,
// nên không cần migrate dữ liệu cũ. Workspace do người dùng tạo thì lưu Firestore
// (khi đăng nhập) hoặc localStorage (khi chưa đăng nhập).
// ----------------------------------------------------------------------------

export const DEFAULT_WORKSPACE_ID = 'default';

// 3 persona preset giữ lại từ bản cũ — luôn hiển thị, không sửa/xoá được.
const PRESET_PERSONAS: AiPersona[] = [
  { id: 'p1', name: 'Senior Coder', systemInstructions: 'You are a senior software engineer. Prefer TypeScript, concise answers, and complete error handling.' },
  { id: 'p2', name: 'Copywriter', systemInstructions: 'You are a persuasive copywriter. Use clear structure, strong benefits, and a direct call to action.' },
  { id: 'p3', name: 'Data Analyst', systemInstructions: 'You are a precise data analyst. Use only the provided evidence and present results in tables when useful.' },
];
const PRESET_PERSONA_IDS = new Set(PRESET_PERSONAS.map((p) => p.id));

const LS = {
  workspaces: 'pb_custom_workspaces',
  personas: 'pb_custom_personas',
  defaultName: 'pb_default_workspace_name',
  activeWorkspace: 'mentor_ai_active_workspace',
  activePersona: 'mentor_ai_active_persona',
};

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function toIso(value: any): string {
  try {
    if (value?.toDate) return value.toDate().toISOString();
    if (typeof value === 'string') return value;
  } catch { /* no-op */ }
  return new Date().toISOString();
}

interface WorkspaceContextType {
  user: User | null;
  authReady: boolean;
  geminiApiKey: string;
  openaiApiKey: string;
  groqApiKey: string;
  useSystemGeminiKey: boolean;
  setGeminiApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setGroqApiKey: (key: string) => void;
  setUseSystemGeminiKey: (use: boolean) => void;
  ghostTextEnabled: boolean;
  setGhostTextEnabled: (v: boolean) => void;

  // Workspaces
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  defaultWorkspaceId: string;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  /** True nếu doc (theo workspaceId của nó) hiển thị trong workspace đang chọn. */
  isInActiveWorkspace: (workspaceId?: string) => boolean;

  // Personas
  personas: AiPersona[];
  activePersonaId: string;
  setActivePersonaId: (id: string) => void;
  activePersona: AiPersona | null;
  createPersona: (data: { name: string; systemInstructions: string }) => Promise<void>;
  updatePersona: (id: string, data: { name: string; systemInstructions: string }) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [geminiApiKey, setGeminiApiKeyState] = useState(() => localStorage.getItem('mentor_ai_gemini_key') || '');
  const [openaiApiKey, setOpenaiApiKeyState] = useState(() => localStorage.getItem('mentor_ai_openai_key') || '');
  const [groqApiKey, setGroqApiKeyState] = useState(() => localStorage.getItem('mentor_ai_groq_key') || '');
  const [useSystemGeminiKey, setUseSystemGeminiKeyState] = useState(() => localStorage.getItem('mentor_ai_use_system_key') !== 'false');
  const [ghostTextEnabled, setGhostTextEnabledState] = useState(() => localStorage.getItem('ghost_text_enabled') !== 'false');

  // Workspace mặc định (ảo) — tên có thể đổi và lưu cục bộ.
  const [defaultWorkspaceName, setDefaultWorkspaceName] = useState(() => localStorage.getItem(LS.defaultName) || 'Dự án chính');
  const [customWorkspaces, setCustomWorkspaces] = useState<Workspace[]>(() => readLS<Workspace[]>(LS.workspaces, []));
  const [customPersonas, setCustomPersonas] = useState<AiPersona[]>(() => readLS<AiPersona[]>(LS.personas, []));

  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => localStorage.getItem(LS.activeWorkspace) || DEFAULT_WORKSPACE_ID);
  const [activePersonaId, setActivePersonaIdState] = useState(() => localStorage.getItem(LS.activePersona) || '');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Khi đăng nhập: nạp workspaces & personas từ Firestore (nguồn chuẩn).
  // Khi đăng xuất: quay về dữ liệu localStorage.
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    async function load() {
      if (!user) {
        setCustomWorkspaces(readLS<Workspace[]>(LS.workspaces, []));
        setCustomPersonas(readLS<AiPersona[]>(LS.personas, []));
        return;
      }
      try {
        const [wsSnap, pSnap] = await Promise.all([
          getDocs(query(collection(db, 'workspaces'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'personas'), where('userId', '==', user.uid))),
        ]);
        if (cancelled) return;
        const ws: Workspace[] = wsSnap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: data.name, color: data.color, userId: data.userId, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) };
        });
        const ps: AiPersona[] = pSnap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: data.name, systemInstructions: data.systemInstructions, userId: data.userId, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) };
        });
        ws.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        ps.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setCustomWorkspaces(ws);
        setCustomPersonas(ps);
      } catch (err) {
        try { handleFirestoreError(err, 'list'); } catch (e: any) { console.error('Load workspaces/personas failed:', e.message); }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, authReady]);

  const workspaces: Workspace[] = useMemo(
    () => [{ id: DEFAULT_WORKSPACE_ID, name: defaultWorkspaceName, color: '#10b981' }, ...customWorkspaces],
    [defaultWorkspaceName, customWorkspaces],
  );

  const personas: AiPersona[] = useMemo(() => [...PRESET_PERSONAS, ...customPersonas], [customPersonas]);

  // Nếu workspace/persona đang chọn không còn tồn tại → quay về mặc định.
  useEffect(() => {
    if (!workspaces.some((w) => w.id === activeWorkspaceId)) {
      setActiveWorkspaceIdState(DEFAULT_WORKSPACE_ID);
    }
  }, [workspaces, activeWorkspaceId]);
  useEffect(() => {
    if (activePersonaId && !personas.some((p) => p.id === activePersonaId)) {
      setActivePersonaIdState('');
    }
  }, [personas, activePersonaId]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem(LS.activeWorkspace, id);
  }, []);
  const setActivePersonaId = useCallback((id: string) => {
    setActivePersonaIdState(id);
    localStorage.setItem(LS.activePersona, id);
  }, []);

  const isInActiveWorkspace = useCallback((workspaceId?: string) => {
    if (activeWorkspaceId === DEFAULT_WORKSPACE_ID) {
      return !workspaceId || workspaceId === DEFAULT_WORKSPACE_ID;
    }
    return workspaceId === activeWorkspaceId;
  }, [activeWorkspaceId]);

  // ---- Workspace CRUD --------------------------------------------------------
  const persistLocalWorkspaces = (next: Workspace[]) => {
    setCustomWorkspaces(next);
    if (!user) localStorage.setItem(LS.workspaces, JSON.stringify(next));
  };

  const createWorkspace = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = genId('ws');
    const nowIso = new Date().toISOString();
    const optimistic: Workspace = { id, name: trimmed, userId: user?.uid, createdAt: nowIso, updatedAt: nowIso };
    setCustomWorkspaces((prev) => {
      const next = [...prev, optimistic];
      if (!user) localStorage.setItem(LS.workspaces, JSON.stringify(next));
      return next;
    });
    setActiveWorkspaceId(id);
    if (user) {
      try {
        await setDoc(doc(db, 'workspaces', id), { userId: user.uid, name: trimmed, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      } catch (err) {
        try { handleFirestoreError(err, 'create', `workspaces/${id}`); } catch (e: any) { console.error(e.message); }
        toast.error('Không thể tạo workspace.');
      }
    }
  }, [user, setActiveWorkspaceId]);

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (id === DEFAULT_WORKSPACE_ID) {
      setDefaultWorkspaceName(trimmed);
      localStorage.setItem(LS.defaultName, trimmed);
      return;
    }
    setCustomWorkspaces((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, name: trimmed } : w));
      if (!user) localStorage.setItem(LS.workspaces, JSON.stringify(next));
      return next;
    });
    if (user) {
      try {
        await setDoc(doc(db, 'workspaces', id), { userId: user.uid, name: trimmed, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        try { handleFirestoreError(err, 'update', `workspaces/${id}`); } catch (e: any) { console.error(e.message); }
        toast.error('Không thể đổi tên workspace.');
      }
    }
  }, [user]);

  const deleteWorkspace = useCallback(async (id: string) => {
    if (id === DEFAULT_WORKSPACE_ID) {
      toast.error('Không thể xoá workspace mặc định.');
      return;
    }
    persistLocalWorkspaces(customWorkspaces.filter((w) => w.id !== id));
    if (activeWorkspaceId === id) setActiveWorkspaceId(DEFAULT_WORKSPACE_ID);
    if (user) {
      try {
        await deleteDoc(doc(db, 'workspaces', id));
      } catch (err) {
        try { handleFirestoreError(err, 'delete', `workspaces/${id}`); } catch (e: any) { console.error(e.message); }
        toast.error('Không thể xoá workspace.');
      }
    }
  }, [user, customWorkspaces, activeWorkspaceId, setActiveWorkspaceId]);

  // ---- Persona CRUD ----------------------------------------------------------
  const createPersona = useCallback(async (data: { name: string; systemInstructions: string }) => {
    const name = data.name.trim();
    if (!name) return;
    const id = genId('persona');
    const nowIso = new Date().toISOString();
    const optimistic: AiPersona = { id, name, systemInstructions: data.systemInstructions, userId: user?.uid, createdAt: nowIso, updatedAt: nowIso };
    setCustomPersonas((prev) => {
      const next = [...prev, optimistic];
      if (!user) localStorage.setItem(LS.personas, JSON.stringify(next));
      return next;
    });
    if (user) {
      try {
        await setDoc(doc(db, 'personas', id), { userId: user.uid, name, systemInstructions: data.systemInstructions, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      } catch (err) {
        try { handleFirestoreError(err, 'create', `personas/${id}`); } catch (e: any) { console.error(e.message); }
        toast.error('Không thể tạo persona.');
      }
    }
  }, [user]);

  const updatePersona = useCallback(async (id: string, data: { name: string; systemInstructions: string }) => {
    if (PRESET_PERSONA_IDS.has(id)) return; // preset bất biến
    const name = data.name.trim();
    if (!name) return;
    setCustomPersonas((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name, systemInstructions: data.systemInstructions } : p));
      if (!user) localStorage.setItem(LS.personas, JSON.stringify(next));
      return next;
    });
    if (user) {
      try {
        await setDoc(doc(db, 'personas', id), { userId: user.uid, name, systemInstructions: data.systemInstructions, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        try { handleFirestoreError(err, 'update', `personas/${id}`); } catch (e: any) { console.error(e.message); }
        toast.error('Không thể cập nhật persona.');
      }
    }
  }, [user]);

  const deletePersona = useCallback(async (id: string) => {
    if (PRESET_PERSONA_IDS.has(id)) return;
    setCustomPersonas((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (!user) localStorage.setItem(LS.personas, JSON.stringify(next));
      return next;
    });
    if (activePersonaId === id) setActivePersonaId('');
    if (user) {
      try {
        await deleteDoc(doc(db, 'personas', id));
      } catch (err) {
        try { handleFirestoreError(err, 'delete', `personas/${id}`); } catch (e: any) { console.error(e.message); }
        toast.error('Không thể xoá persona.');
      }
    }
  }, [user, activePersonaId, setActivePersonaId]);

  const activePersona = useMemo(() => personas.find((p) => p.id === activePersonaId) || null, [personas, activePersonaId]);

  const setGeminiApiKey = (key: string) => { setGeminiApiKeyState(key); localStorage.setItem('mentor_ai_gemini_key', key); };
  const setOpenaiApiKey = (key: string) => { setOpenaiApiKeyState(key); localStorage.setItem('mentor_ai_openai_key', key); };
  const setGroqApiKey = (key: string) => { setGroqApiKeyState(key); localStorage.setItem('mentor_ai_groq_key', key); };
  const setUseSystemGeminiKey = (use: boolean) => { setUseSystemGeminiKeyState(use); localStorage.setItem('mentor_ai_use_system_key', String(use)); };
  const setGhostTextEnabled = (v: boolean) => { setGhostTextEnabledState(v); localStorage.setItem('ghost_text_enabled', String(v)); };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        authReady,
        geminiApiKey,
        openaiApiKey,
        groqApiKey,
        useSystemGeminiKey,
        setGeminiApiKey,
        setOpenaiApiKey,
        setGroqApiKey,
        setUseSystemGeminiKey,
        ghostTextEnabled,
        setGhostTextEnabled,
        workspaces,
        activeWorkspaceId,
        setActiveWorkspaceId,
        defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
        createWorkspace,
        renameWorkspace,
        deleteWorkspace,
        isInActiveWorkspace,
        personas,
        activePersonaId,
        setActivePersonaId,
        activePersona,
        createPersona,
        updatePersona,
        deletePersona,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

/** Preset persona id (không sửa/xoá được) — export để UI phân biệt. */
export const isPresetPersona = (id: string) => PRESET_PERSONA_IDS.has(id);
