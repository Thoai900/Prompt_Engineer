import React from 'react';
import { NodeCard } from './NodeCard';
import { PromptProject } from '../../types';

interface CanvasViewProps {
  activeProject: PromptProject;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  theme?: 'light' | 'dark';
  canvasOffset: { x: number; y: number };
  zoom: number;
  startPanning: (e: React.MouseEvent) => void;
  handleWheel: (e: React.WheelEvent) => void;
  startDragNode: (e: React.MouseEvent, id: string) => void;
  handleOpenSimulator: (id: string) => void;
  handleDeleteNode: (id: string) => void;
  handleAddChildNode: (id: string) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  activeProject,
  selectedNodeId,
  setSelectedNodeId,
  theme = 'dark',
  canvasOffset,
  zoom,
  startPanning,
  handleWheel,
  startDragNode,
  handleOpenSimulator,
  handleDeleteNode,
  handleAddChildNode,
  canvasRef,
}) => {
  return (
    <div 
      ref={canvasRef}
      onMouseDown={startPanning}
      onWheel={handleWheel}
      className="canvas-bg relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] bg-[size:20px_20px]"
    >
      {/* SVG line connections */}
      <svg 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{ 
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '4000px',
          height: '4000px'
        }}
      >
        {activeProject.nodes.map(node => {
          if (!node.parentId) return null;
          const parent = activeProject.nodes.find(n => n.id === node.parentId);
          if (!parent) return null;

          const isVertical = Math.abs(node.position.y - parent.position.y) > Math.abs(node.position.x - parent.position.x);
          
          let startX, startY, endX, endY, pathD, circleX, circleY;
          if (isVertical) {
            startX = parent.position.x + 128;
            startY = parent.position.y + 120;
            endX = node.position.x + 128;
            endY = node.position.y;
            const controlY = startY + (endY - startY) / 2;
            pathD = `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
            circleX = (startX + endX) / 2;
            circleY = controlY;
          } else {
            startX = parent.position.x + 256;
            startY = parent.position.y + 60;
            endX = node.position.x;
            endY = node.position.y + 60;
            const controlX = startX + (endX - startX) / 2;
            pathD = `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
            circleX = controlX;
            circleY = (startY + endY) / 2;
          }

          return (
            <g key={`path-${node.id}`}>
              <path
                d={pathD}
                fill="none"
                stroke={
                  selectedNodeId === node.id
                    ? '#14b8a6'
                    : node.isStale
                      ? '#f59e0b'
                      : node.branchType === 'success'
                        ? '#10b981'
                        : node.branchType === 'failure'
                          ? '#f97316'
                          : theme === 'dark'
                            ? '#334155'
                            : '#cbd5e1'
                }
                strokeWidth={selectedNodeId === node.id ? 2.5 : 2}
                strokeDasharray={node.isStale ? '6 4' : undefined}
                className="transition-colors duration-150"
              />
              <circle
                cx={circleX}
                cy={circleY}
                r={3}
                fill={
                  selectedNodeId === node.id
                    ? '#14b8a6'
                    : node.isStale
                      ? '#f59e0b'
                      : node.branchType === 'success'
                        ? '#10b981'
                        : node.branchType === 'failure'
                          ? '#f97316'
                          : theme === 'dark'
                            ? '#475569'
                            : '#94a3b8'
                }
              />
            </g>
          );
        })}
      </svg>

      {/* Node absolute containers */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{ 
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {activeProject.nodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            theme={theme}
            startDragNode={startDragNode}
            handleOpenSimulator={handleOpenSimulator}
            handleDeleteNode={handleDeleteNode}
            handleAddChildNode={handleAddChildNode}
          />
        ))}
      </div>
    </div>
  );
};
