import { toast } from '../common/Toaster';
import { confirmDialog } from '../common/ConfirmDialog';
import React, { useMemo, useRef, useState } from 'react';
import { PromptProject, PromptBlock, PromptTemplate, TreeNode, EvolutionType, PromptVariable } from '../../types';
import { PRESET_SYSTEM_ROLES } from '../../presets';
import { runPlaygroundChatStream, withPersona } from '../../services/aiService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CanvasView } from './CanvasView';
import { NodeDetailSidebar } from './NodeDetailSidebar';
import { SimulatorPanel } from './SimulatorPanel';
import { ImportTemplateModal } from './ImportTemplateModal';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useProjectPipeline } from '../../hooks/useProjectPipeline';
import { markDescendantsStale } from '../../utils/chainUtils';

/**
 * Chế độ CANVAS của Project Chain (M3: tách nguyên cụm khỏi ProjectChainTab 2.456 dòng —
 * toàn bộ handler node/simulator/branch + CanvasView/NodeDetailSidebar/SimulatorPanel/
 * ImportTemplateModal). Hành vi giữ NGUYÊN: props nhận đúng các setter của shell.
 */
interface CanvasWorkspaceProps {
  activeProject: PromptProject;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveProject: React.Dispatch<React.SetStateAction<PromptProject | null>>;
  setProjects: React.Dispatch<React.SetStateAction<PromptProject[]>>;
  saveProjectState: (proj: PromptProject) => void | Promise<void>;
  pipeline: ReturnType<typeof useProjectPipeline>;
  theme?: 'light' | 'dark';
  onSaveTemplate?: (template: PromptTemplate) => Promise<void>;
  allAvailableTemplates: PromptTemplate[];
}

export function CanvasWorkspace({
  activeProject, selectedNodeId, setSelectedNodeId,
  setActiveProject, setProjects, saveProjectState,
  pipeline, theme = 'dark', onSaveTemplate, allAvailableTemplates,
}: CanvasWorkspaceProps) {
  const { activePersona } = useWorkspace();
  const { canvasOffset, setCanvasOffset, zoom, setZoom, startPanning, handleWheel, resetCanvasView } = useCanvasInteraction();
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorNode, setSimulatorNode] = useState<TreeNode | null>(null);
  const [compiledPromptPreview, setCompiledPromptPreview] = useState('');
  const [simulationResponse, setSimulationResponse] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTemplateQuery, setSearchTemplateQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchTemplateQuery) return allAvailableTemplates;
    return allAvailableTemplates.filter(t => 
      t.title.toLowerCase().includes(searchTemplateQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTemplateQuery.toLowerCase())
    );
  }, [allAvailableTemplates, searchTemplateQuery]);

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
      toast(`Khối "${title}" đã tồn tại trong Node.`);
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
      .then(() => toast('Đã lưu Node thành Template thư viện thành công!'))
      .catch(err => toast('Không thể xuất template: ' + err.message));
  };

  const handleImportTemplateIntoNode = async (template: PromptTemplate) => {
    if (!activeNode) return;
    if (!(await confirmDialog({ message: `Bạn có muốn thay thế các khối Prompt hiện tại của node "${activeNode.title}" bằng mẫu "${template.title}" không?` }))) return;

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

  const handleDeleteNodeCanvas = async (nodeId: string) => {
    if (!activeProject) return;
    const node = activeProject.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    if (node.parentId === null) {
      toast('Không thể xóa Node gốc!');
      return;
    }

    if (!(await confirmDialog({ message: `Bạn có chắc chắn muốn xóa Node "${node.title}" và mọi node phụ thuộc?`, danger: true, confirmText: 'Xoá' }))) return;

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

      // Cập nhật output cho node và lưu dự án.
      // Node vừa chạy: hết lỗi thời (isStale: false). Mọi node con cháu kế thừa output cũ
      // trở nên lỗi thời -> đánh dấu để người dùng biết cần chạy lại.
      let updatedNodes = activeProject.nodes.map(n =>
        n.id === simulatorNode.id ? { ...n, output: accumulatedOutput, status: 'success' as const, isStale: false } : n
      );
      updatedNodes = markDescendantsStale(updatedNodes, simulatorNode.id);
      const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
      saveProjectState(updatedProj);
      setSimulatorNode(prev => prev ? { ...prev, output: accumulatedOutput, status: 'success' as const, isStale: false } : null);
      
    } catch (err: any) {
      console.error(err);
      setSimulationResponse(`❌ Lỗi thực thi: ${err.message}`);
    } finally {
      pipeline.setPipelineStatus('idle');
    }
  };

  // Chạy nháp nhanh bằng model rẻ để người dùng đánh giá sơ bộ trước khi chạy chính thức.
  const handleRunDraftCanvas = async () => {
    if (!simulatorNode || !activeProject) return;

    const systemInstruction = `Bạn là Mentor AI - gia sư thân thiện, kiên nhẫn và khuyến khích cho học sinh trung học. Hãy tuân thủ nghiêm ngặt:
1. Tuyệt đối KHÔNG giải hộ bài tập hay đưa ra đáp án trực tiếp. Sử dụng phương pháp Socratic để đặt câu hỏi khơi gợi tư duy, dẫn dắt từng bước để học sinh tự tìm ra câu trả lời.
2. Giọng điệu thân thiện, kiên nhẫn, sử dụng emoji một cách ấm áp, khích lệ.
3. Khi viết các công thức toán học hoặc khoa học, hãy luôn sử dụng LaTeX (bọc bằng $ hoặc $$).`;

    const customKey = localStorage.getItem('mentor_ai_gemini_key') || '';
    const useSystemKey = localStorage.getItem('mentor_ai_use_system_key') !== 'false';
    const apiKey = useSystemKey ? undefined : customKey;

    // Đặt trạng thái drafting cho node
    setSimulationResponse('');
    setSimulatorNode(prev => prev ? { ...prev, status: 'drafting' as const } : null);
    const draftingNodes = activeProject.nodes.map(n =>
      n.id === simulatorNode.id ? { ...n, status: 'drafting' as const } : n
    );
    setActiveProject({ ...activeProject, nodes: draftingNodes });

    let accumulated = '';
    try {
      await runPlaygroundChatStream(
        'gemini',
        systemInstruction,
        [{ role: 'user', content: compiledPromptPreview }],
        { apiKey, model: 'gemini-2.5-flash', temperature: pipeline.simTemp },
        (chunk) => {
          accumulated += chunk;
          setSimulationResponse(accumulated);
        }
      );

      const draftedNodes = activeProject.nodes.map(n =>
        n.id === simulatorNode.id ? { ...n, draftOutput: accumulated, status: 'drafted' as const } : n
      );
      saveProjectState({ ...activeProject, nodes: draftedNodes, updatedAt: new Date().toISOString() });
      setSimulatorNode(prev => prev ? { ...prev, draftOutput: accumulated, status: 'drafted' as const } : null);
    } catch (err: any) {
      console.error(err);
      setSimulationResponse(`❌ Lỗi chạy nháp: ${err.message}`);
      setSimulatorNode(prev => prev ? { ...prev, status: 'idle' as const } : null);
    }
  };

  const handleEvaluateDraftCanvas = (evalType: 'effective' | 'ineffective') => {
    if (!simulatorNode || !activeProject) return;
    // Ghi nhận đánh giá nháp, đưa node về trạng thái success rồi tạo nhánh tương ứng
    // (effective -> nhánh Nâng cao, ineffective -> nhánh Sửa lỗi) để không bị kẹt ở trạng thái nháp.
    const updatedNodes = activeProject.nodes.map(n =>
      n.id === simulatorNode.id ? { ...n, userEvaluation: evalType, status: 'success' as const } : n
    );
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
    setSimulatorNode(prev => prev ? { ...prev, userEvaluation: evalType, status: 'success' as const } : null);
    handleCreateBranchNodeCanvas(evalType === 'effective' ? 'success' : 'failure');
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
    // Sửa output thủ công cũng làm con cháu lỗi thời như khi chạy lại.
    let updatedNodes = activeProject.nodes.map(n =>
      n.id === simulatorNode.id ? { ...n, output: text, isStale: false } : n
    );
    updatedNodes = markDescendantsStale(updatedNodes, simulatorNode.id);
    const updatedProj = { ...activeProject, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    saveProjectState(updatedProj);
    setSimulatorNode(prev => prev ? { ...prev, output: text, isStale: false } : null);
  };


  return (
    <>
      <div className="flex-1 flex min-h-0 overflow-hidden">
                <CanvasView
                  activeProject={activeProject}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                  theme={theme}
                  canvasOffset={canvasOffset}
                  zoom={zoom}
                  startPanning={startPanning}
                  handleWheel={handleWheel}
                  startDragNode={startDragNodeCanvas}
                  handleOpenSimulator={handleOpenSimulatorCanvas}
                  handleDeleteNode={handleDeleteNodeCanvas}
                  handleAddChildNode={handleAddChildNodeCanvas}
                  canvasRef={canvasRef}
                />
                <NodeDetailSidebar
                  activeNode={activeNode}
                  activeProject={activeProject}
                  selectedNodeId={selectedNodeId}
                  theme={theme}
                  rootInputs={pipeline.pipelineInputs}
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
                  handleOpenSimulator={handleOpenSimulatorCanvas}
                />
              </div>

      <SimulatorPanel
              isOpen={isSimulatorOpen}
              onClose={() => setIsSimulatorOpen(false)}
              simulatorNode={simulatorNode}
              activeProject={activeProject}
              simProvider={pipeline.simProvider}
              setSimProvider={pipeline.setSimProvider}
              simModel={pipeline.simModel}
              setSimModel={pipeline.setSimModel}
              isSimulating={pipeline.pipelineStatus === 'running'}
              compiledPromptPreview={compiledPromptPreview}
              simulationResponse={simulationResponse}
              rootInputs={pipeline.pipelineInputs}
              handleVariableInputChange={handleVariableInputChangeCanvas}
              handleRunDraft={handleRunDraftCanvas}
              handleRunSimulation={handleRunSimulationCanvas}
              handleEvaluateDraft={handleEvaluateDraftCanvas}
              handleCreateBranchNode={handleCreateBranchNodeCanvas}
              handleSaveModifiedSimulatorOutput={handleSaveModifiedSimulatorOutputCanvas}
              theme={theme}
            />

      <ImportTemplateModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        searchQuery={searchTemplateQuery}
        onSearchChange={setSearchTemplateQuery}
        templates={filteredTemplates}
        onSelectTemplate={handleImportTemplateIntoNode}
      />
    </>
  );
}
