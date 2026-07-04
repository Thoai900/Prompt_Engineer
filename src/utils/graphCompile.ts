import { AttrSlot, GraphEdge, GraphNode, PromptProject, PromptVariable } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Project Chain v3 — lõi compile của Prompt Graph (hàm thuần, unit-test được).
// Prompt Gốc có các cổng input theo thứ tự cố định; node thuộc tính cắm vào cổng
// đóng góp văn bản. Node tắt (enabled=false) bị loại cùng toàn bộ nhánh upstream.
// ─────────────────────────────────────────────────────────────────────────────

/** Thứ tự section trong prompt cuối. 'task' = nội dung lõi của Prompt Gốc. */
export type SectionSlot = AttrSlot | 'task';
export const SECTION_ORDER: readonly SectionSlot[] = [
  'role', 'context', 'task', 'format', 'tone', 'constraints', 'example', 'fix', 'custom',
];

/** Các cổng input hiển thị trên Prompt Gốc (thứ tự trên UI = thứ tự compile). */
export const ROOT_SLOTS: readonly AttrSlot[] = [
  'role', 'context', 'format', 'tone', 'constraints', 'example', 'fix', 'custom',
];

export const SLOT_LABELS: Record<SectionSlot, string> = {
  role: 'Vai trò',
  context: 'Ngữ cảnh',
  task: 'Nhiệm vụ',
  format: 'Định dạng',
  tone: 'Giọng điệu',
  constraints: 'Ràng buộc',
  example: 'Ví dụ',
  fix: 'Sửa lỗi',
  custom: 'Khác',
};

/** Màu đại diện cho từng loại — dùng chung cho node trên canvas và preview tô màu. */
export const SLOT_COLORS: Record<SectionSlot, string> = {
  role: '#8b5cf6',        // violet
  context: '#0ea5e9',     // sky
  task: '#6366f1',        // indigo (Prompt Gốc)
  format: '#14b8a6',      // teal
  tone: '#ec4899',        // pink
  constraints: '#f59e0b', // amber
  example: '#10b981',     // emerald
  fix: '#f43f5e',         // rose
  custom: '#64748b',      // slate
};

export interface CompiledSection {
  nodeId: string;       // node nguồn (root với slot 'task')
  slot: SectionSlot;
  title: string;        // nhãn section (SLOT_LABELS)
  showHeader: boolean;  // true nếu là node đầu tiên của slot → in [Nhãn]
  text: string;         // văn bản đã thay biến (gồm cả các node "Ghép thêm" đệ quy)
}

export interface CompiledGraph {
  finalPrompt: string;
  sections: CompiledSection[];
  /** Node thực sự tham gia prompt (đã nối tới root + đang bật). */
  participatingNodeIds: string[];
}

export const findRootNode = (project: PromptProject): GraphNode | null =>
  (project.graphNodes || []).find((n) => n.kind === 'root') || null;

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Thay biến {{ten_bien}}: inputs → defaultValue khai báo trong đồ thị → giữ nguyên. */
const substituteVariables = (
  text: string,
  inputs: Record<string, string>,
  allVars: PromptVariable[],
): string =>
  text.replace(VAR_REGEX, (match, rawName) => {
    const name = String(rawName).trim();
    if (inputs[name] !== undefined && inputs[name] !== '') return inputs[name];
    const def = allVars.find((v) => v.name === name);
    if (def?.defaultValue) return def.defaultValue;
    return match;
  });

/**
 * Kiểm tra nếu thêm dây source→target sẽ tạo chu trình.
 * Có chu trình khi từ `source` đi ngược upstream (qua các dây đang trỏ vào nó)
 * mà gặp lại `target`.
 */
export const wouldCreateCycle = (edges: GraphEdge[], source: string, target: string): boolean => {
  if (source === target) return true;
  const incoming = new Map<string, string[]>();
  edges.forEach((e) => {
    const arr = incoming.get(e.target) || [];
    arr.push(e.source);
    incoming.set(e.target, arr);
  });
  const stack = [source];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop() as string;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    (incoming.get(id) || []).forEach((s) => stack.push(s));
  }
  return false;
};

/** Node cắm vào (target, slot), chỉ lấy node đang bật, sort theo Y (trên → dưới). */
const getEnabledSources = (
  nodeMap: Map<string, GraphNode>,
  edges: GraphEdge[],
  target: string,
  slot: AttrSlot | 'append',
): GraphNode[] =>
  edges
    .filter((e) => e.target === target && e.targetSlot === slot)
    .map((e) => nodeMap.get(e.source))
    .filter((n): n is GraphNode => !!n && n.enabled)
    .sort((a, b) => a.position.y - b.position.y);

/** Văn bản của một node thuộc tính + các node cắm vào cổng "Ghép thêm" (đệ quy). */
const compileAttributeText = (
  node: GraphNode,
  nodeMap: Map<string, GraphNode>,
  edges: GraphEdge[],
  visited: Set<string>,
  collect: (id: string) => void,
): string => {
  if (visited.has(node.id)) return ''; // chống chu trình phòng thủ (UI đã chặn khi nối)
  visited.add(node.id);
  collect(node.id);
  const parts = [node.content.trim()];
  getEnabledSources(nodeMap, edges, node.id, 'append').forEach((child) => {
    const childText = compileAttributeText(child, nodeMap, edges, visited, collect);
    if (childText) parts.push(childText);
  });
  return parts.filter(Boolean).join('\n\n');
};

/** Lắp ráp prompt cuối từ đồ thị. Hàm thuần — không đụng state/UI. */
export const compileGraph = (
  project: PromptProject,
  inputs: Record<string, string> = {},
): CompiledGraph => {
  const graphNodes = project.graphNodes || [];
  const edges = project.edges || [];
  const root = findRootNode(project);
  if (!root) return { finalPrompt: '', sections: [], participatingNodeIds: [] };

  const nodeMap = new Map(graphNodes.map((n) => [n.id, n] as const));
  const participating = new Set<string>([root.id]);
  const collect = (id: string) => participating.add(id);

  const rawSections: Array<Omit<CompiledSection, 'text'> & { rawText: string }> = [];

  for (const slot of SECTION_ORDER) {
    if (slot === 'task') {
      const core = root.content.trim();
      if (core) {
        rawSections.push({
          nodeId: root.id, slot: 'task', title: SLOT_LABELS.task, showHeader: true, rawText: core,
        });
      }
      continue;
    }
    const sources = getEnabledSources(nodeMap, edges, root.id, slot);
    sources.forEach((node, idx) => {
      const visited = new Set<string>();
      const text = compileAttributeText(node, nodeMap, edges, visited, collect);
      if (!text) return;
      rawSections.push({
        nodeId: node.id, slot, title: SLOT_LABELS[slot], showHeader: idx === 0, rawText: text,
      });
    });
  }

  // Biến khả dụng: khai báo trên các node tham gia (root ưu tiên trước).
  const allVars: PromptVariable[] = graphNodes
    .filter((n) => participating.has(n.id))
    .flatMap((n) => n.variables || []);

  const sections: CompiledSection[] = rawSections.map((s) => ({
    nodeId: s.nodeId,
    slot: s.slot,
    title: s.title,
    showHeader: s.showHeader,
    text: substituteVariables(s.rawText, inputs, allVars),
  }));

  const finalPrompt = sections
    .map((s) => (s.showHeader ? `[${s.title}]\n${s.text}` : s.text))
    .join('\n\n');

  return { finalPrompt, sections, participatingNodeIds: [...participating] };
};

/**
 * Biến đầu vào người dùng cần điền: biến khai báo + biến {{...}} xuất hiện trong
 * nội dung các node tham gia nhưng chưa khai báo (suy ra dạng text bắt buộc).
 */
export const collectGraphVariables = (project: PromptProject): PromptVariable[] => {
  const { participatingNodeIds } = compileGraph(project, {});
  const idSet = new Set(participatingNodeIds);
  const nodes = (project.graphNodes || []).filter((n) => idSet.has(n.id));

  const result: PromptVariable[] = [];
  const seen = new Set<string>();

  nodes.forEach((n) => (n.variables || []).forEach((v) => {
    if (seen.has(v.name)) return;
    seen.add(v.name);
    result.push(v);
  }));

  nodes.forEach((n) => {
    let match;
    const regex = new RegExp(VAR_REGEX.source, 'g');
    while ((match = regex.exec(n.content)) !== null) {
      const name = match[1].trim();
      if (seen.has(name)) continue;
      seen.add(name);
      result.push({ name, type: 'text', description: '', required: true, defaultValue: '' });
    }
  });

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// Auto-layout thuần (không cần dagre): xếp theo cột từ phải sang trái.
// Root ở cột 0 (phải cùng); node cắm vào root ở cột 1; upstream sâu hơn → cột xa hơn.
// Trong mỗi cột: sort theo (thứ tự cổng, tiêu đề) rồi xếp chồng đều nhau.
// Node chưa nối dây: gom vào cột riêng dưới cùng bên trái để không chồng lấp.
// ─────────────────────────────────────────────────────────────────────────────

export const LAYOUT = {
  colWidth: 340,
  nodeGapY: 40,
  attrNodeHeight: 132,
  rootX: 980,
  rootY: 80,
} as const;

export const computeGraphLayout = (
  graphNodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  const root = graphNodes.find((n) => n.kind === 'root');
  if (!root) return positions;

  // level = khoảng cách xa nhất tới root (root=0) để nhánh dài không gãy cột.
  const level = new Map<string, number>([[root.id, 0]]);
  let changed = true;
  let guard = 0;
  while (changed && guard < graphNodes.length + 5) {
    changed = false;
    guard++;
    edges.forEach((e) => {
      const targetLevel = level.get(e.target);
      if (targetLevel === undefined) return;
      const want = targetLevel + 1;
      if ((level.get(e.source) ?? -1) < want) {
        level.set(e.source, want);
        changed = true;
      }
    });
  }

  const slotRank = (n: GraphNode) => {
    const idx = SECTION_ORDER.indexOf(n.attrType);
    return idx === -1 ? SECTION_ORDER.length : idx;
  };

  const connected = graphNodes.filter((n) => n.id !== root.id && level.has(n.id));
  const disconnected = graphNodes.filter((n) => n.id !== root.id && !level.has(n.id));

  const maxLevel = Math.max(1, ...[...level.values()]);
  const byLevel = new Map<number, GraphNode[]>();
  connected.forEach((n) => {
    const l = level.get(n.id) as number;
    const arr = byLevel.get(l) || [];
    arr.push(n);
    byLevel.set(l, arr);
  });

  const step = LAYOUT.attrNodeHeight + LAYOUT.nodeGapY;
  let tallestColumn = 0;
  byLevel.forEach((nodes, l) => {
    nodes.sort((a, b) => slotRank(a) - slotRank(b) || a.title.localeCompare(b.title));
    nodes.forEach((n, i) => {
      positions.set(n.id, { x: LAYOUT.rootX - l * LAYOUT.colWidth, y: LAYOUT.rootY + i * step });
    });
    tallestColumn = Math.max(tallestColumn, nodes.length);
  });

  // Root đứng giữa cột 1 theo chiều dọc cho cân mắt.
  const col1Count = (byLevel.get(1) || []).length;
  const rootY = col1Count > 1 ? LAYOUT.rootY + ((col1Count - 1) * step) / 2 : LAYOUT.rootY;
  positions.set(root.id, { x: LAYOUT.rootX, y: rootY });

  // Node mồ côi: cột riêng ngoài cùng bên trái, bắt đầu dưới cột cao nhất.
  const orphanX = LAYOUT.rootX - (maxLevel + 1) * LAYOUT.colWidth;
  disconnected
    .sort((a, b) => slotRank(a) - slotRank(b) || a.title.localeCompare(b.title))
    .forEach((n, i) => {
      positions.set(n.id, { x: orphanX, y: LAYOUT.rootY + i * step });
    });

  return positions;
};
