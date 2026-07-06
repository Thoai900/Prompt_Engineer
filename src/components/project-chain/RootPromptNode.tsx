import React, { useState } from 'react';
import { Handle, Position, NodeProps, useConnection } from '@xyflow/react';
import { Crown, ChevronDown, ChevronUp } from 'lucide-react';
import { GraphEdge, GraphNode } from '../../types';
import { ROOT_SLOTS, SLOT_COLORS, SLOT_LABELS } from '../../utils/graphCompile';

export interface RootPromptNodeData {
  node: GraphNode;
  edges: GraphEdge[];
  [key: string]: unknown;
}

/**
 * Prompt Gốc — node compiler trung tâm duy nhất (kiểu Material Output của Blender).
 * Mỗi hàng bên trái là một cổng input đặt tên; thứ tự cổng = thứ tự section.
 * v3.2: nội dung lõi là TUỲ CHỌN (có thể để trống và cắm Task Node vào cổng
 * Nhiệm vụ); cổng trống thu gọn được — tự hiện đủ khi đang kéo dây.
 */
export function RootPromptNode(props: NodeProps) {
  const { node, edges } = props.data as RootPromptNodeData;
  const accent = SLOT_COLORS.task;
  const connection = useConnection();
  const isWiring = connection.inProgress;
  const [showAllPorts, setShowAllPorts] = useState(true);

  const countFor = (slot: string) =>
    edges.filter((e) => e.target === node.id && e.targetSlot === slot).length;

  // Cổng hiển thị: tất cả khi mở rộng hoặc đang kéo dây; ngược lại chỉ cổng có dây.
  const visibleSlots = ROOT_SLOTS.filter(
    (slot) => showAllPorts || isWiring || countFor(slot) > 0,
  );
  const hiddenCount = ROOT_SLOTS.length - visibleSlots.length;

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

      {/* Nội dung lõi rút gọn (tuỳ chọn — có thể thay bằng Task Node) */}
      <div className="px-3.5 py-2.5 border-b border-line/60">
        <div className="text-[9px] font-extrabold uppercase tracking-wider text-faint mb-1">
          Nhiệm vụ lõi (tuỳ chọn)
        </div>
        <p className="text-[11px] leading-relaxed text-muted line-clamp-3 whitespace-pre-line break-words">
          {node.content.trim() || (
            <span className="italic text-faint">
              Trống — gõ trực tiếp (bấm node) hoặc cắm node Nhiệm vụ vào cổng bên dưới.
            </span>
          )}
        </p>
      </div>

      {/* Các cổng input đặt tên */}
      <div className="py-1.5">
        {visibleSlots.map((slot) => {
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

        {/* Nút thu gọn / mở rộng cổng trống */}
        {!isWiring && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAllPorts((v) => !v); }}
            className="nodrag w-full flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold text-faint hover:text-ink cursor-pointer transition-colors"
          >
            {showAllPorts ? (
              <><ChevronUp size={10} /> Thu gọn cổng trống</>
            ) : (
              <><ChevronDown size={10} /> {hiddenCount} cổng ẩn — bấm để hiện</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
