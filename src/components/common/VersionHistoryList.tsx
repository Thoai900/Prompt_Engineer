import React, { useState } from 'react';
import { ChevronDown, ChevronRight, History, RotateCcw } from 'lucide-react';
import { PromptBlock, TemplateVersion } from '../../types';
import { computeUnifiedDiff } from '../../utils/chainUtils';
import { blocksToText } from '../../utils/templateVersionUtils';

interface VersionHistoryListProps {
  versions: TemplateVersion[];
  /** Bản để so sánh (diff: − bản cũ → + bản này). */
  currentBlocks: PromptBlock[];
  /** Nhãn cho bản so sánh trong chú thích diff, vd "bản hiện tại" / "trình soạn". */
  currentLabel?: string;
  onRestore: (v: TemplateVersion) => void;
  /** Mô tả nút khôi phục làm gì (tooltip + chú thích cuối). */
  restoreHint: string;
}

/**
 * H2: Lịch sử phiên bản template — mở từng bản để xem khác biệt + khôi phục.
 * Dùng chung cho chi tiết template (Thư viện) và Builder.
 */
export default function VersionHistoryList({ versions, currentBlocks, currentLabel = 'bản hiện tại', onRestore, restoreHint }: VersionHistoryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (versions.length === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-2">
        <History className="w-4 h-4 text-indigo-500" />
        <h4 className="text-xs font-bold text-slate-500">Lịch sử phiên bản ({versions.length})</h4>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {versions.map((v) => {
          const isOpen = expandedId === v.id;
          return (
            <div key={v.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 p-2.5">
                <button
                  onClick={() => setExpandedId(isOpen ? null : v.id)}
                  className="flex flex-1 items-center gap-2 text-left cursor-pointer"
                  title={`Xem khác biệt so với ${currentLabel}`}
                >
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">
                      {v.version ? `${v.version} · ` : ''}{new Date(v.at).toLocaleString('vi-VN')}
                    </span>
                    <span className="text-xs text-slate-400">{(v.blocks || []).length} khối{v.note ? ` · ${v.note}` : ''}</span>
                  </div>
                </button>
                <button
                  onClick={() => onRestore(v)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 cursor-pointer"
                  title={restoreHint}
                >
                  <RotateCcw className="w-3 h-3" /> Khôi phục
                </button>
              </div>
              {isOpen && (
                <div className="max-h-56 overflow-y-auto border-t border-slate-100 bg-slate-950 p-3 font-mono text-xs leading-relaxed">
                  {computeUnifiedDiff(blocksToText(v.blocks), blocksToText(currentBlocks)).map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.type === 'added' ? 'text-emerald-400 whitespace-pre-wrap' :
                        line.type === 'removed' ? 'text-rose-400 whitespace-pre-wrap line-through/50' :
                        'text-slate-500 whitespace-pre-wrap'
                      }
                    >
                      {line.type === 'added' ? '+ ' : line.type === 'removed' ? '− ' : '  '}{line.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-slate-400 font-medium px-1">
          Diff hiển thị: <span className="text-rose-500">− bản cũ</span> → <span className="text-emerald-600">+ {currentLabel}</span>. {restoreHint}
        </p>
      </div>
    </div>
  );
}
