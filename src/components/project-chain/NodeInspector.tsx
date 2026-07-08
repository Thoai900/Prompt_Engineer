import React, { useState } from 'react';
import { Trash2, Save, Eye, EyeOff, Variable, Plus, Crown, MousePointerClick, Unlink, ListOrdered, Globe, Loader2, DownloadCloud, Boxes, PackageOpen } from 'lucide-react';
import { AttrSlot, FewShotExample, GraphNode, PromptVariable } from '../../types';
import { ROOT_SLOTS, SLOT_COLORS, SLOT_LABELS, renderNodeText } from '../../utils/graphCompile';
import { getPreset } from '../../utils/graphPresets';
import { fetchUrlAsText } from '../../services/webFetchService';
import { toast } from '../common/Toaster';

interface NodeInspectorProps {
  node: GraphNode | null;
  onUpdateNode: (id: string, fields: Partial<GraphNode>) => void;
  onDeleteNode: (id: string) => void;
  onExportTemplate: (node: GraphNode) => void;
  onUngroupNode: (id: string) => void;
  canExport: boolean;
}

/**
 * Panel soạn node đang chọn. v3.2 có 3 dạng thân:
 * - text: textarea tự do + biến khai báo
 * - preset (Modifier): control params + text sinh ra (read-only) + nút "tháo" thành text
 * - fewshot: editor cặp Đầu vào → Đầu ra
 */
export function NodeInspector({ node, onUpdateNode, onDeleteNode, onExportTemplate, onUngroupNode, canExport }: NodeInspectorProps) {
  const [isFetching, setIsFetching] = useState(false);
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
  const isWeb = node.nodeType === 'web';
  const isGroup = node.nodeType === 'group';
  const isPlainText = !isRoot && !preset && !isFewShot && !isWeb && !isGroup;
  const color = isRoot ? SLOT_COLORS.task
    : isGroup ? '#7c3aed'
    : (SLOT_COLORS[node.attrType] || SLOT_COLORS.custom);

  const handleFetchUrl = async () => {
    const url = (node.url || '').trim();
    if (!url) {
      toast('Nhập URL trước khi cào dữ liệu.');
      return;
    }
    setIsFetching(true);
    try {
      const page = await fetchUrlAsText(url);
      onUpdateNode(node.id, { content: page.text, fetchedAt: new Date().toISOString() });
      toast.success(`Đã cào ${page.text.length.toLocaleString()} ký tự${page.truncated ? ' (đã cắt bớt)' : ''}.`);
    } catch (err: any) {
      toast.error(err.message || 'Không cào được trang.');
    } finally {
      setIsFetching(false);
    }
  };

  const updateMember = (idx: number, fields: Partial<GraphNode>) => {
    const members = [...(node.members || [])];
    members[idx] = { ...members[idx], ...fields };
    onUpdateNode(node.id, { members });
  };

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
        ) : isWeb ? (
          <Globe size={14} style={{ color }} />
        ) : isGroup ? (
          <Boxes size={14} style={{ color }} />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        )}
        <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color }}>
          {isRoot ? 'Prompt Gốc (Compiler)'
            : preset ? `Modifier · ${preset.title}`
            : isFewShot ? 'Few-Shot · Ví dụ mẫu'
            : isWeb ? 'Web · Dữ liệu từ URL'
            : isGroup ? `Nhóm · ${(node.members || []).length} node`
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

      {/* Loại cổng (node thuộc tính; preset có cổng khuyến nghị riêng; nhóm không dây) */}
      {!isRoot && !preset && !isGroup && (
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
      ) : isWeb ? (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5">URL nguồn</label>
            <div className="flex items-center gap-1.5">
              <input
                value={node.url || ''}
                onChange={(e) => onUpdateNode(node.id, { url: e.target.value })}
                placeholder="https://vi.wikipedia.org/wiki/..."
                className="flex-1 min-w-0 bg-transparent border border-line/70 rounded-xl px-3 py-2 text-[11px] font-mono text-ink focus:outline-none focus:border-sky-500 transition-colors"
              />
              <button
                onClick={handleFetchUrl}
                disabled={isFetching}
                className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer transition-all active:scale-95 disabled:opacity-60"
                style={{ background: color }}
              >
                {isFetching ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
                {node.content ? 'Tải lại' : 'Cào'}
              </button>
            </div>
            <p className="text-[9px] text-faint mt-1.5">
              Cần đăng nhập. Dữ liệu được <b>cache vào node</b> (compile dùng bản cache — bấm Tải lại khi trang đổi).
              {node.fetchedAt && <> Cào lần cuối: {new Date(node.fetchedAt).toLocaleString()}.</>}
            </p>
          </div>
          <div className="flex-1 flex flex-col min-h-[160px]">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5">
              Nội dung đã cào ({(node.content || '').length.toLocaleString()} ký tự — sửa/cắt bớt được)
            </label>
            <textarea
              value={node.content}
              onChange={(e) => onUpdateNode(node.id, { content: e.target.value })}
              placeholder="Chưa có dữ liệu — nhập URL rồi bấm Cào."
              className="flex-1 w-full min-h-[160px] bg-transparent border border-line/70 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed text-ink resize-y focus:outline-none focus:border-sky-500 transition-colors font-mono"
            />
          </div>
        </div>
      ) : isGroup ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onUngroupNode(node.id)}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line/70 text-xs font-bold text-muted hover:text-ink cursor-pointer transition-colors"
            title="Trả các node thành viên về canvas và nối lại vào Prompt Gốc"
          >
            <PackageOpen size={12} /> Tách nhóm
          </button>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-faint">
            Thành viên ({(node.members || []).length}) — mỗi node vào đúng cổng của nó
          </div>
          {(node.members || []).map((m, idx) => {
            const mColor = SLOT_COLORS[m.attrType] || SLOT_COLORS.custom;
            const isPlainMember = !m.nodeType || m.nodeType === 'text';
            return (
              <div key={m.id || idx} className="border border-line/60 rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: mColor }} />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider shrink-0" style={{ color: mColor }}>
                    {SLOT_LABELS[m.attrType]}
                  </span>
                  <input
                    value={m.title}
                    onChange={(e) => updateMember(idx, { title: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent border border-line/60 rounded-lg px-2 py-1 text-[11px] font-bold text-ink focus:outline-none focus:border-violet-500"
                  />
                </div>
                {isPlainMember ? (
                  <textarea
                    value={m.content}
                    onChange={(e) => updateMember(idx, { content: e.target.value })}
                    rows={3}
                    className="w-full bg-transparent border border-line/60 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed text-ink resize-y focus:outline-none focus:border-violet-500 transition-colors font-mono"
                  />
                ) : (
                  <>
                    <pre className="text-[10px] text-muted whitespace-pre-wrap break-words max-h-28 overflow-y-auto custom-scrollbar border border-line/50 rounded-lg px-2 py-1.5 bg-black/[0.02] dark:bg-white/[0.02]">{renderNodeText(m) || '(trống)'}</pre>
                    <p className="text-[8px] text-faint italic">Node {m.nodeType} — tách nhóm để chỉnh control của nó.</p>
                  </>
                )}
              </div>
            );
          })}
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
      {(isRoot || isPlainText) && (
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
