import { useState, useRef } from 'react';
import { PromptProject, TreeNode } from '../types';
import { runPlaygroundChatStream, evaluateOutputQualityWithAi, withPersona } from '../services/aiService';
import { compileEvolutionPrompt, markDescendantsStale } from '../utils/chainUtils';

export const useProjectPipeline = (
  activeProject: PromptProject | null,
  setActiveProject: React.Dispatch<React.SetStateAction<PromptProject | null>>,
  setProjects: React.Dispatch<React.SetStateAction<PromptProject[]>>,
  saveActiveProject: (proj: PromptProject) => Promise<void>,
  user: any,
  personaInstructions?: string
) => {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'local' | 'saving' | 'error'>('local');
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'completed' | 'error' | 'paused'>('idle');
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [pipelineCurrentNodeId, setPipelineCurrentNodeId] = useState<string | null>(null);
  const [pipelineNodeResponse, setPipelineNodeResponse] = useState('');
  const [pipelineInputs, setPipelineInputs] = useState<Record<string, string>>({});
  
  // Pipeline Routing config
  const [pipelineRoutingMode, setPipelineRoutingMode] = useState<'ai' | 'keyword' | 'manual'>('ai');
  const [pipelineKeyword, setPipelineKeyword] = useState('effective');

  // Simulator configurations
  const [simProvider, setSimProvider] = useState<'gemini' | 'openai'>('gemini');
  const [simModel, setSimModel] = useState('gemini-2.5-flash');
  const [simTemp, setSimTemp] = useState(0.7);

  const pipelineRunningRef = useRef(false);

  const addPipelineLog = (msg: string) => {
    setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleStopPipeline = () => {
    pipelineRunningRef.current = false;
    setPipelineStatus('idle');
    setPipelineCurrentNodeId(null);
    addPipelineLog("Đã dừng thực thi chuỗi.");
  };

  const executeNodeInPipeline = async (nodeId: string, currentProj: PromptProject) => {
    if (!pipelineRunningRef.current) return;

    const node = currentProj.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setPipelineCurrentNodeId(nodeId);
    
    const runningNodes = currentProj.nodes.map(n => 
      n.id === nodeId ? { ...n, status: 'running' as const } : n
    );
    const runningProj = { ...currentProj, nodes: runningNodes };
    setProjects(prev => prev.map(p => p.id === currentProj.id ? runningProj : p));
    setActiveProject(runningProj);

    addPipelineLog(`Đang thực thi node: "${node.title}"...`);

    const compiledPrompt = compileEvolutionPrompt(node, runningProj, pipelineInputs);
    
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
    setPipelineNodeResponse('');

    try {
      await runPlaygroundChatStream(
        simProvider,
        withPersona(systemInstruction, personaInstructions),
        [{ role: 'user', content: compiledPrompt }],
        {
          apiKey,
          model: simModel,
          temperature: simTemp
        },
        (chunk) => {
          accumulatedOutput += chunk;
          setPipelineNodeResponse(accumulatedOutput);
        }
      );

      if (!pipelineRunningRef.current) return;

      addPipelineLog(`Hoàn thành chạy node: "${node.title}".`);
      
      let successNodes = runningProj.nodes.map(n =>
        n.id === nodeId ? { ...n, output: accumulatedOutput, status: 'success' as const, isStale: false } : n
      );
      successNodes = markDescendantsStale(successNodes, nodeId);
      const nextProj = { ...runningProj, nodes: successNodes, updatedAt: new Date().toISOString() };
      
      await saveActiveProject(nextProj);

      const children = nextProj.nodes.filter(n => n.parentId === nodeId);
      if (children.length === 0) {
        addPipelineLog(`Đã chạy đến node cuối cùng của chuỗi: "${node.title}".`);
        setPipelineStatus('completed');
        addPipelineLog("Chúc mừng! Toàn bộ chuỗi prompt đã thực thi hoàn tất.");
        setPipelineCurrentNodeId(null);
        return;
      }

      const hasBranches = children.some(c => c.branchType === 'success' || c.branchType === 'failure');
      if (hasBranches) {
        addPipelineLog(`Tìm thấy nhánh rẽ của node "${node.title}". Đang kiểm tra định tuyến...`);
        let routeDecision: 'success' | 'failure' = 'success';

        if (pipelineRoutingMode === 'ai') {
          addPipelineLog("AI đang tiến hành thẩm định tự động dựa trên quy chuẩn của dự án...");
          const evalResult = await evaluateOutputQualityWithAi(
            accumulatedOutput,
            nextProj.globalEvalCriteria || [],
            { apiKey: useSystemKey ? undefined : customKey, model: 'gemini-2.5-flash' }
          );
          routeDecision = evalResult === 'effective' ? 'success' : 'failure';
          addPipelineLog(`[AI Auto-Router]: Kết quả đánh giá là "${evalResult === 'effective' ? 'HIỆU QUẢ 👍' : 'CHƯA ĐẠT 👎'}". Tự động định tuyến sang nhánh ${routeDecision === 'success' ? 'Nâng cao (Success)' : 'Sửa lỗi (Failure)'}.`);
        } else if (pipelineRoutingMode === 'keyword') {
          const hasKeyword = accumulatedOutput.toLowerCase().includes(pipelineKeyword.toLowerCase());
          routeDecision = hasKeyword ? 'success' : 'failure';
          addPipelineLog(`[Keyword-Router]: Kiểm tra từ khóa "${pipelineKeyword}" -> ${hasKeyword ? 'Tìm thấy' : 'Không tìm thấy'}. Định tuyến sang nhánh ${routeDecision === 'success' ? 'Nâng cao (Success)' : 'Sửa lỗi (Failure)'}.`);
        } else {
          addPipelineLog(`[Manual-Router]: Tạm dừng chuỗi tại "${node.title}". Vui lòng chọn nhánh đi tiếp trên bảng điều khiển.`);
          setPipelineStatus('paused');
          return;
        }

        const nextBranchNode = children.find(c => c.branchType === routeDecision);
        if (nextBranchNode) {
          addPipelineLog(`Đang chuyển sang nhánh tiếp theo: "${nextBranchNode.title}" (${routeDecision}).`);
          await executeNodeInPipeline(nextBranchNode.id, nextProj);
        } else {
          addPipelineLog(`Lưu ý: Không cấu hình node con cho nhánh "${routeDecision === 'success' ? 'Thành công (Success)' : 'Thất bại (Failure)'}". Dừng chuỗi.`);
          setPipelineStatus('completed');
          setPipelineCurrentNodeId(null);
        }
      } else {
        // Linear progression - usually just one child
        const nextNode = children[0];
        addPipelineLog(`Đang chuyển sang node tiếp theo: "${nextNode.title}".`);
        await executeNodeInPipeline(nextNode.id, nextProj);
      }
    } catch (err: any) {
      console.error(err);
      addPipelineLog(`Lỗi tại node "${node.title}": ${err.message || err}`);
      
      const errorNodes = runningProj.nodes.map(n => 
        n.id === nodeId ? { ...n, status: 'error' as const } : n
      );
      const errProj = { ...runningProj, nodes: errorNodes, updatedAt: new Date().toISOString() };
      await saveActiveProject(errProj);
      
      setPipelineStatus('error');
      setPipelineCurrentNodeId(null);
    }
  };

  const startPipelineExecution = async () => {
    if (!activeProject) return;

    const resetNodes = activeProject.nodes.map(n => ({
      ...n,
      status: 'idle' as const,
      output: '',
      isStale: false
    }));
    const freshProj = { ...activeProject, nodes: resetNodes };
    
    setProjects(prev => prev.map(p => p.id === activeProject.id ? freshProj : p));
    setActiveProject(freshProj);
    
    setPipelineStatus('running');
    setPipelineLogs([]);
    pipelineRunningRef.current = true;
    setPipelineCurrentNodeId(null);
    setPipelineNodeResponse('');

    addPipelineLog(`Bắt đầu chạy chuỗi prompt tự động cho dự án: ${activeProject.name}`);

    const rootNode = freshProj.nodes.find(n => n.parentId === null);
    if (!rootNode) {
      setPipelineStatus('error');
      addPipelineLog("Lỗi: Không tìm thấy Node Gốc của dự án.");
      return;
    }

    try {
      setSyncStatus('saving');
      await executeNodeInPipeline(rootNode.id, freshProj);
      if (user) setSyncStatus('synced');
      else setSyncStatus('local');
    } catch (err: any) {
      console.error(err);
      setPipelineStatus('error');
      addPipelineLog(`Lỗi trong quá trình chạy: ${err.message || err}`);
      setSyncStatus('error');
    }
  };

  const handleResumePipelineManual = async (decision: 'success' | 'failure') => {
    if (!activeProject || !pipelineCurrentNodeId) return;

    addPipelineLog(`[Quyết định thủ công]: Tiếp tục chạy với nhánh "${decision === 'success' ? 'Thành công (Success)' : 'Thất bại (Failure)'}".`);
    setPipelineStatus('running');
    
    const children = activeProject.nodes.filter(n => n.parentId === pipelineCurrentNodeId);
    const targetNode = children.find(c => c.branchType === decision);

    if (targetNode) {
      try {
        await executeNodeInPipeline(targetNode.id, activeProject);
      } catch (err: any) {
        setPipelineStatus('error');
        addPipelineLog(`Lỗi khi tiếp tục chạy nhánh: ${err.message || err}`);
      }
    } else {
      addPipelineLog(`Không tìm thấy Node cấu hình cho nhánh: "${decision}". Thực thi hoàn tất.`);
      setPipelineStatus('completed');
      setPipelineCurrentNodeId(null);
    }
  };

  return {
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
    handleResumePipelineManual,
  };
};
