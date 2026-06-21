import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Trash2, Play, Save, Download, Upload, X, Edit2, 
  Sparkles, Check, AlertCircle, ArrowRight, Search, FileText, 
  ChevronRight, ChevronDown, Settings, Database, HelpCircle, 
  RefreshCw, Cloud, CloudOff, ZoomIn, ZoomOut, Maximize2, Workflow, Wrench, Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { TreeNode, PromptProject, PromptBlock, PromptVariable, TabType, PromptTemplate, EvolutionType, SystemRole, TestCase, NodeExecutionStatus } from '../../types';
import { db, handleFirestoreError } from '../../firebase';
import { TEMPLATES } from '../../data';
import { PRESET_SYSTEM_ROLES } from '../../presets';
import { runPlaygroundChatStream, enhancePromptWithAi, evaluateOutputQualityWithAi, runAutomatedTestEvaluation } from '../../services/aiService';
import { applyAutoLayoutToProject, compileEvolutionPrompt, getRequiredInputsForNode } from '../../utils/chainUtils';
import AIResponseRenderer from '../common/AIResponseRenderer';


// Subcomponents
import { CanvasView } from '../project-chain/CanvasView';
import { NodeDetailSidebar } from '../project-chain/NodeDetailSidebar';
import { SimulatorPanel } from '../project-chain/SimulatorPanel';
import { TestCasesPanel } from '../project-chain/TestCasesPanel';
import { GlobalEvalCriteriaModal } from '../project-chain/modals/GlobalEvalCriteriaModal';
import { LibraryImportPickerModal } from '../project-chain/modals/LibraryImportPickerModal';

// Hooks
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
    description: 'Chuỗi prompt phân tích chủ đề, xây dựng bài học lý thuyết và tạo đề thi trắc nghiệm đi kèm giải thích.',
    globalEvalCriteria: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-root',
        parentId: null,
        title: '1. Phân tích Chủ đề',
        description: 'Phân tích chủ đề giảng dạy thành các nhánh bài học cốt lõi',
        status: 'idle',
        position: { x: 100, y: 220 },
        blocks: [
          {
            id: 'block-root-1',
            type: 'role',
            title: 'Vai trò (Role)',
            content: 'Bạn là một Mentor AI - chuyên gia phát triển nội dung giáo dục phổ thông theo phương pháp Socratic.'
          },
          {
            id: 'block-root-2',
            type: 'task',
            title: 'Nhiệm vụ (Task)',
            content: 'Hãy phân tích chủ đề: "{{subject}}" dành cho học sinh lớp {{grade}}.\n\nChia chủ đề thành 3 nội dung cốt lõi nhất cần nắm vững. Đối với mỗi nội dung, hãy nêu rõ mục tiêu học tập (Learning Objective) và từ khóa chính cần nhớ.\n\nLưu ý:\n- Sử dụng emoji thân thiện 😊\n- Trình bày dạng bullet points\n- Công thức nếu có hãy dùng LaTeX.'
          }
        ],
        variables: [
          { name: 'subject', type: 'text', description: 'Chủ đề bài học (vd: Quang hợp ở thực vật)', required: true, defaultValue: 'Chiến tranh thế giới thứ hai' },
          { name: 'grade', type: 'text', description: 'Lớp học (vd: 10, 11, 12)', required: true, defaultValue: '11' }
        ]
      },
      {
        id: 'node-child-lesson',
        parentId: 'node-root',
        title: '2. Soạn bài giảng',
        description: 'Tạo giáo án chi tiết và các ví dụ minh họa trực quan',
        status: 'idle',
        position: { x: 450, y: 100 },
        blocks: [
          {
            id: 'block-lesson-1',
            type: 'role',
            title: 'Vai trò (Role)',
            content: 'Bạn là một Mentor AI - gia sư thân thiện và ấm áp.'
          },
          {
            id: 'block-lesson-2',
            type: 'context',
            title: 'Ngữ cảnh (Context)',
            content: 'Dưới đây là phân tích chủ đề được thực hiện ở bước trước:\n\n{{1.Phân tíchChủđề.output}}'
          },
          {
            id: 'block-lesson-3',
            type: 'task',
            title: 'Nhiệm vụ (Task)',
            content: 'Hãy viết nội dung bài giảng chi tiết cho nhánh nội dung thứ nhất trong phần phân tích phía trên.\n\nKết cấu bài giảng gồm:\n1. Phần khởi động (Hook): đặt một câu hỏi khơi gợi tò mò theo phương pháp Socratic.\n2. Nội dung kiến thức: giải thích ngắn gọn, dễ hiểu.\n3. Ví dụ minh họa thực tế sinh động.'
          }
        ],
        variables: []
      },
      {
        id: 'node-child-quiz',
        parentId: 'node-root',
        title: '3. Bộ câu hỏi ôn tập',
        description: 'Thiết kế các câu hỏi trắc nghiệm kiểm tra mức độ thấu hiểu bài học',
        status: 'idle',
        position: { x: 450, y: 350 },
        blocks: [
          {
            id: 'block-quiz-1',
            type: 'role',
            title: 'Vai trò (Role)',
            content: 'Bạn là một giáo viên Mentor AI chuyên ra đề thi tương tác.'
          },
          {
            id: 'block-quiz-2',
            type: 'context',
            title: 'Ngữ cảnh (Context)',
            content: 'Tham khảo phân tích chủ đề:\n{{1.Phân tíchChủđề.output}}'
          },
          {
            id: 'block-quiz-3',
            type: 'task',
            title: 'Nhiệm vụ (Task)',
            content: 'Hãy tạo ra 2 câu hỏi trắc nghiệm (mỗi câu 4 phương án A, B, C, D) kiểm tra kiến thức về các từ khóa chính nêu trong đề cương.\n\nBẮT BUỘC: Không cung cấp đáp án trực tiếp. Với mỗi câu hỏi, hãy viết gợi ý (Hint) định hướng tư duy theo phong cách Socratic giúp học sinh tự suy nghĩ chọn đáp án đúng.'
          }
        ],
        variables: []
      }
    ]
  }
];

export default function ProjectChainTab({ 
  theme = 'dark', 
  user, 
  customTemplates = [],
  onSaveTemplate 
}: ProjectChainTabProps) {
  
  // State quản lý danh sách dự án
  const [projects, setProjects] = useState<PromptProject[]>([]);
  const [activeProject, setActiveProject] = useState<PromptProject | null>(null);

  // State Canvas & selected node
  const {
    canvasOffset,
    setCanvasOffset,
    zoom,
    setZoom,
    startPanning,
    handleWheel,
    resetCanvasView
  } = useCanvasInteraction({ x: 50, y: 50 }, 1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTemplateQuery, setSearchTemplateQuery] = useState('');
  const [isEvalCriteriaModalOpen, setIsEvalCriteriaModalOpen] = useState(false);
  const [newCriteriaText, setNewCriteriaText] = useState('');
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);

  // Simulator state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorNode, setSimulatorNode] = useState<TreeNode | null>(null);
  const [rootInputs, setRootInputs] = useState<Record<string, string>>({});
  const [compiledPromptPreview, setCompiledPromptPreview] = useState('');
  const [simulationResponse, setSimulationResponse] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Helper panels & automated testing state
  const [showHelp, setShowHelp] = useState(true);
  const [isUnitTestOpen, setIsUnitTestOpen] = useState(false);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
  const [isRunningAllTests, setIsRunningAllTests] = useState(false);
  const [testSuiteLogs, setTestSuiteLogs] = useState<string[]>([]);

  // Function to save project state
  const saveActiveProject = async (updatedProject: PromptProject) => {
    const updatedProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(updatedProjects);
    setActiveProject(updatedProject);

    try {
      localStorage.setItem('mentor_ai_prompt_projects', JSON.stringify(updatedProjects));
    } catch (e) {
      console.error('Lỗi lưu LocalStorage:', e);
    }

    if (user) {
      setSyncStatus('saving');
      try {
        const docRef = doc(db, 'projects', updatedProject.id);
        const isNew = !projects.some(p => p.id === updatedProject.id);

        const payload = {
          id: updatedProject.id,
          userId: user.uid,
          name: updatedProject.name,
          description: updatedProject.description || '',
          globalEvalCriteria: updatedProject.globalEvalCriteria || [],
          nodes: updatedProject.nodes,
          createdAt: isNew ? new Date().toISOString() : updatedProject.createdAt,
          updatedAt: new Date().toISOString()
        };

        await setDoc(docRef, payload);
        setSyncStatus('synced');
      } catch (err) {
        console.error('Lỗi lưu Firestore:', err);
        setSyncStatus('error');
        handleFirestoreError(err, 'write', 'projects/' + updatedProject.id);
      }
    }
  };

  // Pipeline hook setup
  const {
    syncStatus,
    setSyncStatus,
    pipelineStatus,
    setPipelineStatus,
    pipelineLogs,
    setPipelineLogs,
    pipelineCurrentNodeId,
    pipelineNodeResponse,
    setPipelineNodeResponse,
    pipelineInputs,
    setPipelineInputs,
    pipelineRoutingMode,
    setPipelineRoutingMode,
    pipelineKeyword,
    setPipelineKeyword,
    simProvider,
    setSimProvider,
    simModel,
    setSimModel,
    simTemp,
    setSimTemp,
    startPipelineExecution,
    handleStopPipeline,
    handleResumePipelineManual
  } = useProjectPipeline(activeProject, setActiveProject, setProjects, saveActiveProject, user);

  // --- 1. TẢI VÀ SYNC DỰ ÁN ---
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
              testCases: data.testCases || []
            });
          });

          if (dbProjects.length > 0) {
            setProjects(dbProjects);
            setActiveProject(dbProjects[0]);
            setSyncStatus('synced');
          } else {
            // Write defaults to firestore
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
        setActiveProject(localProjects[0] || null);
        setSyncStatus('local');
      }
    }

    loadProjects();
  }, [user]);

  // Sync projects routing changes from builder
  useEffect(() => {
    if (projects.length === 0) return;
    
    const targetProjId = localStorage.getItem('mentor_ai_active_project_id');
    const targetNodeId = localStorage.getItem('mentor_ai_selected_node_id');
    
    if (targetProjId) {
      const proj = projects.find(p => p.id === targetProjId);
      if (proj) {
        setActiveProject(proj);
        localStorage.removeItem('mentor_ai_active_project_id');
        
        if (targetNodeId) {
          setSelectedNodeId(targetNodeId);
          localStorage.removeItem('mentor_ai_selected_node_id');
          
          const node = proj.nodes.find(n => n.id === targetNodeId);
          if (node) {
            setCanvasOffset({
              x: Math.max(50, 250 - node.position.x * zoom),
              y: Math.max(50, 200 - node.position.y * zoom)
            });
          }
        }
      }
    }
  }, [projects]);

  // Project management handlers
  const handleCreateNewProject = () => {
    const newProj: PromptProject = {
      id: `proj-${Date.now()}`,
      name: `Dự án Chuỗi mới ${projects.length + 1}`,
      description: 'Mô tả chuỗi prompt...',
      globalEvalCriteria: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: 'node-root',
          parentId: null,
          title: '1. Khởi động (Root)',
          description: 'Cấu hình System Role & các tham số chung đầu vào.',
          status: 'idle',
          position: { x: 100, y: 220 },
          blocks: [
            {
              id: 'block-root-1',
              type: 'role',
              title: 'Vai trò (Role)',
              content: 'Bạn là một Mentor AI - chuyên gia phát triển nội dung giáo dục.'
            }
          ],
          variables: []
        }
      ]
    };

    const nextProjects = [...projects, newProj];
    setProjects(nextProjects);
    setActiveProject(newProj);
    setSelectedNodeId(newProj.nodes[0].id);
    saveActiveProject(newProj);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa dự án này?')) return;
    
    const updated = projects.filter(p => p.id !== projectId);
    setProjects(updated);
    
    if (activeProject?.id === projectId) {
      setActiveProject(updated[0] || null);
      setSelectedNodeId(updated[0]?.nodes[0]?.id || null);
    }

    try {
      localStorage.setItem('mentor_ai_prompt_projects', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    if (user) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImportProjectJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const project = JSON.parse(event.target?.result as string) as PromptProject;
        if (!project.name || !project.nodes || !Array.isArray(project.nodes)) {
          alert('JSON không đúng định dạng Prompt Project.');
          return;
        }
        
        project.id = `proj-${Date.now()}`;
        project.createdAt = new Date().toISOString();
        project.updatedAt = new Date().toISOString();
        
        const nextProjects = [...projects, project];
        setProjects(nextProjects);
        setActiveProject(project);
        setSelectedNodeId(project.nodes[0]?.id || null);
        await saveActiveProject(project);
        alert('Nhập dự án thành công!');
      } catch (err) {
        alert('Lỗi đọc tệp: ' + err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportProjectJSON = () => {
    if (!activeProject) return;
    const blob = new Blob([JSON.stringify(activeProject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name.replace(/\s+/g, '_')}_project_chain.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Node editing handlers
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
    saveActiveProject(updatedProj);
  };

  const handleAddChildNode = (parentId: string) => {
    if (!activeProject) return;
    const parentNode = activeProject.nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    const newChild: TreeNode = {
      id: `node-${Date.now()}`,
      parentId: parentId,
      title: `Node phụ ${activeProject.nodes.length + 1}`,
      description: 'Mô tả node mới...',
      status: 'idle',
      position: {
        x: parentNode.position.x + 280,
        y: parentNode.position.y
      },
      blocks: [
        {
          id: `block-${Date.now()}-1`,
          type: 'context',
          title: 'Ngữ cảnh (Context)',
          content: 'Kết quả trước:\n{{parent.output}}'
        },
        {
          id: `block-${Date.now()}-2`,
          type: 'task',
          title: 'Nhiệm vụ (Task)',
          content: 'Hãy thực hiện...'
        }
      ],
      variables: []
    };

    const updatedProj = {
      ...activeProject,
      nodes: [...activeProject.nodes, newChild],
      updatedAt: new Date().toISOString()
    };
    const layoutedProj = applyAutoLayoutToProject(updatedProj);
    saveActiveProject(layoutedProj);
    setSelectedNodeId(newChild.id);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!activeProject) return;
    if (!confirm('Bạn có chắc chắn muốn xóa node này và các nhánh con của nó?')) return;

    const idsToDelete = new Set<string>([nodeId]);
    let prevSize = 0;
    while (prevSize !== idsToDelete.size) {
      prevSize = idsToDelete.size;
      activeProject.nodes.forEach(n => {
        if (n.parentId && idsToDelete.has(n.parentId)) {
          idsToDelete.add(n.id);
        }
      });
    }

    const remainingNodes = activeProject.nodes.filter(n => !idsToDelete.has(n.id));
    const updatedProj = {
      ...activeProject,
      nodes: remainingNodes,
      updatedAt: new Date().toISOString()
    };
    
    if (selectedNodeId && idsToDelete.has(selectedNodeId)) {
      setSelectedNodeId(remainingNodes[0]?.id || null);
    }
    
    const layoutedProj = applyAutoLayoutToProject(updatedProj);
    saveActiveProject(layoutedProj);
  };

  const handleCreateBranchNode = (type: 'success' | 'failure') => {
    if (!activeProject || !simulatorNode) return;
    
    const hasExisting = activeProject.nodes.some(n => n.parentId === simulatorNode.id && n.branchType === type);
    if (hasExisting) {
      alert(`Đã cấu hình nhánh "${type === 'success' ? 'Thành công (Success)' : 'Thất bại (Failure)'}" cho node này.`);
      return;
    }

    const newChild: TreeNode = {
      id: `node-branch-${Date.now()}`,
      parentId: simulatorNode.id,
      branchType: type,
      title: type === 'success' ? `Nhánh Nâng Cao (Success)` : `Nhánh Sửa Lỗi (Failure)`,
      description: type === 'success' ? 'Nhánh nâng cao khi prompt đạt hiệu quả.' : 'Nhánh khắc phục, bổ sung ràng buộc khi prompt chưa tốt.',
      status: 'idle',
      position: {
        x: simulatorNode.position.x + 280,
        y: type === 'success' ? simulatorNode.position.y - 120 : simulatorNode.position.y + 120
      },
      blocks: [
        {
          id: `block-${Date.now()}-1`,
          type: 'context',
          title: 'Ngữ cảnh (Context)',
          content: 'Tham chiếu kết quả trước:\n{{parent.output}}'
        },
        {
          id: `block-${Date.now()}-2`,
          type: 'task',
          title: 'Nhiệm vụ (Task)',
          content: type === 'success' ? 'Tiếp tục phát triển nội dung...' : 'Hãy sửa lỗi hoặc định hướng lại...'
        }
      ],
      variables: []
    };

    const updatedProj = {
      ...activeProject,
      nodes: [...activeProject.nodes, newChild],
      updatedAt: new Date().toISOString()
    };
    
    const layoutedProj = applyAutoLayoutToProject(updatedProj);
    saveActiveProject(layoutedProj);
    setSelectedNodeId(newChild.id);
    setIsSimulatorOpen(false);
  };

  // Node block editing helpers
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
    if (!activeProject || !selectedNodeId) return;
    const role = PRESET_SYSTEM_ROLES.find(r => r.id === roleId);
    if (!role) return;

    const updatedNodes = activeProject.nodes.map(n => {
      if (n.id === selectedNodeId) {
        return {
          ...n,
          blocks: [
            {
              id: `block-role-${Date.now()}`,
              type: 'role' as const,
              title: 'Vai trò Hệ thống (System Role)',
              content: role.rolePrompt
            }
          ],
          variables: role.variables.map(v => ({ ...v }))
        };
      }
      return n;
    });

    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveActiveProject(updatedProj);
  };

  // Node position dragging
  const updateNodePosition = (nodeId: string, pos: { x: number; y: number }) => {
    if (!activeProject) return;
    const updatedNodes = activeProject.nodes.map(n => 
      n.id === nodeId ? { ...n, position: pos } : n
    );
    const updatedProj = { ...activeProject, nodes: updatedNodes };
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProj : p));
    setActiveProject(updatedProj);
  };

  const saveNodeDragEnd = () => {
    if (activeProject) {
      saveActiveProject(activeProject);
    }
  };

  const startDragNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!activeProject) return;
    const node = activeProject.nodes.find(n => n.id === nodeId);
    if (!node || node.parentId === null) return; 

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = node.position.x;
    const initialY = node.position.y;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      updateNodePosition(nodeId, {
        x: Math.round(initialX + dx),
        y: Math.round(initialY + dy)
      });
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      saveNodeDragEnd();
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Auto layout trigger
  const handleTriggerAutoLayout = () => {
    if (!activeProject) return;
    const updatedProj = applyAutoLayoutToProject(activeProject);
    saveActiveProject(updatedProj);
  };

  // Global Criteria management
  const handleAddCriteria = (criterion: string) => {
    if (!activeProject || !criterion.trim()) return;
    const updatedProj = {
      ...activeProject,
      globalEvalCriteria: [...(activeProject.globalEvalCriteria || []), criterion.trim()],
      updatedAt: new Date().toISOString()
    };
    saveActiveProject(updatedProj);
    setNewCriteriaText('');
  };

  const handleDeleteCriteria = (index: number) => {
    if (!activeProject) return;
    const list = [...(activeProject.globalEvalCriteria || [])];
    list.splice(index, 1);
    const updatedProj = {
      ...activeProject,
      globalEvalCriteria: list,
      updatedAt: new Date().toISOString()
    };
    saveActiveProject(updatedProj);
  };

  // Template import/export
  const filteredTemplates = useMemo(() => {
    const list = [...TEMPLATES, ...customTemplates];
    if (!searchTemplateQuery.trim()) return list;
    return list.filter(t => 
      t.title.toLowerCase().includes(searchTemplateQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTemplateQuery.toLowerCase())
    );
  }, [searchTemplateQuery, customTemplates]);

  const handleImportTemplateIntoNode = (template: PromptTemplate) => {
    if (!activeNode || !activeProject) return;
    const updatedNodes = activeProject.nodes.map(n => {
      if (n.id === activeNode.id) {
        return {
          ...n,
          blocks: template.blocks.map(b => ({ ...b, id: `block-${Date.now()}-${Math.random().toString().slice(-4)}` })),
          variables: (template.variables || []).map(v => ({ ...v }))
        };
      }
      return n;
    });

    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveActiveProject(updatedProj);
    setIsImportModalOpen(false);
  };

  const handleExportNodeAsTemplate = async () => {
    if (!activeNode || !onSaveTemplate) return;
    const newTemplate: PromptTemplate = {
      id: `tmpl-${Date.now()}`,
      title: `Bản sao từ Node "${activeNode.title}"`,
      description: activeNode.description || 'Được xuất ra từ sơ đồ chuỗi nodes.',
      blocks: activeNode.blocks,
      variables: activeNode.variables,
      category: 'My templates',
      isPublic: false,
      status: 'Published',
      createdAt: new Date().toISOString()
    };

    try {
      await onSaveTemplate(newTemplate);
      alert('Đã xuất thành công mẫu prompt vào thư viện của bạn!');
    } catch (e: any) {
      alert('Không thể xuất mẫu: ' + e.message);
    }
  };

  // --- 2. SIMULATOR EXECUTION ---
  const handleOpenSimulator = (nodeId: string) => {
    if (!activeProject) return;
    const node = activeProject.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setSimulatorNode(node);
    
    const defaultInputs: Record<string, string> = { ...rootInputs };
    activeProject.nodes.forEach(n => {
      n.variables?.forEach(v => {
        if (v.defaultValue && defaultInputs[v.name] === undefined) {
          defaultInputs[v.name] = v.defaultValue;
        }
      });
    });

    setRootInputs(defaultInputs);
    const preview = compileEvolutionPrompt(node, activeProject, defaultInputs);
    setCompiledPromptPreview(preview);
    setSimulationResponse(node.output || '');
    setIsSimulatorOpen(true);
  };

  const handleVariableInputChange = (name: string, value: string) => {
    if (!simulatorNode || !activeProject) return;
    const updated = { ...rootInputs, [name]: value };
    setRootInputs(updated);
    const preview = compileEvolutionPrompt(simulatorNode, activeProject, updated);
    setCompiledPromptPreview(preview);
  };

  const updateNodeOutputAndStatus = (nodeId: string, output: string, status: NodeExecutionStatus, draftOutput?: string) => {
    if (!activeProject) return;
    const updatedNodes = activeProject.nodes.map(n => {
      if (n.id === nodeId) {
        const upd: Partial<TreeNode> = { status, output };
        if (draftOutput !== undefined) {
          upd.draftOutput = draftOutput;
        }
        return { ...n, ...upd };
      }
      return n;
    });
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveActiveProject(updatedProj);
    
    if (simulatorNode?.id === nodeId) {
      setSimulatorNode(prev => prev ? { ...prev, output, status, draftOutput: draftOutput || prev.draftOutput } : null);
    }
  };

  const handleRunSimulation = async () => {
    if (!simulatorNode || !activeProject) return;
    
    setIsSimulating(true);
    setSimulationResponse('');
    updateNodeOutputAndStatus(simulatorNode.id, '', 'running');

    const systemInstruction = `Bạn là Mentor AI - gia sư thân thiện, kiên nhẫn và khuyến khích cho học sinh trung học. Hãy tuân thủ nghiêm ngặt:
1. Tuyệt đối KHÔNG giải hộ bài tập hay đưa ra đáp án trực tiếp. Sử dụng phương pháp Socratic để đặt câu hỏi khơi gợi tư duy, dẫn dắt từng bước để học sinh tự tìm ra câu trả lời.
2. Giọng điệu thân thiện, kiên nhẫn, sử dụng emoji một cách ấm áp, khích lệ.
3. Khi viết các công thức toán học hoặc khoa học, hãy luôn sử dụng LaTeX (bọc bằng $ hoặc $$).`;

    const customKey = localStorage.getItem('mentor_ai_gemini_key') || '';
    const useSystemKey = localStorage.getItem('mentor_ai_use_system_key') !== 'false';
    const openaiKey = localStorage.getItem('mentor_ai_openai_key') || '';
    const apiKey = simProvider === 'gemini' 
      ? (useSystemKey ? undefined : customKey)
      : openaiKey;

    let accumulatedOutput = '';
    try {
      await runPlaygroundChatStream(
        simProvider,
        systemInstruction,
        [{ role: 'user', content: compiledPromptPreview }],
        {
          apiKey,
          model: simModel,
          temperature: simTemp
        },
        (chunk) => {
          accumulatedOutput += chunk;
          setSimulationResponse(accumulatedOutput);
        }
      );
      updateNodeOutputAndStatus(simulatorNode.id, accumulatedOutput, 'success');
    } catch (err: any) {
      console.error(err);
      updateNodeOutputAndStatus(simulatorNode.id, `Lỗi thực thi: ${err.message || err}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRunDraft = async () => {
    if (!simulatorNode || !activeProject) return;
    
    setIsSimulating(true);
    setSimulationResponse('');
    updateNodeOutputAndStatus(simulatorNode.id, '', 'drafting');

    const criteriaList = activeProject.globalEvalCriteria && activeProject.globalEvalCriteria.length > 0
      ? activeProject.globalEvalCriteria.map((c, i) => `- ${c}`).join('\n')
      : '- Không có quy chuẩn cụ thể.';

    const draftSystemInstruction = `Bạn là Mentor AI. Hãy sinh phản hồi nháp cực ngắn dựa trên prompt người dùng (tối đa 4 câu).
Bắt buộc sau nội dung đó, tự viết 1 phần tự kiểm duyệt trong thẻ <evaluation>...</evaluation> liệt kê xem phản hồi có thỏa mãn các quy chuẩn sau hay không:
${criteriaList}

Quy chuẩn bất biến của Mentor AI:
- Không giải bài tập hộ (chỉ gợi mở Socratic).
- Sử dụng LaTeX.`;

    const customKey = localStorage.getItem('mentor_ai_gemini_key') || '';
    const useSystemKey = localStorage.getItem('mentor_ai_use_system_key') !== 'false';
    const apiKey = useSystemKey ? undefined : customKey;

    let accumulatedOutput = '';
    try {
      await runPlaygroundChatStream(
        'gemini',
        draftSystemInstruction,
        [{ role: 'user', content: compiledPromptPreview }],
        {
          apiKey,
          model: 'gemini-2.5-flash',
          temperature: 0.2
        },
        (chunk) => {
          accumulatedOutput += chunk;
          setSimulationResponse(accumulatedOutput);
        }
      );
      updateNodeOutputAndStatus(simulatorNode.id, '', 'drafted', accumulatedOutput);
    } catch (err: any) {
      console.error(err);
      updateNodeOutputAndStatus(simulatorNode.id, `Lỗi chạy nháp: ${err.message || err}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleEvaluateDraft = (evaluation: 'effective' | 'ineffective') => {
    if (!simulatorNode || !activeProject) return;
    
    const draftText = simulatorNode.draftOutput || simulationResponse;
    const finalCleanText = draftText.replace(/<evaluation>[\s\S]*?<\/evaluation>/g, '').trim();

    const updatedNodes = activeProject.nodes.map(n => {
      if (n.id === simulatorNode.id) {
        return {
          ...n,
          status: 'success' as const,
          output: finalCleanText,
          userEvaluation: evaluation
        };
      }
      return n;
    });

    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveActiveProject(updatedProj);
    setSimulatorNode(prev => prev ? { ...prev, status: 'success', output: finalCleanText, userEvaluation: evaluation } : null);
    setSimulationResponse(finalCleanText);

    // Auto-create branching node
    const branchType = evaluation === 'effective' ? 'success' : 'failure';
    handleCreateBranchNode(branchType);
  };

  const handleSaveModifiedSimulatorOutput = (text: string) => {
    if (!simulatorNode || !activeProject) return;
    updateNodeOutputAndStatus(simulatorNode.id, text, 'success');
  };

  // --- 3. AUTOMATED UNIT TESTING & AI JUDGE ---
  const handleAddTestCase = () => {
    if (!activeProject) return;
    
    const rootNode = activeProject.nodes.find(n => n.parentId === null);
    const initialInputs: Record<string, string> = {};
    rootNode?.variables?.forEach(v => {
      initialInputs[v.name] = v.defaultValue || '';
    });

    const newCase: TestCase = {
      id: `tc-${Date.now()}`,
      name: `Kiểm thử Case ${ (activeProject.testCases || []).length + 1 }`,
      inputs: initialInputs,
      expectedCriteria: [],
      status: 'idle'
    };

    const updatedProj = {
      ...activeProject,
      testCases: [...(activeProject.testCases || []), newCase],
      updatedAt: new Date().toISOString()
    };
    saveActiveProject(updatedProj);
    setSelectedTestCaseId(newCase.id);
  };

  const handleDeleteTestCase = (testCaseId: string) => {
    if (!activeProject) return;
    const remaining = (activeProject.testCases || []).filter(c => c.id !== testCaseId);
    const updatedProj = {
      ...activeProject,
      testCases: remaining,
      updatedAt: new Date().toISOString()
    };
    saveActiveProject(updatedProj);
    if (selectedTestCaseId === testCaseId) {
      setSelectedTestCaseId(remaining[0]?.id || null);
    }
  };

  const handleUpdateTestCase = (testCaseId: string, updates: Partial<TestCase>) => {
    if (!activeProject) return;
    const updatedCases = (activeProject.testCases || []).map(c => 
      c.id === testCaseId ? { ...c, ...updates } : c
    );
    const updatedProj = {
      ...activeProject,
      testCases: updatedCases,
      updatedAt: new Date().toISOString()
    };
    saveActiveProject(updatedProj);
  };

  const runSingleTestCase = async (testCase: TestCase, project: PromptProject): Promise<TestCase> => {
    let testNodes: TreeNode[] = project.nodes.map(n => ({ ...n, output: undefined, status: 'idle' as NodeExecutionStatus }));
    let testProject = { ...project, nodes: testNodes };
    
    let currNode = testProject.nodes.find(n => n.parentId === null);
    if (!currNode) {
      return {
        ...testCase,
        status: 'failed',
        feedback: 'Không tìm thấy Node gốc (Root Node) trong sơ đồ.',
        score: 0
      };
    }

    const customKey = localStorage.getItem('mentor_ai_gemini_key') || '';
    const useSystemKey = localStorage.getItem('mentor_ai_use_system_key') !== 'false';
    const openaiKey = localStorage.getItem('mentor_ai_openai_key') || '';
    const apiKey = simProvider === 'gemini' 
      ? (useSystemKey ? undefined : customKey)
      : openaiKey;

    const systemInstruction = `Bạn là Mentor AI - gia sư thân thiện, kiên nhẫn và khuyến khích cho học sinh trung học. Hãy tuân thủ nghiêm ngặt:
1. Tuyệt đối KHÔNG giải hộ bài tập hay đưa ra đáp án trực tiếp. Sử dụng phương pháp Socratic để đặt câu hỏi khơi gợi tư duy, dẫn dắt từng bước để học sinh tự tìm ra câu trả lời.
2. Giọng điệu thân thiện, kiên nhẫn, sử dụng emoji một cách ấm áp, khích lệ.
3. Khi viết các công thức toán học hoặc khoa học, hãy luôn sử dụng LaTeX (bọc bằng $ hoặc $$).`;

    let finalOutput = '';

    try {
      while (currNode) {
        const compiledPrompt = compileEvolutionPrompt(currNode, testProject, testCase.inputs);
        let nodeOutput = '';
        
        await runPlaygroundChatStream(
          simProvider,
          systemInstruction,
          [{ role: 'user', content: compiledPrompt }],
          {
            apiKey,
            model: simModel,
            temperature: simTemp
          },
          (chunk) => {
            nodeOutput += chunk;
          }
        );

        if (!nodeOutput) {
          throw new Error(`Node "${currNode.title}" trả về kết quả rỗng.`);
        }

        const nodeId = currNode.id;
        testNodes = testNodes.map(n => n.id === nodeId ? { ...n, output: nodeOutput, status: 'success' as const } : n);
        testProject = { ...testProject, nodes: testNodes };
        finalOutput = nodeOutput;

        const children = testNodes.filter(n => n.parentId === nodeId);
        if (children.length === 0) {
          break;
        }

        const hasBranches = children.some(c => c.branchType === 'success' || c.branchType === 'failure');
        if (hasBranches) {
          let routeDecision: 'success' | 'failure' = 'success';
          
          if (pipelineRoutingMode === 'keyword') {
            const hasKeyword = nodeOutput.toLowerCase().includes(pipelineKeyword.toLowerCase());
            routeDecision = hasKeyword ? 'success' : 'failure';
          } else {
            const evalResult = await evaluateOutputQualityWithAi(
              nodeOutput,
              testProject.globalEvalCriteria || [],
              { apiKey: useSystemKey ? undefined : customKey, model: 'gemini-3.5-flash' }
            );
            routeDecision = evalResult === 'effective' ? 'success' : 'failure';
          }

          const nextNode = children.find(c => c.branchType === routeDecision);
          if (nextNode) {
            currNode = nextNode;
          } else {
            break;
          }
        } else {
          currNode = children[0];
        }
      }

      const criteria = testCase.expectedCriteria && testCase.expectedCriteria.length > 0
        ? testCase.expectedCriteria
        : (testProject.globalEvalCriteria || []);

      const evalResult = await runAutomatedTestEvaluation(
        finalOutput,
        criteria,
        { apiKey: useSystemKey ? undefined : customKey, model: 'gemini-3.5-flash' }
      );

      return {
        ...testCase,
        status: evalResult.score >= 80 ? 'success' : 'failed',
        score: evalResult.score,
        feedback: evalResult.feedback,
        outputText: finalOutput
      };

    } catch (error: any) {
      console.error(`Lỗi thực thi test case "${testCase.name}":`, error);
      return {
        ...testCase,
        status: 'failed',
        feedback: `Lỗi thực thi: ${error.message || error}`,
        score: 0,
        outputText: finalOutput || 'Chưa sinh được kết quả.'
      };
    }
  };

  const runTestSuiteExecution = async () => {
    if (!activeProject || isRunningAllTests) return;
    setIsRunningAllTests(true);
    setTestSuiteLogs([`[${new Date().toLocaleTimeString()}] Bắt đầu thực thi bộ kiểm thử cho dự án: ${activeProject.name}...`]);

    const cases = activeProject.testCases || [];
    if (cases.length === 0) {
      setTestSuiteLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Không có bộ kiểm thử nào được cấu hình.`]);
      setIsRunningAllTests(false);
      return;
    }

    let updatedCases = cases.map(c => ({ ...c, status: 'running' as const, score: undefined, feedback: undefined }));
    let runningProj = { ...activeProject, testCases: updatedCases };
    setActiveProject(runningProj);

    const finalCases: TestCase[] = [];

    for (let i = 0; i < updatedCases.length; i++) {
      const tc = updatedCases[i];
      setTestSuiteLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Đang chạy kiểm thử: "${tc.name}"...`]);
      
      const result = await runSingleTestCase(tc, runningProj);
      
      setTestSuiteLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Hoàn thành: "${tc.name}" - Điểm số: ${result.score}/100 - Kết quả: ${result.status === 'success' ? 'ĐẠT ✓' : 'CHƯA ĐẠT ✗'}`
      ]);
      
      finalCases.push(result);
      
      const tempProj = {
        ...activeProject,
        testCases: [
          ...finalCases,
          ...updatedCases.slice(i + 1)
        ]
      };
      setActiveProject(tempProj);
    }

    const finalProj = {
      ...activeProject,
      testCases: finalCases
    };
    await saveActiveProject(finalProj);
    setTestSuiteLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Hoàn thành thực thi toàn bộ ${finalCases.length} bộ kiểm thử.`]);
    setIsRunningAllTests(false);
  };

  const runIndividualTestCase = async (testCaseId: string) => {
    if (!activeProject || isRunningAllTests) return;
    const tc = (activeProject.testCases || []).find(t => t.id === testCaseId);
    if (!tc) return;

    const updatedCases = (activeProject.testCases || []).map(c => 
      c.id === testCaseId ? { ...c, status: 'running' as const, score: undefined, feedback: undefined } : c
    );
    const runningProj = { ...activeProject, testCases: updatedCases };
    setActiveProject(runningProj);

    setTestSuiteLogs([`[${new Date().toLocaleTimeString()}] Bắt đầu chạy riêng lẻ kiểm thử: "${tc.name}"...`]);
    
    const result = await runSingleTestCase(tc, runningProj);
    
    setTestSuiteLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Hoàn thành: "${tc.name}" - Điểm số: ${result.score}/100 - Kết quả: ${result.status === 'success' ? 'ĐẠT ✓' : 'CHƯA ĐẠT ✗'}`,
      `[Nhận xét từ AI]: ${result.feedback || 'Không có phản hồi.'}`
    ]);

    const finalCases = updatedCases.map(c => c.id === testCaseId ? result : c);
    const finalProj = {
      ...activeProject,
      testCases: finalCases
    };
    await saveActiveProject(finalProj);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 text-slate-800 dark:bg-slate-955 dark:text-slate-200">
      
      {/* 1. CANVAS VIEWPORT AND HEADER */}
      <div className="relative flex flex-1 flex-col overflow-hidden border-r border-slate-200/50 dark:border-slate-800/50">
        
        {/* HEADER PANEL */}
        <header className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 bg-white/85 p-4 backdrop-blur-md dark:border-slate-850/50 dark:bg-slate-900/85">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-500 dark:bg-cyan-500/20">
              <Workflow size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <select
                  value={activeProject?.id || ''}
                  onChange={(e) => {
                    const proj = projects.find(p => p.id === e.target.value);
                    if (proj) {
                      setActiveProject(proj);
                      setSelectedNodeId(proj.nodes[0]?.id || null);
                    }
                  }}
                  className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white cursor-pointer py-0.5 pr-8 border border-slate-200 rounded-lg px-2 dark:border-slate-855 bg-slate-55 dark:bg-slate-950 text-[13px]"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id} className="dark:bg-slate-900">{p.name}</option>
                  ))}
                </select>
                <button 
                  onClick={handleCreateNewProject}
                  className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="Tạo dự án mới"
                >
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-xs truncate">
                {activeProject?.description || 'Không có mô tả'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            
            {/* Sync status */}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-850 px-2 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
              {syncStatus === 'synced' && (
                <>
                  <Cloud size={14} className="text-emerald-505 animate-pulse" />
                  <span>Đồng bộ</span>
                </>
              )}
              {syncStatus === 'saving' && (
                <>
                  <RefreshCw size={14} className="animate-spin text-cyan-500" />
                  <span>Đang lưu...</span>
                </>
              )}
              {syncStatus === 'local' && (
                <>
                  <Database size={14} className="text-slate-400" />
                  <span>Ngoại tuyến</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <CloudOff size={14} className="text-rose-500" />
                  <span>Lỗi đồng bộ</span>
                </>
              )}
            </div>

            {/* Global Eval Criteria */}
            {activeProject && (
              <button 
                onClick={() => setIsEvalCriteriaModalOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-650 hover:bg-purple-50 dark:border-slate-800 dark:bg-slate-900 dark:text-purple-400 dark:hover:bg-purple-955/20 cursor-pointer transition-colors text-[11px]"
                title="Quản lý quy chuẩn đánh giá toàn cục"
              >
                <Settings size={13} />
                <span>Quy chuẩn ({activeProject.globalEvalCriteria?.length || 0})</span>
              </button>
            )}

            {/* Run Whole Chain (Pipeline) */}
            {activeProject && (
              <button 
                onClick={() => {
                  const defaultInputs: Record<string, string> = { ...rootInputs };
                  activeProject.nodes.forEach(n => {
                    n.variables?.forEach(v => {
                      if (v.defaultValue && defaultInputs[v.name] === undefined) {
                        defaultInputs[v.name] = v.defaultValue;
                      }
                    });
                  });
                  setPipelineInputs(defaultInputs);
                  setIsPipelineOpen(true);
                }}
                className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-55/50 px-3 py-1.5 text-xs font-semibold text-cyan-600 hover:bg-cyan-100 dark:border-cyan-900/50 dark:bg-cyan-955/20 dark:text-cyan-400 dark:hover:bg-cyan-905/30 cursor-pointer transition-colors text-[11px]"
                title="Chạy tự động toàn bộ chuỗi"
              >
                <Play size={13} fill="currentColor" />
                <span>Chạy toàn chuỗi (Pipeline)</span>
              </button>
            )}

            {/* Unit Tests Trigger */}
            {activeProject && (
              <button 
                onClick={() => {
                  if (!activeProject.testCases) {
                    activeProject.testCases = [];
                  }
                  if (activeProject.testCases.length > 0 && !selectedTestCaseId) {
                    setSelectedTestCaseId(activeProject.testCases[0].id);
                  }
                  setIsUnitTestOpen(true);
                }}
                className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-55/50 px-3 py-1.5 text-xs font-semibold text-purple-650 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-955/20 dark:text-purple-400 dark:hover:bg-purple-900/30 cursor-pointer transition-colors text-[11px]"
                title="Quản lý và chạy bộ kiểm thử tự động"
              >
                <Wrench size={13} />
                <span>Bộ Kiểm Thử (Unit Tests)</span>
              </button>
            )}

            {/* Delete project */}
            {activeProject && (
              <button 
                onClick={() => handleDeleteProject(activeProject.id)}
                className="flex items-center gap-1 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:border-slate-850 dark:bg-slate-900 dark:hover:bg-rose-955/20 cursor-pointer transition-colors text-[11px]"
                title="Xóa dự án hiện tại"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Xóa</span>
              </button>
            )}

            {/* Import JSON */}
            <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-805 dark:bg-slate-900 dark:hover:bg-slate-850 cursor-pointer transition-colors text-[11px]">
              <Upload size={13} className="text-slate-450" />
              <span className="hidden sm:inline">Nhập JSON</span>
              <input type="file" accept=".json" onChange={handleImportProjectJSON} className="hidden" />
            </label>

            {/* Export JSON */}
            <button 
              onClick={handleExportProjectJSON}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850 cursor-pointer transition-colors text-[11px]"
            >
              <Download size={13} className="text-slate-450" />
              <span className="hidden sm:inline">Xuất JSON</span>
            </button>

            {/* Help button */}
            <button
              onClick={() => setShowHelp(prev => !prev)}
              className={`rounded-lg p-1.5 border transition-all cursor-pointer ${showHelp ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400' : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800'}`}
              title="Hướng dẫn liên kết biến"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </header>

        {/* CANVAS FLOATING CONTROLS */}
        <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 p-1.5 shadow-lg backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90">
          <button 
            onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))} 
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-300"
            title="Phóng to"
          >
            <ZoomIn size={16} />
          </button>
          <button 
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))} 
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-300"
            title="Thu nhỏ"
          >
            <ZoomOut size={16} />
          </button>
          <button 
            onClick={resetCanvasView} 
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-300 border-t border-slate-105 dark:border-slate-850"
            title="Góc nhìn mặc định"
          >
            <Maximize2 size={16} />
          </button>
          <button 
            onClick={handleTriggerAutoLayout} 
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-850"
            title="Dàn trang tự động"
          >
            <Network size={16} />
          </button>
        </div>

        {/* FLOATING HELP PANEL */}
        {showHelp && (
          <div className="absolute top-20 right-5 z-20 max-w-xs rounded-xl border border-indigo-150/40 bg-indigo-50/95 dark:bg-indigo-950/90 dark:border-indigo-900/40 p-4 shadow-xl backdrop-blur-md text-xs text-slate-700 dark:text-slate-300">
            <button 
              onClick={() => setShowHelp(false)}
              className="absolute top-2 right-2 text-slate-450 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
            <h4 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1 mb-2">
              <Sparkles size={14} />
              Liên kết Prompt xuyên suốt
            </h4>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Mỗi node cha khi chạy simulator sẽ lưu lại <b>Đầu ra (output)</b>.</li>
              <li>Tại node con, tham chiếu đầu ra của cha trực tiếp bằng: <code>{"{{parent.output}}"}</code>.</li>
              <li>Tham chiếu tổ tiên cụ thể bằng tên của họ: <code>{"{{TenNodeKhôngDấuKhoảngTrắng.output}}"}</code>. Ví dụ: <code>{"{{1.PhântíchChủđề.output}}"}</code>.</li>
              <li>Các biến toàn cục khai báo ở Node gốc (vd: <code>{"{{subject}}"}</code>) có thể dùng ở mọi node con.</li>
            </ul>
          </div>
        )}

        {/* CANVAS VIEWPORT */}
        {activeProject && (
          <CanvasView
            activeProject={activeProject}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            theme={theme}
            canvasOffset={canvasOffset}
            zoom={zoom}
            startPanning={startPanning}
            handleWheel={handleWheel}
            startDragNode={startDragNode}
            handleOpenSimulator={handleOpenSimulator}
            handleDeleteNode={handleDeleteNode}
            handleAddChildNode={handleAddChildNode}
            canvasRef={canvasRef}
          />
        )}
      </div>

      {/* 2. SIDEBAR EDITOR */}
      <NodeDetailSidebar
        activeNode={activeNode}
        activeProject={activeProject}
        selectedNodeId={selectedNodeId}
        theme={theme}
        rootInputs={rootInputs}
        isImportModalOpen={isImportModalOpen}
        setIsImportModalOpen={setIsImportModalOpen}
        handleExportNodeAsTemplate={handleExportNodeAsTemplate}
        handleUpdateNodeFields={handleUpdateNodeFields}
        handleAddBlockToNode={handleAddBlockToNode}
        handleUpdateBlockContent={handleUpdateBlockContent}
        handleUpdateBlockTitle={handleUpdateBlockTitle}
        handleDeleteBlockFromNode={handleDeleteBlockFromNode}
        handleAddPresetBlock={handleAddPresetBlock}
        handleAddVariableToNode={handleAddVariableToNode}
        handleUpdateVariableField={handleUpdateVariableField}
        handleDeleteVariable={handleDeleteVariable}
        handleSelectSystemRole={handleSelectSystemRole}
        handleOpenSimulator={handleOpenSimulator}
      />

      {/* --- MODAL 0: GLOBAL EVALUATION CRITERIA --- */}
      <GlobalEvalCriteriaModal
        isOpen={isEvalCriteriaModalOpen}
        onClose={() => setIsEvalCriteriaModalOpen(false)}
        activeProject={activeProject}
        newCriteriaText={newCriteriaText}
        setNewCriteriaText={setNewCriteriaText}
        handleAddCriteria={handleAddCriteria}
        handleDeleteCriteria={handleDeleteCriteria}
      />

      {/* --- MODAL 1: LIBRARY IMPORT PICKER --- */}
      <LibraryImportPickerModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        searchTemplateQuery={searchTemplateQuery}
        setSearchTemplateQuery={setSearchTemplateQuery}
        filteredTemplates={filteredTemplates}
        handleImportTemplateIntoNode={handleImportTemplateIntoNode}
      />

      {/* --- MODAL 2: INTERACTIVE STEP-BY-STEP SIMULATOR --- */}
      <SimulatorPanel
        isOpen={isSimulatorOpen}
        onClose={() => {
          if (!isSimulating) setIsSimulatorOpen(false);
        }}
        simulatorNode={simulatorNode}
        activeProject={activeProject}
        simProvider={simProvider}
        setSimProvider={setSimProvider}
        simModel={simModel}
        setSimModel={setSimModel}
        isSimulating={isSimulating}
        compiledPromptPreview={compiledPromptPreview}
        simulationResponse={simulationResponse}
        rootInputs={rootInputs}
        handleVariableInputChange={handleVariableInputChange}
        handleRunDraft={handleRunDraft}
        handleRunSimulation={handleRunSimulation}
        handleEvaluateDraft={handleEvaluateDraft}
        handleCreateBranchNode={handleCreateBranchNode}
        handleSaveModifiedSimulatorOutput={handleSaveModifiedSimulatorOutput}
        theme={theme}
      />

      {/* --- MODAL 3: PIPELINE ORCHESTRATION RUNNER --- */}
      <AnimatePresence>
        {isPipelineOpen && activeProject && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (pipelineStatus !== 'running') setIsPipelineOpen(false);
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative z-10 w-full max-w-5xl h-[80vh] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-150 p-4 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-cyan-500/10 p-1.5 text-cyan-500">
                    <Play size={16} fill="currentColor" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Chạy tự động toàn chuỗi (Pipeline Orchestration)
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-550">
                      Chạy tuần tự toàn bộ các node prompt trong dự án và tự động phân nhánh/định tuyến.
                    </p>
                  </div>
                </div>

                <button 
                  disabled={pipelineStatus === 'running'}
                  onClick={() => setIsPipelineOpen(false)}
                  className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Panel */}
                <div className="w-96 border-r border-slate-155 p-4 dark:border-slate-800 flex flex-col space-y-4 overflow-y-auto shrink-0">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-3">Biến đầu vào của Root</h4>
                    {activeProject.nodes.find(n => n.parentId === null)?.variables?.length === 0 ? (
                      <p className="text-[11px] italic text-slate-400 dark:text-slate-500">Không có biến đầu vào.</p>
                    ) : (
                      <div className="space-y-3">
                        {activeProject.nodes.find(n => n.parentId === null)?.variables?.map((v) => (
                          <div key={v.name} className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                              <span>{v.name}</span>
                              {v.required && <span className="text-[9px] text-rose-505 font-bold">Bắt buộc</span>}
                            </label>
                            <input
                              type="text"
                              disabled={pipelineStatus === 'running'}
                              value={pipelineInputs[v.name] || ''}
                              onChange={(e) => setPipelineInputs(prev => ({ ...prev, [v.name]: e.target.value }))}
                              className="w-full rounded-lg border border-slate-250 bg-white px-2.5 py-1.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 disabled:opacity-50"
                              placeholder={v.description || `Nhập giá trị cho {{${v.name}}}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800/40">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-3">Cấu hình rẽ nhánh / Định tuyến</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Chế độ định tuyến</label>
                        <select
                          disabled={pipelineStatus === 'running'}
                          value={pipelineRoutingMode}
                          onChange={(e) => setPipelineRoutingMode(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-202 bg-white px-2.5 py-1.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-955 dark:text-slate-300 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="ai">AI Auto Evaluation (Thẩm định toàn cục)</option>
                          <option value="keyword">Keyword Matching (Khớp từ khóa)</option>
                          <option value="manual">Manual Routing (Duyệt thủ công)</option>
                        </select>
                      </div>

                      {pipelineRoutingMode === 'keyword' && (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Từ khóa đi tiếp nhánh Success</label>
                          <input
                            type="text"
                            disabled={pipelineStatus === 'running'}
                            value={pipelineKeyword}
                            onChange={(e) => setPipelineKeyword(e.target.value)}
                            className="w-full rounded-lg border border-slate-250 bg-white px-2.5 py-1.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-955 dark:text-slate-300 disabled:opacity-50"
                            placeholder="Nhập từ khóa (vd: thành công, đạt...)"
                          />
                        </div>
                      )}

                      {pipelineRoutingMode === 'ai' && (
                        <p className="text-[10px] text-slate-400 leading-normal">
                          💡 AI sẽ tự động chấm điểm output của cha đối chiếu với **Bộ quy chuẩn toàn cục** ({activeProject.globalEvalCriteria?.length || 0} quy chuẩn) để tự rẽ nhánh.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 dark:border-slate-800/40 flex flex-col gap-2 mt-auto">
                    {pipelineStatus === 'running' || pipelineStatus === 'paused' ? (
                      <button
                        onClick={handleStopPipeline}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-rose-650 hover:bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer transition-all active:scale-95 animate-pulse text-[11px]"
                      >
                        <span>Dừng thực thi chuỗi</span>
                      </button>
                    ) : (
                      <button
                        onClick={startPipelineExecution}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer transition-all active:scale-95 text-[11px]"
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Kích hoạt chạy chuỗi</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Panel */}
                <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0 bg-slate-50/50 dark:bg-slate-950/20">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550">
                      Đầu ra của Node hiện tại
                    </span>
                    <div className="flex items-center gap-1.5">
                      {pipelineStatus === 'running' && (
                        <span className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 font-semibold animate-pulse">
                          <RefreshCw size={12} className="animate-spin" />
                          Đang thực thi chuỗi...
                        </span>
                      )}
                      {pipelineStatus === 'paused' && (
                        <span className="flex items-center gap-1 text-xs text-amber-605 dark:text-amber-400 font-semibold animate-pulse">
                          ⚠️ Tạm dừng (Chờ duyệt nhánh)
                        </span>
                      )}
                      {pipelineStatus === 'completed' && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold animate-bounce">
                          ✓ Hoàn thành toàn chuỗi
                        </span>
                      )}
                      {pipelineStatus === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold animate-shake">
                          ✗ Gặp lỗi hệ thống
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 border border-slate-200/80 rounded-2xl bg-white dark:border-slate-800 dark:bg-slate-900 p-4 overflow-y-auto mb-4 select-text relative">
                    {pipelineCurrentNodeId ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-cyan-605 dark:text-cyan-400">
                          <RefreshCw size={12} className="animate-spin" />
                          <span>VĂN BẢN ĐANG SINH TỪ NODE: {activeProject.nodes.find(n => n.id === pipelineCurrentNodeId)?.title}</span>
                        </div>
                        <AIResponseRenderer content={pipelineNodeResponse || 'Đang phản hồi...'} />
                      </div>
                    ) : pipelineStatus === 'completed' ? (
                      <div className="flex h-full flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
                        <Check size={36} className="text-emerald-505 mb-2 animate-bounce" />
                        <h4 className="font-bold text-slate-850 dark:text-slate-200 mb-1">Toàn bộ chuỗi đã được thực thi hoàn chỉnh!</h4>
                        <p className="text-xs max-w-sm">Tất cả các kết quả đầu ra đã được lưu trực tiếp vào từng Node tương ứng trên Sơ đồ Canvas của bạn.</p>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-slate-400 dark:text-slate-550 text-center">
                        <Play size={24} className="mb-2 text-slate-350 dark:text-slate-750" />
                        <p className="text-xs">Đầu ra của Node đang chạy sẽ hiển thị tại đây.</p>
                      </div>
                    )}
                  </div>

                  {pipelineStatus === 'paused' && (
                    <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-amber-500/5 dark:bg-amber-955/20 p-4 border border-amber-500/25 shrink-0">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            Thẩm định & Rẽ nhánh thủ công:
                          </span>
                          <span className="text-[10px] text-slate-450 dark:text-slate-500">
                            Hãy xem kết quả sinh ra ở trên và nhấn chọn nhánh tiếp theo:
                          </span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleResumePipelineManual('success')}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer shadow-sm active:scale-95 text-[11px]"
                          >
                            <Check size={14} />
                            👍 Đi nhánh Nâng Cao
                          </button>
                          <button
                            onClick={() => handleResumePipelineManual('failure')}
                            className="flex items-center gap-1 rounded-xl bg-orange-650 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all cursor-pointer shadow-sm active:scale-95 text-[11px]"
                          >
                            <AlertCircle size={14} />
                            👎 Đi nhánh Sửa Lỗi
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Logs Terminal */}
                  <div className="h-44 border border-slate-200/80 rounded-2xl bg-slate-950 p-3 flex flex-col font-mono text-[10px] text-slate-300 shrink-0">
                    <span className="text-[9px] uppercase font-bold text-slate-500 mb-1.5 pb-1.5 border-b border-slate-900 shrink-0">
                      Bảng theo dõi nhật ký thực thi (Execution Logs)
                    </span>
                    <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
                      {pipelineLogs.length === 0 ? (
                        <span className="text-slate-650 italic">Chưa có nhật ký hoạt động. Hãy kích hoạt chuỗi để bắt đầu.</span>
                      ) : (
                        pipelineLogs.map((log, idx) => (
                          <div key={idx} className="leading-relaxed whitespace-pre-wrap select-text">{log}</div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 4: AUTOMATED UNIT TESTING & AI JUDGE --- */}
      <TestCasesPanel
        isOpen={isUnitTestOpen}
        onClose={() => {
          if (!isRunningAllTests) setIsUnitTestOpen(false);
        }}
        activeProject={activeProject}
        selectedTestCaseId={selectedTestCaseId}
        setSelectedTestCaseId={setSelectedTestCaseId}
        isRunningAllTests={isRunningAllTests}
        testSuiteLogs={testSuiteLogs}
        handleAddTestCase={handleAddTestCase}
        handleDeleteTestCase={handleDeleteTestCase}
        handleUpdateTestCase={handleUpdateTestCase}
        runIndividualTestCase={runIndividualTestCase}
        runTestSuiteExecution={runTestSuiteExecution}
        theme={theme}
      />

    </div>
  );
}
