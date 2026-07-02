import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { PromptProject, TreeNode } from '../types';
import { compileEvolutionPrompt, getRequiredInputsForNode } from '../utils/chainUtils';
import { runPromptOnModel } from './aiService';
import { ALL_MODEL_OPTIONS, GEMINI_FLASH } from '../config/models';

// Chain → App (Lab · Tầng 3 #7): biến một Project Chain thành app chạy được — form
// nhập biến → chạy cả chuỗi ở client → output. Chia sẻ qua `sharedApps` (public read),
// người xem chạy bằng auth của CHÍNH họ (không mở endpoint AI công khai).

export interface ChainInputField {
  name: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
}

export interface ChainStep {
  nodeId: string;
  title: string;
  output: string;
}

/** Các biến ĐẦU VÀO ngoài (không phải output tổ tiên) mà app cần người dùng nhập. */
export function collectChainInputs(project: PromptProject): ChainInputField[] {
  const seen = new Map<string, ChainInputField>();
  const allVars = project.nodes.flatMap((n) => n.variables || []);
  for (const node of project.nodes) {
    for (const varName of getRequiredInputsForNode(node, project)) {
      if (seen.has(varName)) continue;
      const def = allVars.find((v) => v.name === varName);
      seen.set(varName, {
        name: varName,
        description: def?.description,
        defaultValue: def?.defaultValue,
        required: def?.required ?? true,
      });
    }
  }
  return [...seen.values()];
}

/** Thứ tự chạy: cha trước con (BFS từ node gốc), đảm bảo output tổ tiên có sẵn khi chạy node con. */
function orderNodes(project: PromptProject): TreeNode[] {
  const root = project.nodes.find((n) => n.parentId === null);
  if (!root) return [...project.nodes];
  const childrenMap = new Map<string, TreeNode[]>();
  for (const n of project.nodes) {
    if (n.parentId) { const a = childrenMap.get(n.parentId) || []; a.push(n); childrenMap.set(n.parentId, a); }
  }
  const ordered: TreeNode[] = [];
  const seen = new Set<string>();
  const queue: TreeNode[] = [root];
  while (queue.length) {
    const n = queue.shift() as TreeNode;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    ordered.push(n);
    (childrenMap.get(n.id) || []).forEach((c) => queue.push(c));
  }
  // Node mồ côi (không nối vào cây) — thêm cuối cho chắc.
  for (const n of project.nodes) if (!seen.has(n.id)) ordered.push(n);
  return ordered;
}

/** Chạy cả chuỗi ở client: mỗi node compile prompt (kèm output tổ tiên) → gọi AI → lưu output. */
export async function runChainApp(
  project: PromptProject,
  values: Record<string, string>,
  apiKeys?: { gemini?: string; groq?: string; openai?: string },
  onStep?: (step: ChainStep) => void,
): Promise<{ steps: ChainStep[]; finalOutput: string }> {
  // Bản sao có thể ghi: điền output ngược lại để node con tham chiếu được.
  const nodes = project.nodes.map((n) => ({ ...n }));
  const proj: PromptProject = { ...project, nodes };
  const model = GEMINI_FLASH;
  const provider = ALL_MODEL_OPTIONS.find((m) => m.value === model)?.provider || 'gemini';

  const steps: ChainStep[] = [];
  for (const node of orderNodes(proj)) {
    const compiled = compileEvolutionPrompt(node, proj, values);
    const { text } = await runPromptOnModel({
      model,
      provider,
      systemInstruction: compiled,
      userContent: 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.',
      apiKeys,
    });
    const idx = nodes.findIndex((n) => n.id === node.id);
    if (idx >= 0) nodes[idx].output = text;
    const step: ChainStep = { nodeId: node.id, title: node.title, output: text };
    steps.push(step);
    onStep?.(step);
  }

  return { steps, finalOutput: steps.length ? steps[steps.length - 1].output : '' };
}

// ── Chia sẻ (sharedApps) ────────────────────────────────────────────────────
const LOCAL_PROJECTS_KEY = 'mentor_ai_prompt_projects';

/** Đọc các Project Chain lưu cục bộ (ProjectChainTab lưu ở đây). */
export function loadLocalProjects(): PromptProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as PromptProject[]) : [];
  } catch {
    return [];
  }
}

/** Xuất bản một chuỗi thành app công khai (snapshot). Trả về id để dựng link chia sẻ. */
export async function publishApp(user: { uid: string }, project: PromptProject): Promise<string> {
  const ref = doc(db, 'sharedApps', project.id);
  const base: any = {
    userId: user.uid,
    name: project.name,
    description: project.description || '',
    nodes: project.nodes,
    updatedAt: serverTimestamp(),
  };
  const exists = (await getDoc(ref)).exists();
  if (exists) await setDoc(ref, base, { merge: true });
  else await setDoc(ref, { ...base, createdAt: serverTimestamp() });
  return project.id;
}

/** Nạp một app đã chia sẻ (public read) để chạy. */
export async function loadSharedApp(appId: string): Promise<PromptProject | null> {
  try {
    const snap = await getDoc(doc(db, 'sharedApps', appId));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      id: appId,
      name: data.name || 'App',
      description: data.description || '',
      nodes: data.nodes || [],
      globalEvalCriteria: [],
      createdAt: '',
      updatedAt: '',
    };
  } catch (err) {
    try { handleFirestoreError(err, 'get', `sharedApps/${appId}`); } catch (e: any) { console.error(e.message); }
    return null;
  }
}

/** Các app đã xuất bản của user (để quản lý / gỡ). */
export async function listMySharedApps(user: { uid: string }): Promise<{ id: string; name: string }[]> {
  try {
    const snap = await getDocs(query(collection(db, 'sharedApps'), where('userId', '==', user.uid)));
    return snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name || d.id }));
  } catch {
    return [];
  }
}

export async function unpublishApp(appId: string): Promise<void> {
  try { await deleteDoc(doc(db, 'sharedApps', appId)); } catch { /* non-fatal */ }
}

/** URL chia sẻ tới app (mở thẳng chế độ App trong Lab). */
export function buildAppUrl(appId: string): string {
  return `${window.location.origin}${window.location.pathname}?app=${encodeURIComponent(appId)}#lab`;
}
