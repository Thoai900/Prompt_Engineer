import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Eye, EyeOff, Variable, ListOrdered, Globe, Loader2, DownloadCloud, Boxes } from 'lucide-react';
import { GraphNode } from '../../types';
import { SLOT_COLORS, SLOT_LABELS, renderNodeText } from '../../utils/graphCompile';
import { getPreset } from '../../utils/graphPresets';
import { fetchUrlAsText } from '../../services/webFetchService';
import { toast } from '../common/Toaster';

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
  const isGroup = node.nodeType === 'group';
  const isWeb = node.nodeType === 'web';
  const color = isGroup ? '#7c3aed' : (SLOT_COLORS[node.attrType] || SLOT_COLORS.custom);
  const muted = !node.enabled;
  const preset = node.nodeType === 'preset' ? getPreset(node.presetId) : undefined;
  const renderedText = renderNodeText(node);
  const [isFetching, setIsFetching] = useState(false);

  const setParam = (key: string, value: string) => {
    onUpdateNode(node.id, { presetParams: { ...(node.presetParams || {}), [key]: value } });
  };

  const handleFetch = async () => {
    const url = (node.url || '').trim();
    if (!url) {
      toast('Nhập URL trước khi cào dữ liệu.');
      return;
    }
    setIsFetching(true);
    try {
      const page = await fetchUrlAsText(url);
      onUpdateNode(node.id, {
        content: page.text,
        fetchedAt: new Date().toISOString(),
        title: node.title === 'Dữ liệu từ web' && page.title ? page.title.slice(0, 60) : node.title,
      });
      toast.success(`Đã cào ${page.text.length.toLocaleString()} ký tự${page.truncated ? ' (đã cắt bớt)' : ''}.`);
    } catch (err: any) {
      toast.error(err.message || 'Không cào được trang.');
    } finally {
      setIsFetching(false);
    }
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
      {/* Cổng Ghép thêm (input) — nhóm không có dây (đóng góp trực tiếp theo cổng thành viên) */}
      {!isGroup && (
        <Handle
          id="append"
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !border-2 !border-white dark:!border-slate-900"
          style={{ background: '#94a3b8' }}
          title="Ghép thêm: cắm node khác vào đây để nối tiếp nội dung"
        />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 rounded-t-2xl px-3 py-2 border-b border-line/60"
        style={{ background: `${color}${muted ? '0d' : '1a'}` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {preset ? (
            <span className="shrink-0 text-[11px] leading-none">{preset.icon}</span>
          ) : isWeb ? (
            <Globe size={12} className="shrink-0" style={{ color }} />
          ) : isGroup ? (
            <Boxes size={12} className="shrink-0" style={{ color }} />
          ) : (
            <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: color }} />
          )}
          <span
            className="text-[9px] font-extrabold uppercase tracking-wider shrink-0"
            style={{ color }}
          >
            {node.nodeType === 'preset' ? 'Modifier'
              : node.nodeType === 'fewshot' ? 'Few-Shot'
              : isWeb ? 'Web'
              : isGroup ? 'Nhóm'
              : SLOT_LABELS[node.attrType]}
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
        ) : isWeb ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <input
                value={node.url || ''}
                onChange={(e) => onUpdateNode(node.id, { url: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="https://vi.wikipedia.org/wiki/..."
                className="nodrag flex-1 min-w-0 bg-transparent border border-line/70 rounded-lg px-2 py-1 text-[10px] font-mono text-ink focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleFetch(); }}
                disabled={isFetching}
                className="nodrag shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-white cursor-pointer transition-all active:scale-95 disabled:opacity-60"
                style={{ background: color }}
                title="Cào nội dung trang và cache vào node (compile dùng bản cache)"
              >
                {isFetching ? <Loader2 size={11} className="animate-spin" /> : <DownloadCloud size={11} />}
                {node.content ? 'Tải lại' : 'Cào'}
              </button>
            </div>
            {node.content ? (
              <p className="text-[9px] text-faint">
                ✓ {node.content.length.toLocaleString()} ký tự · cào lúc {node.fetchedAt ? new Date(node.fetchedAt).toLocaleTimeString() : '?'}
              </p>
            ) : (
              <p className="text-[9px] text-faint italic">Chưa có dữ liệu — nhập URL rồi bấm Cào (cần đăng nhập).</p>
            )}
          </div>
        ) : isGroup ? (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-bold text-ink">{(node.members || []).length} node bên trong</div>
            {(node.members || []).slice(0, 3).map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted truncate">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: SLOT_COLORS[m.attrType] || SLOT_COLORS.custom }} />
                <span className="truncate">{m.title}</span>
                <span className="ml-auto text-[8px] text-faint shrink-0">{SLOT_LABELS[m.attrType]}</span>
              </div>
            ))}
            {(node.members || []).length > 3 && (
              <div className="text-[9px] text-faint">+ {(node.members || []).length - 3} node khác…</div>
            )}
            <p className="text-[8px] text-faint italic mt-0.5">Mỗi thành viên tự vào đúng cổng của nó — không cần dây.</p>
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

      {/* Cổng output — nhóm không có (đóng góp trực tiếp) */}
      {!isGroup && (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className="!w-3.5 !h-3.5 !border-2 !border-white dark:!border-slate-900"
          style={{ background: color }}
          title="Kéo dây từ đây cắm vào một cổng của Prompt Gốc"
        />
      )}
    </div>
  );
}
