import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { PencilLine, FileText, FlaskConical } from 'lucide-react';
import { toast } from '../common/Toaster';
import { confirmDialog } from '../common/ConfirmDialog';
import {
  AttrSlot, GraphEdge, GraphNode, PromptProject, PromptTemplate, PromptVersion, TestCase,
} from '../../types';
import { compileGraph, LAYOUT, findRootNode } from '../../utils/graphCompile';
import { addTemplateAsAttributeNode } from '../../utils/graphMigration';
import { useWorkspace } from '../../context/WorkspaceContext';
import { GraphCanvas } from './GraphCanvas';
import { NodeInspector } from './NodeInspector';
import { CompiledPreviewPanel } from './CompiledPreviewPanel';
import { TestRunPanel } from './TestRunPanel';
import { ImportTemplateModal } from './ImportTemplateModal';
import { VersionDrawer } from './VersionDrawer';

interface GraphWorkspaceProps {
  activeProject: PromptProject; // đã migrate sang v3 ở shell
  setActiveProject: React.Dispatch<React.SetStateAction<PromptProject | null>>;
  setProjects: React.Dispatch<React.SetStateAction<PromptProject[]>>;
  saveProjectState: (proj: PromptProject) => void | Promise<void>;
  theme?: 'light' | 'dark';
  onSaveTemplate?: (template: PromptTemplate) => Promise<void>;
  allAvailableTemplates: PromptTemplate[];
}

type RightTab = 'node' | 'preview' | 'test';

/**
 * Không gian làm việc Prompt Graph v3: canvas React Flow bên trái, panel phải
 * 3 tab (Node đang chọn · Prompt lắp ráp realtime · Chạy thử).
 */
export function GraphWorkspace({
  activeProject, setActiveProject, setProjects, saveProjectState,
  theme = 'dark', onSaveTemplate, allAvailableTemplates,
}: GraphWorkspaceProps) {
  const { activePersona } = useWorkspace();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('preview');
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTemplateQuery, setSearchTemplateQuery] = useState('');
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [versionToCompare, setVersionToCompare] = useState<PromptVersion | null>(null);

  const compiled = useMemo(() => compileGraph(activeProject, testInputs), [activeProject, testInputs]);

  const selectedNode: GraphNode | null = useMemo(
    () => (activeProject.graphNodes || []).find((n) => n.id === selectedNodeId) || null,
    [activeProject.graphNodes, selectedNodeId],
  );

  // Chọn node trên canvas → nhảy sang tab soạn node.
  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    if (id) setRightTab('node');
  };

  // ── Cập nhật state ─────────────────────────────────────────────────────────
  const updateLocal = (proj: PromptProject) => {
    setActiveProject(proj);
    setProjects((prev) => prev.map((p) => (p.id === proj.id ? proj : p)));
  };

  // Gõ nội dung trong Inspector: cập nhật local ngay, commit debounce 1.2s
  // (tránh ghi localStorage/Firestore mỗi phím).
  const pendingRef = useRef<PromptProject | null>(null);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => {
    // Unmount: flush thay đổi đang chờ.
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (pendingRef.current) saveProjectState(pendingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitDebounced = (proj: PromptProject) => {
    updateLocal(proj);
    pendingRef.current = proj;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (pendingRef.current) saveProjectState(pendingRef.current);
      pendingRef.current = null;
    }, 1200);
  };

  const commitNow = (proj: PromptProject) => {
    pendingRef.current = null;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    saveProjectState(proj);
  };

  const handleUpdateNode = (id: string, fields: Partial<GraphNode>) => {
    const graphNodes = (activeProject.graphNodes || []).map((n) => (n.id === id ? { ...n, ...fields } : n));
    commitDebounced({ ...activeProject, graphNodes, updatedAt: new Date().toISOString() });
  };

  // ── Thêm / xoá node ────────────────────────────────────────────────────────
  const freePosition = (): { x: number; y: number } => {
    const nodes = activeProject.graphNodes || [];
    const root = findRootNode(activeProject);
    const x = (root?.position.x ?? LAYOUT.rootX) - LAYOUT.colWidth;
    const maxY = Math.max(LAYOUT.rootY - LAYOUT.attrNodeHeight - LAYOUT.nodeGapY,
      ...nodes.filter((n) => n.kind !== 'root').map((n) => n.position.y));
    return { x, y: maxY + LAYOUT.attrNodeHeight + LAYOUT.nodeGapY };
  };

  const addAttributeNode = (slot: AttrSlot, title: string, content: string, connect = true) => {
    const root = findRootNode(activeProject);
    const node: GraphNode = {
      id: `attr-${Date.now()}`,
      kind: 'attribute',
      attrType: slot,
      title,
      content,
      variables: [],
      position: freePosition(),
      enabled: true,
    };
    const edges: GraphEdge[] = [...(activeProject.edges || [])];
    if (connect && root) {
      edges.push({ id: `edge-${Date.now()}`, source: node.id, target: root.id, targetSlot: slot });
    }
    commitNow({
      ...activeProject,
      graphNodes: [...(activeProject.graphNodes || []), node],
      edges,
      updatedAt: new Date().toISOString(),
    });
    handleSelectNode(node.id);
    return node;
  };

  const handleAddNode = (slot: AttrSlot) => {
    addAttributeNode(slot, `Thuộc tính mới`, '');
  };

  const handleAddFixNode = (title: string, content: string) => {
    addAttributeNode('fix', title, content);
    toast.success(`Đã thêm node Sửa lỗi "${title}" vào Prompt Gốc — bật/tắt nó để so sánh.`);
    setRightTab('test');
  };

  const handleDeleteNode = async (id: string) => {
    const node = (activeProject.graphNodes || []).find((n) => n.id === id);
    if (!node || node.kind === 'root') return;
    if (!(await confirmDialog({ message: `Xoá node "${node.title}" và các dây nối của nó?`, danger: true, confirmText: 'Xoá' }))) return;
    commitNow({
      ...activeProject,
      graphNodes: (activeProject.graphNodes || []).filter((n) => n.id !== id),
      edges: (activeProject.edges || []).filter((e) => e.source !== id && e.target !== id),
      updatedAt: new Date().toISOString(),
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  // ── Template ───────────────────────────────────────────────────────────────
  const handleExportTemplate = (node: GraphNode) => {
    if (!onSaveTemplate) return;
    onSaveTemplate({
      id: `tpl-${Date.now()}`,
      title: node.title,
      description: `Thuộc tính "${node.title}" xuất từ Prompt Graph`,
      blocks: [{
        id: `block-${Date.now()}`,
        type: node.attrType === 'fix' ? 'custom' : node.attrType,
        title: node.title,
        content: node.content,
      }],
      variables: node.variables,
    })
      .then(() => toast.success('Đã lưu node thành Template thư viện!'))
      .catch((err) => toast.error('Không thể xuất template: ' + err.message));
  };

  const filteredTemplates = useMemo(() => {
    if (!searchTemplateQuery) return allAvailableTemplates;
    const q = searchTemplateQuery.toLowerCase();
    return allAvailableTemplates.filter((t) =>
      t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }, [allAvailableTemplates, searchTemplateQuery]);

  const handleImportTemplate = (template: PromptTemplate) => {
    const proj = addTemplateAsAttributeNode(activeProject, template, { connectToRoot: true });
    const added = (proj.graphNodes || [])[(proj.graphNodes || []).length - 1];
    commitNow(proj);
    setIsImportModalOpen(false);
    if (added) handleSelectNode(added.id);
    toast.success(`Đã thêm "${template.title}" vào đồ thị (đã cắm sẵn vào Prompt Gốc).`);
  };

  // ── Phiên bản & lịch sử chạy ───────────────────────────────────────────────
  const handleSaveVersion = () => {
    if (!compiled.finalPrompt.trim()) {
      toast('Prompt trống — chưa có gì để lưu.');
      return;
    }
    const version: PromptVersion = {
      id: `ver-${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: compiled.finalPrompt,
      description: `Snapshot prompt lắp ráp (${(activeProject.graphNodes || []).length} node)`,
    };
    commitNow({
      ...activeProject,
      versions: [version, ...(activeProject.versions || [])].slice(0, 50),
      updatedAt: new Date().toISOString(),
    });
    toast.success('Đã lưu phiên bản prompt hiện tại.');
  };

  const handleRestoreVersion = (ver: PromptVersion) => {
    // v3: prompt là kết quả lắp ráp từ đồ thị nên không thể "tháo ngược" một
    // snapshot text về các node. Khôi phục = sao chép nội dung phiên bản đó.
    navigator.clipboard.writeText(ver.content);
    toast('Đã sao chép prompt của phiên bản này vào clipboard (đồ thị hiện tại giữ nguyên).');
  };

  const handleSaveTestRun = (inputs: Record<string, string>, output: string) => {
    const run: TestCase = {
      id: `run-${Date.now()}`,
      name: `Chạy thử: ${new Date().toLocaleTimeString()}`,
      inputs,
      status: 'success',
      outputText: output,
    };
    commitNow({
      ...activeProject,
      testCases: [run, ...(activeProject.testCases || [])].slice(0, 10),
      updatedAt: new Date().toISOString(),
    });
  };

  const tabs: { key: RightTab; label: string; icon: React.ReactNode }[] = [
    { key: 'node', label: 'Node', icon: <PencilLine size={12} /> },
    { key: 'preview', label: 'Prompt', icon: <FileText size={12} /> },
    { key: 'test', label: 'Chạy thử', icon: <FlaskConical size={12} /> },
  ];

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <ReactFlowProvider>
        <GraphCanvas
          project={activeProject}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={handleSelectNode}
          theme={theme}
          onUpdateLocal={updateLocal}
          onCommit={commitNow}
          onAddNode={handleAddNode}
          onOpenImportTemplate={() => setIsImportModalOpen(true)}
        />
      </ReactFlowProvider>

      {/* Panel phải: 3 tab */}
      <div className="w-[340px] lg:w-[400px] shrink-0 border-l border-line/60 flex flex-col min-h-0 bg-[var(--color-surface,transparent)]">
        <div className="flex items-center p-2 gap-1 border-b border-line/60 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setRightTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                rightTab === t.key
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-900/20'
                  : 'text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {rightTab === 'node' && (
          <NodeInspector
            node={selectedNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onExportTemplate={handleExportTemplate}
            canExport={!!onSaveTemplate}
          />
        )}
        {rightTab === 'preview' && (
          <CompiledPreviewPanel
            compiled={compiled}
            onSaveVersion={handleSaveVersion}
            onOpenVersionDrawer={() => setShowVersionDrawer(true)}
          />
        )}
        {rightTab === 'test' && (
          <TestRunPanel
            project={activeProject}
            inputs={testInputs}
            setInputs={setTestInputs}
            personaInstructions={activePersona?.systemInstructions}
            onAddFixNode={handleAddFixNode}
            onSaveTestRun={handleSaveTestRun}
          />
        )}
      </div>

      <ImportTemplateModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        searchQuery={searchTemplateQuery}
        onSearchChange={setSearchTemplateQuery}
        templates={filteredTemplates}
        onSelectTemplate={handleImportTemplate}
      />

      <VersionDrawer
        isOpen={showVersionDrawer}
        onClose={() => setShowVersionDrawer(false)}
        versions={activeProject.versions || []}
        selectedVersion={versionToCompare}
        onSelectVersion={setVersionToCompare}
        onRestore={handleRestoreVersion}
        currentContent={compiled.finalPrompt}
      />
    </div>
  );
}
