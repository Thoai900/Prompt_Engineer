import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { 
  Plus, Trash2, Copy, Check, X, Layers, Save, Sparkles, Wand2, 
  ChevronDown, ChevronRight, AlignLeft, Minimize2, Briefcase, 
  Menu, User, Pin, Send, Clock, Undo, Redo, Shield, AlertCircle, Brain,
  Download, FileText, FileJson, Printer, ScrollText, Workflow,
  Wrench, Settings, Loader2
} from 'lucide-react';
import { AVAILABLE_BLOCKS, BLOCK_SUGGESTIONS } from '../../data';
import { PromptBlock, PromptTemplate, AiPersona, AiRule, AiSkill, TabType, PromptVariable, BlockType } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { usePromptBlocks } from '../../hooks/usePromptBlocks';
import { usePlaygroundSession } from '../../hooks/usePlaygroundSession';
import { BuilderSidebar } from '../builder/BuilderSidebar';
import { PromptBlockList } from '../builder/PromptBlockList';
import { PlaygroundPanel } from '../builder/PlaygroundPanel';
import { SaveTemplateModal } from '../builder/modals/SaveTemplateModal';
import { QuickPromptModal } from '../builder/modals/QuickPromptModal';
import { UserProfileModal } from '../builder/modals/UserProfileModal';
import AddToProjectModal from '../modals/AddToProjectModal';
import { autoFillVariables, type AiActionType } from '../../services/aiService';
import { routeQuickFill, routeAutoBlock } from '../../services/promptRouter';
import { PRESET_RULES, PRESET_SKILLS } from '../../presets';
import { DEFAULT_FRAMEWORKS } from '../../utils/builderUtils';

interface BuilderTabProps {
  initialTemplate: PromptTemplate | null;
  personas: AiPersona[];
  activePersonaId: string;
  setActivePersonaId: (id: string) => void;
  onSaveTemplate?: (template: PromptTemplate) => void;
  user?: any;
  onNavigateToTab?: (tab: TabType) => void;
}

export default function BuilderTab({ 
  initialTemplate, 
  personas, 
  activePersonaId, 
  setActivePersonaId, 
  onSaveTemplate,
  user,
  onNavigateToTab
}: BuilderTabProps) {
  const { 
    geminiApiKey, setGeminiApiKey, openaiApiKey, setOpenaiApiKey, 
    useSystemGeminiKey, setUseSystemGeminiKey 
  } = useWorkspace();

  const {
    blocks,
    setBlocks,
    variableValues,
    setVariableValues,
    allVariables,
    addBlock: hookAddBlock,
    deleteBlock: hookDeleteBlock,
    updateBlockContent,
    updateBlockTitle,
    togglePinBlock,
    moveBlock: hookMoveBlock,
    reorderBlocks,
    undoBlock,
    redoBlock,
    restoreBlockVersion,
    saveBlockVersion,
    blockHistoryList,
    blockRedoList,
    injectVariables,
    getVariablesFromText,
    clearAllBlocks,
    loadBlocksFromTemplate,
  } = usePromptBlocks(initialTemplate);

  const {
    playgroundMessages,
    setPlaygroundMessages,
    isChatGenerating,
    chatInput,
    setChatInput,
    playgroundProvider,
    setPlaygroundProvider,
    playgroundModel,
    setPlaygroundModel,
    playgroundTemp,
    setPlaygroundTemp,
    playgroundMaxTokens,
    setPlaygroundMaxTokens,
    showPlaygroundConfig,
    setShowPlaygroundConfig,
    handleSendPlaygroundMessage,
    handleGenerateSampleResult,
    handleResetPlayground,
  } = usePlaygroundSession();

  // Modals & Panels visibility
  const [copied, setCopied] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedSystem, setCopiedSystem] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [globalTheme, setGlobalTheme] = useState<string>('empty');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddToProjOpen, setIsAddToProjOpen] = useState(false);
  const [addToProjTemplate, setAddToProjTemplate] = useState<{ title: string; description?: string; blocks: PromptBlock[]; variables?: PromptVariable[] } | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Playground Tab State (preview / playground)
  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'playground'>('preview');

  // Custom template save states
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Mẫu của tôi');
  const [templateTags, setTemplateTags] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('vi');
  const [isPublicTemplate, setIsPublicTemplate] = useState(false);
  const [isSavedAsFramework, setIsSavedAsFramework] = useState(false);
  
  // Custom states for options
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [activeHistoryMenuId, setActiveHistoryMenuId] = useState<string | null>(null);
  
  const [savedFrameworks, setSavedFrameworks] = useState<any[]>(() => {
    try {
      const item = localStorage.getItem('custom_frameworks');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  });

  const allFrameworks = [...savedFrameworks, ...DEFAULT_FRAMEWORKS];

  const [generatingBlocks, setGeneratingBlocks] = useState<Record<string, boolean>>({});
  const [detailLevel, setDetailLevel] = useState<number>(3);
  const [openAiMenuId, setOpenAiMenuId] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<Record<string, string>>({});

  // AI Configuration states for block generation
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [useDeepReasoning, setUseDeepReasoning] = useState<boolean>(false);
  const [customTemp, setCustomTemp] = useState<number>(0.7);
  const [customTopP, setCustomTopP] = useState<number>(0.95);
  const [showAiSettings, setShowAiSettings] = useState<boolean>(false);

  // States for collapsible sidebar sections and rules library
  const [showFrameworks, setShowFrameworks] = useState<boolean>(true);
  const [showRulesLibrary, setShowRulesLibrary] = useState<boolean>(true);
  const [showComponents, setShowComponents] = useState<boolean>(true);
  const [localRules, setLocalRules] = useState<AiRule[]>([]);
  const [localSkills, setLocalSkills] = useState<AiSkill[]>([]);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [showRulesInSidebar, setShowRulesInSidebar] = useState(true);
  const [showSkillsInSidebar, setShowSkillsInSidebar] = useState(true);

  // Quick prompt states
  const [isQuickPromptModalOpen, setIsQuickPromptModalOpen] = useState(false);
  const [quickPromptTopic, setQuickPromptTopic] = useState('');
  const [quickPromptFramework, setQuickPromptFramework] = useState('claude_xmd');
  const [isGeneratingQuickPrompt, setIsGeneratingQuickPrompt] = useState(false);


  // Auto-fill and profile states
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(() => localStorage.getItem('userProfile') || '');

  // Mobile specific state
  const [showMobilePanel, setShowMobilePanel] = useState<'build' | 'preview'>('build');
  const [previewMode, setPreviewMode] = useState<'combined' | 'split'>('combined');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    loadRulesAndSkills();
  }, []);

  const loadRulesAndSkills = () => {
    const rulesStr = localStorage.getItem('custom_rules');
    const skillsStr = localStorage.getItem('custom_skills');
    const parsedRules = rulesStr ? JSON.parse(rulesStr) : [];
    const parsedSkills = skillsStr ? JSON.parse(skillsStr) : [];
    setLocalRules([...PRESET_RULES, ...parsedRules]);
    setLocalSkills([...PRESET_SKILLS, ...parsedSkills]);
  };

  const addBlock = (blockType: string, atIndex?: number) => {
    const itemToAdd = AVAILABLE_BLOCKS.find(b => b.type === blockType);
    if (!itemToAdd) return;

    const initialContent = globalTheme !== 'empty' && BLOCK_SUGGESTIONS[blockType] 
      ? BLOCK_SUGGESTIONS[blockType][globalTheme] || ''
      : '';

    const newId = hookAddBlock(itemToAdd.type as BlockType, itemToAdd.title, initialContent, atIndex);
    setExpandedBlocks(prev => ({ ...prev, [newId]: true }));
    setIsBottomSheetOpen(false); // Close bottom sheet on mobile if open
  };

  const addCustomBlock = () => {
    const newId = hookAddBlock('custom', 'Khối Tùy Chọn', '');
    setExpandedBlocks(prev => ({ ...prev, [newId]: true }));
    setIsBottomSheetOpen(false);
  };

  const handleQuickAddSet = () => {
    if (globalTheme === 'empty') return;
    clearAllBlocks();
    
    // Default blocks sequence
    const defaultSeq = ['role', 'task', 'context', 'format', 'constraints', 'thinking'];
    defaultSeq.forEach(type => {
      const blockDef = AVAILABLE_BLOCKS.find(b => b.type === type);
      if (blockDef) {
        const content = BLOCK_SUGGESTIONS[type] ? BLOCK_SUGGESTIONS[type][globalTheme] || '' : '';
        hookAddBlock(type as BlockType, blockDef.title, content);
      }
    });
  };

  const handleApplyFramework = (fwBlocks: any[]) => {
    clearAllBlocks();
    fwBlocks.forEach(b => {
      const blockDef = AVAILABLE_BLOCKS.find(avail => avail.type === b.type);
      hookAddBlock(b.type as BlockType, b.title || (blockDef ? blockDef.title : 'Khối'), b.content || '');
    });
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

  const handleAiAssist = async (block: PromptBlock, actionType: AiActionType | string = 'auto') => {
    saveBlockVersion(block.id, block.content, 'Trước khi AI chạy');
    setGeneratingBlocks(prev => ({ ...prev, [block.id]: true }));
    setExpandedBlocks(prev => ({ ...prev, [block.id]: true })); // Expand if collapsed
    setOpenAiMenuId(null);
    const contextBlocks = blocks.filter(b => b.id !== block.id).map(b => ({ title: b.title, content: b.content }));
    
    let accumulatedText = "";
    let isFirstChunk = true;

    try {
      await routeAutoBlock(
        block.type,
        block.title,
        block.content,
        contextBlocks,
        actionType,
        detailLevel,
        (chunk) => {
          if (isFirstChunk) {
            isFirstChunk = false;
            accumulatedText = chunk;
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
      const resultBlocks = await routeQuickFill(
        quickPromptTopic,
        blocks.map(b => ({ id: b.id, type: b.type, title: b.title })),
        {
          model: selectedModel,
          temperature: customTemp,
          topP: customTopP,
          useDeepReasoning
        }
      );
      
      if (resultBlocks) {
        Object.entries(resultBlocks).forEach(([id, content]) => {
          updateBlockContent(id, content);
        });
      }
      setIsQuickPromptModalOpen(false);
      setQuickPromptTopic('');
    } catch (err) {
      console.error(err);
      alert("Đã có lỗi xảy ra trong quá trình sinh tự động.");
    } finally {
      setIsGeneratingQuickPrompt(false);
    }
  };

  const handleDoctorFix = async (type: string) => {
    const blockDef = AVAILABLE_BLOCKS.find(b => b.type === type);
    if (!blockDef) return;

    const newBlockId = hookAddBlock(type as BlockType, blockDef.title, '');
    setGeneratingBlocks(prev => ({ ...prev, [newBlockId]: true }));
    setExpandedBlocks(prev => ({ ...prev, [newBlockId]: true }));

    const contextBlocks = blocks.map(b => ({ title: b.title, content: b.content }));
    let accumulatedText = "";
    let isFirstChunk = true;

    try {
      await routeAutoBlock(
        type,
        blockDef.title,
        '',
        contextBlocks,
        'auto',
        1,
        (chunk) => {
          if (isFirstChunk) {
            isFirstChunk = false;
            accumulatedText = chunk;
          } else {
            accumulatedText += chunk;
          }
          updateBlockContent(newBlockId, accumulatedText);
        },
        {
          model: selectedModel,
          temperature: customTemp,
          topP: customTopP,
          useDeepReasoning,
          customInstruction: "Hãy chỉ tạo một nội dung/ví dụ cơ bản, cực kỳ ngắn gọn và súc tích, đi thẳng vào trọng tâm, không giải thích dài dòng để tối ưu hóa token."
        }
      );
    } catch (error) {
       console.error(error);
    } finally {
      setGeneratingBlocks(prev => ({ ...prev, [newBlockId]: false }));
    }
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
    navigator.clipboard.writeText(text);
    
    if (copyType === 'combined') {
      if (isRaw) { setCopiedRaw(true); setTimeout(() => setCopiedRaw(false), 2000); }
      else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } else if (copyType === 'system') {
      setCopiedSystem(true);
      setTimeout(() => setCopiedSystem(false), 2000);
    } else if (copyType === 'user') {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    }
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
      variables: parsedVars,
      blocks
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
    window.print();
    setShowExportDropdown(false);
  };

  const handleStartPlaygroundSession = () => {
    const combinedSystem = generatePreviewContent(false, 'combined');
    handleGenerateSampleResult(combinedSystem);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    if (result.source.droppableId === 'available-blocks' && result.destination.droppableId === 'builder-area') {
      const itemToAdd = AVAILABLE_BLOCKS[result.source.index];
      addBlock(itemToAdd.type, result.destination.index);
    } else if (result.source.droppableId === 'builder-area' && result.destination.droppableId === 'builder-area') {
      reorderBlocks(result.source.index, result.destination.index);
    }
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

  const handleOpenAddToProject = () => {
    if (blocks.length === 0) {
      alert("Không có khối nào trong Workshop để lưu.");
      return;
    }
    
    const parsedVars = allVariables.map(v => ({
      name: v.name,
      type: v.options ? 'dropdown' as const : 'text' as const,
      required: true,
      options: v.options
    }));

    setAddToProjTemplate({
      title: initialTemplate?.title || 'Draft Prompt',
      description: initialTemplate?.description || '',
      blocks: [...blocks],
      variables: parsedVars
    });
    setIsAddToProjOpen(true);
  };

  const { score, msg } = getPromptScore();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex-1 flex overflow-hidden w-full h-full relative md:flex-row flex-col bg-transparent">
        
        {/* 1. LEFT SIDEBAR COMPONENT */}
        <BuilderSidebar
          isLeftSidebarCollapsed={isLeftSidebarCollapsed}
          setIsLeftSidebarCollapsed={setIsLeftSidebarCollapsed}
          globalTheme={globalTheme}
          setGlobalTheme={setGlobalTheme}
          showFrameworks={showFrameworks}
          setShowFrameworks={setShowFrameworks}
          showRulesLibrary={showRulesLibrary}
          setShowRulesLibrary={setShowRulesLibrary}
          showComponents={showComponents}
          setShowComponents={setShowComponents}
          localRules={localRules}
          localSkills={localSkills}
          sidebarSearchQuery={sidebarSearchQuery}
          setSidebarSearchQuery={setSidebarSearchQuery}
          showRulesInSidebar={showRulesInSidebar}
          setShowRulesInSidebar={setShowRulesInSidebar}
          showSkillsInSidebar={showSkillsInSidebar}
          setShowSkillsInSidebar={setShowSkillsInSidebar}
          allFrameworks={allFrameworks}
          handleApplyFramework={handleApplyFramework}
          addBlock={addBlock}
          addCustomBlock={addCustomBlock}
          handleQuickAddSet={handleQuickAddSet}
          clearAllBlocks={clearAllBlocks}
          onApplyTemplate={loadBlocksFromTemplate}
          PRESET_RULES={PRESET_RULES}
          PRESET_SKILLS={PRESET_SKILLS}
        />

        {/* 2. MIDDLE WORKSPACE (PROMPT BLOCKS LIST) */}
        <div className={`flex-1 flex flex-col min-w-0 h-full relative transition-all duration-300 ${
          isMobile && showMobilePanel === 'preview' ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Action Bar */}
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-850/50 bg-white/50 dark:bg-slate-900/10 flex justify-between items-center shrink-0 flex-wrap gap-3">
            <div className="flex items-center gap-2">
               <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                 <Wrench size={16} className="text-violet-550" />
                 <span>Workshop Thiết Kế</span>
               </h2>
               <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                 {blocks.length} blocks
               </span>
            </div>

            <div className="flex items-center gap-2">
               <button 
                 onClick={() => setIsQuickPromptModalOpen(true)}
                 className="touch-manipulation flex items-center justify-center p-2 rounded-xl bg-violet-600 hover:bg-violet-500 border border-violet-500/10 text-white text-xs font-bold gap-1 cursor-pointer active:scale-95 shadow-md shadow-violet-900/10 h-9"
                 title="Bơm nội dung nhanh"
               >
                 <Wand2 size={13} />
                 <span className="hidden sm:inline">Hoàn thiện AI</span>
               </button>
               

               <button 
                 onClick={handleOpenAddToProject}
                 className="touch-manipulation flex items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold gap-1.5 cursor-pointer active:scale-95 h-9 shadow-sm"
                 title="Thêm vào dự án chuỗi nodes"
               >
                 <Workflow size={13} className="text-cyan-500" />
                 <span className="hidden md:inline">Thêm vào Dự án</span>
               </button>

               <div className="md:hidden">
                 <button 
                   onClick={() => setIsBottomSheetOpen(true)}
                   className="w-9 h-9 flex items-center justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl cursor-pointer active:scale-95"
                 >
                   <Plus size={16} />
                 </button>
               </div>
            </div>
          </div>

          {/* Active block list */}
          <PromptBlockList
            blocks={blocks}
            expandedBlocks={expandedBlocks}
            toggleBlockExpansion={toggleBlockExpansion}
            editingBlockId={editingBlockId}
            setEditingBlockId={setEditingBlockId}
            updateBlockTitle={updateBlockTitle}
            updateBlockContent={updateBlockContent}
            deleteBlock={hookDeleteBlock}
            togglePinBlock={togglePinBlock}
            moveBlock={hookMoveBlock}
            undoBlock={undoBlock}
            redoBlock={redoBlock}
            restoreBlockVersion={restoreBlockVersion}
            saveBlockVersion={saveBlockVersion}
            blockHistoryList={blockHistoryList}
            blockRedoList={blockRedoList}
            activeHistoryMenuId={activeHistoryMenuId}
            setActiveHistoryMenuId={setActiveHistoryMenuId}
            generatingBlocks={generatingBlocks}
            openAiMenuId={openAiMenuId}
            setOpenAiMenuId={setOpenAiMenuId}
            customInstructions={customInstructions}
            setCustomInstructions={setCustomInstructions}
            handleAiAssist={handleAiAssist}
            variableValues={variableValues}
            setVariableValues={setVariableValues}
            getVariablesFromText={getVariablesFromText}
            isMobile={isMobile}
            setShowMobilePanel={setShowMobilePanel}
          />
        </div>

        {/* 3. RIGHT SIDEBAR (PREVIEW & PLAYGROUND SIMULATOR) */}
        <div className={`flex-1 md:w-96 lg:w-[420px] shrink-0 border-l border-slate-200/50 dark:border-slate-850/50 bg-white/20 dark:bg-slate-950/20 backdrop-blur-md flex flex-col h-full overflow-hidden transition-all duration-300 z-10 ${
          isMobile && showMobilePanel === 'build' ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header Panel Tabs */}
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-850/50 bg-slate-50/50 dark:bg-slate-900/10 flex justify-between items-center shrink-0 flex-wrap gap-2">
            <div className="flex gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-850">
              <button 
                onClick={() => setRightPanelTab('preview')}
                className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-lg cursor-pointer transition-all ${
                  rightPanelTab === 'preview' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
                }`}
              >
                Xem trước
              </button>
              <button 
                onClick={() => setRightPanelTab('playground')}
                className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-lg cursor-pointer transition-all ${
                  rightPanelTab === 'playground' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
                }`}
              >
                Giả lập AI
              </button>
            </div>

            <div className="flex items-center gap-1.5">
               {rightPanelTab === 'playground' && (
                  <button 
                    onClick={() => setShowPlaygroundConfig(!showPlaygroundConfig)}
                    className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer active:scale-95 ${
                      showPlaygroundConfig 
                        ? 'bg-violet-500/10 dark:bg-violet-955/20 border-violet-500/30 text-violet-655 dark:text-violet-400' 
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-850 dark:hover:text-slate-200'
                    }`}
                    title="Cấu hình Model & API"
                  >
                    <Settings size={14} />
                  </button>
               )}

               {isMobile && (
                 <button 
                   onClick={() => setShowMobilePanel('build')}
                   className="flex items-center p-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold cursor-pointer active:scale-95"
                 >
                   Quay lại
                 </button>
               )}
            </div>
          </div>

          {rightPanelTab === 'preview' ? (
            /* --- Combined Markdown Preview Panel --- */
            <>
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4 bg-slate-900/20 text-left">
                
                {/* AI Prompt Doctor Suggestion Card */}
                {score < 100 && blocks.length > 0 && (
                  <div className="bg-slate-900 border border-violet-500/20 rounded-2xl overflow-hidden shadow-lg shrink-0 flex flex-col animate-fade-in">
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
                              <label className="text-[11px] font-bold text-slate-350">{v.name}</label>
                              {v.options ? (
                                <select
                                  className="w-full text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
                                  value={variableValues[v.name] || v.options[0]}
                                  onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                                >
                                  {v.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              ) : (
                                <input 
                                  type="text"
                                  className="w-full text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-700 font-medium"
                                  placeholder={`Nhập thông tin cho ${v.name}...`}
                                  value={variableValues[v.name] || ''}
                                  onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                                />
                              )}
                            </div>
                         ))}
                       </div>
                       
                       <div className="p-2 border-t border-slate-800/80 bg-slate-950/40 flex justify-between gap-2.5">
                         <button 
                           onClick={handleAutoFill}
                           disabled={isAutoFilling || !userProfile.trim()}
                           className="flex-1 py-1.5 px-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-850 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:text-slate-600 flex items-center justify-center gap-1 active:scale-95 shadow-md shadow-violet-900/10"
                         >
                            {isAutoFilling ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                            {isAutoFilling ? 'Đang điền...' : 'Điền nhanh AI'}
                         </button>
                         <button 
                           onClick={() => setVariableValues({})}
                           className="py-1.5 px-3 border border-slate-800 bg-slate-950 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                         >
                            Xóa hết
                         </button>
                       </div>
                     </>
                   ) : (
                     <div className="p-4 bg-slate-900/20 text-center text-[10px] text-slate-500 font-medium">
                       Không phát hiện biến động dạng {"{{tên_biến}}"} nào trong prompt.
                     </div>
                   )}
                </div>

                {/* Main preview box */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-y-auto custom-scrollbar relative flex flex-col select-text min-h-[220px]">
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10 shrink-0">
                    <button
                      onClick={() => handleCopy(false, 'combined')}
                      className="px-2 py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-100 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer active:scale-95"
                    >
                      {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                      {copied ? 'Đã sao chép' : 'Sao chép'}
                    </button>
                  </div>
                  
                  {blocks.length === 0 ? (
                    <span className="text-slate-600 italic m-auto select-none">Workshop trống, hãy soạn thảo hoặc thêm các khối.</span>
                  ) : (
                    <div className="whitespace-pre-wrap select-text pr-2 pt-4">
                      {generatePreviewContent(false, 'combined')}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Info & Save Template controls */}
              <div className="p-4 border-t border-slate-200/50 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/10 shrink-0 flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                    <div className="flex flex-col text-left">
                       <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-455">Chất lượng prompt</span>
                       <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{msg}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-bold ${score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-rose-400'}`}>
                        {score}/100
                      </span>
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-rose-500'}`} style={{ width: `${score}%` }}></div>
                      </div>
                    </div>
                 </div>

                 <div className="flex gap-2 relative">
                    <button 
                       onClick={() => setIsModalOpen(true)}
                       className="flex-1 touch-manipulation py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-violet-900/10 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 h-10"
                    >
                       <Save size={14} />
                       Lưu Template
                    </button>

                    <div className="relative">
                      <button 
                         onClick={() => setShowExportDropdown(!showExportDropdown)}
                         className="touch-manipulation py-2.5 px-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer active:scale-95 flex items-center justify-center h-10 shadow-sm"
                      >
                         <Download size={14} />
                      </button>
                      
                      {showExportDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                          <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl z-50 p-1 flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <button
                              onClick={exportToMarkdown}
                              className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-650 dark:hover:text-violet-400 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <FileText size={14} className="text-violet-500" />
                              Xuất Markdown (.md)
                            </button>
                            <button
                              onClick={exportToJSON}
                              className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-655 dark:hover:text-violet-400 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <FileJson size={14} className="text-yellow-500" />
                              Xuất JSON Template (.json)
                            </button>
                            <button
                              onClick={exportToPDF}
                              className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-955/20 hover:text-violet-655 dark:hover:text-violet-400 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
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
            /* --- Playground Simulator Panel --- */
            <PlaygroundPanel
              showPlaygroundConfig={showPlaygroundConfig}
              setShowPlaygroundConfig={setShowPlaygroundConfig}
              playgroundProvider={playgroundProvider}
              setPlaygroundProvider={setPlaygroundProvider}
              playgroundModel={playgroundModel}
              setPlaygroundModel={setPlaygroundModel}
              useSystemGeminiKey={useSystemGeminiKey}
              setUseSystemGeminiKey={setUseSystemGeminiKey}
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              playgroundTemp={playgroundTemp}
              setPlaygroundTemp={setPlaygroundTemp}
              playgroundMaxTokens={playgroundMaxTokens}
              setPlaygroundMaxTokens={setPlaygroundMaxTokens}
              playgroundMessages={playgroundMessages}
              handleStartPlaygroundSession={handleStartPlaygroundSession}
              handleSendPlaygroundMessage={(e) => handleSendPlaygroundMessage(e, generatePreviewContent(false, 'combined'))}
              isChatGenerating={isChatGenerating}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleResetPlayground={handleResetPlayground}
            />
          )}
        </div>
      </div>

      {/* 4. MODALS & OTHER POPUPS */}
      <SaveTemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirmSave={handleConfirmSave}
        templateTitle={templateTitle}
        setTemplateTitle={setTemplateTitle}
        templateDesc={templateDesc}
        setTemplateDesc={setTemplateDesc}
        templateLanguage={templateLanguage}
        setTemplateLanguage={setTemplateLanguage}
        templateTags={templateTags}
        setTemplateTags={setTemplateTags}
        isPublicTemplate={isPublicTemplate}
        setIsPublicTemplate={setIsPublicTemplate}
      />

      <QuickPromptModal
        isOpen={isQuickPromptModalOpen}
        onClose={() => {
          setIsQuickPromptModalOpen(false);
          setQuickPromptTopic('');
        }}
        quickPromptTopic={quickPromptTopic}
        setQuickPromptTopic={setQuickPromptTopic}
        isGeneratingQuickPrompt={isGeneratingQuickPrompt}
        onConfirmGenerate={handleGenerateQuickPrompt}
        hasBlocks={blocks.length > 0}
      />


      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        onSaveProfile={handleSaveProfile}
      />

      <AddToProjectModal
        isOpen={isAddToProjOpen}
        onClose={() => setIsAddToProjOpen(false)}
        user={user}
        template={addToProjTemplate}
        onNavigateToTab={onNavigateToTab || (() => {})}
      />
    </DragDropContext>
  );
}
