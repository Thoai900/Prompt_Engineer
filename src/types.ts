export type TabType = 'home' | 'aifuture' | 'library' | 'builder' | 'enhancer' | 'learn' | 'utilitybelt' | 'rulesskills' | 'projectchain';

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

export interface AiPersona {
  id: string;
  name: string;
  systemInstructions: string;
}

export interface Workspace {
  id: string;
  name: string;
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

export interface PromptProject {
  id: string;
  name: string;
  description: string;
  globalEvalCriteria: string[]; // Bộ quy chuẩn đánh giá áp dụng cho toàn bộ dự án
  nodes: TreeNode[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
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
