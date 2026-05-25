import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { AVAILABLE_BLOCKS, BLOCK_SUGGESTIONS } from '../data';
import { PromptBlock, PromptTemplate, AiPersona } from '../types';
import { 
  GripVertical, Plus, Trash2, Copy, Check, X, Layers, Save, Sparkles, Wand2, 
  Square, ChevronDown, ChevronLeft, ChevronRight, AlignLeft, Minimize2, Briefcase, 
  Smile, Menu, User, Pin, SplitSquareHorizontal, Image as ImageIcon, Upload, 
  Loader2, RotateCcw, RotateCw, Send, Clock, Undo, Redo, Shield, AlertCircle, Brain,
  Download, FileText, FileJson, Printer
} from 'lucide-react';
import { 
  generateAutoBlockStream, autoFillVariables, generateContentForExistingBlocks, 
  generatePromptFromImage, runPlaygroundChatStream, type AiActionType 
} from '../services/aiService';
import AIResponseRenderer from './AIResponseRenderer';

const SMART_PRESETS: Record<string, { label: string; action: string }[]> = {
  role: [
    { label: "🎭 Tăng tính chuyên gia", action: "Đóng vai chuyên gia đầu ngành có tư duy sâu rộng, sử dụng thuật ngữ chuyên môn chính xác" },
    { label: "⚖️ Đóng vai phản biện", action: "Đóng vai một người phản biện nghiêm túc, luôn đặt ra các câu hỏi khó và thử thách giả định" },
    { label: "🍃 Giọng văn trung lập", action: "Đóng vai nhà nghiên cứu khách quan, trình bày thông tin không thiên vị" },
  ],
  task: [
    { label: "🎯 Chi tiết hóa hành động", action: "Mô tả chi tiết từng bước hành động cụ thể, làm rõ các công việc nhỏ cần làm" },
    { label: "🔍 Đơn giản hóa nhiệm vụ", action: "Tóm gọn nhiệm vụ cốt lõi, loại bỏ các chi tiết thừa thãi để tập trung vào mục tiêu chính" },
    { label: "📍 Bổ sung mục tiêu phụ", action: "Xác định và bổ sung thêm các mục tiêu phụ quan trọng giúp hoàn thành tốt nhiệm vụ chính" },
  ],
  context: [
    { label: "📌 Mở rộng bối cảnh", action: "Mở rộng và bổ sung thêm các giả định thực tế, môi trường xung quanh và thông tin nền phong phú" },
    { label: "🎓 Hướng tới học tập", action: "Tập trung bối cảnh vào giảng dạy, tự học, tiếp thu kiến thức cho học sinh cấp 3" },
    { label: "✂️ Lược bỏ chi tiết thừa", action: "Tinh lọc bối cảnh ngắn gọn, chỉ giữ lại những thông số ảnh hưởng trực tiếp đến kết quả" },
  ],
  constraints: [
    { label: "🚫 Quy tắc từ cấm", action: "Thêm danh sách các quy tắc cấm sử dụng từ ngữ sáo rỗng, rườm rà, lặp ý hoặc văn phong học thuật quá đà" },
    { label: "🛡️ Chống ảo giác (Anti-hallucination)", action: "Thêm ràng buộc yêu cầu AI chỉ trả lời dựa trên thông tin chính xác, nói 'không biết' nếu thiếu dữ liệu" },
    { label: "🇻🇳 Viết bằng Tiếng Việt", action: "Ràng buộc đầu ra bắt buộc phải viết hoàn toàn bằng tiếng Việt tự nhiên và chuẩn ngữ pháp" },
  ],
  format: [
    { label: "📊 Chuyển sang Markdown Table", action: "Chuyển cấu trúc kết quả đầu ra thành bảng Markdown có tiêu đề rõ ràng" },
    { label: "📋 Định dạng Bullet Points", action: "Định dạng kết quả đầu ra dưới dạng danh sách gạch đầu dòng phân lớp rõ ràng" },
    { label: "💻 Kết xuất dạng JSON", action: "Định dạng kết quả đầu ra dưới dạng JSON object có cấu trúc mẫu cụ thể" },
  ],
  example: [
    { label: "💡 Thêm ví dụ thực tế", action: "Thêm một ví dụ cụ thể, thực tế minh họa cho cách triển khai mong muốn" },
    { label: "❌ Thêm ví dụ phản diện", action: "Thêm một ví dụ không nên làm (Negative Example) để giúp AI tránh sai sót" },
  ],
  thinking: [
    { label: "🧠 Chain-of-Thought", action: "Yêu cầu suy nghĩ sâu sắc bằng cách phân tích lý do logic trước khi trả lời" },
    { label: "👣 Suy nghĩ từng bước", action: "Thêm hướng dẫn chi tiết yêu cầu giải quyết bài toán theo từng bước nhỏ độc lập" },
    { label: "⚙️ Tự kiểm lỗi logic", action: "Thêm bước tự kiểm tra và phản biện lại kết quả trước khi đưa ra câu trả lời cuối cùng" },
  ],
};

const DEFAULT_SMART_PRESETS = [
  { label: "✨ Tối ưu hóa hành văn", action: "Chỉnh sửa lại câu từ cho mượt mà, lưu loát, chuyên nghiệp hơn mà không đổi ý nghĩa" },
  { label: "✍️ Sửa lỗi ngữ pháp", action: "Kiểm tra và khắc phục tất cả lỗi chính tả, ngữ pháp hoặc cấu trúc câu tiếng Việt" },
];

const DEFAULT_FRAMEWORKS = [
  { 
    id: 'role', 
    name: 'R.O.L.E Framework', 
    blocks: [
      { type: 'role', title: 'Vai trò (Role)', content: 'Bạn là {{Chuyên gia/Vai trò cụ thể}}' },
      { type: 'objective', title: 'Mục tiêu (Objective)', content: 'Tôi cần {{Hành động cụ thể}}' },
      { type: 'context', title: 'Ngữ cảnh (Context)', content: 'Trong tình huống {{Bối cảnh chi tiết}}' },
      { type: 'format', title: 'Kỳ vọng (Expectation)', content: 'Kết quả cần {{Định dạng/Phong cách/Độ dài}}' }
    ] 
  },
  { 
    id: 'create', 
    name: 'C.R.E.A.T.E Framework', 
    blocks: [
      { type: 'context', title: 'Context (Ngữ cảnh)', content: '{{Mô tả tình huống/vấn đề}}' },
      { type: 'role', title: 'Role (Vai trò)', content: 'Hãy đóng vai {{Chuyên gia/nhân vật}}' },
      { type: 'example', title: 'Examples (Ví dụ)', content: 'Tham khảo phong cách {{Mẫu cụ thể}}' },
      { type: 'objective', title: 'Action (Hành động)', content: 'Hãy {{tạo/viết/phân tích/tối ưu}}' },
      { type: 'format', title: 'Type (Kiểu dáng)', content: 'Dưới dạng {{Format cụ thể}}' },
      { type: 'constraints', title: 'Extras (Thêm)', content: 'Lưu ý {{Ràng buộc/yêu cầu đặc biệt}}' }
    ] 
  },
  { 
    id: 'persona', 
    name: 'P.E.R.S.O.N.A Framework', 
    blocks: [
      { type: 'objective', title: 'Purpose (Mục đích)', content: 'Tôi muốn {{Kết quả cuối cùng}}' },
      { type: 'experience', title: 'Experience (Kinh nghiệm)', content: 'Trình độ của tôi là {{Level}}' },
      { type: 'example', title: 'Reference (Tham chiếu)', content: 'Tôi thích phong cách {{Mẫu/Tác giả}}' },
      { type: 'constraints', title: 'Specifics (Chi tiết)', content: 'Bao gồm {{Yêu cầu cụ thể}}' },
      { type: 'format', title: 'Output (Đầu ra)', content: 'Cho tôi {{Định dạng}}' },
      { type: 'tone', title: 'Nuance (Sắc thái)', content: 'Giọng điệu {{Tone mong muốn}}' },
      { type: 'audience', title: 'Audience (Đối tượng)', content: 'Người đọc/nghe là {{Ai}}' }
    ] 
  },
  { 
    id: 'task_fw', 
    name: 'T.A.S.K Framework', 
    blocks: [
      { type: 'task', title: 'Task (Nhiệm vụ)', content: '{{Động từ hành động}} {{Đối tượng cụ thể}}' },
      { type: 'audience', title: 'Audience (Đối tượng)', content: 'Dành cho {{Ai}}' },
      { type: 'tone', title: 'Style (Phong cách)', content: 'Theo kiểu {{Mô tả}}' },
      { type: 'constraints', title: 'Key points (Điểm chính)', content: 'Phải có {{Yêu cầu bắt buộc}}' }
    ] 
  },
  { 
    id: 'chain', 
    name: 'C.H.A.I.N Framework', 
    blocks: [
      { type: 'challenge', title: 'Challenge (Thách thức)', content: 'Vấn đề tôi đang gặp là {{Mô tả}}' },
      { type: 'objective', title: 'Help needed (Cần giúp)', content: 'Tôi cần bạn giúp {{Hành động}}' },
      { type: 'steps', title: 'Approach (Cách tiếp cận)', content: 'Hãy làm theo các bước:\n- Bước 1: {{Phân tích/Nghiên cứu}}\n- Bước 2: {{Đề xuất/Tạo}}\n- Bước 3: {{Tối ưu/Tinh chỉnh}}' },
      { type: 'input_data', title: 'Input (Đầu vào)', content: 'Thông tin tôi có: {{Dữ liệu}}' },
      { type: 'task', title: 'Next steps (Bước tiếp theo)', content: 'Sau đó hãy {{Yêu cầu cuối}}' }
    ] 
  },
  { 
    id: 'claude_xmd', 
    name: 'Claude Pro XMD', 
    blocks: [
      { type: 'role', title: 'Vai trò (Role)' },
      { type: 'task', title: 'Nhiệm vụ (Task)' },
      { type: 'input_data', title: 'Dữ liệu đầu vào (Input)' },
      { type: 'thinking', title: 'Suy luận (Thinking)' },
      { type: 'format', title: 'Định dạng (Format)' },
      { type: 'constraints', title: 'Ràng buộc (Constraints)' },
      { type: 'self_correction', title: 'Tự xem xét (Self-Correction)' },
      { type: 'anchor', title: 'Mỏ neo (Anchor)' }
    ] 
  },
  { 
    id: 'costar', 
    name: 'CO-STAR Framework', 
    blocks: [
      { type: 'context', title: 'Context (Ngữ cảnh)' },
      { type: 'task', title: 'Objective (Mục tiêu)' },
      { type: 'tone', title: 'Style (Phong cách)' },
      { type: 'tone', title: 'Tone (Giọng điệu)' },
      { type: 'context', title: 'Audience (Đối tượng)' },
      { type: 'format', title: 'Response (Phản hồi)' }
    ] 
  },
  { 
    id: 'rtf', 
    name: 'RTF Framework', 
    blocks: [
      { type: 'role', title: 'Role (Vai trò)' },
      { type: 'task', title: 'Task (Nhiệm vụ)' },
      { type: 'format', title: 'Format (Định dạng)' }
    ] 
  },
  { 
    id: 'race', 
    name: 'RACE Framework', 
    blocks: [
      { type: 'role', title: 'Role (Vai trò)' },
      { type: 'task', title: 'Action (Nhiệm vụ)' },
      { type: 'context', title: 'Context (Ngữ cảnh)' },
      { type: 'format', title: 'Expectation (Kỳ vọng)' }
    ] 
  },
];

interface BuilderTabProps {
  initialTemplate: PromptTemplate | null;
  personas: AiPersona[];
  activePersonaId: string;
  setActivePersonaId: (id: string) => void;
  onSaveTemplate?: (template: PromptTemplate) => void;
}

interface ExtractedVar {
  name: string;
  options?: string[];
  raw: string;
}

const TYPE_STYLES: Record<string, { badge: string, border: string }> = {
  role: { badge: 'text-blue-300 bg-blue-500/10 ring-blue-500/20 border-blue-500/30', border: 'border-l-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.05)]' },
  task: { badge: 'text-violet-300 bg-violet-500/10 ring-violet-500/20 border-violet-500/30', border: 'border-l-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.05)]' },
  context: { badge: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20 border-emerald-500/30', border: 'border-l-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.05)]' },
  input_data: { badge: 'text-indigo-300 bg-indigo-500/10 ring-indigo-500/20 border-indigo-500/30', border: 'border-l-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.05)]' },
  thinking: { badge: 'text-amber-300 bg-amber-500/10 ring-amber-500/20 border-amber-500/30', border: 'border-l-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.05)]' },
  format: { badge: 'text-purple-300 bg-purple-500/10 ring-purple-500/20 border-purple-500/30', border: 'border-l-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.05)]' },
  tone: { badge: 'text-pink-300 bg-pink-500/10 ring-pink-500/20 border-pink-500/30', border: 'border-l-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.05)]' },
  constraints: { badge: 'text-rose-300 bg-rose-500/10 ring-rose-500/20 border-rose-500/30', border: 'border-l-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.05)]' },
  example: { badge: 'text-cyan-300 bg-cyan-500/10 ring-cyan-500/20 border-cyan-500/30', border: 'border-l-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.05)]' },
  self_correction: { badge: 'text-teal-300 bg-teal-500/10 ring-teal-500/20 border-teal-500/30', border: 'border-l-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.05)]' },
  anchor: { badge: 'text-sky-300 bg-sky-500/10 ring-sky-500/20 border-sky-500/30', border: 'border-l-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.05)]' },
  objective: { badge: 'text-rose-300 bg-rose-500/10 ring-rose-500/20 border-rose-500/30', border: 'border-l-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.05)]' },
  audience: { badge: 'text-amber-300 bg-amber-500/10 ring-amber-500/20 border-amber-500/30', border: 'border-l-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.05)]' },
  experience: { badge: 'text-lime-300 bg-lime-500/10 ring-lime-500/20 border-lime-500/30', border: 'border-l-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.05)]' },
  challenge: { badge: 'text-red-300 bg-red-500/10 ring-red-500/20 border-red-500/30', border: 'border-l-red-500 shadow-[0_0_10px_rgba(239,68,68,0.05)]' },
  steps: { badge: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20 border-emerald-500/30', border: 'border-l-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.05)]' },
  custom: { badge: 'text-slate-300 bg-slate-500/10 ring-slate-500/20 border-slate-700/30', border: 'border-l-slate-400 shadow-[0_0_10px_rgba(100,116,139,0.05)]' },
};

const BLOCK_ICONS: Record<string, React.ReactNode> = {
  role: <User size={16} />,
  task: <Briefcase size={16} />,
  context: <Pin size={16} />,
  input_data: <Upload size={16} />,
  thinking: <Brain size={16} />,
  format: <Layers size={16} />,
  tone: <Smile size={16} />,
  constraints: <Shield size={16} />,
  example: <Copy size={16} />,
  custom: <Plus size={16} />,
};

export default function BuilderTab({ initialTemplate, personas, activePersonaId, setActivePersonaId, onSaveTemplate }: BuilderTabProps) {
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedSystem, setCopiedSystem] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [globalTheme, setGlobalTheme] = useState<string>('empty');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Playground States
  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'playground'>('preview');
  const [playgroundMessages, setPlaygroundMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isChatGenerating, setIsChatGenerating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // Playground Config Parameters
  const [playgroundProvider, setPlaygroundProvider] = useState<'gemini' | 'openai'>('gemini');
  const [playgroundModel, setPlaygroundModel] = useState<string>('gemini-2.5-flash');
  const [playgroundTemp, setPlaygroundTemp] = useState<number>(0.7);
  const [playgroundMaxTokens, setPlaygroundMaxTokens] = useState<number>(2048);
  const [showPlaygroundConfig, setShowPlaygroundConfig] = useState(false);
  
  // API Keys state
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('mentor_ai_gemini_key') || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem('mentor_ai_openai_key') || '');
  const [useSystemGeminiKey, setUseSystemGeminiKey] = useState(() => {
    const saved = localStorage.getItem('mentor_ai_use_system_key');
    return saved !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('mentor_ai_gemini_key', geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('mentor_ai_openai_key', openaiApiKey);
  }, [openaiApiKey]);

  useEffect(() => {
    localStorage.setItem('mentor_ai_use_system_key', String(useSystemGeminiKey));
  }, [useSystemGeminiKey]);

  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Mẫu của tôi');
  const [templateTags, setTemplateTags] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('vi');
  const [isPublicTemplate, setIsPublicTemplate] = useState(false);
  const [isSavedAsFramework, setIsSavedAsFramework] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  
  // Custom states for options
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(false);
  const [blockHistoryList, setBlockHistoryList] = useState<Record<string, { content: string; timestamp: string; label: string }[]>>({});
  const [blockRedoList, setBlockRedoList] = useState<Record<string, { content: string; timestamp: string; label: string }[]>>({});
  const [activeHistoryMenuId, setActiveHistoryMenuId] = useState<string | null>(null);
  
  const focusContentsRef = useRef<Record<string, string>>({});

  const [savedFrameworks, setSavedFrameworks] = useState<any[]>(() => {
    try {
      const item = localStorage.getItem('custom_frameworks');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  });

  const allFrameworks = [...savedFrameworks, ...DEFAULT_FRAMEWORKS];

  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatingBlocks, setGeneratingBlocks] = useState<Record<string, boolean>>({});
  const [detailLevel, setDetailLevel] = useState<number>(3);
  const [openAiMenuId, setOpenAiMenuId] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<Record<string, string>>({});

  // AI Configuration states
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [useDeepReasoning, setUseDeepReasoning] = useState<boolean>(false);
  const [customTemp, setCustomTemp] = useState<number>(0.7);
  const [customTopP, setCustomTopP] = useState<number>(0.95);
  const [showAiSettings, setShowAiSettings] = useState<boolean>(false);

  // Quick prompt states
  const [isQuickPromptModalOpen, setIsQuickPromptModalOpen] = useState(false);
  const [quickPromptTopic, setQuickPromptTopic] = useState('');
  const [quickPromptFramework, setQuickPromptFramework] = useState('claude_xmd');
  const [isGeneratingQuickPrompt, setIsGeneratingQuickPrompt] = useState(false);

  // Image to prompt states
  const [isImagePromptModalOpen, setIsImagePromptModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string | null>(null);
  const [isGeneratingFromImage, setIsGeneratingFromImage] = useState(false);

  // Auto-fill and profile states
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(() => localStorage.getItem('userProfile') || '');

  // Mobile specific state
  const [showMobilePanel, setShowMobilePanel] = useState<'build' | 'preview'>('build');
  const [previewMode, setPreviewMode] = useState<'combined' | 'split'>('combined');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const toggleBlockExpansion = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedBlocks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    // When a new block is added, expand it by default
    const latestBlock = blocks[blocks.length - 1];
    if (latestBlock && expandedBlocks[latestBlock.id] === undefined) {
      setExpandedBlocks(prev => ({ ...prev, [latestBlock.id]: true }));
    }
  }, [blocks.length]);

  // Helper to extract variables from all blocks
  const getVariablesFromBlocks = (blocksArgs: PromptBlock[]): ExtractedVar[] => {
    const list: ExtractedVar[] = [];
    const seen = new Set<string>();
    
    blocksArgs.forEach(b => {
      const matches = b.content.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        matches.forEach(m => {
          const inner = m.slice(2, -2).trim();
          const parts = inner.split(':');
          const name = parts[0].trim();
          if (!seen.has(name)) {
            seen.add(name);
            const options = parts.length > 1 ? parts[1].split(',').map(o => o.trim()) : undefined;
            list.push({ name, options, raw: m });
          }
        });
      }
    });
    return list;
  };

  // Helper to extract variables from a single block's text
  const getVariablesFromText = (text: string): ExtractedVar[] => {
    const list: ExtractedVar[] = [];
    const seen = new Set<string>();
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (matches) {
      matches.forEach(m => {
        const inner = m.slice(2, -2).trim();
        const parts = inner.split(':');
        const name = parts[0].trim();
        if (!seen.has(name)) {
          seen.add(name);
          const options = parts.length > 1 ? parts[1].split(',').map(o => o.trim()) : undefined;
          list.push({ name, options, raw: m });
        }
      });
    }
    return list;
  };

  const allVariables = getVariablesFromBlocks(blocks);

  // Helper to replace variables with user values
  const injectVariables = (text: string) => {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varInner) => {
      const parts = varInner.trim().split(':');
      const name = parts[0].trim();
      return variableValues[name] || (parts.length > 1 ? parts[1].split(',')[0].trim() : match);
    });
  };

  // Undo/Redo & Version History helpers
  const saveBlockVersion = (blockId: string, content: string, label: string) => {
    if (!content || !content.trim()) return; // Don't save empty versions
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { content, timestamp, label };
    
    setBlockHistoryList(prev => {
      const list = prev[blockId] ? [...prev[blockId]] : [];
      if (list.length > 0 && list[list.length - 1].content === content) {
        return prev;
      }
      if (list.length >= 10) list.shift();
      return { ...prev, [blockId]: [...list, entry] };
    });
    setBlockRedoList(prev => ({ ...prev, [blockId]: [] }));
  };

  const undoBlock = (blockId: string) => {
    const history = blockHistoryList[blockId] || [];
    if (history.length === 0) return;
    
    const currentBlock = blocks.find(b => b.id === blockId);
    if (!currentBlock) return;
    
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const redoEntry = { content: currentBlock.content, timestamp, label: 'Bản hiện tại (Hoàn tác)' };
    
    setBlockRedoList(prev => {
      const list = prev[blockId] ? [...prev[blockId]] : [];
      return { ...prev, [blockId]: [...list, redoEntry] };
    });
    
    setBlockHistoryList(prev => ({ ...prev, [blockId]: newHistory }));
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: previous.content } : b));
  };

  const redoBlock = (blockId: string) => {
    const redos = blockRedoList[blockId] || [];
    if (redos.length === 0) return;
    
    const currentBlock = blocks.find(b => b.id === blockId);
    if (!currentBlock) return;
    
    const next = redos[redos.length - 1];
    const newRedos = redos.slice(0, -1);
    
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const historyEntry = { content: currentBlock.content, timestamp, label: 'Trước khi Phục hồi' };
    
    setBlockHistoryList(prev => {
      const list = prev[blockId] ? [...prev[blockId]] : [];
      return { ...prev, [blockId]: [...list, historyEntry] };
    });
    
    setBlockRedoList(prev => ({ ...prev, [blockId]: newRedos }));
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: next.content } : b));
  };

  const restoreBlockVersion = (blockId: string, content: string) => {
    const currentBlock = blocks.find(b => b.id === blockId);
    if (!currentBlock) return;
    
    saveBlockVersion(blockId, currentBlock.content, 'Trước khi chọn bản cũ');
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    setActiveHistoryMenuId(null);
  };

  const handleSaveProfile = (newProfile: string) => {
    setUserProfile(newProfile);
    localStorage.setItem('userProfile', newProfile);
    setIsProfileModalOpen(false);
  };

  const handleAutoFill = async () => {
    if (allVariables.length === 0 || blocks.length === 0) return;
    setIsAutoFilling(true);
    try {
      const templateContext = blocks.map(b => `[${b.title}]: ${b.content}`).join('\n');
      const varNames = allVariables.map(v => v.name);
      const filledData = await autoFillVariables(userProfile, templateContext, varNames, {
        model: selectedModel,
        temperature: customTemp,
        topP: customTopP,
        useDeepReasoning
      });
      
      setVariableValues(prev => ({
        ...prev,
        ...filledData
      }));
    } catch (err) {
      console.error("Auto Fill Failed", err);
      alert("Tính năng điền tự động AI đang gặp lỗi, vui lòng thử lại sau.");
    } finally {
      setIsAutoFilling(false);
    }
  };

  useEffect(() => {
    if (initialTemplate) {
      const newBlocks = initialTemplate.blocks.map(b => ({...b, id: `${b.id}-${Date.now()}`}));
      setBlocks(prev => {
        // Keep pinned blocks and append the new template blocks
        const pinned = prev.filter(p => p.isPinned);
        return [...pinned, ...newBlocks];
      });
      const expandState: Record<string, boolean> = {};
      newBlocks.forEach(b => expandState[b.id] = true);
      setExpandedBlocks(prev => ({ ...prev, ...expandState }));
    }
  }, [initialTemplate]);

  const updateBlockTitle = (id: string, title: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, title } : b));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    if (result.source.droppableId === 'available-blocks' && result.destination.droppableId === 'builder-area') {
      const itemToAdd = AVAILABLE_BLOCKS[result.source.index];
      addBlock(itemToAdd.type, result.destination.index);
    } else if (result.source.droppableId === 'builder-area' && result.destination.droppableId === 'builder-area') {
      const newBlocks = Array.from(blocks);
      const [reorderedItem] = newBlocks.splice(result.source.index, 1);
      newBlocks.splice(result.destination.index, 0, reorderedItem);
      setBlocks(newBlocks);
    }
  };

  const addBlock = (blockType: string, atIndex?: number) => {
    const itemToAdd = AVAILABLE_BLOCKS.find(b => b.type === blockType);
    if (!itemToAdd) return;

    const initialContent = globalTheme !== 'empty' && BLOCK_SUGGESTIONS[blockType] 
      ? BLOCK_SUGGESTIONS[blockType][globalTheme] || ''
      : '';

    const newBlock: PromptBlock = {
      id: `${itemToAdd.type}-${Date.now()}`,
      type: itemToAdd.type,
      title: itemToAdd.title,
      content: initialContent
    };

    setBlocks(prev => {
        const newBlocks = [...prev];
        if (atIndex !== undefined) {
             newBlocks.splice(atIndex, 0, newBlock);
        } else {
             newBlocks.push(newBlock);
        }
        return newBlocks;
    });
    setExpandedBlocks(prev => ({ ...prev, [newBlock.id]: true }));
    setIsBottomSheetOpen(false); // Close bottom sheet on mobile if open
  };

  const addCustomBlock = () => {
    const title = prompt("Nhập tên khối mới (VD: Lưu ý thêm):");
    if (!title || !title.trim()) return;
    const newBlock: PromptBlock = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      title: title.trim(),
      content: ''
    };
    setBlocks(prev => [...prev, newBlock]);
    setExpandedBlocks(prev => ({ ...prev, [newBlock.id]: true }));
    setIsBottomSheetOpen(false);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const togglePin = (id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, isPinned: !b.isPinned } : b));
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const handleAiAssist = async (block: PromptBlock, actionType: AiActionType | string = 'auto') => {
    saveBlockVersion(block.id, block.content, 'Trước khi AI chạy');
    setGeneratingBlocks(prev => ({ ...prev, [block.id]: true }));
    setExpandedBlocks(prev => ({ ...prev, [block.id]: true })); // Expand if collapsed
    setOpenAiMenuId(null);
    const contextBlocks = blocks.filter(b => b.id !== block.id).map(b => ({ title: b.title, content: b.content }));
    
    let accumulatedText = "";
    let isFirstChunk = true;

    try {
      await generateAutoBlockStream(
        block.type, 
        block.title, 
        block.content, 
        contextBlocks,
        actionType,
        detailLevel,
        (chunk) => {
          if (isFirstChunk) {
            isFirstChunk = false;
            accumulatedText = chunk; // Override whatever was there
          } else {
            accumulatedText += chunk;
          }
          setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, content: accumulatedText } : b));
        },
        {
          model: selectedModel,
          temperature: customTemp,
          topP: customTopP,
          useDeepReasoning
        }
      );
    } catch (error) {
       console.error(error);
    } finally {
      setGeneratingBlocks(prev => ({ ...prev, [block.id]: false }));
    }
  };

  const handleGenerateQuickPrompt = async () => {
    if (!quickPromptTopic.trim() || blocks.length === 0) return;
    setIsGeneratingQuickPrompt(true);
    
    try {
      // Save history for blocks that will be changed
      const blocksInfo = blocks.map(b => ({ id: b.id, type: b.type, title: b.title }));
      const resultObj = await generateContentForExistingBlocks(quickPromptTopic, blocksInfo, {
        model: selectedModel,
        temperature: customTemp,
        topP: customTopP,
        useDeepReasoning
      });
      
      setBlocks(prevBlocks => prevBlocks.map(b => {
        if (resultObj[b.id]) {
          saveBlockVersion(b.id, b.content, 'Trước khi Bơm AI');
          return { ...b, content: resultObj[b.id] };
        }
        return b;
      }));
      
      const expandState: Record<string, boolean> = {};
      blocks.forEach(b => {
        if (resultObj[b.id]) expandState[b.id] = true;
      });
      setExpandedBlocks(prev => ({ ...prev, ...expandState }));
      setIsQuickPromptModalOpen(false);
      setQuickPromptTopic('');
    } catch (e) {
      console.error(e);
      alert("Đã có lỗi xảy ra khi tự động điền. Vui lòng thử lại.");
    } finally {
      setIsGeneratingQuickPrompt(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn một tệp hình ảnh (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64Data = result.split(',')[1];
      setSelectedImage(base64Data);
      setSelectedImageMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateFromImage = async () => {
    if (!selectedImage || !selectedImageMime || blocks.length === 0) return;
    setIsGeneratingFromImage(true);
    
    try {
      const blocksInfo = blocks.map(b => ({ id: b.id, type: b.type, title: b.title }));
      const resultObj = await generatePromptFromImage(selectedImage, selectedImageMime, blocksInfo, {
        model: selectedModel,
        temperature: customTemp,
        topP: customTopP,
        useDeepReasoning
      });
      
      setBlocks(prevBlocks => prevBlocks.map(b => {
        if (resultObj[b.id]) {
          saveBlockVersion(b.id, b.content, 'Trước khi Quét Ảnh');
          return { ...b, content: resultObj[b.id] };
        }
        return b;
      }));
      
      const expandState: Record<string, boolean> = {};
      blocks.forEach(b => {
        if (resultObj[b.id]) expandState[b.id] = true;
      });
      setExpandedBlocks(prev => ({ ...prev, ...expandState }));
      setIsImagePromptModalOpen(false);
      setSelectedImage(null);
      setSelectedImageMime(null);
    } catch (e) {
      console.error(e);
      alert("Đã có lỗi xảy ra khi phân tích hình ảnh. Vui lòng thử lại.");
    } finally {
      setIsGeneratingFromImage(false);
    }
  };

  const generatePromptText = (raw = false) => {
    return blocks.filter(b => b.content.trim() !== '').map(b => `### ${b.title}\n${raw ? b.content : injectVariables(b.content)}`).join('\n\n');
  };

  const activePersona = personas.find(p => p.id === activePersonaId);
  const systemBlocks = blocks.filter(b => ['role', 'context', 'tone', 'constraints'].includes(b.type));
  const userBlocks = blocks.filter(b => ['task', 'format', 'example'].includes(b.type));
  
  const generatePreviewContent = (isRaw: boolean = false, type: 'combined' | 'system' | 'user' = 'combined') => {
    let output = "";
    
    const renderBlock = (b: PromptBlock) => {
      if (b.content.trim() === '') return '';
      let result = '';
      if (isRaw) {
        result += `[${b.title}]\n${b.content}\n\n`;
      } else {
        result += `[${b.title}]\n${injectVariables(b.content)}\n\n`;
      }
      return result;
    };

    if (type === 'combined' || type === 'system') {
      if (activePersona?.systemInstructions) {
        output += `[SYSTEM RULES]\n${activePersona.systemInstructions}\n\n`;
      }
      if (type === 'combined') {
        blocks.forEach(b => { output += renderBlock(b); });
      } else {
        systemBlocks.forEach(b => { output += renderBlock(b); });
      }
    }
    
    if (type === 'user') {
      userBlocks.forEach(b => { output += renderBlock(b); });
    }

    return output.trim();
  };

  const handleCopy = (isRaw: boolean, copyType: 'combined' | 'system' | 'user' = 'combined') => {
    const text = generatePreviewContent(isRaw, copyType);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (copyType === 'system') {
        setCopiedSystem(true);
        setTimeout(() => setCopiedSystem(false), 2000);
      } else if (copyType === 'user') {
        setCopiedUser(true);
        setTimeout(() => setCopiedUser(false), 2000);
      } else {
        if (isRaw) {
          setCopiedRaw(true);
          setTimeout(() => setCopiedRaw(false), 2000);
        } else {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    });
  };

  const handleQuickAddSet = () => {
    if (globalTheme === 'empty') return;
    const typesToPull = ['role', 'task', 'context', 'format'];
    const newBlocks = typesToPull.map((type, idx) => {
      const blockDef = AVAILABLE_BLOCKS.find(b => b.type === type);
      const newBlock = {
        id: `${type}-${Date.now()}-${idx}`,
        type: type as any,
        title: blockDef?.title || '',
        content: BLOCK_SUGGESTIONS[type]?.[globalTheme] || ''
      };
      return newBlock;
    });
    setBlocks(prev => [...prev, ...newBlocks]);
    
    const expandState: Record<string, boolean> = {};
    newBlocks.forEach(b => expandState[b.id] = true);
    setExpandedBlocks(prev => ({ ...prev, ...expandState }));
  };

  const handleSaveModal = () => {
    if (blocks.length === 0) return;
    setIsModalOpen(true);
  };

  const handleConfirmSave = () => {
    if (!onSaveTemplate || !templateTitle.trim()) return;
    
    const parsedVars = allVariables.map(v => ({
      name: v.name,
      type: v.options ? 'dropdown' as const : 'text' as const,
      required: true,
      options: v.options
    }));

    const newTemplate: PromptTemplate = {
      id: `custom-${Date.now()}`,
      title: templateTitle,
      description: templateDesc || 'Custom template created by you.',
      category: templateCategory,
      tags: templateTags.split(',').map(t => t.trim()).filter(Boolean),
      language: templateLanguage,
      isPublic: isPublicTemplate,
      version: 'v1.0',
      status: 'Published',
      metrics: { usageCount: 0, upvotes: 0 },
      variables: parsedVars,
      blocks: [...blocks]
    };
    onSaveTemplate(newTemplate);

    if (isSavedAsFramework) {
      const newFw = {
        id: `fw-${Date.now()}`,
        name: templateTitle,
        blocks: blocks.map(b => ({ type: b.type, title: b.title, content: b.content }))
      };
      const newSavedFrameworks = [newFw, ...savedFrameworks];
      setSavedFrameworks(newSavedFrameworks);
      localStorage.setItem('custom_frameworks', JSON.stringify(newSavedFrameworks));
    }

    setIsModalOpen(false);
    setTemplateTitle('');
    setTemplateDesc('');
    setTemplateTags('');
    setIsSavedAsFramework(false);
  };

  const getExportFilename = (suffix: string, ext: string) => {
    const title = initialTemplate?.title || 'mentor_ai_prompt';
    return `${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${suffix}.${ext}`;
  };

  const exportToMarkdown = () => {
    if (blocks.length === 0) return;
    const title = initialTemplate?.title || 'Mentor AI Prompt';
    const description = initialTemplate?.description || 'Được tạo bởi Prompt Builder';
    
    let markdown = `# ${title}\n`;
    markdown += `> ${description}\n\n`;
    markdown += `*Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}*\n\n`;
    markdown += `---\n\n`;

    blocks.forEach(b => {
      if (b.content.trim() !== '') {
        markdown += `### ${b.title}\n`;
        markdown += `${injectVariables(b.content)}\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', getExportFilename('prompt', 'md'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportDropdown(false);
  };

  const exportToJSON = () => {
    if (blocks.length === 0) return;
    const title = initialTemplate?.title || 'Mentor AI Prompt';
    const description = initialTemplate?.description || 'Được tạo bởi Prompt Builder';
    
    const parsedVars = allVariables.map(v => ({
      name: v.name,
      type: v.options ? 'dropdown' : 'text',
      required: true,
      options: v.options
    }));

    const exportData = {
      title,
      description,
      version: initialTemplate?.version || 'v1.0',
      language: initialTemplate?.language || 'vi',
      tags: initialTemplate?.tags || [],
      category: initialTemplate?.category || 'Mẫu của tôi',
      variables: parsedVars,
      variableValues,
      blocks: blocks.map(b => ({
        type: b.type,
        title: b.title,
        content: b.content
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', getExportFilename('template', 'json'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportDropdown(false);
  };

  const exportToPDF = () => {
    if (blocks.length === 0) return;
    const title = initialTemplate?.title || 'Mentor AI Prompt';
    const description = initialTemplate?.description || 'Được tạo bởi Prompt Builder';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Không thể mở cửa sổ in. Vui lòng tắt trình chặn popup và thử lại.');
      return;
    }

    const blocksHtml = blocks.map(b => {
      if (b.content.trim() === '') return '';
      const content = injectVariables(b.content).replace(/\n/g, '<br/>');
      return `
        <div class="block-card">
          <div class="block-header">
            <span class="block-badge block-badge-${b.type}">${b.title}</span>
          </div>
          <div class="block-content">${content}</div>
        </div>
      `;
    }).join('');

    const stylesHtml = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
          line-height: 1.6;
          margin: 0;
          padding: 40px;
          background-color: #ffffff;
        }

        .header {
          margin-bottom: 30px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
        }

        .title {
          font-family: 'Outfit', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 10px 0;
        }

        .description {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 15px 0;
        }

        .meta {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .block-card {
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
          border-left: 5px solid #647489;
          border-radius: 12px;
          background-color: #f8fafc;
          page-break-inside: avoid;
          overflow: hidden;
        }

        .block-header {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          background-color: #f1f5f9;
        }

        .block-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          border-radius: 6px;
        }

        /* Badge colors based on types */
        .block-badge-role { background-color: #dbeafe; color: #1e40af; }
        .block-badge-task { background-color: #f3e8ff; color: #6b21a8; }
        .block-badge-context { background-color: #d1fae5; color: #065f46; }
        .block-badge-input_data { background-color: #e0e7ff; color: #3730a3; }
        .block-badge-thinking { background-color: #fef3c7; color: #92400e; }
        .block-badge-format { background-color: #fdf2f8; color: #9d174d; }
        .block-badge-tone { background-color: #fce7f3; color: #9d174d; }
        .block-badge-constraints { background-color: #ffe4e6; color: #9f1239; }
        .block-badge-example { background-color: #ecfeff; color: #155e75; }
        .block-badge-custom { background-color: #f1f5f9; color: #334155; }

        .block-content {
          padding: 16px;
          font-size: 13px;
          white-space: pre-wrap;
          color: #334155;
        }

        /* Specific left borders for visual consistency */
        .block-card:has(.block-badge-role) { border-left-color: #3b82f6; }
        .block-card:has(.block-badge-task) { border-left-color: #8b5cf6; }
        .block-card:has(.block-badge-context) { border-left-color: #10b981; }
        .block-card:has(.block-badge-input_data) { border-left-color: #6366f1; }
        .block-card:has(.block-badge-thinking) { border-left-color: #f59e0b; }
        .block-card:has(.block-badge-format) { border-left-color: #a855f7; }
        .block-card:has(.block-badge-tone) { border-left-color: #ec4899; }
        .block-card:has(.block-badge-constraints) { border-left-color: #f43f5e; }
        .block-card:has(.block-badge-example) { border-left-color: #06b6d4; }

        .footer {
          margin-top: 40px;
          border-top: 1px solid #e2e8f0;
          padding-top: 15px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
        }

        @media print {
          body {
            padding: 20px;
          }
          .block-card {
            border: 1px solid #cbd5e1;
            background-color: #ffffff !important;
          }
          .block-header {
            background-color: #f8fafc !important;
          }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          ${stylesHtml}
        </head>
        <body>
          <div class="header">
            <h1 class="title">${title}</h1>
            <p class="description">${description}</p>
            <div class="meta">Mentor AI • Prompt Builder • Xuất bản ngày: ${new Date().toLocaleDateString('vi-VN')}</div>
          </div>
          <div class="content">
            ${blocksHtml}
          </div>
          <div class="footer">
            Tài liệu được sinh tự động bởi Prompt Builder (Mentor AI)
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setShowExportDropdown(false);
  };

  const handleSendPlaygroundMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatGenerating) return;

    const userMessageText = chatInput.trim();
    setChatInput('');

    const newUserMessage = { role: 'user' as const, content: userMessageText };
    const updatedMessages = [...playgroundMessages, newUserMessage];
    setPlaygroundMessages(updatedMessages);
    setIsChatGenerating(true);

    try {
      let systemInstruction = generatePreviewContent(false, 'combined');
      // Append Mentor AI guidelines to enforce Socratic method, empathetic tone and LaTeX math format
      systemInstruction += `\n\n[HƯỚNG DẪN BẮT BUỘC CHO MENTOR AI]\nBạn là Mentor AI - gia sư thân thiện, kiên nhẫn và khuyến khích cho học sinh trung học. Hãy tuân thủ nghiêm ngặt:\n1. Tuyệt đối KHÔNG giải hộ bài tập hay đưa ra đáp án trực tiếp. Sử dụng phương pháp Socratic để đặt câu hỏi khơi gợi tư duy, dẫn dắt từng bước để học sinh tự tìm ra câu trả lời.\n2. Giọng điệu thân thiện, kiên nhẫn, sử dụng emoji một cách ấm áp, khích lệ.\n3. Khi viết các công thức toán học hoặc khoa học, hãy luôn sử dụng LaTeX (bọc bằng $ hoặc $$).`;
      
      const apiMessages = updatedMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        content: m.content
      }));

      let accumulatedResponse = '';
      
      setPlaygroundMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const apiKey = playgroundProvider === 'gemini' 
        ? (useSystemGeminiKey ? undefined : geminiApiKey)
        : openaiApiKey;

      await runPlaygroundChatStream(
        playgroundProvider,
        systemInstruction,
        apiMessages,
        {
          apiKey,
          model: playgroundModel,
          temperature: playgroundTemp,
          maxTokens: playgroundMaxTokens
        },
        (chunk) => {
          accumulatedResponse += chunk;
          setPlaygroundMessages(prev => {
            const next = [...prev];
            if (next.length > 0) {
              next[next.length - 1] = { role: 'assistant', content: accumulatedResponse };
            }
            return next;
          });
        }
      );
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'Đã xảy ra lỗi khi kết nối với AI.';
      setPlaygroundMessages(prev => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === 'assistant' && next[next.length - 1].content === '') {
          next[next.length - 1] = { role: 'assistant', content: `❌ Lỗi: ${errorMessage}` };
        } else {
          next.push({ role: 'assistant', content: `❌ Lỗi: ${errorMessage}` });
        }
        return next;
      });
    } finally {
      setIsChatGenerating(false);
    }
  };

  const handleResetPlayground = () => {
    setPlaygroundMessages([]);
    setIsChatGenerating(false);
    setChatInput('');
  };

  const handleStartPlaygroundSession = () => {
    const greeting = "Chào bạn! Tôi là Mentor AI 🎓. Tôi đã sẵn sàng chạy thử nghiệm prompt cùng bạn. Hãy gửi tin nhắn hoặc câu hỏi bất kỳ liên quan đến vai trò/bối cảnh đã thiết lập để chúng ta cùng bắt đầu nhé! 😊";
    setPlaygroundMessages([{ role: 'assistant', content: greeting }]);
  };

  const handleApplyFramework = (fwBlocks: any[]) => {
    const newBlocks = fwBlocks.map((blockData, idx) => {
      const isString = typeof blockData === 'string';
      const type = isString ? blockData : blockData.type;
      const blockDef = AVAILABLE_BLOCKS.find(b => b.type === type);
      return {
        id: `${type}-${Date.now()}-${idx}`,
        type: type as any,
        title: isString ? (blockDef?.title || '') : (blockData.title || blockDef?.title || ''),
        content: isString ? '' : (blockData.content || '')
      };
    });
    setBlocks(prev => {
      const pinned = prev.filter(p => p.isPinned);
      return [...pinned, ...newBlocks];
    });
    const expandState: Record<string, boolean> = {};
    newBlocks.forEach(b => expandState[b.id] = true);
    setExpandedBlocks(prev => ({ ...prev, ...expandState }));
  };

  const getPromptScore = () => {
    if (blocks.length === 0) return { score: 0, msg: '' };
    const hasRole = blocks.some(b => b.type === 'role');
    const hasTask = blocks.some(b => b.type === 'task');
    const hasContextOrInput = blocks.some(b => b.type === 'context' || b.type === 'input_data');
    const hasFormat = blocks.some(b => b.type === 'format');
    const hasThinking = blocks.some(b => b.type === 'thinking');
    
    let score = 30;
    let missing = [];
    if (hasRole) score += 10; else missing.push('Vai trò');
    if (hasTask) score += 20; else missing.push('Nhiệm vụ');
    if (hasContextOrInput) score += 10; else missing.push('Ngữ cảnh/Dữ liệu');
    if (hasFormat) score += 10; else missing.push('Format');
    if (hasThinking) score += 20; else missing.push('Suy luận');
    
    let msg = score >= 90 ? 'Tuyệt vời, prompt rất chuẩn!' : `Gợi ý thêm: ${missing.join(', ')}`;
    return { score, msg };
  };

  const getDoctorSuggestions = () => {
    const suggestions = [];
    const hasRole = blocks.some(b => b.type === 'role');
    const hasTask = blocks.some(b => b.type === 'task');
    const hasContextOrInput = blocks.some(b => b.type === 'context' || b.type === 'input_data');
    const hasFormat = blocks.some(b => b.type === 'format');
    const hasThinking = blocks.some(b => b.type === 'thinking');
    const hasConstraints = blocks.some(b => b.type === 'constraints');
    const hasExample = blocks.some(b => b.type === 'example');

    if (!hasRole) {
      suggestions.push({
        type: 'role',
        title: 'Thiếu Vai trò (Role)',
        desc: 'Thiết lập vai trò giúp AI định vị văn phong và chuyên môn phù hợp.',
        fixLabel: 'Thêm & Tự sinh Vai trò',
      });
    }
    if (!hasTask) {
      suggestions.push({
        type: 'task',
        title: 'Thiếu Nhiệm vụ (Task)',
        desc: 'Nhiệm vụ rõ ràng giúp AI hiểu chính xác hành động cần thực hiện.',
        fixLabel: 'Thêm & Tự sinh Nhiệm vụ',
      });
    }
    if (!hasContextOrInput) {
      suggestions.push({
        type: 'context',
        title: 'Thiếu Ngữ cảnh (Context)',
        desc: 'Cung cấp bối cảnh hoặc dữ liệu đầu vào giúp AI trả lời sát thực tế hơn.',
        fixLabel: 'Thêm & Tự sinh Ngữ cảnh',
      });
    }
    if (!hasFormat) {
      suggestions.push({
        type: 'format',
        title: 'Thiếu Định dạng (Format)',
        desc: 'Chỉ định định dạng đầu ra (bảng, bullet points, JSON) giúp dữ liệu dễ dùng hơn.',
        fixLabel: 'Thêm & Tự sinh Định dạng',
      });
    }
    if (!hasConstraints) {
      suggestions.push({
        type: 'constraints',
        title: 'Thiếu Ràng buộc (Constraints)',
        desc: 'Ràng buộc (chống ảo giác, ngôn ngữ, độ dài) giúp AI không trả lời lan man.',
        fixLabel: 'Thêm & Tự sinh Ràng buộc',
      });
    }
    if (!hasExample) {
      suggestions.push({
        type: 'example',
        title: 'Thiếu Ví dụ (Example)',
        desc: 'Ví dụ minh họa (Few-shot prompting) là cách tốt nhất để đồng bộ hóa phong cách.',
        fixLabel: 'Thêm & Tự sinh Ví dụ',
      });
    }
    if (!hasThinking) {
      suggestions.push({
        type: 'thinking',
        title: 'Thiếu Suy luận (Thinking)',
        desc: 'Yêu cầu suy nghĩ từng bước (Chain-of-thought) tăng độ chính xác của lập luận.',
        fixLabel: 'Thêm & Tự sinh Suy luận',
      });
    }
    return suggestions;
  };

  const handleDoctorFix = async (type: string) => {
    const blockDef = AVAILABLE_BLOCKS.find(b => b.type === type);
    if (!blockDef) return;

    const newBlockId = `${type}-${Date.now()}`;
    const newBlock: PromptBlock = {
      id: newBlockId,
      type: type as any,
      title: blockDef.title,
      content: ''
    };

    setBlocks(prev => {
      let next = [...prev];
      if (type === 'role') {
        next.unshift(newBlock);
      } else {
        next.push(newBlock);
      }
      return next;
    });

    setExpandedBlocks(prev => ({ ...prev, [newBlockId]: true }));
    await handleAiAssist(newBlock, 'auto');
  };

  const { score, msg } = getPromptScore();

  return (
    <div className="flex flex-row flex-1 overflow-hidden relative w-full h-full bg-transparent text-slate-900 dark:text-slate-100 font-sans">
      <DragDropContext onDragEnd={onDragEnd}>
        
        {/* Left Column: Available Blocks (Hidden on Mobile) */}
        <div className={`hidden lg:flex flex-col shrink-0 h-full border-r border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md transition-all duration-300 relative ${isLeftSidebarCollapsed ? 'w-14' : 'w-64'}`}>
          
          {/* Collapse Toggle Button */}
          <div className="absolute top-3 -right-3 z-30">
            <button
              onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
              className="w-6 h-6 rounded-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 hover:border-violet-500 hover:text-violet-400 text-slate-400 dark:text-slate-300 flex items-center justify-center shadow-md transition-all"
              title={isLeftSidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            >
              {isLeftSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {isLeftSidebarCollapsed ? (
            /* Collapsed Sidebar View (Icons Only) */
            <div className="flex-1 flex flex-col items-center py-4 gap-3.5 overflow-y-auto custom-scrollbar">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-2">
                <Layers size={18} />
              </div>
              <div className="w-full border-t border-slate-200/50 dark:border-slate-800/50 my-2"></div>
              
              {AVAILABLE_BLOCKS.map(block => (
                <button
                  key={block.type}
                  onClick={() => addBlock(block.type)}
                  className="w-10 h-10 bg-white/80 dark:bg-slate-850 hover:bg-violet-600 border border-slate-200/60 dark:border-slate-700/50 hover:border-violet-500 text-slate-650 dark:text-slate-300 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center group relative cursor-pointer active:scale-95"
                  title={`Thêm ${block.title}`}
                >
                  {BLOCK_ICONS[block.type] || <Plus size={16} />}
                  <span className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
                    {block.title}
                  </span>
                </button>
              ))}
              
              <div className="w-full border-t border-slate-200/50 dark:border-slate-800/50 my-2"></div>
              
              <button
                onClick={addCustomBlock}
                className="w-10 h-10 border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 bg-white/50 dark:bg-slate-900 hover:bg-violet-50 dark:hover:bg-violet-955/20 text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 rounded-xl transition-all flex items-center justify-center group relative cursor-pointer active:scale-95"
                title="Tạo Khối Mới"
              >
                <Plus size={16} />
                <span className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
                  Khối tùy chỉnh
                </span>
              </button>
            </div>
          ) : (
            /* Fully Expanded Sidebar View */
            <div className="flex-1 flex flex-col h-full overflow-hidden pt-2 pb-14 lg:pb-0">
              <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-4 shrink-0 bg-white/40 dark:bg-slate-900/20">
                <div>
                   <h3 className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-2">Cài đặt bộ</h3>
                   <div className="relative mb-2">
                     <select 
                       value={globalTheme}
                       onChange={(e) => setGlobalTheme(e.target.value)}
                       className="w-full text-xs font-semibold text-violet-600 dark:text-violet-300 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg px-4 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors cursor-pointer appearance-none shadow-sm text-slate-800 dark:text-slate-100"
                     >
                        <option value="empty">✏️ Tự do (Trống)</option>
                        <option value="math">🧮 Giải toán</option>
                        <option value="writing">✍️ Viết bài dài</option>
                        <option value="coding">💻 Lập trình</option>
                        <option value="self_dev">🌱 Phát triển bản thân</option>
                        <option value="roadmap">🗺️ Lộ trình học tập</option>
                     </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-violet-600 dark:text-violet-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-2 mt-1">
                     <button
                       onClick={handleQuickAddSet}
                       disabled={globalTheme === 'empty'}
                       className="w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg flex justify-center items-center h-10 shadow-md shadow-violet-900/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                     >
                       + TẠO BỘ
                     </button>
                     <button
                       onClick={() => setBlocks(blocks.filter(b => b.isPinned))}
                       className="w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex justify-center items-center h-10 shadow-sm transition-all"
                     >
                       XÓA TẤT CẢ
                     </button>
                   </div>

                   <div className="mt-5 border-t border-slate-200/50 dark:border-slate-800/50 pt-3">
                     <div className="flex justify-between items-center mb-1">
                         <h3 className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Mức độ chi tiết AI</h3>
                         <span className="text-[10px] font-bold text-violet-500 dark:text-violet-400">{detailLevel === 1 ? 'Ngắn gọn' : detailLevel === 2 ? 'Tiêu chuẩn' : 'Rất chi tiết'}</span>
                     </div>
                     <input 
                         type="range" 
                         min="1" max="3" step="1"
                         value={detailLevel}
                         onChange={(e) => setDetailLevel(Number(e.target.value))}
                         className="w-full accent-violet-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer mt-1"
                     />
                     <div className="flex justify-between mt-1 text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                         <span>Ngắn</span>
                         <span>Vừa</span>
                         <span>Dài</span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-200/50 dark:border-slate-800/50 pt-3">
                      <button
                        onClick={() => setShowAiSettings(!showAiSettings)}
                        className="w-full flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                      >
                        <span>⚙️ Cấu hình AI nâng cao</span>
                        <ChevronDown size={12} className={`transform transition-transform ${showAiSettings ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showAiSettings && (
                        <div className="mt-3 space-y-3 bg-slate-50/50 dark:bg-slate-955 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 flex flex-col">
                              <span>🧠 Lập luận chuyên sâu</span>
                              <span className="text-[8px] text-slate-400 dark:text-slate-500 font-normal">Sử dụng mô hình mạnh nhất</span>
                            </label>
                            <input
                              type="checkbox"
                              checked={useDeepReasoning}
                              onChange={(e) => setUseDeepReasoning(e.target.checked)}
                              className="w-3.5 h-3.5 text-violet-605 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded focus:ring-violet-500 cursor-pointer"
                            />
                          </div>
                          
                          <div>
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Sáng tạo (Temp): {customTemp}</span>
                            </div>
                            <input
                              type="range"
                              min="0" max="1" step="0.1"
                              value={customTemp}
                              onChange={(e) => setCustomTemp(Number(e.target.value))}
                              className="w-full accent-violet-500 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Từ vựng (Top-P): {customTopP}</span>
                            </div>
                            <input
                              type="range"
                              min="0.1" max="1" step="0.05"
                              value={customTopP}
                              onChange={(e) => setCustomTopP(Number(e.target.value))}
                              className="w-full accent-violet-500 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 border-t border-slate-200/50 dark:border-slate-800/50 pt-3 flex flex-col min-h-0">
                     <h3 className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-2 shrink-0">Framework Chuẩn</h3>
                     <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 max-h-[160px]">
                       {allFrameworks.map((fw: any) => (
                         <button
                           key={fw.id}
                           onClick={() => handleApplyFramework(fw.blocks)}
                           className="text-left px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-600 dark:hover:text-violet-300 hover:border-violet-550/30 dark:hover:border-violet-500/30 transition-all flex items-center shrink-0 active:scale-[0.98]"
                         >
                           {fw.name}
                         </button>
                       ))}
                     </div>
                    </div>
                 </div>
               </div>
               
               <div className="p-3 pb-1 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-white/10 dark:bg-slate-900/20">
                  <h3 className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Thành phần (Blocks)</h3>
               </div>

               <Droppable droppableId="available-blocks" isDropDisabled={true}>
                 {(provided) => (
                   <div 
                     ref={provided.innerRef} 
                     {...provided.droppableProps}
                     className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-white/10 dark:bg-slate-900/10"
                   >
                     {AVAILABLE_BLOCKS.map((block, index) => (
                      <Draggable key={block.type} draggableId={`available-${block.type}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="group"
                          >
                             <div className={`p-3 border border-slate-200 dark:border-slate-800 hover:border-violet-500/40 rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur-md hover:bg-white/90 dark:hover:bg-slate-850/80 transition-all duration-300
                              ${snapshot.isDragging ? 'shadow-lg border-violet-500 ring-1 ring-violet-500/30 bg-white dark:bg-slate-800' : ''}`}
                            >
                              <div className="flex justify-between items-center min-h-[28px]">
                                 <div className="flex flex-col min-w-0 flex-1 pr-2">
                                   <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-100">{block.title}</p>
                                   <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{block.description}</p>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addBlock(block.type);
                                    }}
                                    className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500/30 rounded-lg shadow-sm w-7 h-7 flex items-center justify-center p-0 active:scale-95"
                                    aria-label="Thêm vào"
                                  >
                                    <Plus size={14} />
                                  </button>
                               </div>
                             </div>
                           </div>
                         )}
                       </Draggable>
                     ))}
                     {provided.placeholder}
                     <button
                       onClick={addCustomBlock}
                       className="w-full mt-3 p-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-500/50 rounded-xl text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/20 hover:bg-white/60 dark:hover:bg-slate-900/40 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                     >
                       <Plus size={18} className="text-violet-500 dark:text-violet-400" />
                       <span className="text-[10px] font-bold uppercase tracking-wider">Tạo Khối Mới</span>
                     </button>
                   </div>
                 )}
               </Droppable>
             </div>
           )}
         </div>

        {/* Split Workspace Area (Desktop side-by-side, Mobile toggled) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full relative">
          
          {/* Workshop Editor (60% width on Desktop) */}
          <div className={`flex-1 lg:flex-[3] bg-transparent flex flex-col overflow-hidden w-full h-full min-w-0 border-r border-slate-200/50 dark:border-slate-800/50 ${showMobilePanel === 'build' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="p-4 md:p-6 border-b border-slate-200/50 dark:border-slate-900 shrink-0 flex items-center justify-between flex-wrap gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
              <div>
                <h2 className="text-lg font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                  <span className="text-violet-400">🔨</span>
                  <span>The Workshop (Xưởng chế tác)</span>
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 hidden lg:flex">
                  <span>Kéo thả các khối để sắp xếp. Gợi ý: Gõ <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-violet-600 dark:text-violet-400 font-mono text-[10px] border border-slate-200 dark:border-slate-800">{"{{Tên}}"}</code> để tạo biến số.</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setIsImagePromptModalOpen(true)}
                   className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap active:scale-95"
                 >
                   <ImageIcon size={14} className="text-violet-400" /> Quét Ảnh
                 </button>
                 
                 <button 
                   onClick={() => setIsQuickPromptModalOpen(true)}
                   className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-violet-900/20 transition-all whitespace-nowrap active:scale-95"
                 >
                   <Sparkles size={14} /> Tạo nhanh
                 </button>
                 
                 {personas && personas.length > 0 && (
                    <select 
                      value={activePersonaId} 
                      onChange={(e) => setActivePersonaId(e.target.value)}
                      className="text-xs bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 font-semibold px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer max-w-[150px] truncate"
                    >
                      <option value="">Làm việc Tự do</option>
                      {personas.map(p => (
                        <option key={p.id} value={p.id}>👤 {p.name}</option>
                      ))}
                    </select>
                  )}
                  
                {blocks.length > 0 && onSaveTemplate && (
                  <button 
                    onClick={handleSaveModal}
                    className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm active:scale-95"
                  >
                    <Save size={12} />
                    Lưu Template
                  </button>
                )}

                {blocks.length > 0 && (
                  <div className="relative">
                    <button 
                      onClick={() => setShowExportDropdown(!showExportDropdown)}
                      className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Download size={12} />
                      Xuất Prompt
                      <ChevronDown size={10} className={`transform transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showExportDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-xl rounded-xl z-50 p-1 flex flex-col gap-0.5 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                          <button
                            onClick={exportToMarkdown}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-600 dark:hover:text-violet-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <FileText size={14} className="text-blue-500" />
                            Xuất Markdown (.md)
                          </button>
                          <button
                            onClick={exportToJSON}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-600 dark:hover:text-violet-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <FileJson size={14} className="text-yellow-500" />
                            Xuất JSON Template (.json)
                          </button>
                          <button
                            onClick={exportToPDF}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-600 dark:hover:text-violet-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Printer size={14} className="text-emerald-500" />
                            Xuất tài liệu PDF (.pdf)
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

               {/* Mobile View Toggle & Global Settings Bar */}
              <div className="flex lg:hidden items-center justify-between w-full bg-white/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 mt-2 backdrop-blur-md">
                 <button 
                    onClick={() => setIsBottomSheetOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-lg min-h-[40px]"
                 >
                   <Plus size={14} />
                   Thêm khối
                 </button>
                 
                 <div className="flex items-center gap-2">
                   <select 
                     value={globalTheme}
                     onChange={(e) => setGlobalTheme(e.target.value)}
                     className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 min-h-[40px] max-w-[120px] focus:outline-none appearance-none"
                   >
                      <option value="empty">Cài bộ: Trống</option>
                      <option value="math">🧮 Giải toán</option>
                      <option value="writing">✍️ Viết bài dài</option>
                      <option value="coding">💻 Lập trình</option>
                   </select>
                   <button onClick={() => setShowMobilePanel('preview')} className="flex items-center p-2 rounded-lg bg-violet-600 text-white min-h-[40px]">
                     <span className="text-[10px] font-bold uppercase tracking-wider mr-1">Preview</span>
                     <ChevronRight size={14} />
                   </button>
                 </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 lg:px-6 custom-scrollbar pb-32 lg:pb-8 relative pt-4 bg-transparent">
              <Droppable droppableId="builder-area">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 flex flex-col gap-4.5 transition-colors min-h-[300px] ${snapshot.isDraggingOver ? 'bg-slate-100/30 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800' : ''}`}
                  >
                    {blocks.length === 0 && (
                      <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 py-16 mt-4">
                        <Layers className="w-10 h-10 text-slate-350 dark:text-slate-700 mb-2 animate-pulse" />
                        <span className="text-sm font-bold text-slate-650 dark:text-slate-400">Chưa có thành phần nào</span>
                        <span className="text-xs text-slate-500 text-center max-w-xs">{`Chạm '+ Thêm khối' hoặc Kéo thả khối từ cột trái để bắt đầu thiết kế prompt.`}</span>
                      </div>
                    )}
                    
                    {blocks.map((block, index) => {
                      const style = TYPE_STYLES[block.type] || { badge: 'text-slate-300 bg-slate-500/10 ring-slate-500/20 border-slate-700/30', border: 'border-l-slate-400 shadow-[0_0_10px_rgba(100,116,139,0.05)]' };
                      const isGenerating = generatingBlocks[block.id];
                      const isExpanded = expandedBlocks[block.id];

                      // Parse in-place variables for this block
                      const blockVars = getVariablesFromText(block.content);

                      return (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`bg-slate-900/60 backdrop-blur-sm border-y border-r border-l-[4px] rounded-2xl flex items-start gap-2 lg:gap-3 transition-all duration-300 group relative
                                ${style.border}
                                ${snapshot.isDragging 
                                  ? 'shadow-2xl shadow-violet-500/10 border-r-violet-500 border-y-violet-500 rotate-1 scale-[1.01] bg-slate-900/90 z-50 overflow-hidden' 
                                  : isGenerating
                                    ? 'border-violet-500 border-y-[1.5px] border-r-[1.5px] shadow-[0_0_15px_rgba(139,92,246,0.15)] bg-violet-950/10 z-10 overflow-hidden'
                                    : openAiMenuId === block.id
                                      ? 'border-y-slate-800 border-r-slate-800 shadow-md border-r-violet-500/30 border-y-violet-500/30 z-30 overflow-visible'
                                      : 'border-y-slate-800 border-r-slate-800 shadow-sm hover:border-r-slate-700 hover:border-y-slate-700 hover:shadow-[0_0_15px_rgba(139,92,246,0.04)] z-10 overflow-visible'}`}
                            >
                              {isGenerating && (
                                <div className="absolute inset-0 bg-violet-500/5 animate-[pulse_1.5s_ease-in-out_infinite] pointer-events-none rounded-r-2xl" />
                              )}
                              
                              {/* Drag Handle */}
                              <div {...provided.dragHandleProps} className="w-8 py-4 flex flex-col items-center gap-1 opacity-20 cursor-grab active:cursor-grabbing hover:opacity-60 transition-opacity z-10 hidden lg:flex">
                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                              </div>
                              
                              {/* Mobile Drag Handle */}
                              <div {...provided.dragHandleProps} className="lg:hidden pt-4 pl-3 flex flex-col items-center opacity-40 cursor-grab active:cursor-grabbing z-10 touch-manipulation pb-1 flex-shrink-0">
                                <Menu size={16} />
                              </div>

                              <div className="flex-1 w-full min-w-0 py-3 pr-3 lg:pr-4 z-10 relative">
                                  <div className="flex justify-between items-center mb-1 flex-wrap gap-y-2">
                                   <div 
                                      className="flex items-center gap-2 cursor-pointer touch-manipulation min-h-[32px] pl-1 pr-2 rounded-lg hover:bg-slate-800 transition-colors"
                                      onClick={(e) => toggleBlockExpansion(block.id, e)}
                                   >
                                       <ChevronDown size={14} className={`text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                       {editingBlockId === block.id ? (
                                         <input 
                                            autoFocus
                                            value={block.title}
                                            onChange={(e) => updateBlockTitle(block.id, e.target.value)}
                                            onBlur={() => setEditingBlockId(null)}
                                            onKeyDown={(e) => e.key === 'Enter' && setEditingBlockId(null)}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded border border-transparent whitespace-nowrap outline-none focus:ring-1 focus:ring-violet-500 ${style.badge}`}
                                         />
                                       ) : (
                                         <span 
                                           onDoubleClick={(e) => { e.stopPropagation(); setEditingBlockId(block.id); }}
                                           className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded ring-1 ring-inset border whitespace-nowrap cursor-text ${style.badge}`}
                                           title="Nháy đúp để đổi tên"
                                         >
                                           {block.title}
                                         </span>
                                       )}
                                       {!isExpanded && block.content && (
                                         <span className="text-xs text-slate-400 truncate max-w-[120px] sm:max-w-[200px] ml-1.5">{block.content}</span>
                                       )}
                                   </div>

                                   <div className={`flex items-center gap-1 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}>
                                      
                                      {/* Block Version History Controls */}
                                      <div className="flex items-center gap-0.5 bg-slate-950/40 rounded-lg p-0.5 border border-slate-800">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            undoBlock(block.id);
                                          }}
                                          disabled={!blockHistoryList[block.id] || blockHistoryList[block.id].length === 0}
                                          className="p-1 px-1.5 hover:text-violet-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 text-slate-400 cursor-pointer"
                                          title="Hoàn tác chỉnh sửa"
                                        >
                                          <RotateCcw size={12} />
                                        </button>
                                        
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            redoBlock(block.id);
                                          }}
                                          disabled={!blockRedoList[block.id] || blockRedoList[block.id].length === 0}
                                          className="p-1 px-1.5 hover:text-violet-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 text-slate-400 cursor-pointer"
                                          title="Làm lại chỉnh sửa"
                                        >
                                          <RotateCw size={12} />
                                        </button>

                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveHistoryMenuId(activeHistoryMenuId === block.id ? null : block.id);
                                            }}
                                            disabled={!blockHistoryList[block.id] || blockHistoryList[block.id].length === 0}
                                            className={`p-1 px-1.5 hover:text-violet-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 cursor-pointer ${activeHistoryMenuId === block.id ? 'bg-slate-800 text-violet-400' : 'text-slate-400'}`}
                                            title="Lịch sử chỉnh sửa"
                                          >
                                            <Clock size={12} />
                                          </button>
                                          
                                          {activeHistoryMenuId === block.id && blockHistoryList[block.id] && (
                                            <>
                                              <div 
                                                className="fixed inset-0 z-40" 
                                                onClick={(e) => { e.stopPropagation(); setActiveHistoryMenuId(null); }}
                                              />
                                              <div className="absolute top-full right-0 mt-1 w-60 bg-slate-900 border border-slate-850 shadow-2xl rounded-xl z-55 flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
                                                <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lịch sử (Tối đa 10)</span>
                                                  <Clock size={10} className="text-violet-400" />
                                                </div>
                                                <div className="max-h-48 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                                                  {blockHistoryList[block.id].slice().reverse().map((h, hIdx) => (
                                                    <button
                                                      key={hIdx}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        restoreBlockVersion(block.id, h.content);
                                                      }}
                                                      className="w-full text-left p-1.5 hover:bg-slate-850 rounded-lg transition-all flex flex-col gap-0.5 border border-transparent hover:border-violet-500/20"
                                                    >
                                                      <div className="flex justify-between items-center text-[9px] w-full">
                                                        <span className="font-bold text-violet-300 truncate max-w-[120px]">{h.label}</span>
                                                        <span className="text-slate-500 whitespace-nowrap">{h.timestamp}</span>
                                                      </div>
                                                      <p className="text-[9px] text-slate-400 truncate line-clamp-1 w-full">{h.content}</p>
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {isGenerating ? (
                                        <div className="p-1 px-2 flex items-center gap-1.5 text-violet-650 dark:text-violet-400 bg-violet-550/10 border border-violet-500/20 rounded-lg animate-pulse h-8" title="Đang tạo văn bản...">
                                          <Sparkles size={12} className="animate-pulse text-violet-600 dark:text-violet-400" />
                                          <span className="text-[10px] font-bold uppercase tracking-wider hidden lg:inline">Đang viết...</span>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="relative">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); setOpenAiMenuId(openAiMenuId === block.id ? null : block.id); }}
                                              disabled={isGenerating}
                                              className="flex items-center justify-center min-w-[32px] h-8 lg:w-auto lg:h-auto gap-1 lg:p-1.5 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 touch-manipulation z-20 cursor-pointer text-slate-400"
                                              title="Tùy chọn AI"
                                            >
                                              <Sparkles size={14} />
                                              <ChevronDown size={10} className="hidden lg:block" />
                                            </button>
                                            
                                            {openAiMenuId === block.id && (
                                              <>
                                                <div 
                                                  className="fixed inset-0 z-40" 
                                                  onClick={(e) => { e.stopPropagation(); setOpenAiMenuId(null); }}
                                                />
                                                <div className="absolute top-full right-0 mt-1 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl z-50 flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
                                                  {/* Popover Header */}
                                                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trợ lý AI khối</span>
                                                    <span className="text-[9px] font-bold text-violet-650 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded uppercase">{block.type}</span>
                                                  </div>

                                                  {/* Custom Instruction Box */}
                                                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 bg-slate-50/40 dark:bg-slate-900/40">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">🎯 Yêu cầu chỉnh sửa riêng</span>
                                                    <div className="flex gap-1.5">
                                                      <input
                                                        type="text"
                                                        autoFocus
                                                        value={customInstructions[block.id] || ""}
                                                        onChange={(e) => setCustomInstructions(prev => ({ ...prev, [block.id]: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                          if (e.key === 'Enter' && (customInstructions[block.id] || "").trim()) {
                                                            e.stopPropagation();
                                                            handleAiAssist(block, (customInstructions[block.id] || "").trim());
                                                            setCustomInstructions(prev => ({ ...prev, [block.id]: '' }));
                                                          }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder="Dịch sang tiếng Anh, dạng bảng..."
                                                        className="flex-1 text-xs border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-slate-50 dark:bg-slate-950 text-slate-850 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                                                      />
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          const text = (customInstructions[block.id] || "").trim();
                                                          if (text) {
                                                            handleAiAssist(block, text);
                                                            setCustomInstructions(prev => ({ ...prev, [block.id]: '' }));
                                                          }
                                                        }}
                                                        className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors shadow-sm shrink-0 active:scale-95"
                                                        title="Gửi yêu cầu"
                                                      >
                                                        <Send size={11} />
                                                      </button>
                                                    </div>
                                                  </div>

                                                  {/* Smart Presets */}
                                                  <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-900">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 mb-0.5">💡 Gợi ý nhanh cho khối</span>
                                                    <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto custom-scrollbar">
                                                      {(SMART_PRESETS[block.type] || DEFAULT_SMART_PRESETS).map((preset, idx) => (
                                                        <button
                                                          key={idx}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAiAssist(block, preset.action);
                                                          }}
                                                          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 rounded-md transition-colors text-left font-medium active:scale-[0.98]"
                                                        >
                                                          {preset.label}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  </div>

                                                  {/* Basic AI choices */}
                                                  <div className="p-2 flex flex-col gap-1.5 bg-slate-50/40 dark:bg-slate-950/40">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 mb-0.5">⚡ Lựa chọn cơ bản</span>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'auto'); }}
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
                                                      >
                                                        <Sparkles size={10} className="text-violet-500 dark:text-violet-400 shrink-0" />
                                                        <span>Tự động</span>
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'longer'); }}
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
                                                      >
                                                        <AlignLeft size={10} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                                                        <span>Dài hơn</span>
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'shorter'); }}
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
                                                      >
                                                        <Minimize2 size={10} className="text-rose-500 dark:text-rose-400 shrink-0" />
                                                        <span>Ngắn gọn</span>
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'professional'); }}
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
                                                      >
                                                        <Briefcase size={10} className="text-blue-500 dark:text-blue-400 shrink-0" />
                                                        <span>Chuyên nghiệp</span>
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                          
       
                                  <button 
                                             onClick={(e) => { e.stopPropagation(); togglePin(block.id); }}
                                             className={`w-8 h-8 lg:w-7 lg:h-7 flex items-center justify-center rounded-lg transition-colors touch-manipulation shrink-0 cursor-pointer ${block.isPinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                             title="Ghim block này lại"
                                           >
                                             <Pin size={14} className={block.isPinned ? 'fill-current' : ''} />
                                         </button>
                                         
                                         <button 
                                             onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                                             className="w-8 h-8 lg:w-7 lg:h-7 flex items-center justify-center text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors touch-manipulation shrink-0 cursor-pointer"
                                             title="Xóa"
                                           >
                                             <Trash2 size={14} />
                                         </button>
                                       </>
                                     )}
                                   </div>
                                </div>
                                
                               {isExpanded && (
                                 <div className="flex flex-col gap-2.5 mt-2">
                                   <textarea
                                     value={block.content}
                                     onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                     onFocus={() => { focusContentsRef.current[block.id] = block.content; }}
                                     onBlur={() => {
                                       const initialVal = focusContentsRef.current[block.id];
                                       if (initialVal !== undefined && initialVal !== block.content) {
                                         saveBlockVersion(block.id, initialVal, 'Chỉnh sửa thủ công');
                                       }
                                     }}
                                     placeholder={isGenerating ? "AI đang tự động soạn thảo..." : "Nhập nội dung khối ở đây..."}
                                     disabled={isGenerating}
                                     className={`w-full text-sm font-medium focus:outline-none resize-y min-h-[90px] bg-transparent leading-relaxed transition-all duration-300 p-3 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800/80 ${
                                       isGenerating ? 'text-violet-600 dark:text-violet-400 placeholder-violet-400/50 cursor-wait opacity-65' : 'opacity-100'
                                     }`}
                                   />
                                   
                                   {/* In-place Variables Inputs inside the block */}
                                   {blockVars.length > 0 && (
                                     <div className="mt-1 p-3 bg-slate-100/60 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-850 flex flex-col gap-2 relative">
                                       <div className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                                         <Sparkles size={11} className="text-violet-500" />
                                         <span>Điền nhanh biến số</span>
                                       </div>
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                         {blockVars.map(v => (
                                           <div key={v.name} className="flex flex-col gap-0.5">
                                             <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{v.name}</span>
                                             {v.options ? (
                                               <select
                                                 className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                                                 value={variableValues[v.name] || v.options[0]}
                                                 onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                                               >
                                                 {v.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                               </select>
                                             ) : (
                                               <input 
                                                 type="text"
                                                 className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600"
                                                 placeholder={`Thông tin cho ${v.name}...`}
                                                 value={variableValues[v.name] || ''}
                                                 onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                                               />
                                             )}
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   )}
                                 </div>
                               )}
                             </div>
                          </div>
                         )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
            
            {/* Mobile Bottom Action Bar (Sticky) */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-850 p-3 pb-safe shadow-2xl z-40">
               <div className="flex justify-between items-center gap-3 w-full max-w-md mx-auto">
                   <div className="flex gap-2 flex-1">
                       <button
                          onClick={() => handleCopy(false)}
                          disabled={blocks.length === 0}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-bold h-12 shadow-md disabled:opacity-40 active:scale-95 transition-all"
                       >
                          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                          Copy
                       </button>

                       <div className="relative">
                          <button
                             onClick={() => setShowExportDropdown(!showExportDropdown)}
                             disabled={blocks.length === 0}
                             className="px-3.5 flex items-center justify-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-sm font-bold h-12 shadow-md disabled:opacity-40 active:scale-95 transition-all cursor-pointer"
                          >
                             <Download size={16} />
                             Xuất
                          </button>

                          {showExportDropdown && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                              <div className="absolute right-0 bottom-full mb-2 w-56 bg-slate-900 border border-slate-800 shadow-2xl rounded-xl z-50 p-1.5 flex flex-col gap-0.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                                <button
                                  onClick={exportToMarkdown}
                                  className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                  <FileText size={14} className="text-blue-400" />
                                  Xuất Markdown (.md)
                                </button>
                                <button
                                  onClick={exportToJSON}
                                  className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                  <FileJson size={14} className="text-yellow-400" />
                                  Xuất JSON Template (.json)
                                </button>
                                <button
                                  onClick={exportToPDF}
                                  className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                  <Printer size={14} className="text-emerald-400" />
                                  Xuất tài liệu PDF (.pdf)
                                </button>
                              </div>
                            </>
                          )}
                       </div>
                   </div>
                   <div className="flex items-center justify-end w-[130px] border-l border-slate-850 pl-4 h-12">
                       <div className="flex flex-col w-full">
                         <span className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">AI detail</span>
                         <input 
                             type="range" 
                             min="1" max="3" step="1"
                             value={detailLevel}
                             onChange={(e) => setDetailLevel(Number(e.target.value))}
                             className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                         />
                       </div>
                   </div>
               </div>
            </div>
          </div>

          {/* Live Preview & Variables Column (40% width on Desktop) */}
          <div className={`w-full lg:flex-[2] border-l border-slate-900 bg-slate-900 flex-col shrink-0 h-full lg:z-10 shadow-2xl absolute lg:relative inset-0 lg:inset-auto z-[45] ${showMobilePanel === 'preview' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="p-3 border-b border-slate-850 flex items-center justify-between min-h-[60px] shrink-0 bg-slate-900/40">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowMobilePanel('build')} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 rounded-full hover:bg-slate-850">
                   <ChevronRight size={20} className="rotate-180" />
                </button>
                
                {/* Tab Switcher */}
                <div className="flex bg-slate-955 p-0.5 rounded-lg border border-slate-800">
                  <button 
                    type="button"
                    onClick={() => setRightPanelTab('preview')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${rightPanelTab === 'preview' ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Xem trước
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setRightPanelTab('playground');
                      if (playgroundMessages.length === 0) {
                        handleStartPlaygroundSession();
                      }
                    }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${rightPanelTab === 'playground' ? 'bg-slate-800 text-violet-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Thử nghiệm (AI)
                  </button>
                </div>
              </div>
              
              {rightPanelTab === 'preview' ? (
                <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-bold rounded-lg animate-pulse">LIVE</span>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowPlaygroundConfig(!showPlaygroundConfig)}
                  className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center text-slate-400 hover:text-slate-100 ${showPlaygroundConfig ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-transparent border-transparent'}`}
                  title="Cấu hình API & Model"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  ></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
              )}
            </div>

            {rightPanelTab === 'preview' ? (
              <>
            
            {blocks.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-850 bg-slate-950/40 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Điểm tối ưu:</span>
                  <span className={`text-xs font-bold ${score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-rose-400'}`}>
                    {score}/100
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${score >= 80 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : score >= 60 ? 'bg-yellow-500' : 'bg-rose-500'}`} style={{ width: `${score}%` }}></div>
                </div>
                <span className="text-[10px] text-slate-400 truncate font-semibold">{msg}</span>
              </div>
            )}
            
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4 bg-slate-900/20">
              
              {/* AI Prompt Doctor Card */}
              {score < 100 && blocks.length > 0 && (
                <div className="bg-slate-900 border border-violet-500/20 rounded-2xl overflow-hidden shadow-lg shrink-0 flex flex-col">
                   <div className="bg-violet-950/15 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-violet-300 font-bold uppercase tracking-wider text-[10px]">
                         <span className="relative flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                         </span>
                         <span>🩺 AI Prompt Doctor</span>
                      </div>
                      <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">Suggestions</span>
                   </div>
                   
                   <div className="p-3 max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 bg-slate-900/30">
                     {getDoctorSuggestions().map((s) => (
                       <div key={s.type} className="flex flex-col gap-1.5 p-2 bg-slate-950/40 border border-slate-850 rounded-xl hover:border-violet-500/10 transition-all">
                         <div className="flex justify-between items-start">
                           <span className="text-[11px] font-bold text-slate-200">{s.title}</span>
                           <span className="text-[8px] font-bold text-slate-500 uppercase bg-slate-800 px-1 rounded">{s.type}</span>
                         </div>
                         <p className="text-[10px] text-slate-400 leading-relaxed">{s.desc}</p>
                         <button
                           onClick={() => handleDoctorFix(s.type)}
                           className="mt-1 py-1 px-2.5 bg-violet-950/40 hover:bg-violet-900/50 border border-violet-500/30 hover:border-violet-500/50 text-[10px] font-bold text-violet-300 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                         >
                           <Sparkles size={10} className="text-violet-400" />
                           {s.fixLabel}
                         </button>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              {/* Variables Panel (Only if variables are found in template) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md shrink-0 flex flex-col">
                 <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-violet-400">
                       <Wand2 size={13} />
                       <span className="text-[10px] font-bold uppercase tracking-wider">Bộ Biến Số Prompt</span>
                    </div>
                    <button 
                       onClick={() => setIsProfileModalOpen(true)}
                       className="text-[9px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                       <User size={10} />
                       Hồ sơ
                    </button>
                 </div>
                 
                 {allVariables.length > 0 ? (
                   <>
                     <div className="p-3 bg-slate-900/30 max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                       {allVariables.map(v => (
                          <div key={v.name} className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-slate-300">{v.name}</label>
                            {v.options ? (
                              <select
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-2xl focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold text-slate-200 cursor-pointer"
                                value={variableValues[v.name] || v.options[0]}
                                onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                              >
                                {v.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <input 
                                type="text"
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-2xl focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-200 placeholder-slate-600"
                                placeholder={`Nhập ${v.name}...`}
                                value={variableValues[v.name] || ''}
                                onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                              />
                            )}
                          </div>
                       ))}
                     </div>
                   </>
                 ) : (
                   <div className="p-4 text-center text-xs text-slate-500 italic bg-slate-900/20">
                     Không tìm thấy biến số trong template
                   </div>
                 )}
              </div>

              {/* Preview Output */}
              <div className="flex-1 flex flex-col min-h-0 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-850 shadow-lg">
                <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-850 flex items-center justify-between flex-wrap gap-2 rounded-t-2xl">
                   <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Raw Output</span>
                   <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <button 
                        onClick={() => setPreviewMode('combined')}
                        className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${previewMode === 'combined' ? 'bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'}`}
                      >
                        GỘP CHUNG
                      </button>
                      <button 
                        onClick={() => setPreviewMode('split')}
                        className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${previewMode === 'split' ? 'bg-white dark:bg-slate-800 text-violet-650 dark:text-violet-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'}`}
                      >
                        <SplitSquareHorizontal size={10} /> TÁCH API
                      </button>
                   </div>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 font-mono custom-scrollbar relative">
                  {blocks.length === 0 && !activePersona ? (
                     <p className="text-slate-400 dark:text-slate-600 italic">Bắt đầu thiết lập Workshop để xem kết quả ở đây...</p>
                  ) : previewMode === 'combined' ? (
                    <div className="whitespace-pre-wrap">
                      {activePersona && (
                        <div className="mb-4 bg-slate-50/60 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850/50">
                          <span className="text-violet-650 dark:text-violet-400 font-bold uppercase tracking-widest text-[9px] block mb-1">⚙️ [System Instructions]</span>
                          <span className="text-slate-600 dark:text-slate-450 italic leading-relaxed">{activePersona.systemInstructions}</span>
                        </div>
                      )}
                      {blocks.map((b, i) => (
                        <div key={b.id} className="mb-4">
                          {b.content.trim() !== '' && (
                            <>
                              <span className="text-violet-650 dark:text-violet-400 font-bold uppercase tracking-widest text-[9px]">[{b.title}]</span>
                              <br/>
                              <span className="text-slate-800 dark:text-slate-200 leading-relaxed block mt-1">{injectVariables(b.content)}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {/* SYSTEM PROMPT */}
                      <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl p-3">
                        <h4 className="text-[10px] font-bold text-violet-650 dark:text-violet-400 uppercase tracking-wider mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                          <span>System Instructions (Quy tắc hệ thống)</span>
                          <button onClick={() => handleCopy(false, 'system')} className="text-violet-650 dark:text-violet-455 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer">
                            {copiedSystem ? <Check size={10}/> : <Copy size={10}/>}
                          </button>
                        </h4>
                        <div className="whitespace-pre-wrap text-[10px] leading-relaxed">
                          {activePersona && (
                            <div className="mb-3">
                               <span className="text-slate-500 italic block mb-1 text-[9px]">Quy tắc Persona ({activePersona.name}):</span>
                               <span className="text-slate-700 dark:text-slate-350">{activePersona.systemInstructions}</span>
                            </div>
                          )}
                          {systemBlocks.length > 0 ? systemBlocks.map(b => (
                            <div key={b.id} className="mb-3">
                              <span className="text-violet-650 dark:text-violet-400/80 font-bold text-[8px] uppercase">[{b.title}]</span><br/>
                              <span className="text-slate-800 dark:text-slate-300 mt-1 block">{injectVariables(b.content)}</span>
                            </div>
                          )) : !activePersona && <span className="text-slate-400 dark:text-slate-600 italic">Chưa có các khối Role, Context, Constraints...</span>}
                        </div>
                      </div>

                      {/* USER PROMPT */}
                      <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl p-3">
                        <h4 className="text-[10px] font-bold text-violet-650 dark:text-violet-400 uppercase tracking-wider mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                          <span>User Task (Nhiệm vụ đầu vào)</span>
                          <button onClick={() => handleCopy(false, 'user')} className="text-violet-650 dark:text-violet-455 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer">
                            {copiedUser ? <Check size={10}/> : <Copy size={10}/>}
                          </button>
                        </h4>
                        <div className="whitespace-pre-wrap text-[10px] leading-relaxed">
                          {userBlocks.length > 0 ? userBlocks.map(b => (
                            <div key={b.id} className="mb-3">
                              <span className="text-violet-650 dark:text-violet-400/80 font-bold text-[8px] uppercase">[{b.title}]</span><br/>
                              <span className="text-slate-800 dark:text-slate-355 mt-1 block">{injectVariables(b.content)}</span>
                            </div>
                          )) : <span className="text-slate-400 dark:text-slate-600 italic">Chưa có các khối Task, Format, Example...</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

              {/* Action Buttons */}
              <div className="mt-1 flex flex-col pb-6 lg:pb-0 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(false, 'combined')}
                    disabled={blocks.length === 0 && !activePersona}
                    className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-[10px] sm:text-xs font-bold shadow-md hover:from-violet-500 hover:to-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    Copy Gộp
                  </button>
                  
                  <button
                    onClick={() => handleCopy(true, 'combined')}
                    disabled={blocks.length === 0}
                    className="flex-1 py-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg text-[10px] sm:text-xs font-bold shadow-sm flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer active:scale-[0.98]"
                    title="Copy Raw Code Template"
                  >
                    {copiedRaw ? <Check size={12} /> : <Copy size={12} />}
                    Copy Raw
                  </button>

                  <div className="relative flex-1">
                    <button 
                      onClick={() => setShowExportDropdown(!showExportDropdown)}
                      disabled={blocks.length === 0}
                      className="w-full py-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg text-[10px] sm:text-xs font-bold shadow-sm flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                    >
                      <Download size={12} />
                      Xuất
                    </button>
                    
                    {showExportDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                        <div className="absolute right-0 bottom-full mb-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-xl rounded-xl z-50 p-1 flex flex-col gap-0.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                          <button
                            onClick={exportToMarkdown}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-205 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-600 dark:hover:text-violet-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <FileText size={14} className="text-blue-500" />
                            Xuất Markdown (.md)
                          </button>
                          <button
                            onClick={exportToJSON}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-205 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-600 dark:hover:text-violet-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <FileJson size={14} className="text-yellow-500" />
                            Xuất JSON Template (.json)
                          </button>
                          <button
                            onClick={exportToPDF}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-205 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-600 dark:hover:text-violet-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Printer size={14} className="text-emerald-500" />
                            Xuất tài liệu PDF (.pdf)
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* --- Playground Chat Panel --- */
            <div className="flex-1 flex flex-col min-h-0 relative bg-slate-950/20">
              {/* Playground API & Model Config Panel */}
              {showPlaygroundConfig && (
                <div className="absolute inset-x-0 top-0 bg-slate-900 border-b border-slate-800 p-4 z-20 flex flex-col gap-3 shadow-xl animate-in slide-in-from-top-2 duration-150 text-slate-100">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cấu hình AI Playground</span>
                    <button 
                      type="button" 
                      onClick={() => setShowPlaygroundConfig(false)} 
                      className="text-xs font-semibold text-violet-400 hover:text-violet-300 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-405 uppercase mb-1">Nhà cung cấp</label>
                      <select
                        value={playgroundProvider}
                        onChange={(e) => {
                          const val = e.target.value as 'gemini' | 'openai';
                          setPlaygroundProvider(val);
                          setPlaygroundModel(val === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
                        }}
                        className="text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-405 uppercase mb-1">Mô hình (Model)</label>
                      <select
                        value={playgroundModel}
                        onChange={(e) => setPlaygroundModel(e.target.value)}
                        className="text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
                      >
                        {playgroundProvider === 'gemini' ? (
                          <>
                            <option value="gemini-2.5-flash">gemini-2.5-flash (Nhanh)</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro (Pro)</option>
                            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                          </>
                        ) : (
                          <>
                            <option value="gpt-4o-mini">gpt-4o-mini</option>
                            <option value="gpt-4o">gpt-4o</option>
                            <option value="o1-mini">o1-mini (Lập luận)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {playgroundProvider === 'gemini' ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="useSystemKeyCheckbox" className="text-[10px] font-bold text-slate-350 cursor-pointer">Sử dụng API Key mặc định hệ thống</label>
                        <input
                          type="checkbox"
                          id="useSystemKeyCheckbox"
                          checked={useSystemGeminiKey}
                          onChange={(e) => setUseSystemGeminiKey(e.target.checked)}
                          className="rounded border-slate-800 text-violet-550 focus:ring-violet-500 cursor-pointer w-3.5 h-3.5"
                        />
                      </div>
                      {!useSystemGeminiKey && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-slate-500 font-medium">Gemini API Key cá nhân:</span>
                          <input
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="Nhập AIzaSy..."
                            className="w-full text-xs px-2.5 py-1 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-800"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-bold text-slate-300 block">OpenAI API Key cá nhân:</label>
                      <input
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="Nhập sk-..."
                        className="w-full text-xs px-2.5 py-1 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-800"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-slate-450 uppercase mb-0.5">
                        <span>Sáng tạo (Temp):</span>
                        <span className="text-violet-400">{playgroundTemp}</span>
                      </div>
                      <input
                        type="range"
                        min="0" max="1.5" step="0.1"
                        value={playgroundTemp}
                        onChange={(e) => setPlaygroundTemp(Number(e.target.value))}
                        className="w-full accent-violet-550 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-slate-450 uppercase mb-0.5">
                        <span>Max tokens:</span>
                        <span className="text-violet-400">{playgroundMaxTokens}</span>
                      </div>
                      <input
                        type="number"
                        value={playgroundMaxTokens}
                        onChange={(e) => setPlaygroundMaxTokens(Number(e.target.value))}
                        className="w-full text-xs px-2 py-0.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Message History */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3.5 scroll-smooth bg-slate-955/10">
                {playgroundMessages.length === 0 ? (
                  <div className="m-auto flex flex-col items-center justify-center text-center p-8 max-w-xs gap-3">
                    <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                      <Sparkles size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Phiên thử nghiệm trống</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Hãy khởi chạy phiên chat để đưa System Prompt hiện tại vào thử nghiệm trực tiếp.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartPlaygroundSession}
                      className="py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-violet-900/10 active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles size={12} /> Khởi chạy Chat
                    </button>
                  </div>
                ) : (
                  playgroundMessages.map((m, idx) => {
                    const isAi = m.role === 'assistant';
                    return (
                      <div key={idx} className={`flex flex-col gap-1 max-w-[85%] ${isAi ? 'self-start' : 'self-end items-end'}`}>
                        <div className={`text-[8px] font-bold uppercase tracking-wider text-slate-500 ${isAi ? 'pl-2' : 'pr-2'}`}>
                          {isAi ? '🎓 Mentor AI' : '👤 Học sinh'}
                        </div>
                        <div className={`p-3 rounded-2xl text-[11.5px] leading-relaxed shadow-sm border
                          ${isAi 
                            ? 'bg-slate-900/80 backdrop-blur-sm border-slate-800 text-slate-200 rounded-tl-sm' 
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500/10 text-white rounded-tr-sm'}`}
                        >
                          {m.content === '' ? (
                            <div className="flex items-center gap-1 py-1">
                              <Loader2 size={12} className="animate-spin text-violet-400" />
                              <span className="text-[10px] text-slate-400 italic">Đang suy nghĩ...</span>
                            </div>
                          ) : isAi ? (
                            <AIResponseRenderer content={m.content} className="prose-invert text-slate-200" />
                          ) : (
                            <div className="whitespace-pre-wrap font-sans break-words">{m.content}</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Area */}
              <div className="p-3 border-t border-slate-850 bg-slate-900/40 shrink-0 flex flex-col gap-2">
                <form onSubmit={handleSendPlaygroundMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isChatGenerating || playgroundMessages.length === 0}
                    placeholder={playgroundMessages.length === 0 ? "Bấm 'Khởi chạy Chat' để bắt đầu..." : "Hỏi Mentor AI gì đó..."}
                    className="flex-1 text-xs px-3.5 py-2.5 border border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-650 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isChatGenerating || !chatInput.trim() || playgroundMessages.length === 0}
                    className="w-10 h-10 shrink-0 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-md shadow-violet-900/10 transition-colors disabled:text-slate-600 disabled:shadow-none cursor-pointer active:scale-95"
                  >
                    {isChatGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
                {playgroundMessages.length > 0 && (
                  <div className="flex justify-between items-center text-[9px] text-slate-500 px-1">
                    <span>Phiên chat đã nạp System Prompt tự động.</span>
                    <button 
                      type="button"
                      onClick={handleResetPlayground} 
                      className="text-rose-400 hover:text-rose-350 font-bold uppercase transition-colors cursor-pointer"
                    >
                      Reset Chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </DragDropContext>

      {isBottomSheetOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[90] flex items-end justify-center lg:hidden">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-t-3xl w-full max-h-[85vh] shadow-2xl flex flex-col animate-in slide-in-from-bottom-5 duration-250 text-slate-900 dark:text-slate-100">
            <div className="flex justify-center pt-3 pb-2 w-full touch-pan-y" onClick={() => setIsBottomSheetOpen(false)}>
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
            </div>
            
            <div className="px-5 py-3 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/40 dark:bg-slate-900/40">
               <h3 className="text-sm uppercase font-bold text-slate-800 dark:text-slate-100 tracking-wider">Thêm Component</h3>
               <button onClick={() => setIsBottomSheetOpen(false)} className="p-2 -mr-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center shadow-sm touch-manipulation">
                 <X size={16} />
               </button>
            </div>
            
            <div className="overflow-y-auto p-5 custom-scrollbar pb-12 bg-transparent">
              <div className="mb-6">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Tạo bộ nhanh</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { handleApplyFramework(allFrameworks[0].blocks); setIsBottomSheetOpen(false); }} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-left bg-white/40 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-750 transition-colors active:scale-95 touch-manipulation">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">{allFrameworks[0]?.name}</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">Chuẩn hóa cho phân tích</span>
                  </button>
                  <button onClick={() => { handleApplyFramework(allFrameworks[1].blocks); setIsBottomSheetOpen(false); }} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-left bg-white/40 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-750 transition-colors active:scale-95 touch-manipulation">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">{allFrameworks[1]?.name}</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">Chuẩn hóa cho giao tiếp cơ bản</span>
                  </button>
                </div>
              </div>

              <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-3">Blocks đơn lẻ (Chạm để thêm)</h4>
              <div className="grid grid-cols-1 gap-3">
                {AVAILABLE_BLOCKS.map((block) => (
                  <button
                    key={block.type}
                    onClick={() => addBlock(block.type)}
                    className="flex flex-col items-start p-4 border border-slate-200 dark:border-slate-850 bg-white/40 dark:bg-slate-850 rounded-xl active:bg-slate-100 dark:active:bg-slate-800 active:scale-[0.98] transition-all text-left touch-manipulation shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1 w-full justify-between">
                       <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border ${TYPE_STYLES[block.type]?.badge || 'text-slate-650 dark:text-slate-350 bg-slate-500/10 border-slate-200 dark:border-slate-700'}`}>
                         {block.title}
                       </span>
                       <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full text-slate-500 dark:text-slate-450">
                         <Plus size={16} />
                       </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-450 mt-2 pr-4">{block.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            <h3 className="text-xl font-bold mb-1 text-slate-800 dark:text-slate-100">Lưu Template Mới</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Template của bạn sẽ được lưu vào Thư viện riêng và có thể tái sử dụng bất cứ lúc nào.</p>
            
            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 block">Tên Template</label>
                <input 
                  type="text" 
                  value={templateTitle}
                  onChange={e => setTemplateTitle(e.target.value)}
                  placeholder="Vd: Template Chuyên gia Tối ưu SEO"
                  className="w-full text-sm py-2 px-3 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-650"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 block">Mô tả (Không bắt buộc)</label>
                <textarea 
                  value={templateDesc}
                  onChange={e => setTemplateDesc(e.target.value)}
                  placeholder="Mô tả cụ thể mục đích của template này..."
                  className="w-full text-sm py-2 px-3 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 min-h-[60px] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Ngôn ngữ</label>
                  <select 
                    value={templateLanguage}
                    onChange={e => setTemplateLanguage(e.target.value)}
                    className="w-full text-sm py-2 px-3 border border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-colors bg-slate-950 text-slate-200"
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Tags (phẩy để tách)</label>
                  <input 
                    type="text" 
                    value={templateTags}
                    onChange={e => setTemplateTags(e.target.value)}
                    placeholder="vd: seo, marketing"
                    className="w-full text-sm py-2 px-3 border border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-colors bg-slate-950 text-slate-200 placeholder-slate-600"
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="isPublicToggle"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-800 text-violet-650 focus:ring-violet-550"
                  />
                  <label htmlFor="isPublicToggle" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                    Chia sẻ template này công khai với mọi người
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-auto">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
              >
                Hủy
              </button>
              <button 
                onClick={handleSaveTemplate}
                className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-colors shadow-md shadow-violet-900/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Save size={14} />
                Lưu template
              </button>
            </div>
          </div>
        </div>
      )}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 bg-violet-500/10 text-violet-650 dark:text-violet-405 border border-violet-500/20 rounded-full flex items-center justify-center">
                  <User size={20} />
               </div>
               <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Hồ Sơ Cá Nhân</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Mô tả bản thân để AI có thể tự động điền biến nhanh chóng và phân tích cấu trúc prompt tốt hơn.</p>
            
            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 block">Bạn là ai? Ngữ cảnh của bạn?</label>
                <textarea 
                  value={userProfile}
                  onChange={e => setUserProfile(e.target.value)}
                  placeholder="Vd: Tôi là học sinh lớp 12, đang ôn thi khối A. Điểm yếu là môn Lý. Thích lối giao tiếp hài hước..."
                  rows={4}
                  className="w-full text-sm py-2 px-3 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 resize-y min-h-[100px]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-auto">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
              >
                Đóng
              </button>
              <button 
                onClick={() => handleSaveProfile(userProfile)}
                className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-colors shadow-md shadow-violet-900/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Save size={14} />
                Lưu hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompt Modal */}
      {isQuickPromptModalOpen && (
        <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div 
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg border border-slate-200/50 dark:border-slate-800/50 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Wand2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tự động hoàn thiện</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bơm nội dung thông minh vào các khối hiện có</p>
                </div>
              </div>
              <button 
                onClick={() => setIsQuickPromptModalOpen(false)}
                className="p-2 text-slate-550 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                disabled={isGeneratingQuickPrompt}
              >
                <X size={18} />
              </button>
            </div>

            {blocks.length === 0 ? (
                <div className="text-center py-8">
                   <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                      <Layers size={32} />
                   </div>
                   <h3 className="text-slate-800 dark:text-slate-200 font-bold mb-2">Chưa có khối nào</h3>
                   <p className="text-slate-500 dark:text-slate-455 text-sm mb-6 leading-relaxed">Vui lòng thêm hoặc kéo thả các khối vào Workshop trước khi sử dụng tính năng này.</p>
                   <button 
                      onClick={() => setIsQuickPromptModalOpen(false)}
                      className="px-6 py-2 text-sm font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-202 rounded-lg transition-colors cursor-pointer active:scale-95"
                    >
                      Đã hiểu
                    </button>
                </div>
            ) : (
                <>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-2 block">Chủ đề / Yêu cầu</label>
                      <textarea 
                        value={quickPromptTopic}
                        onChange={e => setQuickPromptTopic(e.target.value)}
                        placeholder="Vd: Viết email xin việc chuyên nghiệp, Lên kịch bản video TikTok viral..."
                        className="w-full text-sm py-3 px-4 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 resize-none min-h-[100px]"
                        autoFocus
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-2 block">Gợi ý nhanh</label>
                      <div className="flex flex-wrap gap-2">
                         {["Viết email xin việc chuyên nghiệp", "Lên kịch bản video TikTok", "Lập kế hoạch Digital Marketing", "Giải bài toán lập trình"].map((suggestion, idx) => (
                           <button 
                             key={idx}
                             onClick={() => setQuickPromptTopic(suggestion)}
                             className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer active:scale-[0.98]"
                           >
                             {suggestion}
                           </button>
                         ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-8">
                    <button 
                      onClick={() => setIsQuickPromptModalOpen(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
                      disabled={isGeneratingQuickPrompt}
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={handleGenerateQuickPrompt}
                      disabled={!quickPromptTopic.trim() || isGeneratingQuickPrompt}
                      className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg transition-all shadow-md shadow-violet-900/10 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                    >
                      {isGeneratingQuickPrompt ? (
                        <>
                          <Wand2 size={16} className="animate-pulse" />
                          Đang bơm nội dung...
                        </>
                      ) : (
                        <>
                          <Wand2 size={16} /> Bắt đầu hoàn thiện
                        </>
                      )}
                    </button>
                  </div>
                </>
            )}
          </div>
        </div>
      )}          {/* Image Prompt Modal */}
      {isImagePromptModalOpen && (
        <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div 
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg border border-slate-200/50 dark:border-slate-800/50 text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100">Quét Ảnh & Sinh Prompt</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bóc tách cấu trúc từ hình ảnh tự động</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsImagePromptModalOpen(false);
                  setSelectedImage(null);
                  setSelectedImageMime(null);
                }}
                className="p-2 text-slate-550 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                disabled={isGeneratingFromImage}
              >
                <X size={18} />
              </button>
            </div>

            {blocks.length === 0 ? (
                <div className="text-center py-8">
                   <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                      <Layers size={32} />
                   </div>
                   <h3 className="text-slate-800 dark:text-slate-200 font-bold mb-2">Chưa có khối nào</h3>
                   <p className="text-slate-500 dark:text-slate-455 text-sm mb-6 leading-relaxed">Vui lòng thêm hoặc kéo thả các khối vào Workshop trước khi sử dụng tính năng này.</p>
                   <button 
                      onClick={() => setIsImagePromptModalOpen(false)}
                      className="px-6 py-2 text-sm font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-205 rounded-lg transition-colors cursor-pointer active:scale-95"
                    >
                      Đã hiểu
                    </button>
                </div>
            ) : (
                <>
                  <div className="space-y-5">
                    
                    <div className="w-full">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-2 block">Tải ảnh lên (Sơ đồ, UI/UX, Bảng dữ liệu)</label>
                      <label htmlFor="image-prompt-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-200 dark:border-slate-850 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-950 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 hover:border-violet-500 overflow-hidden relative transition-all">
                        {selectedImage ? (
                          <div className="absolute inset-0 w-full h-full p-2">
                             <img src={`data:${selectedImageMime};base64,${selectedImage}`} alt="Selected" className="w-full h-full object-contain rounded-xl" />
                             <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl m-2">
                               <p className="text-white text-xs font-bold bg-slate-900/90 border border-slate-750 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-md"><Upload size={14}/> Đổi ảnh khác</p>
                             </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-9 h-9 mb-3 text-slate-400 dark:text-slate-500 animate-bounce" />
                            <p className="mb-2 text-xs text-slate-700 dark:text-slate-350 font-bold"><span className="text-violet-500 dark:text-violet-400">Nhấn để tải lên</span> hoặc kéo thả</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-550">PNG, JPG, WebP (Tối đa 5MB)</p>
                          </div>
                        )}
                        <input id="image-prompt-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageSelect} disabled={isGeneratingFromImage} />
                      </label>
                    </div>

                    <div className="p-3 bg-violet-50 dark:bg-violet-955/15 border border-violet-200 dark:border-violet-500/10 rounded-xl text-[11px] text-violet-700 dark:text-violet-300 leading-normal">
                      <strong>Mẹo:</strong> Máy quét cấu trúc AI sẽ nhận diện nội dung ảnh (sơ đồ, giao diện, ý tưởng) và tự động rải dữ liệu vào các khối hiện có (Role, Task, Constraints, v.v).
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-8">
                    <button 
                      onClick={() => {
                        setIsImagePromptModalOpen(false);
                        setSelectedImage(null);
                        setSelectedImageMime(null);
                      }}
                      className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
                      disabled={isGeneratingFromImage}
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={handleGenerateFromImage}
                      disabled={!selectedImage || isGeneratingFromImage}
                      className="px-5 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-505 text-white rounded-lg transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                    >
                      {isGeneratingFromImage ? (
                        <>
                          <ImageIcon size={14} className="animate-pulse" />
                          Đang phân tích ảnh...
                        </>
                      ) : (
                        <>
                          <ImageIcon size={14} /> Bắt đầu bóc tách
                        </>
                      )}
                    </button>
                  </div>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
