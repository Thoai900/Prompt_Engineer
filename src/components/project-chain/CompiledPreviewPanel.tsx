import React from 'react';
import { Copy, FileText, History } from 'lucide-react';
import { toast } from '../common/Toaster';
import { CompiledGraph, SLOT_COLORS } from '../../utils/graphCompile';
import { estimateTokens } from '../../config/models';

interface CompiledPreviewPanelProps {
  compiled: CompiledGraph;
  onSaveVersion: () => void;
  onOpenVersionDrawer: () => void;
}

/**
 * "Nguồn hiểu" chính của Prompt Graph: prompt cuối được lắp ráp REALTIME,
 * mỗi section tô màu theo node nguồn — cắm/rút/bật/tắt node là thấy đổi ngay.
 */
export function CompiledPreviewPanel({ compiled, onSaveVersion, onOpenVersionDrawer }: CompiledPreviewPanelProps) {
  const { finalPrompt, sections } = compiled;

  const handleCopy = () => {
    if (!finalPrompt.trim()) {
      toast('Prompt đang trống — hãy soạn nội dung lõi hoặc cắm thêm node.');
      return;
    }
    navigator.clipboard.writeText(finalPrompt);
    toast.success('Đã sao chép prompt hoàn chỉnh!');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-line/60 shrink-0">
        <span className="text-[10px] font-bold text-faint mr-auto">
          ~{estimateTokens(finalPrompt)} token · {sections.length} phần
        </span>
        <button
          onClick={onOpenVersionDrawer}
          className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-line/70 text-[10px] font-bold text-muted hover:text-ink cursor-pointer transition-colors"
        >
          <History size={11} /> Lịch sử
        </button>
        <button
          onClick={onSaveVersion}
          className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-line/70 text-[10px] font-bold text-muted hover:text-ink cursor-pointer transition-colors"
        >
          <FileText size={11} /> Lưu phiên bản
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
        >
          <Copy size={11} /> Sao chép
        </button>
      </div>

      {/* Sections tô màu theo node nguồn */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 text-left">
        {sections.length === 0 ? (
          <p className="text-xs text-muted italic p-3 leading-relaxed">
            Prompt trống. Soạn <b>Nhiệm vụ</b> trong Prompt Gốc và cắm các node thuộc tính vào — nội dung sẽ hiện ở đây ngay lập tức.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed">
            {sections.map((s, i) => {
              const color = SLOT_COLORS[s.slot] || SLOT_COLORS.custom;
              return (
                <div
                  key={`${s.nodeId}-${i}`}
                  className="rounded-lg px-2.5 py-2 border-l-[3px]"
                  style={{ borderLeftColor: color, background: `${color}0d` }}
                  title={`Từ node: ${s.title}`}
                >
                  {s.showHeader && (
                    <div className="font-extrabold mb-0.5" style={{ color }}>[{s.title}]</div>
                  )}
                  <pre className="whitespace-pre-wrap break-words text-ink font-mono">{s.text}</pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
