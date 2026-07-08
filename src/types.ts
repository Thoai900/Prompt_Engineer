export type TabType = 'studio' | 'home' | 'aifuture' | 'library' | 'builder' | 'enhancer' | 'learn' | 'utilitybelt' | 'rulesskills' | 'projectchain' | 'lab';

export type BlockType = 'role' | 'task' | 'context' | 'format' | 'tone' | 'constraints' | 'example' | 'thinking' | 'anchor' | 'self_correction' | 'input_data' | 'custom' | 'objective' | 'audience' | 'experience' | 'challenge' | 'steps';

export interface PromptBlock {
  id: string;
  type: BlockType;
  title: string;
  content: string;
  isPinned?: boolean; // 2. Tính năng Pinned Block
}

export interface AiRule {
  id: string;
  title: string;
  description: string;
  content: string; // Markdown content of the rule/guide
  type: 'system-rules' | 'markdown-guide';
  tags: string[];
  isPreset?: boolean;
  updatedAt: string;
}

export interface SkillVariable {
  name: string;
  type: 'text' | 'long-text' | 'dropdown' | 'boolean';
  description?: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface SkillStep {
  id: string;
  order: number;
  title: string;
  description: string;
}

export interface AiSkill {
  id: string;
  title: string;
  description: string;
  inputs: SkillVariable[];
  steps: SkillStep[];
  instructions: string; // Markdown instructions for executing the skill
  isPreset?: boolean;
  updatedAt: string;
}

// A single execution of a skill: the filled-in inputs, the rendered prompt, and the model output.
export interface SkillRunRecord {
  id: string;
  skillId: string;
  values: Record<string, string | boolean>;
  renderedPrompt: string;
  output: string;
  createdAt: string;
}

export interface AiPersona {
  id: string;
  name: string;
  systemInstructions: string;
  userId?: string;       // chủ sở hữu (mô hình cá nhân); rỗng = persona cục bộ/preset
  createdAt?: string;    // ISO date string
  updatedAt?: string;    // ISO date string
}

export interface Workspace {
  id: string;
  name: string;
  color?: string;        // mã màu trang trí (vd '#10b981')
  userId?: string;       // chủ sở hữu (mô hình cá nhân); rỗng = workspace cục bộ/mặc định
  createdAt?: string;    // ISO date string
  updatedAt?: string;    // ISO date string
}

export interface PromptVariable {
  name: string;
  type: 'text' | 'long-text' | 'dropdown' | 'boolean';
  description?: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface FewShotExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface AiConfig {
  recommendedModels?: string[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// H2: một snapshot phiên bản của template (chụp blocks TRƯỚC mỗi lần ghi đè).
export interface TemplateVersion {
  id: string;
  at: string;           // ISO date string — thời điểm snapshot
  version?: string;     // nhãn version của template tại thời điểm đó (vd 'v1.0')
  blocks: PromptBlock[];
  note?: string;        // ghi chú ngắn (tuỳ chọn)
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category?: string;
  blocks: PromptBlock[];
  
  // 1. Tham số hóa động
  variables?: PromptVariable[];
  
  // 2. Quản lý phiên bản & Rẽ nhánh
  version?: string;
  parentPromptId?: string;
  changelog?: string;
  
  // 3. Metadata & Taxonomy
  tags?: string[];
  language?: string;
  difficultyLevel?: 'Basic' | 'Advanced' | 'Expert';
  useCase?: string;
  
  // 4. Model Compatibility
  aiConfig?: AiConfig;
  
  // 5. Metrics & Social Data
  metrics?: {
    usageCount: number;
    upvotes: number;
    likes?: number; // Social likes
    saves?: number; // Social saves/bookmarks
    averageRating?: number;
  };
  
  // 6. Few-shot Examples
  fewShots?: FewShotExample[];
  
  // 7. Visibility & Governance
  isPublic?: boolean;
  status?: 'Draft' | 'Published' | 'Archived';
  userId?: string; // uid chủ sở hữu (Firestore) — để phân biệt "của tôi" vs "cộng đồng"
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  isVerified?: boolean;
  
  // Example output for the prompt card
  outputExample?: {
    type: 'text' | 'code' | 'ui' | 'video' | 'mindmap' | 'tutor';
    title?: string;
    description?: string;
    content?: string;
    input?: string;
  };

  // Social history
  forkedFrom?: string; // ID of the prompt it was remixed from
  createdAt?: string; // ISO date string

  // 8. Phân vùng theo Workspace (cá nhân). Rỗng = thuộc workspace mặc định.
  workspaceId?: string;

  // 9. H2: lịch sử phiên bản (mới nhất ở đầu, giữ tối đa ~10 bản).
  versions?: TemplateVersion[];
}

export type EvolutionType = 
  | 'expand'   // Chi tiết hơn
  | 'shorten'  // Ngắn gọn lại
  | 'refocus'  // Tái lập hướng đi mới
  | 'fix';     // Sửa lỗi / Thêm ràng buộc

export type NodeExecutionStatus = 'idle' | 'drafting' | 'drafted' | 'running' | 'success' | 'error';

export interface TreeNode {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  blocks: PromptBlock[];
  variables: PromptVariable[];
  aiConfig?: AiConfig;
  output?: string;
  status: NodeExecutionStatus;
  position: { x: number; y: number };
  branchType?: 'success' | 'failure' | null;
  isStale?: boolean;                              // Output đã lỗi thời do node cha (tổ tiên) được chạy/sửa lại

  // Các thuộc tính bổ sung cho tính năng Tiến hóa
  draftOutput?: string;                            // Kết quả nháp ngắn gọn từ LLM nhỏ
  userEvaluation?: 'effective' | 'ineffective' | null; // Đánh giá của người dùng
  evolutionInstruction?: string;                  // Câu lệnh tối ưu cộng dồn (chỉ áp dụng từ Node con)
  evolutionType?: EvolutionType | null;           // Loại biến đổi của node con so với node cha
  contextMode?: 'full' | 'parent_only' | 'limit'; // Chế độ kế thừa ngữ cảnh
  contextLimit?: number;                          // Số cấp cha giới hạn kế thừa
}

export interface PromptVersion {
  id: string;
  timestamp: string;
  content: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Chain v3 — "Prompt Graph": prompt gốc là node trung tâm, các node
// thuộc tính (vai trò, ràng buộc, ví dụ...) cắm dây vào các cổng của nó.
// Mô hình DAG (GraphEdge) thay cho cây parentId của TreeNode (legacy v2).
// ─────────────────────────────────────────────────────────────────────────────

/** Loại thuộc tính = tên cổng input trên Prompt Gốc, theo thứ tự compile. */
export type AttrSlot = 'role' | 'context' | 'task' | 'format' | 'tone' | 'constraints' | 'example' | 'fix' | 'custom';

/**
 * v3.2+: node không chỉ là "hộp text".
 * - 'text' (mặc định): văn bản tự do trong `content`.
 * - 'preset': Modifier node (Meta-Prompt) — text sinh từ thư viện preset
 *   (graphPresets.ts) theo `presetId` + `presetParams` (dropdown/slider trên node).
 * - 'fewshot': node Ví dụ mẫu — cặp `examples[]` Input→Output có cấu trúc.
 * - 'web' (v3.3): node cào dữ liệu từ URL — snapshot cache vào `content`
 *   (compile vẫn thuần, chỉ đọc cache; bấm "Cào" mới fetch qua api/fetch-url).
 * - 'group' (v3.3): Bundle node — gom nhiều node thành 1 card; mỗi thành viên
 *   giữ attrType riêng và đóng góp section vào đúng cổng đó của Prompt Gốc
 *   (không cần dây), mute nhóm = tắt cả cụm.
 */
export type GraphNodeType = 'text' | 'preset' | 'fewshot' | 'web' | 'group';

export interface FewShotExample {
  input: string;
  output: string;
}

export interface GraphNode {
  id: string;
  kind: 'root' | 'attribute';
  attrType: AttrSlot;          // với root: bỏ qua (giữ 'custom')
  title: string;
  content: string;             // văn bản thuộc tính / nội dung lõi (root) / cache web
  variables: PromptVariable[];
  position: { x: number; y: number };
  enabled: boolean;            // false = mute (loại khỏi compile, dây mờ đi)

  // v3.2+ — node có cấu trúc (undefined = 'text', tương thích ngược)
  nodeType?: GraphNodeType;
  presetId?: string;                      // nodeType 'preset'
  presetParams?: Record<string, string>;  // giá trị các control của preset
  examples?: FewShotExample[];            // nodeType 'fewshot'
  url?: string;                           // nodeType 'web'
  fetchedAt?: string;                     // nodeType 'web' — ISO thời điểm cào
  members?: GraphNode[];                  // nodeType 'group' — các node thành viên
}

export interface GraphEdge {
  id: string;
  source: string;                   // node nguồn (cổng output)
  target: string;                   // node đích
  targetSlot: AttrSlot | 'append';  // cổng trên root, hoặc 'append' = cổng Ghép thêm của node thuộc tính
}

export interface PromptProject {
  id: string;
  name: string;
  description: string;
  globalEvalCriteria: string[]; // Bộ quy chuẩn đánh giá áp dụng cho toàn bộ dự án
  /** Legacy v2 (cây parentId). Project v3 giữ [] — dữ liệu nằm ở graphNodes/edges. */
  nodes: TreeNode[];
  /** v3: 3 = đã ở dạng Prompt Graph. Thiếu/khác 3 = legacy, sẽ được migrate khi mở. */
  schemaVersion?: number;
  graphNodes?: GraphNode[];
  edges?: GraphEdge[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
  workspaceId?: string; // Phân vùng theo Workspace (cá nhân). Rỗng = workspace mặc định.
  testCases?: TestCase[]; // Bộ kiểm thử tự động
  versions?: PromptVersion[]; // Lịch sử phiên bản prompt
}

export interface TestCase {
  id: string;
  name: string;
  inputs: Record<string, string>;
  expectedCriteria?: string[];
  status: 'idle' | 'running' | 'success' | 'failed';
  score?: number;
  feedback?: string;
  outputText?: string;
}

export interface SystemRole {
  id: string;
  title: string;
  description: string;
  rolePrompt: string;
  variables: PromptVariable[];
}

// ── Prompt Health/CI (Lab · Tầng 1 #2) ──────────────────────────────────────
export interface HealthTest {
  id: string;
  input: string;        // đầu vào thử
  criteria: string[];   // tiêu chí chấm cho test này
}

export interface HealthTestResult {
  testId: string;
  score: number;        // 0–100
  feedback?: string;
}

export interface HealthRun {
  at: string;           // ISO date string
  model: string;        // model đã chạy lần này (để phát hiện "đổi model")
  avgScore: number;     // điểm trung bình toàn suite
  results: HealthTestResult[];
}

export interface HealthSuite {
  id: string;
  name: string;
  prompt: string;       // prompt/hệ thống được kiểm thử
  model: string;        // model mặc định của suite
  testCases: HealthTest[];
  runs: HealthRun[];    // mới nhất ở đầu, giữ tối đa ~10 lần
  cronEnabled?: boolean; // H3: bật chạy tự động hằng ngày (Vercel Cron, cần đăng nhập)
  userId?: string;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
}
