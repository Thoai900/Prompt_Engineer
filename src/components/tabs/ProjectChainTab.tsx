import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Trash2, Play, Save, Check, AlertCircle, ArrowRight, Settings, 
  RefreshCw, Copy, ExternalLink, Sparkles, AlertTriangle, ArrowLeft,
  ChevronRight, Wrench, Edit3, HelpCircle, Layers, FileText, X, Clock,
  Upload, Download, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, doc, getDocs, query, where, setDoc, deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { TEMPLATES } from '../../data';
import { PromptProject, PromptBlock, PromptTemplate, TestCase, PromptVersion, TreeNode, EvolutionType, PromptVariable } from '../../types';
import { runPlaygroundChatStream, evaluateAndEnhancePrompt, AIChainEvaluation } from '../../services/aiService';
import AIResponseRenderer from '../common/AIResponseRenderer';
import { CanvasView } from '../project-chain/CanvasView';
import { NodeDetailSidebar } from '../project-chain/NodeDetailSidebar';
import { SimulatorPanel } from '../project-chain/SimulatorPanel';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useProjectPipeline } from '../../hooks/useProjectPipeline';

interface ProjectChainTabProps {
  theme?: 'light' | 'dark';
  user: any;
  customTemplates?: PromptTemplate[];
  onSaveTemplate?: (template: PromptTemplate) => Promise<void>;
}

const DEFAULT_PROJECTS: PromptProject[] = [
  {
    id: 'proj-education-tutor',
    name: 'Gia sư Mentor AI chuyên sâu',
    description: 'Dự án mẫu giúp thiết kế và tinh chỉnh prompt cho gia sư ảo sử dụng phương pháp Socratic.',
    globalEvalCriteria: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-root',
        parentId: null,
        title: 'Prompt Nền Móng',
        description: 'Prompt chính của dự án',
        status: 'idle',
        position: { x: 100, y: 100 },
        blocks: [
          {
            id: 'block-root-main',
            type: 'task',
            title: 'Prompt Nền Móng',
            content: 'Bạn là một gia sư AI thân thiện. Hãy giải thích chủ đề: "{{subject}}" cho học sinh lớp {{grade}}.\n\nYêu cầu:\n- Không giải hộ bài tập trực tiếp, hãy đặt câu hỏi gợi mở để hướng dẫn học sinh.\n- Định dạng công thức toán nếu có bằng LaTeX.'
          }
        ],
        variables: []
      }
    ],
    testCases: [],
    versions: []
  }
];

export default function ProjectChainTab({ theme = 'dark', user, customTemplates = [], onSaveTemplate }: ProjectChainTabProps) {
  const [projects, setProjects] = useState<PromptProject[]>([]);
  const [activeProject, setActiveProject] = useState<PromptProject | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'local' | 'error'>('local');

  // Dual-mode state
  const [viewMode, setViewMode] = useState<'wizard' | 'canvas'>(() => {
    return (localStorage.getItem('mentor_ai_project_chain_mode') as 'wizard' | 'canvas') || 'wizard';
  });

  useEffect(() => {
    localStorage.setItem('mentor_ai_project_chain_mode', viewMode);
  }, [viewMode]);

  // Canvas View control states
  const { canvasOffset, setCanvasOffset, zoom, setZoom, startPanning, handleWheel, resetCanvasView } = useCanvasInteraction();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  
  // Simulator Panel state for Canvas
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorNode, setSimulatorNode] = useState<TreeNode | null>(null);
  const [compiledPromptPreview, setCompiledPromptPreview] = useState('');
  const [simulationResponse, setSimulationResponse] = useState('');
  
  // Node Template Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTemplateQuery, setSearchTemplateQuery] = useState('');

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Base Prompt state
  const [basePromptInput, setBasePromptInput] = useState('');
  const [extractedVars, setExtractedVars] = useState<string[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [selectedVersionToCompare, setSelectedVersionToCompare] = useState<PromptVersion | null>(null);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);

  // Step 2: Simulation state
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [simProvider, setSimProvider] = useState<'gemini' | 'openai'>('gemini');
  const [simModel, setSimModel] = useState('gemini-2.5-flash');
  const [simTemp, setSimTemp] = useState(0.7);
  const [simMaxTokens, setSimMaxTokens] = useState(1000);
  const [simOutput, setSimOutput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Multi-step simulation execution state
  const [nodeExecutionOutputs, setNodeExecutionOutputs] = useState<Record<number, string>>({});
  const [currentExecutingNodeIndex, setCurrentExecutingNodeIndex] = useState<number | null>(null);
  const [expandedSimNodeIndex, setExpandedSimNodeIndex] = useState<number | null>(0);

  // Step 3: Evaluation state
  const [evaluation, setEvaluation] = useState<AIChainEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Record<number, boolean>>({});
  const [evalNodeIndex, setEvalNodeIndex] = useState<number>(0);

  // Project modification modal/states
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const saveProjectState = async (updatedProj: PromptProject) => {
    const updatedProjects = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
    setProjects(updatedProjects);
    setActiveProject(updatedProj);

    try {
      localStorage.setItem('mentor_ai_prompt_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.error(e);
    }

    if (user) {
      setSyncStatus('saving');
      try {
        const docRef = doc(db, 'projects', updatedProj.id);
        await setDoc(docRef, {
          ...updatedProj,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
        setSyncStatus('synced');
      } catch (err) {
        console.error('Lỗi Firestore:', err);
        setSyncStatus('error');
      }
    }
  };

  // Pipeline Controller Hook for Canvas
  const pipeline = useProjectPipeline(
    activeProject,
    setActiveProject,
    setProjects,
    saveProjectState,
    user
  );

  // --- 1. TẢI DỮ LIỆU ---
  useEffect(() => {
    async function loadProjects() {
      let localProjects: PromptProject[] = [];
      try {
        const saved = localStorage.getItem('mentor_ai_prompt_projects');
        if (saved) {
          localProjects = JSON.parse(saved);
        }
      } catch (e) {
        console.error('Lỗi parse local projects:', e);
      }

      if (localProjects.length === 0) {
        localProjects = [...DEFAULT_PROJECTS];
        localStorage.setItem('mentor_ai_prompt_projects', JSON.stringify(localProjects));
      }

      if (user) {
        setSyncStatus('saving');
        try {
          const q = query(collection(db, 'projects'), where('userId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          const dbProjects: PromptProject[] = [];
          
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            dbProjects.push({
              id: docSnap.id,
              name: data.name,
              description: data.description || '',
              globalEvalCriteria: data.globalEvalCriteria || [],
              nodes: data.nodes || [],
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
              userId: data.userId,
              testCases: data.testCases || [],
              versions: data.versions || []
            });
          });

          if (dbProjects.length > 0) {
            setProjects(dbProjects);
            const activeId = localStorage.getItem('active_project_id');
            const foundActive = dbProjects.find(p => p.id === activeId) || dbProjects[0];
            setActiveProject(foundActive);
            setSyncStatus('synced');
          } else {
            for (const p of localProjects) {
              const docRef = doc(db, 'projects', p.id);
              await setDoc(docRef, { ...p, userId: user.uid });
            }
            setProjects(localProjects);
            setActiveProject(localProjects[0]);
            setSyncStatus('synced');
          }
        } catch (err) {
          console.error('Lỗi load Firestore:', err);
          setProjects(localProjects);
          setActiveProject(localProjects[0] || null);
          setSyncStatus('local');
        }
      } else {
        setProjects(localProjects);
        const activeId = localStorage.getItem('active_project_id');
        const foundActive = localProjects.find(p => p.id === activeId) || localProjects[0];
        setActiveProject(foundActive || null);
        setSyncStatus('local');
      }
    }

    loadProjects();
  }, [user]);

  // Reset selectedNodeIndex when project ID changes
  const prevProjectIdRef = React.useRef(activeProject?.id);
  useEffect(() => {
    if (activeProject?.id !== prevProjectIdRef.current) {
      setSelectedNodeIndex(0);
      prevProjectIdRef.current = activeProject?.id;
    }
  }, [activeProject?.id]);

  // Sync state to local state variables when active project changes or selectedNodeIndex changes
  useEffect(() => {
    if (!activeProject) {
      setBasePromptInput('');
      setExtractedVars([]);
      return;
    }
    localStorage.setItem('active_project_id', activeProject.id);
    
    // Ensure selectedNodeIndex is within range
    const idx = Math.min(selectedNodeIndex, (activeProject.nodes || []).length - 1);
    const currentNode = activeProject.nodes?.[idx >= 0 ? idx : 0];
    const mainContent = currentNode?.blocks?.[0]?.content || '';
    setBasePromptInput(mainContent);
    
    // Reset simulation output & eval for the new project context
    setSimOutput('');
    setNodeExecutionOutputs({});
    setEvaluation(null);
    setAppliedSuggestions({});
    setSelectedVersionToCompare(null);
  }, [activeProject, selectedNodeIndex]);

  // Extract variables automatically from all nodes (excluding output_X references)
  useEffect(() => {
    if (!activeProject) {
      setExtractedVars([]);
      return;
    }
    const allVars = new Set<string>();
    activeProject.nodes.forEach(node => {
      const nodeText = node.blocks?.[0]?.content || '';
      const vars = extractVariables(nodeText);
      vars.forEach(v => {
        if (!/^[oO]utput_\d+$/.test(v)) {
          allVars.add(v);
        }
      });
    });
    const varsArray = Array.from(allVars);
    setExtractedVars(varsArray);
    
    // Sync variables to varValues map
    setVarValues(prev => {
      const next = { ...prev };
      varsArray.forEach(v => {
        if (next[v] === undefined) next[v] = '';
      });
      return next;
    });
  }, [activeProject?.nodes, basePromptInput]);

  // Debounced auto-save versions when user stops typing in Step 1
  useEffect(() => {
    if (!activeProject || !basePromptInput.trim()) return;

    const currentSavedText = activeProject.nodes?.[selectedNodeIndex]?.blocks?.[0]?.content || '';
    if (basePromptInput === currentSavedText) return;

    const timer = setTimeout(() => {
      const now = Date.now();
      const prevVersions = [...(activeProject.versions || [])];
      const lastVer = prevVersions[0];
      
      const isRecentDraft = lastVer && 
        lastVer.description === `Tự động lưu nháp (Bước ${selectedNodeIndex + 1})` && 
        (now - new Date(lastVer.timestamp).getTime()) < 120000; // 2 minutes

      const newVersion: PromptVersion = {
        id: isRecentDraft ? lastVer.id : `ver-${Date.now()}`,
        timestamp: new Date().toISOString(),
        content: basePromptInput,
        description: `Tự động lưu nháp (Bước ${selectedNodeIndex + 1})`
      };

      let updatedVersions;
      if (isRecentDraft) {
        prevVersions[0] = newVersion;
        updatedVersions = prevVersions;
      } else {
        updatedVersions = [newVersion, ...prevVersions].slice(0, 50);
      }

      const updatedNodes = [...(activeProject.nodes || [])];
      if (updatedNodes.length > selectedNodeIndex) {
        updatedNodes[selectedNodeIndex] = {
          ...updatedNodes[selectedNodeIndex],
          blocks: [{
            ...(updatedNodes[selectedNodeIndex].blocks?.[0] || { 
              id: `block-${Date.now()}-${selectedNodeIndex}`, 
              type: 'task', 
              title: updatedNodes[selectedNodeIndex].title 
            }),
            content: basePromptInput
          }]
        };
      }

      saveProjectState({
        ...activeProject,
        nodes: updatedNodes,
        versions: updatedVersions
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [basePromptInput, activeProject, selectedNodeIndex]);

  const extractVariables = (text: string): string[] => {
    const regex = /\{\{([a-zA-Z0-9_]+)(?::[^}]+)?\}\}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  };

  const injectVariables = (text: string, values: Record<string, string>): string => {
    let result = text;
    Object.entries(values).forEach(([key, val]) => {
      const regex = new RegExp(`\\{\\{${key}(?::[^}]+)?\\}\\}`, 'g');
      result = result.replace(regex, val);
    });
    return result;
  };

  // --- CANVAS HANDLERS ---
  const activeNode = useMemo(() => {
    if (!activeProject || !selectedNodeId) return null;
    return activeProject.nodes.find(n => n.id === selectedNodeId) || null;
  }, [activeProject, selectedNodeId]);

  const handleUpdateNodeFields = (fields: Partial<TreeNode>) => {
    if (!activeProject || !selectedNodeId) return;
    const updatedNodes = activeProject.nodes.map(n => 
      n.id === selectedNodeId ? { ...n, ...fields } : n
    );
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
  };

  const handleAddBlockToNode = (type: PromptBlock['type']) => {
    if (!activeNode) return;
    const typeTitles: Record<string, string> = {
      role: 'Vai trò (Role)',
      task: 'Nhiệm vụ (Task)',
      context: 'Ngữ cảnh (Context)',
      format: 'Định dạng (Format)',
      tone: 'Giọng điệu (Tone)',
      constraints: 'Ràng buộc (Constraints)',
      custom: 'Tùy chỉnh'
    };

    const newBlock: PromptBlock = {
      id: `block-${Date.now()}`,
      type,
      title: typeTitles[type] || 'Khối mới',
      content: ''
    };

    handleUpdateNodeFields({
      blocks: [...activeNode.blocks, newBlock]
    });
  };

  const handleUpdateBlockContent = (blockId: string, content: string) => {
    if (!activeNode) return;
    const updatedBlocks = activeNode.blocks.map(b => 
      b.id === blockId ? { ...b, content } : b
    );
    handleUpdateNodeFields({ blocks: updatedBlocks });
  };

  const handleUpdateBlockTitle = (blockId: string, title: string) => {
    if (!activeNode) return;
    const updatedBlocks = activeNode.blocks.map(b => 
      b.id === blockId ? { ...b, title } : b
    );
    handleUpdateNodeFields({ blocks: updatedBlocks });
  };

  const handleDeleteBlockFromNode = (blockId: string) => {
    if (!activeNode) return;
    const remaining = activeNode.blocks.filter(b => b.id !== blockId);
    handleUpdateNodeFields({ blocks: remaining });
  };

  const handleAddPresetBlock = (type: string, title: string, content: string) => {
    if (!activeNode) return;
    const hasBlock = activeNode.blocks.some(b => b.title === title || b.type === type);
    if (hasBlock) {
      alert(`Khối "${title}" đã tồn tại trong Node.`);
      return;
    }
    const newBlock: PromptBlock = {
      id: `block-preset-${Date.now()}`,
      type: type as any,
      title: title,
      content: content
    };
    handleUpdateNodeFields({
      blocks: [...activeNode.blocks, newBlock]
    });
  };

  const handleAddVariableToNode = () => {
    if (!activeNode) return;
    const newVar: PromptVariable = {
      name: `new_variable_${Date.now().toString().slice(-4)}`,
      type: 'text',
      description: 'Mô tả biến',
      required: true,
      defaultValue: ''
    };
    handleUpdateNodeFields({
      variables: [...(activeNode.variables || []), newVar]
    });
  };

  const handleUpdateVariableField = (index: number, fields: Partial<PromptVariable>) => {
    if (!activeNode) return;
    const updated = [...(activeNode.variables || [])];
    updated[index] = { ...updated[index], ...fields };
    handleUpdateNodeFields({ variables: updated });
  };

  const handleDeleteVariable = (index: number) => {
    if (!activeNode) return;
    const updated = (activeNode.variables || []).filter((_, i) => i !== index);
    handleUpdateNodeFields({ variables: updated });
  };

  const handleSelectSystemRole = (roleId: string) => {
    const role = PRESET_SYSTEM_ROLES.find(r => r.id === roleId);
    if (!role || !activeNode) return;
    
    const updatedBlocks = [...activeNode.blocks];
    if (updatedBlocks[0] && updatedBlocks[0].type === 'role') {
      updatedBlocks[0] = { ...updatedBlocks[0], content: role.rolePrompt };
    } else {
      updatedBlocks.unshift({
        id: `block-role-${Date.now()}`,
        type: 'role',
        title: 'Vai trò (Role)',
        content: role.rolePrompt
      });
    }

    handleUpdateNodeFields({
      blocks: updatedBlocks,
      variables: role.variables ? role.variables.map(v => ({ ...v })) : []
    });
  };

  const handleExportNodeAsTemplate = () => {
    if (!activeNode || !onSaveTemplate) return;
    const template: PromptTemplate = {
      id: `tpl-${Date.now()}`,
      title: activeNode.title,
      description: activeNode.description,
      blocks: activeNode.blocks,
      variables: activeNode.variables
    };
    onSaveTemplate(template)
      .then(() => alert('Đã lưu Node thành Template thư viện thành công!'))
      .catch(err => alert('Không thể xuất template: ' + err.message));
  };

  const handleImportTemplateIntoNode = (template: PromptTemplate) => {
    if (!activeNode) return;
    if (!confirm(`Bạn có muốn thay thế các khối Prompt hiện tại của node "${activeNode.title}" bằng mẫu "${template.title}" không?`)) return;

    handleUpdateNodeFields({
      title: `${activeNode.title.split('.')[0] || 'Node'}. ${template.title}`,
      description: template.description || activeNode.description,
      blocks: template.blocks.map(b => ({
        id: `block-${Date.now()}-${b.id}`,
        type: b.type,
        title: b.title,
        content: b.content
      })),
      variables: template.variables ? template.variables.map(v => ({ ...v })) : []
    });
    setIsImportModalOpen(false);
  };

  // --- CANVAS STRUCTURAL HANDLERS ---
  const handleAddChildNodeCanvas = (parentId: string) => {
    if (!activeProject) return;
    const parentNode = activeProject.nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    const childrenCount = activeProject.nodes.filter(n => n.parentId === parentId).length;

    const newChild: TreeNode = {
      id: `node-${Date.now()}`,
      parentId: parentId,
      title: `${parentNode.title.split('.')[0] || 'Node'}.${childrenCount + 1} Tiếp theo`,
      description: 'Nhánh con của ' + parentNode.title,
      status: 'idle',
      position: { 
        x: parentNode.position.x + 280, 
        y: parentNode.position.y + (childrenCount * 140) - (childrenCount > 0 ? 50 : 0) 
      },
      blocks: [
        {
          id: `b-${Date.now()}-1`,
          type: 'context',
          title: 'Ngữ cảnh (Context)',
          content: `Tham khảo kết quả từ bước trước:\n\n{{${parentNode.title.replace(/\s+/g, '')}.output}}`
        },
        {
          id: `b-${Date.now()}-2`,
          type: 'task',
          title: 'Nhiệm vụ (Task)',
          content: 'Hãy thực hiện...'
        }
      ],
      variables: []
    };

    const updatedNodes = [...activeProject.nodes, newChild];
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
    setSelectedNodeId(newChild.id);
  };

  const handleDeleteNodeCanvas = (nodeId: string) => {
    if (!activeProject) return;
    const node = activeProject.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    if (node.parentId === null) {
      alert('Không thể xóa Node gốc!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa Node "${node.title}" và mọi node phụ thuộc?`)) return;

    const idsToDelete = new Set<string>([nodeId]);
    let checking = true;
    while (checking) {
      const sizeBefore = idsToDelete.size;
      activeProject.nodes.forEach(n => {
        if (n.parentId && idsToDelete.has(n.parentId)) {
          idsToDelete.add(n.id);
        }
      });
      if (idsToDelete.size === sizeBefore) {
        checking = false;
      }
    }

    const remainingNodes = activeProject.nodes.filter(n => !idsToDelete.has(n.id));
    const updatedProj = { ...activeProject, nodes: remainingNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
    
    if (selectedNodeId && idsToDelete.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  };

  const updateNodePositionCanvas = (nodeId: string, pos: { x: number; y: number }) => {
    if (!activeProject) return;
    const updatedNodes = activeProject.nodes.map(n => 
      n.id === nodeId ? { ...n, position: pos } : n
    );
    const updatedProj = { ...activeProject, nodes: updatedNodes };
    
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProj : p));
    setActiveProject(updatedProj);
  };

  const saveNodeDragEndCanvas = () => {
    if (activeProject) {
      saveProjectState(activeProject);
    }
  };

  const startDragNodeCanvas = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!activeProject) return;
    const node = activeProject.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = node.position.x;
    const initialY = node.position.y;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      updateNodePositionCanvas(nodeId, {
        x: Math.round(initialX + dx),
        y: Math.round(initialY + dy)
      });
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveNodeDragEndCanvas();
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- SIMULATION & PIPELINE HANDLERS FOR CANVAS ---
  const handleOpenSimulatorCanvas = (nodeId: string) => {
    if (!activeProject) return;
    const node = activeProject.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setSimulatorNode(node);
    
    const defaultInputs: Record<string, string> = { ...pipeline.pipelineInputs };
    activeProject.nodes.forEach(n => {
      n.variables?.forEach(v => {
        if (v.defaultValue && defaultInputs[v.name] === undefined) {
          defaultInputs[v.name] = v.defaultValue;
        }
      });
    });

    pipeline.setPipelineInputs(defaultInputs);

    // Compile preview
    const preview = compilePromptTextCanvas(node, activeProject, defaultInputs);
    setCompiledPromptPreview(preview);
    setSimulationResponse(node.output || '');
    setIsSimulatorOpen(true);
  };

  const compilePromptTextCanvas = (node: TreeNode, project: PromptProject, inputs: Record<string, string>): string => {
    let compiled = node.blocks.map(b => `[${b.title}]\n${b.content}`).join('\n\n');
    const varRegex = /\{\{([^}]+)\}\}/g;
    
    const replacements: Record<string, string> = {};
    const ancestors: TreeNode[] = [];
    let currentParentId = node.parentId;
    while (currentParentId) {
      const parentNode = project.nodes.find(n => n.id === currentParentId);
      if (parentNode) {
        ancestors.push(parentNode);
        currentParentId = parentNode.parentId;
      } else {
        break;
      }
    }

    const directParent = ancestors[0];
    if (directParent) {
      replacements['parent.output'] = directParent.output || `[LƯU Ý: Đầu ra của Node "${directParent.title}" chưa được thực thi. Vui lòng chạy Node cha trước!]`;
    }

    ancestors.forEach(anc => {
      const key = `${anc.title.replace(/\s+/g, '')}.output`;
      replacements[key] = anc.output || `[LƯU Ý: Đầu ra của Node "${anc.title}" chưa được thực thi. Vui lòng chạy Node này trước!]`;
    });

    return compiled.replace(varRegex, (match, varName) => {
      const cleanedName = varName.trim();
      if (replacements[cleanedName] !== undefined) {
        return replacements[cleanedName];
      }
      if (inputs[cleanedName] !== undefined && inputs[cleanedName] !== '') {
        return inputs[cleanedName];
      }
      const defVar = project.nodes.flatMap(n => n.variables || []).find(v => v.name === cleanedName);
      if (defVar && defVar.defaultValue) {
        return defVar.defaultValue;
      }
      return match;
    });
  };

  const handleVariableInputChangeCanvas = (name: string, value: string) => {
    const updated = { ...pipeline.pipelineInputs, [name]: value };
    pipeline.setPipelineInputs(updated);
    if (simulatorNode && activeProject) {
      const preview = compilePromptTextCanvas(simulatorNode, activeProject, updated);
      setCompiledPromptPreview(preview);
    }
  };

  const handleRunSimulationCanvas = async () => {
    if (!simulatorNode || !activeProject) return;
    
    pipeline.setPipelineNodeResponse('');
    
    const systemInstruction = `Bạn là Mentor AI - gia sư thân thiện, kiên nhẫn và khuyến khích cho học sinh trung học. Hãy tuân thủ nghiêm ngặt:
1. Tuyệt đối KHÔNG giải hộ bài tập hay đưa ra đáp án trực tiếp. Sử dụng phương pháp Socratic để đặt câu hỏi khơi gợi tư duy, dẫn dắt từng bước để học sinh tự tìm ra câu trả lời.
2. Giọng điệu thân thiện, kiên nhẫn, sử dụng emoji một cách ấm áp, khích lệ.
3. Khi viết các công thức toán học hoặc khoa học, hãy luôn sử dụng LaTeX (bọc bằng $ hoặc $$).`;

    const customKey = localStorage.getItem('mentor_ai_gemini_key') || '';
    const useSystemKey = localStorage.getItem('mentor_ai_use_system_key') !== 'false';
    const openaiKey = localStorage.getItem('mentor_ai_openai_key') || '';
    const apiKey = pipeline.simProvider === 'gemini' 
      ? (useSystemKey ? undefined : customKey)
      : openaiKey;

    let accumulatedOutput = '';
    pipeline.setPipelineStatus('running');

    try {
      await runPlaygroundChatStream(
        pipeline.simProvider,
        systemInstruction,
        [{ role: 'user', content: compiledPromptPreview }],
        {
          apiKey,
          model: pipeline.simModel,
          temperature: pipeline.simTemp
        },
        (chunk) => {
          accumulatedOutput += chunk;
          setSimulationResponse(accumulatedOutput);
        }
      );

      // Cập nhật output cho node và lưu dự án
      const updatedNodes = activeProject.nodes.map(n => 
        n.id === simulatorNode.id ? { ...n, output: accumulatedOutput, status: 'success' as const } : n
      );
      const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
      saveProjectState(updatedProj);
      setSimulatorNode(prev => prev ? { ...prev, output: accumulatedOutput, status: 'success' as const } : null);
      
    } catch (err: any) {
      console.error(err);
      setSimulationResponse(`❌ Lỗi thực thi: ${err.message}`);
    } finally {
      pipeline.setPipelineStatus('idle');
    }
  };

  const handleEvaluateDraftCanvas = (evalType: 'effective' | 'ineffective') => {
    if (!simulatorNode || !activeProject) return;
    const updatedNodes = activeProject.nodes.map(n => 
      n.id === simulatorNode.id ? { ...n, userEvaluation: evalType } : n
    );
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
    setSimulatorNode(prev => prev ? { ...prev, userEvaluation: evalType } : null);
  };

  const handleCreateBranchNodeCanvas = (type: 'success' | 'failure') => {
    if (!activeProject || !simulatorNode) return;
    
    const siblingCount = activeProject.nodes.filter(
      n => n.parentId === simulatorNode.id && n.branchType === type
    ).length;
    
    const offsetSlot = siblingCount * 140;
    const posX = simulatorNode.position.x + 280;
    const posY = type === 'success' 
      ? simulatorNode.position.y - 125 - offsetSlot
      : simulatorNode.position.y + 125 + offsetSlot;

    const newTitle = type === 'success'
      ? `${simulatorNode.title.split('.')[0] || 'Node'}.A Nâng cao ${siblingCount + 1}`
      : `${simulatorNode.title.split('.')[0] || 'Node'}.B Sửa lỗi ${siblingCount + 1}`;

    const newDescription = type === 'success'
      ? `Nhánh nâng cao khi prompt "${simulatorNode.title}" hoạt động hiệu quả.`
      : `Nhánh khắc phục và sửa đổi lỗi khi prompt "${simulatorNode.title}" chưa được như ý.`;

    const newChild: TreeNode = {
      id: `node-${Date.now()}`,
      parentId: simulatorNode.id,
      title: newTitle,
      description: newDescription,
      status: 'idle',
      branchType: type,
      position: { x: posX, y: posY },
      blocks: type === 'success' ? [
        {
          id: `b-${Date.now()}-1`,
          type: 'context',
          title: 'Kết quả bước trước',
          content: `Kết quả từ bước trước:\n\n{{${simulatorNode.title.replace(/\s+/g, '')}.output}}`
        },
        {
          id: `b-${Date.now()}-2`,
          type: 'task',
          title: 'Nhiệm vụ nâng cao',
          content: 'Dựa trên kết quả hiệu quả phía trên, hãy thực hiện bước tiếp theo...'
        }
      ] : [
        {
          id: `b-${Date.now()}-1`,
          type: 'context',
          title: 'Kết quả lỗi',
          content: `Kết quả chưa đạt từ bước trước:\n\n{{${simulatorNode.title.replace(/\s+/g, '')}.output}}`
        },
        {
          id: `b-${Date.now()}-2`,
          type: 'task',
          title: 'Nhiệm vụ sửa đổi',
          content: 'Hãy điều chỉnh lại prompt hoặc bổ sung các cấu trúc ràng buộc (Constraints) chặt chẽ hơn...'
        }
      ],
      variables: []
    };

    const updatedNodes = [...activeProject.nodes, newChild];
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
    
    setSelectedNodeId(newChild.id);
    setIsSimulatorOpen(false);
  };

  const handleSaveModifiedSimulatorOutputCanvas = (text: string) => {
    if (!simulatorNode || !activeProject) return;
    const updatedNodes = activeProject.nodes.map(n => 
      n.id === simulatorNode.id ? { ...n, output: text } : n
    );
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
    setSimulatorNode(prev => prev ? { ...prev, output: text } : null);
  };

  const handleToggleViewMode = (mode: 'wizard' | 'canvas') => {
    if (mode === 'canvas' && activeProject?.nodes) {
      const currentWizardNode = activeProject.nodes[selectedNodeIndex];
      if (currentWizardNode) {
        setSelectedNodeId(currentWizardNode.id);
      }
    } else if (mode === 'wizard' && activeProject?.nodes && selectedNodeId) {
      const idx = activeProject.nodes.findIndex(n => n.id === selectedNodeId);
      if (idx !== -1) {
        setSelectedNodeIndex(idx);
        setBasePromptInput(activeProject.nodes[idx].blocks?.[0]?.content || '');
      }
    }
    setViewMode(mode);
  };

  const allAvailableTemplates = useMemo(() => {
    const presets = TEMPLATES;
    const customs = customTemplates || [];
    return [...presets, ...customs];
  }, [customTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!searchTemplateQuery) return allAvailableTemplates;
    return allAvailableTemplates.filter(t => 
      t.title.toLowerCase().includes(searchTemplateQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTemplateQuery.toLowerCase())
    );
  }, [allAvailableTemplates, searchTemplateQuery]);

  const PRESET_SYSTEM_ROLES = useMemo(() => {
    return [
      {
        id: 'role-mentor-ai',
        title: 'Mentor AI - Socratic Tutor',
        rolePrompt: 'Bạn là Mentor AI - gia sư thân thiện, kiên nhẫn và khuyến khích cho học sinh trung học. Hãy tuân thủ nghiêm ngặt phương pháp Socratic, đặt câu hỏi khơi gợi và sử dụng LaTeX.',
        variables: []
      },
      {
        id: 'role-code-reviewer',
        title: 'Senior Code Reviewer',
        rolePrompt: 'Bạn là một lập trình viên cao cấp có vai trò review code. Hãy tập trung review tính đúng đắn, hiệu năng và phong cách viết code.',
        variables: []
      }
    ];
  }, []);

  const handleUpdatePromptText = (text: string) => {
    if (!activeProject) return;
    setBasePromptInput(text);

    const updatedNodes = [...(activeProject.nodes || [])];
    // Ensure the array has enough nodes up to selectedNodeIndex
    while (updatedNodes.length <= selectedNodeIndex) {
      const idx = updatedNodes.length;
      updatedNodes.push({
        id: `node-${Date.now()}-${idx}`,
        parentId: idx > 0 ? updatedNodes[idx - 1].id : null,
        title: `Bước ${idx + 1}`,
        description: `Mắt xích thứ ${idx + 1} của chuỗi`,
        status: 'idle',
        position: { x: 100 + idx * 150, y: 100 },
        blocks: [{
          id: `block-${Date.now()}-${idx}`,
          type: 'task',
          title: `Bước ${idx + 1}`,
          content: ''
        }],
        variables: []
      });
    }

    updatedNodes[selectedNodeIndex] = {
      ...updatedNodes[selectedNodeIndex],
      blocks: [{
        ...(updatedNodes[selectedNodeIndex].blocks?.[0] || { 
          id: `block-${Date.now()}-${selectedNodeIndex}`, 
          type: 'task', 
          title: updatedNodes[selectedNodeIndex].title || `Bước ${selectedNodeIndex + 1}` 
        }),
        content: text
      }]
    };

    saveProjectState({
      ...activeProject,
      nodes: updatedNodes
    });
  };

  const handleUpdateNodeTitle = (idx: number, newTitle: string) => {
    if (!activeProject) return;
    const updatedNodes = [...(activeProject.nodes || [])];
    if (updatedNodes[idx]) {
      updatedNodes[idx] = {
        ...updatedNodes[idx],
        title: newTitle,
        blocks: [{
          ...(updatedNodes[idx].blocks?.[0] || { 
            id: `block-${Date.now()}-${idx}`, 
            type: 'task', 
            title: newTitle,
            content: ''
          }),
          title: newTitle
        }]
      };
      saveProjectState({
        ...activeProject,
        nodes: updatedNodes
      });
    }
  };

  const handleAddNode = () => {
    if (!activeProject) return;
    const updatedNodes = [...(activeProject.nodes || [])];
    const newIdx = updatedNodes.length;
    const parentId = newIdx > 0 ? updatedNodes[newIdx - 1].id : null;
    
    updatedNodes.push({
      id: `node-${Date.now()}-${newIdx}`,
      parentId: parentId,
      title: `Bước ${newIdx + 1}`,
      description: `Mắt xích thứ ${newIdx + 1} của chuỗi`,
      status: 'idle',
      position: { x: 100 + newIdx * 150, y: 100 },
      blocks: [{
        id: `block-${Date.now()}-${newIdx}`,
        type: 'task',
        title: `Bước ${newIdx + 1}`,
        content: `Mô tả prompt cho bước ${newIdx + 1} tại đây. Bạn có thể sử dụng {{output_${newIdx}}} để tham chiếu kết quả bước trước.`
      }],
      variables: []
    });

    saveProjectState({
      ...activeProject,
      nodes: updatedNodes
    });
    setSelectedNodeIndex(newIdx);
  };

  const handleDeleteNode = (idx: number) => {
    if (!activeProject || (activeProject.nodes || []).length <= 1) return;
    if (!confirm('Bạn có chắc chắn muốn xóa bước này khỏi chuỗi prompt?')) return;

    let updatedNodes = [...(activeProject.nodes || [])];
    updatedNodes.splice(idx, 1);
    
    // Re-adjust node ids/parents and default titles
    updatedNodes = updatedNodes.map((node, i) => {
      return {
        ...node,
        parentId: i > 0 ? updatedNodes[i - 1].id : null,
        title: node.title.startsWith('Bước ') ? `Bước ${i + 1}` : node.title
      };
    });

    saveProjectState({
      ...activeProject,
      nodes: updatedNodes
    });
    
    // Adjust selected index
    if (selectedNodeIndex >= updatedNodes.length) {
      setSelectedNodeIndex(updatedNodes.length - 1);
    } else if (selectedNodeIndex === idx) {
      setSelectedNodeIndex(Math.max(0, idx - 1));
    }
  };

  const handleMoveNode = (idx: number, direction: 'up' | 'down') => {
    if (!activeProject) return;
    const updatedNodes = [...(activeProject.nodes || [])];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    if (targetIdx < 0 || targetIdx >= updatedNodes.length) return;
    
    // Swap
    const temp = updatedNodes[idx];
    updatedNodes[idx] = updatedNodes[targetIdx];
    updatedNodes[targetIdx] = temp;
    
    // Update parents after swap
    const finalNodes = updatedNodes.map((node, i) => ({
      ...node,
      parentId: i > 0 ? updatedNodes[i - 1].id : null,
      title: node.title.startsWith('Bước ') ? `Bước ${i + 1}` : node.title
    }));

    saveProjectState({
      ...activeProject,
      nodes: finalNodes
    });
    setSelectedNodeIndex(targetIdx);
  };

  // --- 3. QUẢN LÝ DỰ ÁN (THÊM, XÓA) ---
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;

    const newProj: PromptProject = {
      id: `proj-${Date.now()}`,
      name: newProjectName,
      description: newProjectDesc,
      globalEvalCriteria: [],
      nodes: [{
        id: 'node-root',
        parentId: null,
        title: 'Prompt Nền Móng',
        description: 'Prompt chính của dự án',
        status: 'idle',
        position: { x: 100, y: 100 },
        blocks: [{
          id: 'block-root-main',
          type: 'task',
          title: 'Prompt Nền Móng',
          content: ''
        }],
        variables: []
      }],
      testCases: [],
      versions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextProjects = [...projects, newProj];
    setProjects(nextProjects);
    setActiveProject(newProj);
    localStorage.setItem('mentor_ai_prompt_projects', JSON.stringify(nextProjects));

    if (user) {
      const docRef = doc(db, 'projects', newProj.id);
      setDoc(docRef, { ...newProj, userId: user.uid }).then(() => {
        setSyncStatus('synced');
      }).catch(() => setSyncStatus('error'));
    }

    setIsNewProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
    setCurrentStep(1);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa dự án này?')) return;

    const nextProjects = projects.filter(p => p.id !== id);
    setProjects(nextProjects);

    if (activeProject?.id === id) {
      setActiveProject(nextProjects[0] || null);
    }

    localStorage.setItem('mentor_ai_prompt_projects', JSON.stringify(nextProjects));

    if (user) {
      const docRef = doc(db, 'projects', id);
      deleteDoc(docRef).then(() => {
        setSyncStatus('synced');
      }).catch(() => setSyncStatus('error'));
    }
  };

  // --- 4. BƯỚC 2: CHẠY GIẢ LẬP ---
  const handleRunSimulation = async () => {
    if (!activeProject || isSimulating) return;

    setIsSimulating(true);
    setNodeExecutionOutputs({});
    setCurrentExecutingNodeIndex(0);
    setExpandedSimNodeIndex(0);
    setSimOutput('');

    const outputs: Record<number, string> = {};
    const chainVals: Record<string, string> = { ...varValues };

    try {
      const nodes = activeProject.nodes || [];
      for (let k = 0; k < nodes.length; k++) {
        setCurrentExecutingNodeIndex(k);
        setExpandedSimNodeIndex(k);
        
        const node = nodes[k];
        const rawPrompt = node.blocks?.[0]?.content || '';
        
        const compileVals = { ...chainVals };
        for (let j = 0; j < k; j++) {
          compileVals[`output_${j+1}`] = outputs[j] || '';
          compileVals[`Output_${j+1}`] = outputs[j] || '';
        }
        
        const injectedPrompt = injectVariables(rawPrompt, compileVals);
        let accumulated = '';
        outputs[k] = '';
        
        await runPlaygroundChatStream(
          simProvider,
          injectedPrompt,
          [{ role: 'user', content: 'Hãy thực thi và phản hồi theo chỉ dẫn prompt hệ thống.' }],
          {
            apiKey: undefined,
            model: simModel,
            temperature: simTemp,
            maxTokens: simMaxTokens
          },
          (chunk) => {
            accumulated += chunk;
            outputs[k] = accumulated;
            setNodeExecutionOutputs(prev => ({
              ...prev,
              [k]: accumulated
            }));
            if (k === nodes.length - 1) {
              setSimOutput(accumulated);
            }
          }
        );
        
        chainVals[`output_${k+1}`] = outputs[k];
        chainVals[`Output_${k+1}`] = outputs[k];
      }

      const finalOutput = outputs[nodes.length - 1] || '';
      const newRun: TestCase = {
        id: `run-${Date.now()}`,
        name: `Giả lập Chuỗi (${nodes.length} bước): ${new Date().toLocaleTimeString()}`,
        inputs: { ...varValues },
        status: 'success',
        outputText: finalOutput
      };

      const updatedTestCases = [newRun, ...(activeProject.testCases || [])].slice(0, 10);
      saveProjectState({
        ...activeProject,
        testCases: updatedTestCases
      });

    } catch (err: any) {
      console.error(err);
      setSimOutput(`❌ Lỗi khi chạy giả lập: ${err.message}`);
    } finally {
      setIsSimulating(false);
      setCurrentExecutingNodeIndex(null);
    }
  };

  const handleOpenExternalPlayground = (url: string) => {
    if (!activeProject) return;
    const rawPrompt = activeProject.nodes?.[selectedNodeIndex]?.blocks?.[0]?.content || '';
    
    const compileVals = { ...varValues };
    Object.entries(nodeExecutionOutputs).forEach(([kStr, output]) => {
      const k = parseInt(kStr);
      compileVals[`output_${k+1}`] = output;
      compileVals[`Output_${k+1}`] = output;
    });
    
    const injectedPrompt = injectVariables(rawPrompt, compileVals);
    navigator.clipboard.writeText(injectedPrompt);
    alert('Đã điền các biến số và sao chép Prompt vào Clipboard thành công! Đang chuyển hướng bạn sang trang Playground ngoài...');
    window.open(url, '_blank');
  };

  // --- 5. BƯỚC 3: ĐÁNH GIÁ & TỐI ƯU ---
  const handleStartEvaluation = async () => {
    const outputToEval = nodeExecutionOutputs[evalNodeIndex] || simOutput;
    
    if (!outputToEval || isEvaluating) {
      alert(`Vui lòng chạy giả lập ở Bước 2 trước khi thẩm định Bước ${evalNodeIndex + 1}!`);
      return;
    }

    setIsEvaluating(true);
    setEvaluation(null);
    setAppliedSuggestions({});

    try {
      const promptToEval = activeProject?.nodes[evalNodeIndex]?.blocks?.[0]?.content || '';
      const res = await evaluateAndEnhancePrompt(promptToEval, outputToEval);
      setEvaluation(res);
    } catch (err: any) {
      console.error(err);
      alert('Đã xảy ra lỗi khi thẩm định AI: ' + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleApplySuggestion = (content: string, index: number) => {
    if (appliedSuggestions[index] || !activeProject) return;

    const targetNode = activeProject.nodes[evalNodeIndex];
    if (!targetNode) return;

    const currentPromptText = targetNode.blocks?.[0]?.content || '';
    const newPromptText = currentPromptText.trim() + '\n' + content.trim();
    
    const newVersion: PromptVersion = {
      id: `ver-${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: newPromptText,
      description: `Áp dụng gợi ý AI (Bước ${evalNodeIndex + 1}): ${evaluation?.suggestions[index].title || 'Tối ưu hóa'}`
    };

    const updatedVersions = [newVersion, ...(activeProject.versions || [])].slice(0, 50);
    
    if (evalNodeIndex === selectedNodeIndex) {
      setBasePromptInput(newPromptText);
    }
    setAppliedSuggestions(prev => ({ ...prev, [index]: true }));

    const updatedNodes = [...(activeProject.nodes || [])];
    if (updatedNodes[evalNodeIndex]) {
      updatedNodes[evalNodeIndex] = {
        ...updatedNodes[evalNodeIndex],
        blocks: [{
          ...(updatedNodes[evalNodeIndex].blocks?.[0] || { 
            id: `block-${Date.now()}-${evalNodeIndex}`, 
            type: 'task', 
            title: updatedNodes[evalNodeIndex].title 
          }),
          content: newPromptText
        }]
      };
    }

    saveProjectState({
      ...activeProject,
      nodes: updatedNodes,
      versions: updatedVersions
    });
  };

  // Restore previous version
  const handleRestoreVersion = (ver: PromptVersion) => {
    if (!activeProject) return;
    if (!confirm(`Bạn có chắc chắn muốn khôi phục về phiên bản ngày ${new Date(ver.timestamp).toLocaleString()}?`)) return;

    const backupVersion: PromptVersion = {
      id: `ver-${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: basePromptInput,
      description: `Lưu nháp trước khi khôi phục (Bước ${selectedNodeIndex + 1})`
    };

    const updatedVersions = [backupVersion, ...(activeProject.versions || [])].slice(0, 50);
    setBasePromptInput(ver.content);

    const updatedNodes = [...(activeProject.nodes || [])];
    if (updatedNodes[selectedNodeIndex]) {
      updatedNodes[selectedNodeIndex] = {
        ...updatedNodes[selectedNodeIndex],
        blocks: [{
          ...(updatedNodes[selectedNodeIndex].blocks?.[0] || { 
            id: `block-${Date.now()}-${selectedNodeIndex}`, 
            type: 'task', 
            title: updatedNodes[selectedNodeIndex].title 
          }),
          content: ver.content
        }]
      };
    }

    saveProjectState({
      ...activeProject,
      nodes: updatedNodes,
      versions: updatedVersions
    });

    setSelectedVersionToCompare(null);
    alert('Khôi phục phiên bản thành công!');
  };

  // Compute text diff (line by line unified diff helper)
  const computeUnifiedDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diffResult: { type: 'added' | 'removed' | 'unchanged'; text: string }[] = [];
    
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
          diffResult.push({ type: 'unchanged', text: oldLines[i] });
          i++;
          j++;
        } else {
          let foundMatch = false;
          for (let k = 1; k < 5; k++) {
            if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
              for (let m = 0; m < k; m++) {
                diffResult.push({ type: 'removed', text: oldLines[i + m] });
              }
              i += k;
              foundMatch = true;
              break;
            }
            if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
              for (let m = 0; m < k; m++) {
                diffResult.push({ type: 'added', text: newLines[j + m] });
              }
              j += k;
              foundMatch = true;
              break;
            }
          }
          if (!foundMatch) {
            diffResult.push({ type: 'removed', text: oldLines[i] });
            diffResult.push({ type: 'added', text: newLines[j] });
            i++;
            j++;
          }
        }
      } else if (i < oldLines.length) {
        diffResult.push({ type: 'removed', text: oldLines[i] });
        i++;
      } else if (j < newLines.length) {
        diffResult.push({ type: 'added', text: newLines[j] });
        j++;
      }
    }
    return diffResult;
  };

  // Preset Template loader
  const handleLoadTemplate = (content: string) => {
    handleUpdatePromptText(content);
    setShowTemplatePicker(false);
  };

  const allTemplates = [...(customTemplates || []), ...TEMPLATES];

  return (
    <div className="flex-1 flex overflow-hidden w-full h-full relative md:flex-row flex-col bg-slate-955 text-slate-100 font-sans">
      
      {/* 1. LEFT SIDEBAR - PROJECT LIST */}
      <div className="w-full md:w-80 shrink-0 border-r border-slate-205/10 dark:border-slate-900 bg-slate-100 dark:bg-slate-900/10 backdrop-blur-md flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-205/10 dark:border-slate-900 flex justify-between items-center bg-slate-50 dark:bg-slate-950/20">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-violet-500" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Danh Sách Dự Án</span>
          </div>
          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="p-1.5 bg-violet-600 hover:bg-violet-500 dark:bg-violet-650 text-white rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-violet-900/10 flex items-center justify-center"
            title="Tạo dự án mới"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 custom-scrollbar bg-slate-50/50 dark:bg-transparent text-left">
          {projects.map((proj) => {
            const isActive = activeProject?.id === proj.id;
            return (
              <div
                key={proj.id}
                onClick={() => {
                  setActiveProject(proj);
                  setCurrentStep(1);
                }}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-white dark:bg-gradient-to-r dark:from-violet-955/20 dark:to-indigo-955/20 border-violet-500/30 shadow-md shadow-violet-900/5 dark:shadow-none' 
                    : 'bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-900/50 hover:border-slate-350 dark:hover:border-slate-800'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <h4 className={`text-xs font-bold transition-colors ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200'}`}>
                    {proj.name}
                  </h4>
                  <button
                    onClick={(e) => handleDeleteProject(proj.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-455 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                    title="Xóa dự án"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {proj.description || 'Không có mô tả.'}
                </p>
                
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

        {/* Sync Status bar */}
        <div className="p-3 bg-slate-100 dark:bg-slate-950/40 border-t border-slate-205/10 dark:border-slate-900 flex justify-between items-center text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === 'synced' ? 'bg-emerald-500' : 
              syncStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 
              syncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-500'
            }`} />
            <span className="font-medium uppercase tracking-wider text-[8px] text-slate-555 dark:text-slate-400">
              {syncStatus === 'synced' ? 'Đã đồng bộ Cloud' :
               syncStatus === 'saving' ? 'Đang sao lưu...' :
               syncStatus === 'error' ? 'Lỗi Firestore' : 'Chế độ ngoại tuyến'}
            </span>
          </div>
          <span className="text-slate-400 dark:text-slate-500">v2.0 (Simplified)</span>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 overflow-hidden relative">
        {!activeProject ? (
          <div className="m-auto text-center flex flex-col items-center justify-center p-8 max-w-sm gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center mx-auto">
              <Layers size={24} className="text-violet-500" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Chọn hoặc tạo một dự án từ sidebar để bắt đầu.</p>
          </div>
        ) : (
          <>
            {/* Main Header / Wizard Progress bar */}
            <div className="p-4 border-b border-slate-205/60 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-955/20 flex flex-col gap-4 shrink-0">
              <div className="flex justify-between items-start gap-4">
                <div className="text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{activeProject.name}</h2>
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-805 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-250 dark:border-slate-800 font-bold uppercase tracking-wider">Project Chain v2</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{activeProject.description || 'Không có mô tả.'}</p>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shrink-0 select-none">
                  <button
                    onClick={() => handleToggleViewMode('wizard')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'wizard'
                        ? 'bg-white dark:bg-slate-800 text-violet-650 dark:text-violet-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-750 dark:hover:text-slate-350'
                    }`}
                  >
                    Tuyến tính (Wizard)
                  </button>
                  <button
                    onClick={() => handleToggleViewMode('canvas')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'canvas'
                        ? 'bg-white dark:bg-slate-800 text-violet-650 dark:text-violet-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-750 dark:hover:text-slate-350'
                    }`}
                  >
                    Sơ đồ cây (Canvas)
                  </button>
                </div>
              </div>

              {/* Step indicator */}
              {viewMode === 'wizard' && (
                <div className="flex justify-between items-center max-w-xl mx-auto w-full px-4 relative mt-1">
                  {/* Connecting Line */}
                  <div className="absolute top-4 left-8 right-8 h-0.5 bg-slate-200 dark:bg-slate-800 -z-10">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-655 transition-all duration-300"
                      style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                    />
                  </div>

                  {[
                    { num: 1, label: '1. Prompt Nền Móng' },
                    { num: 2, label: '2. Chạy Giả Lập' },
                    { num: 3, label: '3. Đánh Giá & Tối Ưu' }
                  ].map((step) => {
                    const isCompleted = step.num < currentStep;
                    const isActive = step.num === currentStep;
                    return (
                      <button
                        key={step.num}
                        onClick={() => {
                          if (step.num <= currentStep || (step.num === 2 && basePromptInput.trim()) || (step.num === 3 && simOutput)) {
                            setCurrentStep(step.num as 1 | 2 | 3);
                          }
                        }}
                        className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
                      >
                        <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300
                          ${isActive 
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500 text-white shadow-lg shadow-violet-900/20 scale-105' 
                            : isCompleted 
                              ? 'bg-emerald-100 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-white dark:bg-slate-900 border-slate-250 dark:border-slate-850 text-slate-400 dark:text-slate-505'}`}
                        >
                          {isCompleted ? <Check size={14} /> : step.num}
                        </div>
                        <span className={`text-[10px] font-bold tracking-wide transition-colors duration-300
                          ${isActive ? 'text-slate-800 dark:text-slate-200' : isCompleted ? 'text-emerald-600 dark:text-emerald-555' : 'text-slate-400 dark:text-slate-500'}`}>
                          {step.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stepper Views */}
            <div className="flex-1 overflow-hidden relative bg-slate-50/10 dark:bg-slate-955/5">
              <AnimatePresence mode="wait">
                
                {/* STEP 1: MULTI-NODE PIPELINE DESIGNER */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute inset-0 flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex-1 max-w-5xl w-full mx-auto flex flex-col gap-4">
                      
                      <div className="flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-1.5 text-left">
                          <Layers size={15} className="text-violet-500" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-350">Thiết kế Chuỗi Prompt Liên Kết</h3>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowVersionDrawer(true)}
                            className="py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 hover:border-slate-400 dark:hover:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-955 dark:hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Clock size={11} className="text-violet-555 dark:text-violet-400" />
                            Lịch sử phiên bản
                          </button>
                        </div>
                      </div>

                      {/* 2-Column Multi-node layout */}
                      <div className="flex-1 flex flex-col md:flex-row gap-5 items-stretch min-h-[420px]">
                        
                        {/* Column Left: Pipeline Steps Sidebar */}
                        <div className="w-full md:w-64 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-850 pb-4 md:pb-0 md:pr-4 text-left shrink-0">
                          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span>Quy trình liên kết ({activeProject?.nodes?.length || 1} bước)</span>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 max-h-[300px] md:max-h-none">
                            {activeProject?.nodes?.map((node, idx) => {
                              const isSelected = selectedNodeIndex === idx;
                              return (
                                <div
                                  key={node.id}
                                  onClick={() => setSelectedNodeIndex(idx)}
                                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative group flex flex-col gap-1.5 ${
                                    isSelected 
                                      ? 'bg-violet-500/10 border-violet-500/40 text-violet-955 dark:text-violet-300 shadow-sm' 
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 hover:border-slate-350 dark:hover:border-slate-800'
                                  }`}
                                >
                                  {/* Index Badge & Shift Actions */}
                                  <div className="flex justify-between items-center">
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                      isSelected 
                                        ? 'bg-violet-500 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-550'
                                    }`}>
                                      Bước {idx + 1}
                                    </span>
                                    
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                      <button
                                        disabled={idx === 0}
                                        onClick={(e) => { e.stopPropagation(); handleMoveNode(idx, 'up'); }}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-850 rounded disabled:opacity-30 cursor-pointer"
                                        title="Di chuyển lên"
                                      >
                                        <ArrowRight size={10} className="-rotate-90 text-slate-500" />
                                      </button>
                                      <button
                                        disabled={idx === (activeProject?.nodes?.length || 1) - 1}
                                        onClick={(e) => { e.stopPropagation(); handleMoveNode(idx, 'down'); }}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-850 rounded disabled:opacity-30 cursor-pointer"
                                        title="Di chuyển xuống"
                                      >
                                        <ArrowRight size={10} className="rotate-90 text-slate-500" />
                                      </button>
                                      <button
                                        disabled={(activeProject?.nodes?.length || 1) <= 1}
                                        onClick={(e) => { e.stopPropagation(); handleDeleteNode(idx); }}
                                        className="p-1 text-rose-500 hover:bg-rose-500/10 rounded disabled:opacity-30 cursor-pointer"
                                        title="Xóa bước này"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Editable title input */}
                                  <input
                                    type="text"
                                    value={node.title}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleUpdateNodeTitle(idx, e.target.value)}
                                    className="font-bold text-[11px] bg-transparent border-b border-transparent hover:border-slate-355 dark:hover:border-slate-800 focus:border-violet-500 text-slate-800 dark:text-slate-200 focus:outline-none w-full"
                                    placeholder="Tên bước..."
                                  />
                                  
                                  {idx > 0 && (
                                    <div className="text-[8.5px] text-slate-400 dark:text-slate-500 italic mt-0.5 flex items-center gap-1">
                                      <Layers size={8} /> Sử dụng kết quả Bước {idx}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Add node button */}
                          <button
                            onClick={handleAddNode}
                            className="py-2.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md shadow-violet-900/10"
                          >
                            <Plus size={12} />
                            Thêm bước tiếp theo
                          </button>
                        </div>

                        {/* Column Right: Prompt Editor */}
                        <div className="flex-1 flex flex-col gap-4 text-left">
                          
                          <div className="flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Nội dung Prompt: {activeProject?.nodes?.[selectedNodeIndex]?.title || `Bước ${selectedNodeIndex + 1}`}
                            </span>

                            <div className="relative">
                              <button
                                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                                className="py-1 px-2.5 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-855 hover:border-slate-400 dark:hover:border-slate-800 text-slate-700 dark:text-slate-350 hover:text-slate-955 dark:hover:text-white rounded-xl text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Sparkles size={11} className="text-violet-555 dark:text-violet-400" />
                                Chọn Prompt mẫu
                              </button>
                              
                              {showTemplatePicker && (
                                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-880 rounded-2xl shadow-xl z-30 p-2 text-left animate-in fade-in duration-100">
                                  <div className="p-2 border-b border-slate-150 dark:border-slate-850 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Chọn một mẫu từ thư viện
                                  </div>
                                  <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-1">
                                    {allTemplates.map((t, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => {
                                          handleLoadTemplate(t.blocks?.map(b => `[${b.title}]\n${b.content}`).join('\n\n') || '');
                                          setShowTemplatePicker(false);
                                        }}
                                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] text-slate-755 dark:text-slate-300 hover:text-slate-955 dark:hover:text-white transition-colors"
                                      >
                                        <div className="font-bold line-clamp-1">{t.title}</div>
                                        <div className="text-[9px] text-slate-500 line-clamp-1 mt-0.5">{t.description || 'Không có mô tả.'}</div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Editor Panel */}
                          <div className="flex-1 min-h-[250px] relative bg-white dark:bg-slate-900/30 border border-slate-255 dark:border-slate-900 focus-within:border-violet-500/50 rounded-2xl overflow-hidden flex flex-col transition-all">
                            <textarea
                              value={basePromptInput}
                              onChange={(e) => handleUpdatePromptText(e.target.value)}
                              placeholder={`Nhập hoặc dán prompt cho bước này.
Sử dụng {{tên_biến}} để khai báo biến.
Nếu là bước thứ 2 trở đi, sử dụng {{output_${selectedNodeIndex}}} để tham chiếu kết quả của bước trước đó.`}
                              className="flex-1 p-4 bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 text-xs leading-relaxed focus:outline-none resize-none custom-scrollbar font-mono text-left"
                            />
                            <div className="px-4 py-2 border-t border-slate-150 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/20 flex justify-between items-center text-[10px] text-slate-500">
                              <span>Ký tự: {basePromptInput.length}</span>
                              <span className="italic">Nhấn để soạn thảo trực tiếp</span>
                            </div>
                          </div>

                          {/* Variables Info */}
                          {selectedNodeIndex > 0 && (
                            <div className="p-3 bg-violet-500/5 dark:bg-violet-955/10 border border-violet-500/10 rounded-2xl text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">
                              💡 **Kết nối chuỗi:** Dùng biến số <code className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-violet-650 dark:text-violet-400">{`{{output_${selectedNodeIndex}}}`}</code> để chèn kết quả đầu ra của **{activeProject?.nodes?.[selectedNodeIndex - 1]?.title || `Bước ${selectedNodeIndex}`}** vào prompt bước này.
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="flex justify-end mt-2 shrink-0">
                        <button
                          onClick={() => setCurrentStep(2)}
                          disabled={!basePromptInput.trim()}
                          className="py-3 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shadow-violet-900/10"
                        >
                          Chạy Giả Lập <ArrowRight size={14} />
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* STEP 2: SIMULATION PLAYGROUND */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute inset-0 flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex-1 max-w-5xl w-full mx-auto flex flex-col md:flex-row gap-5">
                      
                      {/* Left configuration panel */}
                      <div className="flex-[3] flex flex-col gap-4.5">
                        
                        {/* Variables Input panel */}
                        <div className="p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col gap-3 text-left">
                          <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tham Số Đầu Vào Gốc</h4>
                          
                          {extractedVars.length === 0 ? (
                            <p className="text-[10.5px] text-slate-500 italic">Không phát hiện biến số nào cần nhập. Chuỗi prompt sẽ được thực thi trực tiếp.</p>
                          ) : (
                            <div className="flex flex-col gap-2.5">
                              {extractedVars.map(v => (
                                <div key={v} className="flex flex-col gap-1">
                                  <label className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">{`{{${v}}}`}</label>
                                  <input
                                    type="text"
                                    value={varValues[v] || ''}
                                    onChange={(e) => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                                    placeholder={`Nhập giá trị cho ${v}...`}
                                    className="text-xs px-3 py-2 border border-slate-200 dark:border-slate-880 bg-slate-50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Model Config Panel */}
                        <div className="p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col gap-3 text-left">
                          <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cấu HÌnh Mô Hình AI</h4>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-505 uppercase">Provider</label>
                              <select
                                value={simProvider}
                                onChange={(e) => {
                                  const prov = e.target.value as 'gemini' | 'openai';
                                  setSimProvider(prov);
                                  setSimModel(prov === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
                                }}
                                className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-880 bg-slate-50 dark:bg-slate-955 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
                              >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-555 uppercase">Model</label>
                              <select
                                value={simModel}
                                onChange={(e) => setSimModel(e.target.value)}
                                className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-880 bg-slate-50 dark:bg-slate-955 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
                              >
                                {simProvider === 'gemini' ? (
                                  <>
                                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                                    <option value="gpt-4o">gpt-4o</option>
                                    <option value="o1-mini">o1-mini</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-1">
                            <div>
                              <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                                <span>Temperature</span>
                                <span className="text-violet-650 dark:text-violet-400 font-bold">{simTemp}</span>
                              </div>
                              <input
                                type="range"
                                min="0" max="1.5" step="0.1"
                                value={simTemp}
                                onChange={(e) => setSimTemp(Number(e.target.value))}
                                className="w-full accent-violet-550 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                                <span>Max Tokens</span>
                                <span className="text-violet-650 dark:text-violet-400 font-bold">{simMaxTokens}</span>
                              </div>
                              <input
                                type="number"
                                value={simMaxTokens}
                                onChange={(e) => setSimMaxTokens(Number(e.target.value))}
                                className="w-full text-xs px-2 py-0.5 border border-slate-200 dark:border-slate-880 bg-slate-50 dark:bg-slate-955 rounded-lg text-slate-705 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
                              />
                            </div>
                          </div>

                        </div>

                        {/* External links paths */}
                        <div className="p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col gap-2.5 text-left">
                          <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đường Dẫn Ráp Nối Mô Hình Ngoài</h4>
                          <p className="text-[10px] text-slate-555 leading-relaxed">
                            Mở và chạy kiểm thử prompt của bước đang soạn thảo trong các IDE chính thức.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            <button
                              onClick={() => handleOpenExternalPlayground('https://aistudio.google.com/')}
                              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-250 dark:border-slate-800 rounded-xl text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ExternalLink size={12} /> Google AI Studio
                            </button>
                            <button
                              onClick={() => handleOpenExternalPlayground('https://platform.openai.com/playground')}
                              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-855 border border-slate-255 dark:border-slate-800 rounded-xl text-[11px] font-bold text-violet-650 dark:text-violet-400 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ExternalLink size={12} /> OpenAI Playground
                            </button>
                          </div>
                        </div>

                      </div>

                      {/* Right inline output preview panel: Sequence timelines */}
                      <div className="flex-[4] flex flex-col gap-3 min-h-[300px] bg-slate-50/30 dark:bg-slate-955 border border-slate-202 dark:border-slate-900 rounded-2xl overflow-hidden shadow-xl text-left">
                        <div className="px-4 py-3 border-b border-slate-250 dark:border-slate-900 bg-white dark:bg-slate-950 flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <RefreshCw size={13} className={`text-violet-555 dark:text-violet-400 ${isSimulating ? 'animate-spin' : ''}`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-355">Tiến Trình Thực Thi Chuỗi</span>
                          </div>
                          
                          <button
                            onClick={handleRunSimulation}
                            disabled={isSimulating}
                            className="py-1.5 px-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-[10.5px] rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-md shadow-violet-900/10"
                          >
                            <Play size={10} /> {isSimulating ? 'Đang chạy chuỗi...' : 'Chạy Giả Lập'}
                          </button>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-white/20 dark:bg-slate-900/10 flex flex-col gap-3.5 select-text">
                          {activeProject?.nodes?.map((node, idx) => {
                            const hasOutput = nodeExecutionOutputs[idx] !== undefined;
                            const outputText = nodeExecutionOutputs[idx] || '';
                            const isNodeExecuting = currentExecutingNodeIndex === idx;
                            const isExpanded = expandedSimNodeIndex === idx;
                            
                            return (
                              <div 
                                key={node.id} 
                                className={`border rounded-2xl overflow-hidden transition-all ${
                                  isNodeExecuting 
                                    ? 'border-violet-500/50 bg-violet-500/5 ring-1 ring-violet-500/10' 
                                    : hasOutput 
                                      ? 'border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900/50' 
                                      : 'border-slate-150 dark:border-slate-880/40 bg-slate-50/50 dark:bg-slate-955/20 opacity-60'
                                }`}
                              >
                                {/* Step Header */}
                                <div 
                                  onClick={() => setExpandedSimNodeIndex(isExpanded ? null : idx)}
                                  className="px-4 py-2.5 flex justify-between items-center cursor-pointer select-none bg-slate-50/50 dark:bg-slate-900/80 border-b border-slate-150 dark:border-slate-855"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                      isNodeExecuting
                                        ? 'bg-violet-650 text-white animate-pulse'
                                        : hasOutput
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-200 dark:bg-slate-850 text-slate-500'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                      {node.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isNodeExecuting && (
                                      <span className="text-[10px] text-violet-555 dark:text-violet-400 font-bold animate-pulse flex items-center gap-1">
                                        <RefreshCw size={10} className="animate-spin" /> Đang chạy...
                                      </span>
                                    )}
                                    {hasOutput && !isNodeExecuting && (
                                      <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Hoàn thành
                                      </span>
                                    )}
                                    {!hasOutput && !isNodeExecuting && (
                                      <span className="text-[9.5px] text-slate-400 dark:text-slate-600">
                                        Đang chờ...
                                      </span>
                                    )}
                                    <ChevronRight size={13} className={`text-slate-400 dark:text-slate-500 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  </div>
                                </div>

                                {/* Step Content (injected prompt and output) */}
                                {isExpanded && (
                                  <div className="p-3 flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-880/50 bg-white/50 dark:bg-slate-900/20 text-xs">
                                    {/* Compiled Prompt Preview */}
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Prompt đã biên dịch</span>
                                      <pre className="p-2 bg-slate-50 dark:bg-slate-955 rounded-lg text-[10px] font-mono whitespace-pre-wrap overflow-x-auto text-slate-700 dark:text-slate-355 border border-slate-150 dark:border-slate-900 max-h-24 overflow-y-auto custom-scrollbar">
                                        {(() => {
                                          const rawPrompt = node.blocks?.[0]?.content || '';
                                          const compileVals = { ...varValues };
                                          for (let j = 0; j < idx; j++) {
                                            compileVals[`output_${j+1}`] = nodeExecutionOutputs[j] || '';
                                            compileVals[`Output_${j+1}`] = nodeExecutionOutputs[j] || '';
                                          }
                                          return injectVariables(rawPrompt, compileVals);
                                        })()}
                                      </pre>
                                    </div>

                                    {/* Output Preview */}
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Kết quả đầu ra (Output)</span>
                                      <div className="p-2 bg-slate-50/50 dark:bg-slate-955/40 rounded-lg border border-slate-150 dark:border-slate-900 min-h-[50px] select-text">
                                        {outputText ? (
                                          <AIResponseRenderer content={outputText} className="dark:prose-invert text-[11px] text-slate-800 dark:text-slate-200" />
                                        ) : isNodeExecuting ? (
                                          <div className="flex items-center gap-2 text-slate-400 py-2">
                                            <RefreshCw size={12} className="animate-spin text-violet-555" />
                                            <span className="text-[10px] animate-pulse">Đang đợi phản hồi từ mô hình...</span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 italic">Chưa thực thi.</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          
                          {(!activeProject?.nodes || activeProject.nodes.length === 0) && (
                            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-605 gap-2 my-auto py-12">
                              <Play size={20} className="opacity-40" />
                              <span className="text-[11px]">Chưa cấu hình các bước trong chuỗi.</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Navigation bar */}
                    <div className="flex justify-between items-center max-w-5xl w-full mx-auto mt-4 shrink-0">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 hover:border-slate-400 dark:hover:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ArrowLeft size={14} /> Quay lại Bước 1
                      </button>

                      <button
                        onClick={() => {
                          setCurrentStep(3);
                          const defaultIdx = Math.min(selectedNodeIndex, (activeProject?.nodes || []).length - 1);
                          setEvalNodeIndex(defaultIdx >= 0 ? defaultIdx : 0);
                          
                          // Run evaluation automatically if output exists
                          setTimeout(() => {
                            const outputToEval = nodeExecutionOutputs[defaultIdx >= 0 ? defaultIdx : 0];
                            if (outputToEval) {
                              setIsEvaluating(true);
                              setEvaluation(null);
                              setAppliedSuggestions({});
                              
                              const promptToEval = activeProject?.nodes[defaultIdx >= 0 ? defaultIdx : 0]?.blocks?.[0]?.content || '';
                              evaluateAndEnhancePrompt(promptToEval, outputToEval)
                                .then(res => setEvaluation(res))
                                .catch(err => console.error(err))
                                .finally(() => setIsEvaluating(false));
                            }
                          }, 50);
                        }}
                        disabled={Object.keys(nodeExecutionOutputs).length === 0 || isSimulating}
                        className="py-2.5 px-5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-violet-900/10"
                      >
                        Tiến Hành Đánh Giá <ArrowRight size={14} />
                      </button>
                    </div>

                  </motion.div>
                )}

                {/* STEP 3: EVALUATION & ENHANCEMENT */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute inset-0 flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex-1 max-w-4xl w-full mx-auto flex flex-col gap-5">
                      
                      {/* Step node selector */}
                      <div className="p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                        <div className="flex flex-col gap-1">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Chọn mắt xích cần AI đánh giá</h4>
                          <p className="text-[10px] text-slate-505">Hệ thống sẽ thẩm định prompt của bước đã chọn với kết quả giả lập tương ứng.</p>
                        </div>
                        
                        <select
                          value={evalNodeIndex}
                          onChange={(e) => {
                            const idx = Number(e.target.value);
                            setEvalNodeIndex(idx);
                            setEvaluation(null);
                            setAppliedSuggestions({});
                          }}
                          className="text-xs px-3 py-2 border border-slate-200 dark:border-slate-880 bg-slate-50 dark:bg-slate-955 rounded-xl text-slate-755 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer w-full sm:w-64"
                        >
                          {activeProject?.nodes?.map((node, idx) => (
                            <option key={node.id} value={idx}>
                              Bước {idx + 1}: {node.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {isEvaluating ? (
                        <div className="m-auto text-center flex flex-col items-center justify-center p-12 gap-3">
                          <RefreshCw size={36} className="animate-spin text-violet-500" />
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">AI Đang Thẩm Định Mắt Xích {evalNodeIndex + 1}...</h4>
                          <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                            Mô hình đang đối chiếu kết quả giả lập và prompt của bước này để tìm lỗi logic, tối ưu hóa từ ngữ và soạn gợi ý nâng cấp.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Scoring Banner */}
                          {evaluation ? (
                            <div className="p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left animate-in fade-in duration-200">
                              <div className="flex items-center gap-4">
                                {/* Quality Score Badge */}
                                <div className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center font-bold relative shrink-0
                                  ${evaluation.score >= 85 ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' : 
                                    evaluation.score >= 60 ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5' : 
                                    'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5'}`}
                                >
                                  <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-505 font-bold">Điểm số</span>
                                  <span className="text-xl -mt-1 font-mono">{evaluation.score}</span>
                                </div>
                                
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Đánh giá chất lượng của {activeProject?.nodes?.[evalNodeIndex]?.title || `Bước ${evalNodeIndex + 1}`}</h4>
                                  <p className="text-[10.5px] text-slate-555 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                                    {evaluation.score >= 85 ? 'Prompt hoạt động tốt và tạo phản hồi đầu ra rất tối ưu.' : 
                                     evaluation.score >= 60 ? 'Đạt yêu cầu nhưng còn nhiều từ ngữ, logic có thể tối ưu thêm.' : 
                                     'Phản hồi bị lỗi logic hoặc sai định dạng. Cần bổ sung nâng cấp bổ khuyết ngay.'}
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={handleStartEvaluation}
                                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:text-slate-955 dark:hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <RefreshCw size={12} /> Đánh giá lại
                              </button>
                            </div>
                          ) : (
                            <div className="p-8 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
                              <Sparkles size={24} className="text-violet-550 animate-pulse" />
                              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Mắt xích chưa được thẩm định</h4>
                              <p className="text-[10.5px] text-slate-500 max-w-xs">
                                Hãy bấm nút dưới đây để AI phân tích chất lượng của prompt **{activeProject?.nodes?.[evalNodeIndex]?.title || `Bước ${evalNodeIndex + 1}`}**.
                              </p>
                              <button
                                onClick={handleStartEvaluation}
                                className="py-2 px-4 bg-violet-650 hover:bg-violet-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-violet-900/10 active:scale-95"
                              >
                                Thẩm định mắt xích này
                              </button>
                            </div>
                          )}

                          {evaluation && (
                            /* Detail analyses split panel */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left animate-in slide-in-from-bottom-3 duration-250">
                              
                              {/* Weaknesses List */}
                              <div className="p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col gap-3">
                                <div className="flex items-center gap-1.5 text-amber-550 dark:text-amber-500">
                                  <AlertTriangle size={15} />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Nhược Điểm Cần Khắc Phục</span>
                                </div>
                                
                                {evaluation.weaknesses && evaluation.weaknesses.length > 0 ? (
                                  <ul className="flex flex-col gap-2.5 pl-1.5 mt-1">
                                    {evaluation.weaknesses.map((w, idx) => (
                                      <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2 leading-relaxed font-medium">
                                        <span className="text-amber-555 dark:text-amber-500 font-bold text-[10px] shrink-0 mt-0.5">•</span>
                                        <span>{w}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[10.5px] text-slate-500 italic my-auto py-4 text-center">
                                    🎉 Tuyệt vời! AI không phát hiện nhược điểm lớn nào.
                                  </p>
                                )}
                              </div>

                              {/* Suggestions List */}
                              <div className="p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col gap-3">
                                <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                                  <Sparkles size={15} />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Gợi Ý Nâng Cấp Từ AI</span>
                                </div>

                                {evaluation.suggestions && evaluation.suggestions.length > 0 ? (
                                  <div className="flex flex-col gap-3.5 mt-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
                                    {evaluation.suggestions.map((s, idx) => {
                                      const isApplied = appliedSuggestions[idx];
                                      return (
                                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-955/40 border border-slate-200 dark:border-slate-850 rounded-xl flex flex-col gap-2.5">
                                          <div>
                                            <div className="flex justify-between items-start gap-2">
                                              <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200 leading-normal">{s.title}</span>
                                              {isApplied && (
                                                <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Đã ráp nối</span>
                                              )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{s.description}</p>
                                          </div>

                                          <div className="p-2 bg-white dark:bg-slate-900/60 rounded-lg text-[9.5px] font-mono text-slate-650 dark:text-slate-400 border border-slate-200 dark:border-slate-900 max-h-24 overflow-y-auto custom-scrollbar select-text whitespace-pre-wrap">
                                            {s.content}
                                          </div>

                                          {!isApplied && (
                                            <button
                                              onClick={() => handleApplySuggestion(s.content, idx)}
                                              className="w-full mt-0.5 py-2 px-3 bg-violet-500/10 dark:bg-violet-955/35 hover:bg-violet-600 dark:hover:bg-violet-950/50 border border-violet-500/20 dark:border-violet-500/30 hover:border-violet-500/50 text-[10px] font-bold text-violet-600 dark:text-violet-300 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-98"
                                          >
                                            <Sparkles size={10} className="text-violet-500" />
                                            Nối vào Prompt gốc
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[10.5px] text-slate-555 italic my-auto py-4 text-center">
                                  {evaluation ? 'Không có đề xuất thêm.' : 'Chưa có phân tích.'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                      {/* Navigation bar */}
                      <div className="flex justify-between items-center mt-4 shrink-0">
                        <button
                          onClick={() => setCurrentStep(2)}
                          className="py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 hover:border-slate-400 dark:hover:border-slate-800 text-slate-505 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <ArrowLeft size={14} /> Quay lại Bước 2
                        </button>

                        <button
                          onClick={() => {
                            setCurrentStep(1);
                          }}
                          className="py-2.5 px-5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-violet-900/10"
                        >
                          Hoàn tất & Về Bước 1 <Check size={14} />
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* 3. NEW PROJECT MODAL */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in scale-in duration-250 flex flex-col text-left text-slate-800 dark:text-slate-100"
          >
            <div className="px-5 py-4 border-b border-slate-250 dark:border-slate-855 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-violet-555 dark:text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Tạo dự án mới</h3>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase tracking-wide">Tên dự án <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Ví dụ: Chatbot dịch thuật..."
                  className="text-xs px-3.5 py-2.5 border border-slate-250 dark:border-slate-850 focus:border-violet-555 dark:focus:border-violet-500 bg-slate-50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 rounded-xl focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase tracking-wide">Mô tả dự án</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu của dự án này..."
                  className="text-xs px-3.5 py-2.5 border border-slate-250 dark:border-slate-850 focus:border-violet-555 dark:focus:border-violet-500 bg-slate-50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 rounded-xl focus:outline-none resize-none h-20 transition-colors custom-scrollbar"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-250 dark:border-slate-850 bg-slate-50 dark:bg-slate-950/40 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-250 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-255 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="py-2 px-4 bg-violet-600 dark:bg-violet-650 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Tạo dự án
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERSION DRAWER PANEL */}
      <AnimatePresence>
        {showVersionDrawer && (
          <div 
            onClick={() => {
              setShowVersionDrawer(false);
              setSelectedVersionToCompare(null);
            }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-850 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 text-slate-800 dark:text-slate-100"
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-855 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-violet-600 dark:text-violet-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-355">Lịch sử phiên bản</h3>
                </div>
                <button
                  onClick={() => {
                    setShowVersionDrawer(false);
                    setSelectedVersionToCompare(null);
                  }}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
                {(!activeProject?.versions || activeProject.versions.length === 0) ? (
                  <div className="m-auto text-center py-12 text-slate-400 my-auto">
                    <Clock size={24} className="mx-auto opacity-30 mb-2" />
                    <p className="text-xs">Chưa có lịch sử phiên bản nào được ghi nhận.</p>
                  </div>
                ) : (
                  <>
                    {/* Version List */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Danh sách phiên bản ({activeProject.versions.length})</span>
                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar p-0.5">
                        {activeProject.versions.map((ver) => {
                          const isSelected = selectedVersionToCompare?.id === ver.id;
                          return (
                            <div 
                              key={ver.id}
                              onClick={() => setSelectedVersionToCompare(ver)}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 relative group
                                ${isSelected 
                                  ? 'bg-violet-50 dark:bg-violet-955/15 border-violet-400 dark:border-violet-500/50' 
                                  : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800'}`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200">
                                  {new Date(ver.timestamp).toLocaleString()}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreVersion(ver);
                                  }}
                                  className="py-1 px-2.5 bg-violet-600 dark:bg-violet-650 hover:bg-violet-500 text-white text-[9.5px] font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Khôi phục
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed font-semibold">
                                {ver.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Diff Viewer panel */}
                    {selectedVersionToCompare && (
                      <div className="flex-1 flex flex-col gap-2 min-h-[250px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
                          So sánh khác biệt (So với Hiện tại)
                        </span>
                        <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl overflow-y-auto custom-scrollbar font-mono text-[10px] text-left select-text whitespace-pre-wrap leading-relaxed">
                          {computeUnifiedDiff(selectedVersionToCompare.content, basePromptInput).map((line, idx) => {
                            if (line.type === 'added') {
                              return (
                                <div key={idx} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 border-l-2 border-emerald-500/50">
                                  + {line.text}
                                </div>
                              );
                            } else if (line.type === 'removed') {
                              return (
                                <div key={idx} className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1 border-l-2 border-rose-500/50 line-through">
                                  - {line.text}
                                </div>
                              );
                            } else {
                              return (
                                <div key={idx} className="text-slate-500 dark:text-slate-400 px-1">
                                  &nbsp;&nbsp;{line.text}
                                </div>
                              );
                            }
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
