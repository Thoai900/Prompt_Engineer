/**
 * Bước 4 — Kiểm tra: lintPrompt phân tích tĩnh prompt đã lắp ráp.
 * Có lỗi → một nút "Đề xuất bản sửa bằng AI"; bản sửa hiện dạng thẻ
 * Áp dụng / Bỏ qua (không tự ghi đè — mức điều phối B).
 */
import React, { useState } from 'react';
import { CheckCircle2, Loader2, Stethoscope, Wand2 } from 'lucide-react';
import { toast } from '../common/Toaster';
import type { LintIssue } from '../../services/aiService';
import { PromptBlock } from '../../types';
import { StudioDraft, buildFixRequest, normalizeBlockType } from '../../utils/studioFlow';
import SuggestionCard from './SuggestionCard';

interface StepCheckProps {
  draft: StudioDraft;
  /** Prompt đã lắp ráp KHÔNG kèm persona (persona là chuyện runtime). */
  assembledText: string;
  onPatch: (patch: Partial<StudioDraft>) => void;
}

const SEVERITY_STYLES: Record<LintIssue['severity'], string> = {
  high: 'border-rose-300/50 bg-rose-500/10 text-rose-500 dark:border-rose-800/50',
  medium: 'border-amber-300/50 bg-amber-500/10 text-amber-600 dark:border-amber-800/50 dark:text-amber-400',
  low: 'border-sky-300/50 bg-sky-500/10 text-sky-600 dark:border-sky-800/50 dark:text-sky-400',
};

const SEVERITY_LABELS: Record<LintIssue['severity'], string> = {
  high: 'Nghiêm trọng', medium: 'Trung bình', low: 'Nhẹ',
};

export default function StepCheck({ draft, assembledText, onPatch }: StepCheckProps) {
  const [isLinting, setIsLinting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [pendingFix, setPendingFix] = useState<PromptBlock[] | null>(null);

  const handleLint = async () => {
    if (!assembledText.trim()) {
      toast('Chưa có prompt để kiểm tra — dựng bản nháp ở bước 2 trước.');
      return;
    }
    setIsLinting(true);
    try {
      const { lintPrompt } = await import('../../services/aiService');
      const issues = await lintPrompt(assembledText);
      onPatch({ lintIssues: issues, lintRanAt: new Date().toISOString() });
      if (issues.length === 0) toast.success('Prompt sạch — không tìm thấy vấn đề nào.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Không chấm điểm được. Thử lại sau.');
    } finally {
      setIsLinting(false);
    }
  };

  const handleProposeFix = async () => {
    setIsFixing(true);
    try {
      const { enhancePromptWithAi } = await import('../../services/aiService');
      const rawBlocks = await enhancePromptWithAi(buildFixRequest(assembledText, draft.lintIssues));
      const stamp = Date.now();
      setPendingFix(rawBlocks.map((b: any, i: number) => ({
        id: `studio-fix-${stamp}-${i}`,
        type: normalizeBlockType(b.type),
        title: b.title || 'Khối',
        content: b.content || '',
      })));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Không tạo được bản sửa. Thử lại sau.');
    } finally {
      setIsFixing(false);
    }
  };

  const applyFix = () => {
    if (!pendingFix || !draft.template) return;
    // Thay blocks bằng bản sửa; lint cũ hết hiệu lực → mời chấm điểm lại.
    onPatch({ template: { ...draft.template, blocks: pendingFix }, lintIssues: [], lintRanAt: null });
    setPendingFix(null);
    toast.success('Đã áp dụng bản sửa. Bấm "Chấm điểm lại" để xác nhận.');
  };

  const hasRun = draft.lintRanAt !== null;
  const issues = draft.lintIssues;

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-ink">Kiểm tra trước khi dùng</h2>
        <p className="mt-1 text-sm text-muted">
          Linter phân tích tĩnh prompt đã lắp ráp: mâu thuẫn, mơ hồ, thiếu ngữ cảnh, ràng buộc xung đột.
        </p>
      </header>

      <button
        onClick={handleLint}
        disabled={isLinting || !assembledText.trim()}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLinting ? <Loader2 size={16} className="animate-spin" /> : <Stethoscope size={16} />}
        {isLinting ? 'Đang phân tích…' : hasRun ? 'Chấm điểm lại' : 'Chấm điểm prompt'}
      </button>

      {hasRun && issues.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/50 bg-emerald-500/10 p-4 dark:border-emerald-800/50">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
          <div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Không tìm thấy vấn đề nào</div>
            <div className="text-xs text-muted">Prompt đã sẵn sàng — sang bước Hoàn tất.</div>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-faint">
            {issues.length} vấn đề tìm thấy
          </div>
          {issues.map((issue, i) => (
            <div key={i} className="rounded-2xl border border-line bg-panel/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_STYLES[issue.severity]}`}>
                  {SEVERITY_LABELS[issue.severity]}
                </span>
                <span className="text-[11px] font-semibold text-faint">{issue.category}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink">{issue.message}</p>
              {issue.suggestion && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-violet-500">Gợi ý:</span> {issue.suggestion}
                </p>
              )}
            </div>
          ))}

          {pendingFix ? (
            <SuggestionCard
              icon={<Wand2 size={16} />}
              eyebrow="Bản sửa"
              title={`Bản viết lại gồm ${pendingFix.length} khối`}
              description={pendingFix.map((b) => b.title).join(' · ')}
              reason={`khắc phục ${issues.length} vấn đề linter tìm thấy`}
              applyLabel="Thay thế các khối"
              onApply={applyFix}
              onDismiss={() => setPendingFix(null)}
            />
          ) : (
            <button
              onClick={handleProposeFix}
              disabled={isFixing}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-hover disabled:opacity-50"
            >
              {isFixing ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              {isFixing ? 'AI đang viết lại…' : 'Đề xuất bản sửa bằng AI'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
