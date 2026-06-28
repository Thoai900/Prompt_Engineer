import { toast } from '../common/Toaster';
import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Database, ArrowRight, Play, CheckCircle } from 'lucide-react';
import { TreeNode, PromptProject, PromptTemplate, PromptBlock, PromptVariable, TabType } from '../../types';
import { collection, doc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface AddToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  template: { title: string; description?: string; blocks: PromptBlock[]; variables?: PromptVariable[] } | null;
  onNavigateToTab: (tab: TabType) => void;
}

export default function AddToProjectModal({
  isOpen,
  onClose,
  user,
  template,
  onNavigateToTab
}: AddToProjectModalProps) {
  const [projects, setProjects] = useState<PromptProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string>('');
  
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  // Tải danh sách dự án
  useEffect(() => {
    if (!isOpen) return;

    // Load từ local storage trước
    let localProjects: PromptProject[] = [];
    try {
      const saved = localStorage.getItem('mentor_ai_prompt_projects');
      if (saved) {
        localProjects = JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }

    if (localProjects.length === 0) {
      // Dùng mặc định nếu trống
      localProjects = [];
    }

    // Load từ Firestore nếu đã đăng nhập
    if (user) {
      const loadFirestore = async () => {
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
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
              userId: data.userId
            });
          });

          // Trộn dự án
          const merged = [...dbProjects];
          localProjects.forEach(lp => {
            if (!merged.some(mp => mp.id === lp.id)) {
              merged.push(lp);
            }
          });

          setProjects(merged);
          if (merged.length > 0) {
            setSelectedProjectId(merged[0].id);
            const firstNodeId = merged[0].nodes[0]?.id || '';
            setSelectedParentNodeId(firstNodeId);
          } else {
            setIsCreatingNew(true);
          }
        } catch (err) {
          console.error(err);
          setProjects(localProjects);
          if (localProjects.length > 0) {
            setSelectedProjectId(localProjects[0].id);
            setSelectedParentNodeId(localProjects[0].nodes[0]?.id || '');
          } else {
            setIsCreatingNew(true);
          }
        }
      };
      loadFirestore();
    } else {
      setProjects(localProjects);
      if (localProjects.length > 0) {
        setSelectedProjectId(localProjects[0].id);
        setSelectedParentNodeId(localProjects[0].nodes[0]?.id || '');
      } else {
        setIsCreatingNew(true);
      }
    }
  }, [isOpen, user]);

  const activeProject = projects.find(p => p.id === selectedProjectId) || null;

  // Cập nhật node cha mặc định khi đổi dự án
  useEffect(() => {
    if (activeProject) {
      setSelectedParentNodeId(activeProject.nodes[0]?.id || '');
    } else {
      setSelectedParentNodeId('');
    }
  }, [selectedProjectId, activeProject]);

  if (!isOpen || !template) return null;

  const handleConfirm = async () => {
    let targetProject: PromptProject;
    let newNodes: TreeNode[] = [];
    const newId = `node-${Date.now()}`;

    if (isCreatingNew) {
      if (!newProjName.trim()) {
        toast('Vui lòng điền tên dự án mới!');
        return;
      }
      
      const newProjId = `proj-${Date.now()}`;
      const rootNode: TreeNode = {
        id: newId,
        parentId: null,
        title: `1. ${template.title}`,
        description: template.description || 'Node khởi đầu của chuỗi prompt.',
        status: 'idle',
        position: { x: 150, y: 200 },
        blocks: template.blocks.map(b => ({ ...b })),
        variables: template.variables ? template.variables.map(v => ({ ...v })) : []
      };

      targetProject = {
        id: newProjId,
        name: newProjName,
        description: newProjDesc || 'Dự án chuỗi prompt.',
        globalEvalCriteria: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: [rootNode]
      };
      
      newNodes = [rootNode];
    } else {
      if (!activeProject) return;

      const parentNode = activeProject.nodes.find(n => n.id === selectedParentNodeId) || null;
      const siblingCount = activeProject.nodes.filter(n => n.parentId === selectedParentNodeId).length;

      // Tính vị trí node mới
      const posX = parentNode ? parentNode.position.x + 280 : 150;
      const posY = parentNode ? parentNode.position.y + (siblingCount * 140) : 200;

      const newNode: TreeNode = {
        id: newId,
        parentId: selectedParentNodeId || null,
        title: `${parentNode ? parentNode.title.split('.')[0] || 'Node' : 'Node'}.${siblingCount + 1} ${template.title}`,
        description: template.description || 'Mô tả bước này',
        status: 'idle',
        position: { x: posX, y: posY },
        blocks: template.blocks.map(b => ({ ...b })),
        variables: template.variables ? template.variables.map(v => ({ ...v })) : []
      };

      targetProject = {
        ...activeProject,
        nodes: [...activeProject.nodes, newNode],
        updatedAt: new Date().toISOString()
      };
      
      newNodes = targetProject.nodes;
    }

    // 1. Lưu LocalStorage danh sách
    const updatedProjects = projects.some(p => p.id === targetProject.id)
      ? projects.map(p => p.id === targetProject.id ? targetProject : p)
      : [targetProject, ...projects];
    
    localStorage.setItem('mentor_ai_prompt_projects', JSON.stringify(updatedProjects));

    // 2. Lưu Firestore nếu đăng nhập
    if (user) {
      try {
        const docRef = doc(db, 'projects', targetProject.id);
        const payload = {
          id: targetProject.id,
          userId: user.uid,
          name: targetProject.name,
          description: targetProject.description || '',
          globalEvalCriteria: targetProject.globalEvalCriteria || [],
          nodes: targetProject.nodes,
          createdAt: isCreatingNew ? new Date().toISOString() : targetProject.createdAt,
          updatedAt: new Date().toISOString()
        };
        await setDoc(docRef, payload);
      } catch (err) {
        console.error('Firestore save failed:', err);
      }
    }

    // 3. Đánh dấu active project và selected node cho tab Project Chain đọc
    localStorage.setItem('mentor_ai_active_project_id', targetProject.id);
    localStorage.setItem('mentor_ai_selected_node_id', newId);

    toast(`Đã thêm thành công prompt vào dự án "${targetProject.name}"!`);
    onClose();
    
    // 4. Chuyển hướng
    onNavigateToTab('projectchain');
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
      />
      
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[85vh] text-slate-800 dark:text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <FolderPlus size={16} className="text-cyan-500" />
            Thêm Prompt vào Project Chain
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Thông tin Prompt đang thêm */}
        <div className="my-3 rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-xs border border-slate-200/50 dark:border-slate-850">
          <span className="font-bold text-slate-900 dark:text-white">Prompt đã chọn:</span>
          <p className="mt-1 text-slate-500 dark:text-slate-400 font-semibold">{template.title}</p>
        </div>

        {/* Tab chọn Dự án có sẵn vs Tạo mới */}
        <div className="flex gap-4 border-b border-slate-100 mb-4 text-xs font-bold text-slate-400">
          <button 
            type="button"
            onClick={() => setIsCreatingNew(false)}
            disabled={projects.length === 0}
            className={`pb-2 transition-colors relative cursor-pointer ${!isCreatingNew ? 'text-cyan-600' : 'hover:text-slate-700 disabled:opacity-40'}`}
          >
            Dự án hiện có
            {!isCreatingNew && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-cyan-500 rounded-t-full"></span>}
          </button>
          <button 
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className={`pb-2 transition-colors relative cursor-pointer ${isCreatingNew ? 'text-cyan-600' : 'hover:text-slate-700'}`}
          >
            Tạo dự án mới
            {isCreatingNew && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-cyan-500 rounded-t-full"></span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {isCreatingNew ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Tên dự án mới</label>
                <input
                  type="text"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350"
                  placeholder="Ví dụ: Quy trình viết bài học sinh học..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Mô tả dự án</label>
                <textarea
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350 resize-none"
                  placeholder="Mô tả các bước của quy trình..."
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Chọn dự án</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350 cursor-pointer"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {activeProject && (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Chọn Node cha liên kết trực tiếp</label>
                  <p className="text-[10px] text-slate-400 mb-1">Node mới sẽ được gắn bên phải của Node cha đã chọn.</p>
                  <select
                    value={selectedParentNodeId}
                    onChange={(e) => setSelectedParentNodeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350 cursor-pointer"
                  >
                    {activeProject.nodes.map(node => (
                      <option key={node.id} value={node.id}>
                        {node.title} ({node.blocks.length} khối)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-4 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-550 rounded-xl cursor-pointer font-bold"
          >
            Hủy
          </button>
          <button 
            onClick={handleConfirm}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl cursor-pointer font-bold shadow-md shadow-cyan-900/10 flex items-center gap-1 active:scale-95 transition-all"
          >
            Xác nhận
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
