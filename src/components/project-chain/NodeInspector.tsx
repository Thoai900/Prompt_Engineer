import React from 'react';
import { Trash2, Save, Eye, EyeOff, Variable, Plus, Crown, MousePointerClick } from 'lucide-react';
import { AttrSlot, GraphNode, PromptVariable } from '../../types';
import { ROOT_SLOTS, SLOT_COLORS, SLOT_LABELS } from '../../utils/graphCompile';

interface NodeInspectorProps {
  node: GraphNode | null;
  onUpdateNode: (id: string, fields: Partial<GraphNode>) => void;
  onDeleteNode: (id: string) => void;
  onExportTemplate: (node: GraphNode) => void;
  canExport: boolean;
}

/**
 * Panel soạn nội dung node đang chọn: tiêu đề, loại cổng, nội dung, biến.
 * Nội dung gõ vào được commit debounce ở GraphWorkspace (không ghi Firestore mỗi phím).
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
  const color = isRoot ? SLOT_COLORS.task : (SLOT_COLORS[node.attrType] || SLOT_COLORS.custom);

  const updateVariable = (idx: number, fields: Partial<PromptVariable>) => {
    const vars = [...(node.variables || [])];
    vars[idx] = { ...vars[idx], ...fields };
    onUpdateNode(node.id, { variables: vars });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 text-left">
      {/* Loại node */}
      <div className="flex items-center gap-2">
        {isRoot ? <Crown size={14} style={{ color }} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color }}>
          {isRoot ? 'Prompt Gốc' : `Thuộc tính · ${SLOT_LABELS[node.attrType]}`}
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

      {/* Loại cổng (chỉ node thuộc tính) */}
      {!isRoot && (
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

      {/* Nội dung */}
      <div className="flex-1 flex flex-col min-h-[180px]">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-faint block mb-1.5">
          {isRoot ? 'Nhiệm vụ chính (nội dung lõi của prompt)' : 'Nội dung đóng góp vào prompt'}
        </label>
        <textarea
          value={node.content}
          onChange={(e) => onUpdateNode(node.id, { content: e.target.value })}
          placeholder={isRoot
            ? 'Ví dụ: Viết một bài blog về chủ đề {{chu_de}}...'
            : 'Văn bản của thuộc tính này. Có thể dùng biến {{ten_bien}}.'}
          className="flex-1 w-full min-h-[180px] bg-transparent border border-line/70 rounded-xl px-3 py-2.5 text-xs leading-relaxed text-ink resize-y focus:outline-none focus:border-violet-500 transition-colors font-mono"
        />
        <p className="text-[9px] text-faint mt-1.5">Biến dạng <code>{'{{ten_bien}}'}</code> sẽ hiện trong form Chạy thử.</p>
      </div>

      {/* Biến */}
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
