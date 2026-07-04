import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Crown } from 'lucide-react';
import { GraphEdge, GraphNode } from '../../types';
import { ROOT_SLOTS, SLOT_COLORS, SLOT_LABELS } from '../../utils/graphCompile';

export interface RootPromptNodeData {
  node: GraphNode;
  edges: GraphEdge[];
  [key: string]: unknown;
}

/**
 * Prompt Gốc — node trung tâm duy nhất (kiểu Material Output của Blender).
 * Mỗi hàng bên trái là một cổng input đặt tên; node thuộc tính cắm dây vào đây.
 * Thứ tự cổng = thứ tự section trong prompt cuối.
 */
export function RootPromptNode(props: NodeProps) {
  const { node, edges } = props.data as RootPromptNodeData;
  const accent = SLOT_COLORS.task;

  const countFor = (slot: string) =>
    edges.filter((e) => e.target === node.id && e.targetSlot === slot).length;

  return (
    <div
      className="w-72 rounded-2xl border-2 bg-[var(--color-panel,#fff)] dark:bg-slate-900 shadow-xl"
      style={{
        borderColor: props.selected ? accent : `${accent}88`,
        boxShadow: props.selected
          ? `0 0 0 3px ${accent}33, 0 18px 40px -16px ${accent}66`
          : `0 14px 32px -18px ${accent}55`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-2xl px-3.5 py-2.5 border-b border-line/60"
        style={{ background: `${accent}1f` }}
      >
        <Crown size={14} style={{ color: accent }} className="shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-ink truncate">{node.title || 'Prompt Gốc'}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            Prompt cuối được lắp ráp tại đây
          </div>
        </div>
      </div>

      {/* Nội dung lõi rút gọn */}
      <div className="px-3.5 py-2.5 border-b border-line/60">
        <div className="text-[9px] font-extrabold uppercase tracking-wider text-faint mb-1">Nhiệm vụ (nội dung lõi)</div>
        <p className="text-[11px] leading-relaxed text-muted line-clamp-3 whitespace-pre-line break-words">
          {node.content.trim() || <span className="italic text-faint">Chưa có nội dung — bấm node để soạn.</span>}
        </p>
      </div>

      {/* Các cổng input đặt tên */}
      <div className="py-1.5">
        {ROOT_SLOTS.map((slot) => {
          const color = SLOT_COLORS[slot];
          const count = countFor(slot);
          return (
            <div key={slot} className="relative flex items-center gap-2 px-3.5 py-[5px]">
              <Handle
                id={slot}
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900"
                style={{ background: count > 0 ? color : '#94a3b8', position: 'absolute', left: -6, top: '50%' }}
                title={`Cổng "${SLOT_LABELS[slot]}" — kéo dây từ node thuộc tính vào đây`}
              />
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className={`text-[10px] font-bold ${count > 0 ? 'text-ink' : 'text-faint'}`}>
                {SLOT_LABELS[slot]}
              </span>
              {count > 0 && (
                <span
                  className="ml-auto text-[9px] font-extrabold px-1.5 py-px rounded-full"
                  style={{ background: `${color}22`, color }}
                >
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
