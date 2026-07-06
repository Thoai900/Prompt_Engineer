import { AttrSlot, BlockType, GraphEdge, GraphNode, PromptBlock, PromptProject, PromptVariable, TreeNode } from '../types';
import { computeGraphLayout, LAYOUT } from './graphCompile';

// ─────────────────────────────────────────────────────────────────────────────
// Migration Project Chain v2 (cây parentId) → v3 (Prompt Graph). Hàm thuần.
// Quy tắc:
//  - Node gốc cũ: block `task` đầu tiên → nội dung lõi Prompt Gốc; các block còn
//    lại → node thuộc tính ĐÃ nối dây vào cổng tương ứng; variables → root.
//  - Node con/cháu cũ → node thuộc tính `fix` (nhánh failure) hoặc `custom`,
//    gộp blocks thành content, ĐÃ TẮT và CHƯA nối dây (người dùng tự cắm lại).
//  - Cú pháp cũ {{output_N}} / {{parent.output}} / {{X.output}} không còn ngữ
//    nghĩa → thay bằng ghi chú [Tham chiếu cũ: ...] để người dùng thấy và xử lý.
// ─────────────────────────────────────────────────────────────────────────────

export const isGraphProject = (p: PromptProject): boolean =>
  p.schemaVersion === 3 && Array.isArray(p.graphNodes);

/** Map BlockType (v2, 17 loại) → cổng thuộc tính v3. */
export const blockTypeToSlot = (type: BlockType): AttrSlot => {
  switch (type) {
    case 'role': return 'role';
    case 'context': return 'context';
    case 'task': return 'task'; // block task THỪA (ngoài block lõi) → Task Node cắm cổng Nhiệm vụ
    case 'format': return 'format';
    case 'tone': return 'tone';
    case 'constraints': return 'constraints';
    case 'example': return 'example';
    default: return 'custom';
  }
};

const LEGACY_REF_REGEX = /\{\{\s*((?:[oO]utput_\d+)|(?:parent\.output)|(?:[^{}]*\.output))\s*\}\}/g;

/** Thay tham chiếu cú pháp cũ bằng ghi chú rõ ràng (v3 chỉ còn {{ten_bien}}). */
export const stripLegacyRefs = (text: string): string =>
  (text || '').replace(LEGACY_REF_REGEX, (_m, ref) => `[Tham chiếu cũ: ${String(ref).trim()}]`);

const joinBlocks = (blocks: PromptBlock[]): string =>
  blocks
    .filter((b) => (b.content || '').trim())
    .map((b) => `[${b.title}]\n${b.content.trim()}`)
    .join('\n\n');

let uid = 0;
const newId = (prefix: string) => `${prefix}-${Date.now()}-${++uid}`;

/** Tạo project v3 rỗng (chỉ có Prompt Gốc). */
export const createEmptyGraphProject = (
  name: string,
  description: string,
  workspaceId?: string,
): PromptProject => {
  const root: GraphNode = {
    id: newId('root'),
    kind: 'root',
    attrType: 'custom',
    title: 'Prompt Gốc',
    content: '',
    variables: [],
    position: { x: LAYOUT.rootX, y: LAYOUT.rootY },
    enabled: true,
  };
  return {
    id: `proj-${Date.now()}`,
    name,
    description,
    globalEvalCriteria: [],
    nodes: [],
    schemaVersion: 3,
    graphNodes: [root],
    edges: [],
    testCases: [],
    versions: [],
    workspaceId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Xuất một template (từ Prompt Studio / Builder) thành project Prompt Graph v3
 * độc lập: block `task` đầu tiên → nội dung lõi Prompt Gốc; các block còn lại →
 * node thuộc tính ĐÃ nối dây vào cổng tương ứng; variables → root.
 */
export const templateToGraphProject = (
  template: { title: string; description?: string; blocks: PromptBlock[]; variables?: PromptVariable[] },
  workspaceId?: string,
): PromptProject => {
  const blocks = (template.blocks || []).filter((b) => (b.content || '').trim());
  const taskIdx = blocks.findIndex((b) => b.type === 'task');

  const root: GraphNode = {
    id: newId('root'),
    kind: 'root',
    attrType: 'custom',
    title: 'Prompt Gốc',
    content: taskIdx >= 0 ? blocks[taskIdx].content.trim() : '',
    variables: (template.variables || []).map((v) => ({ ...v })),
    position: { x: LAYOUT.rootX, y: LAYOUT.rootY },
    enabled: true,
  };
  const graphNodes: GraphNode[] = [root];
  const edges: GraphEdge[] = [];

  blocks.forEach((b, i) => {
    if (i === taskIdx) return;
    const slot = blockTypeToSlot(b.type);
    const attr: GraphNode = {
      id: newId('attr'),
      kind: 'attribute',
      attrType: slot,
      title: b.title || 'Thuộc tính',
      content: b.content.trim(),
      variables: [],
      position: { x: 0, y: 0 }, // auto-layout đặt lại bên dưới
      enabled: true,
    };
    graphNodes.push(attr);
    edges.push({ id: newId('edge'), source: attr.id, target: root.id, targetSlot: slot });
  });

  const positions = computeGraphLayout(graphNodes, edges);
  const laidOut = graphNodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });

  return {
    id: `proj-${Date.now()}`,
    name: template.title || 'Prompt mới',
    description: template.description || '',
    globalEvalCriteria: [],
    nodes: [],
    schemaVersion: 3,
    graphNodes: laidOut,
    edges,
    testCases: [],
    versions: [],
    workspaceId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/** Chuyển một project legacy sang v3. Idempotent: project v3 trả về nguyên vẹn. */
export const migrateProjectToGraph = (project: PromptProject): PromptProject => {
  if (isGraphProject(project)) return project;

  const legacy: TreeNode[] = project.nodes || [];
  const legacyRoot = legacy.find((n) => n.parentId === null) || legacy[0] || null;

  const graphNodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // 1. Prompt Gốc
  const rootBlocks = legacyRoot?.blocks || [];
  const taskIdx = rootBlocks.findIndex((b) => b.type === 'task');
  const coreBlock = taskIdx >= 0 ? rootBlocks[taskIdx] : null;

  const root: GraphNode = {
    id: legacyRoot?.id || newId('root'),
    kind: 'root',
    attrType: 'custom',
    title: 'Prompt Gốc',
    content: stripLegacyRefs(coreBlock?.content || ''),
    variables: (legacyRoot?.variables || []).map((v: PromptVariable) => ({ ...v })),
    position: { x: LAYOUT.rootX, y: LAYOUT.rootY },
    enabled: true,
  };
  graphNodes.push(root);

  // 2. Các block còn lại của node gốc → node thuộc tính đã nối dây
  rootBlocks.forEach((b, i) => {
    if (i === taskIdx) return;
    if (!(b.content || '').trim()) return;
    const slot = blockTypeToSlot(b.type);
    const attr: GraphNode = {
      id: newId('attr'),
      kind: 'attribute',
      attrType: slot,
      title: b.title || 'Thuộc tính',
      content: stripLegacyRefs(b.content),
      variables: [],
      position: { x: 0, y: 0 }, // auto-layout đặt lại phía dưới
      enabled: true,
    };
    graphNodes.push(attr);
    edges.push({ id: newId('edge'), source: attr.id, target: root.id, targetSlot: slot });
  });

  // 3. Node con/cháu cũ → node thuộc tính tắt, chưa nối dây
  legacy.forEach((n) => {
    if (!legacyRoot || n.id === legacyRoot.id) return;
    const content = stripLegacyRefs(joinBlocks(n.blocks || []));
    if (!content.trim()) return;
    graphNodes.push({
      id: n.id,
      kind: 'attribute',
      attrType: n.branchType === 'failure' ? 'fix' : 'custom',
      title: n.title,
      content,
      variables: (n.variables || []).map((v) => ({ ...v })),
      position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
      enabled: false,
    });
  });

  // 4. Auto-layout cho toàn bộ (node mồ côi được gom cột riêng, không chồng lấp)
  const positions = computeGraphLayout(graphNodes, edges);
  const laidOut = graphNodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });

  return {
    ...project,
    nodes: [], // dữ liệu legacy đã chuyển hết sang graphNodes (backup do nơi gọi thực hiện)
    schemaVersion: 3,
    graphNodes: laidOut,
    edges,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Thêm một template thư viện vào project dưới dạng node thuộc tính (dùng cho
 * AddToProjectModal & palette). Tự migrate nếu project còn ở v2.
 * `connectToRoot: true` sẽ cắm sẵn dây vào cổng tương ứng của Prompt Gốc.
 */
export const addTemplateAsAttributeNode = (
  project: PromptProject,
  template: { title: string; description?: string; blocks: PromptBlock[]; variables?: PromptVariable[] },
  options?: { connectToRoot?: boolean },
): PromptProject => {
  const proj = migrateProjectToGraph(project);
  const graphNodes = proj.graphNodes || [];
  const firstBlockType = template.blocks[0]?.type;
  const maxY = Math.max(LAYOUT.rootY, ...graphNodes.map((n) => n.position.y));

  const attr: GraphNode = {
    id: newId('attr'),
    kind: 'attribute',
    attrType: firstBlockType ? blockTypeToSlot(firstBlockType) : 'custom',
    title: template.title,
    content: stripLegacyRefs(joinBlocks(template.blocks)),
    variables: (template.variables || []).map((v) => ({ ...v })),
    position: { x: LAYOUT.rootX - LAYOUT.colWidth, y: maxY + LAYOUT.attrNodeHeight + LAYOUT.nodeGapY },
    enabled: true,
  };

  const root = graphNodes.find((n) => n.kind === 'root');
  const edges = options?.connectToRoot && root
    ? [...(proj.edges || []), { id: newId('edge'), source: attr.id, target: root.id, targetSlot: attr.attrType } as GraphEdge]
    : proj.edges;

  return {
    ...proj,
    graphNodes: [...graphNodes, attr],
    edges,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Tạo project v3 mới từ một template thư viện: block `task` → nội dung lõi,
 * các block khác → node thuộc tính đã nối dây (tái dùng logic migration).
 */
export const createGraphProjectFromTemplate = (
  name: string,
  description: string,
  template: { title: string; description?: string; blocks: PromptBlock[]; variables?: PromptVariable[] },
  workspaceId?: string,
): PromptProject => {
  const legacyShape: PromptProject = {
    id: `proj-${Date.now()}`,
    name,
    description,
    globalEvalCriteria: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId,
    nodes: [{
      id: newId('root'),
      parentId: null,
      title: template.title,
      description: template.description || '',
      status: 'idle',
      position: { x: LAYOUT.rootX, y: LAYOUT.rootY },
      blocks: template.blocks.map((b) => ({ ...b })),
      variables: (template.variables || []).map((v) => ({ ...v })),
    }],
  };
  return migrateProjectToGraph(legacyShape);
};
