/**
 * "Prompt đang thành hình" — khung xem trước sống, lớn dần theo từng đề xuất
 * được duyệt. Nửa còn lại của chữ ký thị giác (cùng với StepRail).
 */
import React from 'react';
import { FileText } from 'lucide-react';
import { CompositeQuality } from '../../utils/studioFlow';

interface LivePreviewProps {
  text: string;
  blockCount: number;
  ruleCount: number;
  skillCount: number;
  personaName: string | null;
  /** Điểm chất lượng tổng hợp (đợt 2); null = chưa có phép đo nào. */
  quality: CompositeQuality | null;
}

function CountChip({ label, value }: { label: string; value: number }) {
  if (value <= 0) return null;
  return (
    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
      {value} {label}
    </span>
  );
}

export default function LivePreview({ text, blockCount, ruleCount, skillCount, personaName, quality }: LivePreviewProps) {
  return (
    <aside className="flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-line bg-panel/70 backdrop-blur-sm">
      <div className="border-b border-line/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-faint">
            <FileText size={12} className="text-violet-500" />
            Prompt đang thành hình
          </div>
          {quality && (
            <span
              title={quality.parts.map((p) => `${p.label}: ${p.value === null ? 'chưa đo' : p.value}`).join(' · ')}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                quality.score >= 80
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : quality.score >= 60
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-rose-500/10 text-rose-500'
              }`}
            >
              {quality.score}/100
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <CountChip label="khối" value={blockCount} />
          <CountChip label="quy tắc" value={ruleCount} />
          <CountChip label="kỹ năng" value={skillCount} />
          {personaName && (
            <span className="rounded-full border border-violet-200/60 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-500 dark:border-violet-800/60">
              {personaName}
            </span>
          )}
        </div>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-3">
        {text ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted">
            {text}
            <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-gradient-to-b from-violet-500 to-cyan-500" />
          </pre>
        ) : (
          <p className="text-xs leading-relaxed text-faint">
            Chưa có gì để xem. Bắt đầu từ bước <span className="font-semibold text-muted">Ý tưởng</span> —
            prompt sẽ lớn dần ở đây theo từng bước bạn hoàn thành.
          </p>
        )}
      </div>
      {text && (
        <div className="border-t border-line/70 px-4 py-2 text-[10px] font-semibold text-faint">
          {text.length.toLocaleString('vi-VN')} ký tự
        </div>
      )}
    </aside>
  );
}
