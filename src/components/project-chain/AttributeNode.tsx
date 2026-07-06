import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Eye, EyeOff, Variable, ListOrdered } from 'lucide-react';
import { GraphNode } from '../../types';
import { SLOT_COLORS, SLOT_LABELS, renderNodeText } from '../../utils/graphCompile';
import { getPreset } from '../../utils/graphPresets';

export interface AttributeNodeData {
  node: GraphNode;
  onToggleEnabled: (id: string) => void;
  onUpdateNode: (id: string, fields: Partial<GraphNode>) => void;
  [key: string]: unknown;
}

/**
 * Node thuộc tính trên canvas (kiểu Blender): 1 cổng output bên phải, 1 cổng
 * "Ghép thêm" bên trái. v3.2: 3 dạng —
 * - text: hộp văn bản tự do (như cũ)
 * - preset (Modifier): dropdown/slider chỉnh NGAY TRÊN CARD, text tự sinh
 * - fewshot: hiện số cặp Ví dụ mẫu, soạn trong Inspector
 */
export function AttributeNode(props: NodeProps) {
  const { node, onToggleEnabled, onUpdateNode } = props.data as AttributeNodeData;
  const color = SLOT_COLORS[node.attrType] || SLOT_COLORS.custom;
  const muted = !node.enabled;
  const preset = node.nodeType === 'preset' ? getPreset(node.presetId) : undefined;
  const renderedText = renderNodeText(node);

  const setParam = (key: string, value: string) => {
    onUpdateNode(node.id, { presetParams: { ...(node.presetParams || {}), [key]: value } });
  };

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
          {preset ? (
            <span className="shrink-0 text-[11px] leading-none">{preset.icon}</span>
          ) : (
            <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: color }} />
          )}
          <span
            className="text-[9px] font-extrabold uppercase tracking-wider shrink-0"
            style={{ color }}
          >
            {node.nodeType === 'preset' ? 'Modifier' : node.nodeType === 'fewshot' ? 'Few-Shot' : SLOT_LABELS[node.attrType]}
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

      {/* Thân node theo loại */}
      <div className="px-3 py-2.5">
        {preset ? (
          <div className="flex flex-col gap-2">
            {preset.params.map((param) => (
              <div key={param.key} className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-faint flex justify-between">
                  <span>{param.label}</span>
                  {param.type === 'slider' && (
                    <span style={{ color }}>{(node.presetParams || {})[param.key] ?? param.defaultValue}/{param.max}</span>
                  )}
                </label>
                {param.type === 'select' ? (
                  <select
                    value={(node.presetParams || {})[param.key] ?? param.defaultValue}
                    onChange={(e) => setParam(param.key, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="nodrag w-full bg-transparent border border-line/70 rounded-lg px-2 py-1 text-[11px] font-bold text-ink focus:outline-none cursor-pointer"
                  >
                    {(param.options || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={1}
                    value={(node.presetParams || {})[param.key] ?? param.defaultValue}
                    onChange={(e) => setParam(param.key, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="nodrag w-full cursor-pointer"
                    style={{ accentColor: color }}
                  />
                )}
              </div>
            ))}
            <p className="text-[10px] leading-relaxed text-faint italic line-clamp-2 break-words border-t border-line/50 pt-1.5">
              {renderedText}
            </p>
          </div>
        ) : node.nodeType === 'fewshot' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
              <ListOrdered size={12} style={{ color }} />
              {(node.examples || []).filter((e) => e.input.trim() || e.output.trim()).length} cặp Ví dụ → Đầu ra
            </div>
            <p className="text-[10px] leading-relaxed text-faint italic line-clamp-2 break-words">
              {renderedText || 'Chưa có cặp ví dụ nào — bấm node để soạn trong Inspector.'}
            </p>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted line-clamp-3 whitespace-pre-line break-words">
            {node.content.trim() || <span className="italic text-faint">Chưa có nội dung — bấm để soạn.</span>}
          </p>
        )}

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
