import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Panel,
  Connection, Edge as RFEdge, Node as RFNode, NodeChange, MarkerType,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from '../common/Toaster';
import { AttrSlot, GraphEdge, GraphNode, PromptProject } from '../../types';
import { ROOT_SLOTS, SLOT_COLORS, computeGraphLayout, findRootNode, wouldCreateCycle } from '../../utils/graphCompile';
import { AttributeNode } from './AttributeNode';
import { RootPromptNode } from './RootPromptNode';
import { NodePalette } from './NodePalette';

const nodeTypes = { rootNode: RootPromptNode, attrNode: AttributeNode };

interface GraphCanvasProps {
  project: PromptProject; // đã đảm bảo v3
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  theme?: 'light' | 'dark';
  /** Cập nhật in-memory (khi đang kéo) — KHÔNG ghi localStorage/Firestore. */
  onUpdateLocal: (proj: PromptProject) => void;
  /** Cập nhật + lưu bền (thả kéo, nối dây, thêm/xoá node...). */
  onCommit: (proj: PromptProject) => void;
  onAddNode: (slot: AttrSlot) => void;
  onOpenImportTemplate: () => void;
}

/**
 * Canvas Prompt Graph trên React Flow: kéo dây socket-to-socket có chặn chu
 * trình, minimap, fit-view, auto-layout — thay toàn bộ canvas tự viết cũ.
 */
export function GraphCanvas({
  project, selectedNodeId, setSelectedNodeId, theme = 'dark',
  onUpdateLocal, onCommit, onAddNode, onOpenImportTemplate,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const graphNodes = project.graphNodes || [];
  const edges = project.edges || [];

  const handleToggleEnabled = useCallback((id: string) => {
    const updated = graphNodes.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n));
    onCommit({ ...project, graphNodes: updated, updatedAt: new Date().toISOString() });
  }, [project, graphNodes, onCommit]);

  // ── Chuyển đổi dữ liệu project → React Flow ────────────────────────────────
  const rfNodes: RFNode[] = useMemo(() => graphNodes.map((n) => ({
    id: n.id,
    type: n.kind === 'root' ? 'rootNode' : 'attrNode',
    position: n.position,
    selected: n.id === selectedNodeId,
    deletable: n.kind !== 'root',
    data: n.kind === 'root'
      ? { node: n, edges }
      : { node: n, onToggleEnabled: handleToggleEnabled },
  })), [graphNodes, edges, selectedNodeId, handleToggleEnabled]);

  const nodeById = useMemo(() => new Map(graphNodes.map((n) => [n.id, n] as const)), [graphNodes]);

  const rfEdges: RFEdge[] = useMemo(() => edges.map((e) => {
    const source = nodeById.get(e.source);
    const color = source ? (SLOT_COLORS[source.attrType] || SLOT_COLORS.custom) : '#94a3b8';
    const muted = source ? !source.enabled : false;
    return {
      id: e.id,
      source: e.source,
      sourceHandle: 'out',
      target: e.target,
      targetHandle: e.targetSlot,
      style: {
        stroke: color,
        strokeWidth: 2,
        opacity: muted ? 0.3 : 0.9,
        strokeDasharray: muted ? '6 4' : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    };
  }), [edges, nodeById]);

  // ── Tương tác ──────────────────────────────────────────────────────────────
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    let positions: Record<string, { x: number; y: number }> | null = null;
    changes.forEach((ch) => {
      if (ch.type === 'position' && ch.position) {
        positions = positions || {};
        positions[ch.id] = ch.position;
      } else if (ch.type === 'select') {
        if (ch.selected) setSelectedNodeId(ch.id);
        else if (selectedNodeId === ch.id) setSelectedNodeId(null);
      }
    });
    if (positions) {
      const posMap = positions;
      const updated = graphNodes.map((n) => (posMap[n.id] ? { ...n, position: posMap[n.id] } : n));
      onUpdateLocal({ ...project, graphNodes: updated });
    }
  }, [graphNodes, project, onUpdateLocal, selectedNodeId, setSelectedNodeId]);

  // Lưu theo vị trí cuối do React Flow trả về (state cha có thể trễ 1 frame).
  const handleNodeDragStop = useCallback((_e: unknown, _node: RFNode, draggedNodes: RFNode[]) => {
    const finalPos = new Map(draggedNodes.map((n) => [n.id, n.position] as const));
    const updated = graphNodes.map((n) => {
      const pos = finalPos.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
    onCommit({ ...project, graphNodes: updated });
  }, [graphNodes, project, onCommit]);

  const isValidConnection = useCallback((conn: RFEdge | Connection): boolean => {
    if (!conn.source || !conn.target) return false;
    if (conn.source === conn.target) return false;
    const targetNode = nodeById.get(conn.target);
    if (!targetNode) return false;
    // Cổng hợp lệ: root nhận các slot đặt tên; node thuộc tính chỉ nhận 'append'.
    const slot = conn.targetHandle as string | null | undefined;
    if (targetNode.kind === 'root' && !ROOT_SLOTS.includes(slot as AttrSlot)) return false;
    if (targetNode.kind === 'attribute' && slot !== 'append') return false;
    if (wouldCreateCycle(edges, conn.source, conn.target)) return false;
    return true;
  }, [nodeById, edges]);

  const handleConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || !conn.targetHandle) return;
    if (wouldCreateCycle(edges, conn.source, conn.target)) {
      toast.error('Không thể nối: sẽ tạo vòng lặp trong đồ thị.');
      return;
    }
    const targetSlot = conn.targetHandle as GraphEdge['targetSlot'];
    const dup = edges.some((e) => e.source === conn.source && e.target === conn.target && e.targetSlot === targetSlot);
    if (dup) return;
    const newEdge: GraphEdge = {
      id: `edge-${Date.now()}`,
      source: conn.source,
      target: conn.target,
      targetSlot,
    };
    onCommit({ ...project, edges: [...edges, newEdge], updatedAt: new Date().toISOString() });
  }, [edges, project, onCommit]);

  const handleNodesDelete = useCallback((deleted: RFNode[]) => {
    const ids = new Set(deleted.map((n) => n.id).filter((id) => nodeById.get(id)?.kind !== 'root'));
    if (ids.size === 0) return;
    const remainingNodes = graphNodes.filter((n) => !ids.has(n.id));
    const remainingEdges = edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
    if (selectedNodeId && ids.has(selectedNodeId)) setSelectedNodeId(null);
    onCommit({ ...project, graphNodes: remainingNodes, edges: remainingEdges, updatedAt: new Date().toISOString() });
  }, [graphNodes, edges, project, nodeById, selectedNodeId, setSelectedNodeId, onCommit]);

  const handleEdgesDelete = useCallback((deleted: RFEdge[]) => {
    const ids = new Set(deleted.map((e) => e.id));
    if (ids.size === 0) return;
    onCommit({ ...project, edges: edges.filter((e) => !ids.has(e.id)), updatedAt: new Date().toISOString() });
  }, [edges, project, onCommit]);

  const handleAutoLayout = useCallback(() => {
    const positions = computeGraphLayout(graphNodes, edges);
    const updated = graphNodes.map((n) => {
      const pos = positions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
    onCommit({ ...project, graphNodes: updated, updatedAt: new Date().toISOString() });
    // Đợi state áp dụng rồi fit khung nhìn.
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60);
  }, [graphNodes, edges, project, onCommit, fitView]);

  const hasRoot = !!findRootNode(project);

  return (
    <div className="flex-1 min-w-0 h-full relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        colorMode={theme === 'dark' ? 'dark' : 'light'}
        onNodesChange={handleNodesChange}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onPaneClick={() => setSelectedNodeId(null)}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.15}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'default' }}
        className="!bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          nodeColor={(n) => {
            const gn = nodeById.get(n.id);
            if (!gn) return '#94a3b8';
            return gn.kind === 'root' ? SLOT_COLORS.task : (SLOT_COLORS[gn.attrType] || SLOT_COLORS.custom);
          }}
          className="!w-40 !h-28 rounded-xl overflow-hidden border border-line/60"
        />
        <Panel position="top-left">
          <NodePalette
            onAddNode={onAddNode}
            onOpenImportTemplate={onOpenImportTemplate}
            onAutoLayout={handleAutoLayout}
            disabled={!hasRoot}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}
