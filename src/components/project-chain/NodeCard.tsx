import React from 'react';
import { Sparkles, Wrench, Play, Trash2, Plus, Check } from 'lucide-react';
import { TreeNode } from '../../types';

interface NodeCardProps {
  node: TreeNode;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  theme?: 'light' | 'dark';
  startDragNode: (e: React.MouseEvent, id: string) => void;
  handleOpenSimulator: (id: string) => void;
  handleDeleteNode: (id: string) => void;
  handleAddChildNode: (id: string) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  selectedNodeId,
  setSelectedNodeId,
  theme = 'dark',
  startDragNode,
  handleOpenSimulator,
  handleDeleteNode,
  handleAddChildNode,
}) => {
  const isSelected = selectedNodeId === node.id;

  return (
    <div
      className="pointer-events-auto absolute flex w-64 flex-col rounded-2xl border bg-white dark:bg-slate-900 shadow-md hover:shadow-lg transition-all duration-200"
      style={{ 
        left: node.position.x, 
        top: node.position.y,
        borderColor: isSelected 
          ? '#06b6d4' 
          : node.status === 'running'
            ? '#06b6d4'
            : node.status === 'drafting'
              ? '#a855f7' // purple border for drafting
              : node.status === 'drafted'
                ? '#6366f1' // indigo border for drafted
                : node.branchType === 'success'
                  ? '#10b981'
                  : node.branchType === 'failure'
                    ? '#f97316'
                    : node.status === 'success' 
                      ? '#10b981' 
                      : node.status === 'error' 
                        ? '#f43f5e' 
                        : theme === 'dark' ? '#1e293b' : '#e2e8f0',
        boxShadow: isSelected 
          ? '0 10px 25px -5px rgba(6, 182, 212, 0.15), 0 8px 10px -6px rgba(6, 182, 212, 0.15)' 
          : 'none'
      }}
    >
      {/* Header Node - Drag Handle */}
      <div 
        onMouseDown={(e) => {
          if (node.parentId !== null) {
            startDragNode(e, node.id);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedNodeId(node.id);
        }}
        className={`flex ${node.parentId === null ? 'cursor-default' : 'cursor-move'} items-center justify-between border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-800/50`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {node.branchType === 'success' ? (
            <Sparkles size={13} className="text-emerald-500 shrink-0" />
          ) : node.branchType === 'failure' ? (
            <Wrench size={13} className="text-orange-500 shrink-0 animate-pulse" />
          ) : (
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              node.status === 'success' 
                ? 'bg-emerald-500' 
                : node.status === 'running' 
                  ? 'bg-cyan-500 animate-pulse'
                  : node.status === 'drafting'
                    ? 'bg-purple-500 animate-pulse'
                    : node.status === 'drafted'
                      ? 'bg-indigo-500'
                      : node.status === 'error'
                        ? 'bg-rose-500'
                        : 'bg-slate-300 dark:bg-slate-600'
            }`} />
          )}
          <span className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate select-none">
            {node.title}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenSimulator(node.id);
            }}
            className="rounded-md p-1 hover:bg-slate-100 text-slate-500 hover:text-emerald-550 dark:hover:bg-slate-805 cursor-pointer transition-colors"
            title="Chạy mô phỏng Node này"
          >
            <Play size={12} fill="currentColor" className="text-emerald-500" />
          </button>
          {node.parentId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node.id);
              }}
              className="rounded-md p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-550 dark:hover:bg-slate-805 cursor-pointer transition-colors"
              title="Xóa Node này"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Summary content */}
      <div 
        onClick={() => setSelectedNodeId(node.id)}
        className="flex-1 cursor-pointer p-3.5 text-xs text-slate-500 dark:text-slate-400"
      >
        <p className="line-clamp-2 leading-relaxed mb-2.5 select-none text-[11px]">
          {node.description || 'Không có mô tả cho node này.'}
        </p>
        
        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 pt-2 dark:border-slate-800/30 text-[10px]">
          <span className="font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded">
            {node.blocks ? node.blocks.length : 0} khối Prompt
          </span>
          
          {node.output ? (
            <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              <Check size={11} /> Đã có đầu ra
            </span>
          ) : (
            <span className="text-slate-400 italic">Chưa chạy</span>
          )}
        </div>
      </div>

      {/* Plus button to add children */}
      <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddChildNode(node.id);
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-cyan-400 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Tạo nhánh con tiếp theo"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Left connection dot */}
      {node.parentId && (
        <div className="absolute left-0 top-1/2 -translate-x-1.5 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-white bg-slate-400 dark:border-slate-900 dark:bg-slate-600" />
      )}
    </div>
  );
};
