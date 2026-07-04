import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Eye, EyeOff, Variable } from 'lucide-react';
import { GraphNode } from '../../types';
import { SLOT_COLORS, SLOT_LABELS } from '../../utils/graphCompile';

export interface AttributeNodeData {
  node: GraphNode;
  onToggleEnabled: (id: string) => void;
  [key: string]: unknown;
}

/**
 * Node thuộc tính trên canvas (kiểu Blender): 1 cổng output bên phải cắm vào
 * Prompt Gốc / node khác, 1 cổng "Ghép thêm" bên trái để gom node con.
 * Công tắc mắt = mute/unmute (loại khỏi prompt compile ngay lập tức).
 */
export function AttributeNode(props: NodeProps) {
  const { node, onToggleEnabled } = props.data as AttributeNodeData;
  const color = SLOT_COLORS[node.attrType] || SLOT_COLORS.custom;
  const muted = !node.enabled;

  return (
    <div
      className="w-64 rounded-2xl border bg-[var(--color-panel,#fff)] dark:bg-slate-900 shadow-md transition-all duration-150"
      style={{
        borderColor: props.selected ? color : muted ? 'var(--color-line, #e2e8f0)' : `${color}66`,
        boxShadow: props.selected ? `0 0 0 2px ${color}44, 0 10px 24px -10px ${color}55` : undefined,
        opacity: muted ? 0.55 : 1,
      }}
    >
      {/* Cổng Ghép thêm (input) */}
      <Handle
        id="append"
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900"
        style={{ background: '#94a3b8' }}
        title="Ghép thêm: cắm node khác vào đây để nối tiếp nội dung"
      />

      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 rounded-t-2xl px-3 py-2 border-b border-line/60"
        style={{ background: `${color}${muted ? '0d' : '1a'}` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: color }} />
          <span
            className="text-[9px] font-extrabold uppercase tracking-wider shrink-0"
            style={{ color }}
          >
            {SLOT_LABELS[node.attrType]}
          </span>
          <span className="text-xs font-bold text-ink truncate" title={node.title}>
            {node.title}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleEnabled(node.id); }}
          className="nodrag shrink-0 rounded-md p-1 text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
          title={muted ? 'Đang TẮT — bấm để đưa lại vào prompt' : 'Đang BẬT — bấm để tạm loại khỏi prompt'}
        >
          {muted ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>

      {/* Nội dung rút gọn */}
      <div className="px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-muted line-clamp-3 whitespace-pre-line break-words">
          {node.content.trim() || <span className="italic text-faint">Chưa có nội dung — bấm để soạn.</span>}
        </p>
        {(node.variables?.length || 0) > 0 && (
          <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-faint">
            <Variable size={10} />
            {node.variables.map((v) => `{{${v.name}}}`).join(' · ')}
          </div>
        )}
      </div>

      {/* Cổng output */}
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900"
        style={{ background: color }}
        title="Kéo dây từ đây cắm vào một cổng của Prompt Gốc"
      />
    </div>
  );
}
