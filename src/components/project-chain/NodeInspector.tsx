import React from 'react';
import { Trash2, Save, Eye, EyeOff, Variable, Plus, Crown, MousePointerClick, Unlink, ListOrdered } from 'lucide-react';
import { AttrSlot, FewShotExample, GraphNode, PromptVariable } from '../../types';
import { ROOT_SLOTS, SLOT_COLORS, SLOT_LABELS, renderNodeText } from '../../utils/graphCompile';
import { getPreset } from '../../utils/graphPresets';

interface NodeInspectorProps {
  node: GraphNode | null;
  onUpdateNode: (id: string, fields: Partial<GraphNode>) => void;
  onDeleteNode: (id: string) => void;
  onExportTemplate: (node: GraphNode) => void;
  canExport: boolean;
}

/**
 * Panel soạn node đang chọn. v3.2 có 3 dạng thân:
 * - text: textarea tự do + biến khai báo
 * - preset (Modifier): control params + text sinh ra (read-only) + nút "tháo" thành text
 * - fewshot: editor cặp Đầu vào → Đầu ra
 */
export function NodeInspector({ node, onUpdateNode, onDeleteNode, onExportTemplate, canExport }: NodeInspectorProps) {
  if (!node) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <MousePointerClick size={22} className="text-faint" />
        <p className="text-xs text-muted leading-relaxed">
          Bấm vào một node trên canvas để soạn nội dung.<br />
          Kéo từ chấm tròn bên phải node thuộc tính vào một cổng của <b>Prompt Gốc</b> để cắm dây.
        </p>
      </div>
    );
  }

  const isRoot = node.kind === 'root';
  const preset = node.nodeType === 'preset' ? getPreset(node.presetId) : undefined;
  const isFewShot = node.nodeType === 'fewshot';
  const color = isRoot ? SLOT_COLORS.task : (SLOT_COLORS[node.attrType] || SLOT_COLORS.custom);

  const updateVariable = (idx: number, fields: Partial<PromptVariable>) => {
    const vars = [...(node.variables || [])];
    vars[idx] = { ...vars[idx], ...fields };
    onUpdateNode(node.id, { variables: vars });
  };

  const updateExample = (idx: number, fields: Partial<FewShotExample>) => {
    const examples = [...(node.examples || [])];
    examples[idx] = { ...examples[idx], ...fields };
    onUpdateNode(node.id, { examples });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 text-left">
      {/* Loại node */}
      <div className="flex items-center gap-2">
        {isRoot ? <Crown size={14} style={{ color }} /> : preset ? (
          <span className="text-sm leading-none">{preset.icon}</span>
        ) : (
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        )}
        <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color }}>
          {isRoot ? 'Prompt Gốc (Compiler)'
            : preset ? `Modifier · ${preset.title}`
            : isFewShot ? 'Few-Shot · Ví dụ mẫu'
            : `Thuộc tính · ${SLOT_LABELS[node.attrType]}`}
        </span>
        {!isRoot && (
          <button
            onClick={() => onUpdateNode(node.id, { enabled: !node.enabled })}
            className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors ${
              node.enabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-500/10 text-muted'
            }`}
          >
            {node.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
            {node.enabled ? 'Đang bật' : 'Đang tắt'}
          </button>
        )}
      </div>

      {/* Tiêu đề */}
      <div>
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5">Tiêu đề</label>
        <input
          value={node.title}
          onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
          className="w-full bg-transparent border border-line/70 rounded-xl px-3 py-2 text-xs font-bold text-ink focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Loại cổng (node thuộc tính, trừ preset — preset có cổng khuyến nghị riêng) */}
      {!isRoot && !preset && (
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5">
            Loại thuộc tính (cổng tương ứng trên Prompt Gốc)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ROOT_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => onUpdateNode(node.id, { attrType: slot as AttrSlot })}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
                  node.attrType === slot ? 'text-white shadow-sm' : 'text-muted border-line/70 hover:border-line'
                }`}
                style={node.attrType === slot ? { background: SLOT_COLORS[slot], borderColor: SLOT_COLORS[slot] } : undefined}
              >
                {SLOT_LABELS[slot]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Thân theo loại node ── */}
      {preset ? (
        <>
          <div className="flex flex-col gap-3">
            {preset.params.map((param) => (
              <div key={param.key}>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5 flex justify-between">
                  <span>{param.label}</span>
                  {param.type === 'slider' && (
                    <span style={{ color }}>{(node.presetParams || {})[param.key] ?? param.defaultValue}/{param.max}</span>
                  )}
                </label>
                {param.type === 'select' ? (
                  <select
                    value={(node.presetParams || {})[param.key] ?? param.defaultValue}
                    onChange={(e) => onUpdateNode(node.id, { presetParams: { ...(node.presetParams || {}), [param.key]: e.target.value } })}
                    className="w-full bg-transparent border border-line/70 rounded-xl px-3 py-2 text-xs font-bold text-ink focus:outline-none cursor-pointer"
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
                    onChange={(e) => onUpdateNode(node.id, { presetParams: { ...(node.presetParams || {}), [param.key]: e.target.value } })}
                    className="w-full cursor-pointer"
                    style={{ accentColor: color }}
                  />
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5">
              Text sẽ chèn vào prompt (tự sinh)
            </label>
            <pre className="w-full border border-line/60 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed text-muted whitespace-pre-wrap break-words bg-black/[0.02] dark:bg-white/[0.02]">
              {renderNodeText(node)}
            </pre>
          </div>
          <button
            onClick={() => onUpdateNode(node.id, { nodeType: 'text', content: renderNodeText(node), presetId: undefined, presetParams: undefined })}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line/70 text-xs font-bold text-muted hover:text-ink cursor-pointer transition-colors"
            title="Biến text tự sinh thành nội dung sửa tay được (mất control preset)"
          >
            <Unlink size={12} /> Chuyển thành node text tự do
          </button>
        </>
      ) : isFewShot ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint flex items-center gap-1">
              <ListOrdered size={11} /> Cặp ví dụ ({(node.examples || []).length})
            </label>
            <button
              onClick={() => onUpdateNode(node.id, { examples: [...(node.examples || []), { input: '', output: '' }] })}
              className="text-[10px] font-bold text-violet-500 hover:text-violet-400 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus size={11} /> Thêm cặp
            </button>
          </div>
          {(node.examples || []).map((ex, idx) => (
            <div key={idx} className="border border-line/60 rounded-xl p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color }}>Ví dụ {idx + 1}</span>
                <button
                  onClick={() => onUpdateNode(node.id, { examples: (node.examples || []).filter((_, i) => i !== idx) })}
                  className="p-1 text-faint hover:text-rose-500 cursor-pointer transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div>
                <label className="text-[9px] font-bold text-faint block mb-1">Đầu vào</label>
                <textarea
                  value={ex.input}
                  onChange={(e) => updateExample(idx, { input: e.target.value })}
                  rows={2}
                  placeholder="Ví dụ đầu vào người dùng sẽ đưa..."
                  className="w-full bg-transparent border border-line/60 rounded-lg px-2 py-1.5 text-[11px] text-ink resize-y focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-faint block mb-1">Đầu ra mong muốn</label>
                <textarea
                  value={ex.output}
                  onChange={(e) => updateExample(idx, { output: e.target.value })}
                  rows={3}
                  placeholder="Kết quả chuẩn AI cần học theo..."
                  className="w-full bg-transparent border border-line/60 rounded-lg px-2 py-1.5 text-[11px] text-ink resize-y focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>
          ))}
          <p className="text-[9px] text-faint leading-relaxed">
            Các cặp sẽ được đóng khung chuẩn few-shot khi compile. Cặp trống cả hai vế sẽ tự bị bỏ qua.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-[180px]">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5">
            {isRoot ? 'Nhiệm vụ lõi (tuỳ chọn — có thể thay bằng Task Node cắm vào cổng Nhiệm vụ)' : 'Nội dung đóng góp vào prompt'}
          </label>
          <textarea
            value={node.content}
            onChange={(e) => onUpdateNode(node.id, { content: e.target.value })}
            placeholder={isRoot
              ? 'Ví dụ: Viết một bài blog về chủ đề {{chu_de}}... (hoặc để trống và cắm node Nhiệm vụ)'
              : 'Văn bản của thuộc tính này. Có thể dùng biến {{ten_bien}}.'}
            className="flex-1 w-full min-h-[180px] bg-transparent border border-line/70 rounded-xl px-3 py-2.5 text-xs leading-relaxed text-ink resize-y focus:outline-none focus:border-violet-500 transition-colors font-mono"
          />
          <p className="text-[9px] text-faint mt-1.5">Biến dạng <code>{'{{ten_bien}}'}</code> sẽ hiện trong form Chạy thử.</p>
        </div>
      )}

      {/* Biến khai báo (node text & root) */}
      {!preset && !isFewShot && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint flex items-center gap-1">
              <Variable size={10} /> Biến khai báo ({(node.variables || []).length})
            </label>
            <button
              onClick={() => onUpdateNode(node.id, {
                variables: [...(node.variables || []), { name: `bien_${(node.variables || []).length + 1}`, type: 'text', description: '', required: true, defaultValue: '' }],
              })}
              className="text-[10px] font-bold text-violet-500 hover:text-violet-400 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus size={11} /> Thêm biến
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {(node.variables || []).map((v, idx) => (
              <div key={idx} className="border border-line/60 rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    value={v.name}
                    onChange={(e) => updateVariable(idx, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })}
                    className="flex-1 min-w-0 bg-transparent border border-line/60 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-ink focus:outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={() => onUpdateNode(node.id, { variables: (node.variables || []).filter((_, i) => i !== idx) })}
                    className="p-1 text-faint hover:text-rose-500 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  value={v.defaultValue || ''}
                  onChange={(e) => updateVariable(idx, { defaultValue: e.target.value })}
                  placeholder="Giá trị mặc định"
                  className="w-full bg-transparent border border-line/60 rounded-lg px-2 py-1 text-[11px] text-muted focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hành động */}
      {!isRoot && (
        <div className="flex items-center gap-2 pt-2 border-t border-line/60">
          {canExport && (
            <button
              onClick={() => onExportTemplate(node)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line/70 text-xs font-bold text-ink hover:border-emerald-500 hover:text-emerald-500 cursor-pointer transition-colors"
            >
              <Save size={12} /> Lưu thành Template
            </button>
          )}
          <button
            onClick={() => onDeleteNode(node.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-500/30 text-xs font-bold text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
          >
            <Trash2 size={12} /> Xoá node
          </button>
        </div>
      )}
    </div>
  );
}
