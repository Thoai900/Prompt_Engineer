/**
 * Bước 2 — Bản nháp: AI dựng template nhiều khối từ ý tưởng
 * (generateStructuredTemplateFromTopic, import động để giữ bundle nhẹ).
 * Người dùng sửa nội dung từng khối tại chỗ.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { toast } from '../common/Toaster';
import { PromptTemplate } from '../../types';
import { StudioDraft } from '../../utils/studioFlow';

interface StepDraftProps {
  draft: StudioDraft;
  onPatch: (patch: Partial<StudioDraft>) => void;
}

const GENERATING_STEPS = [
  '🔍 Đang nghiên cứu bối cảnh & chủ đề…',
  '🧠 Đang thiết lập vai trò chuyên môn…',
  '🏗️ Đang lắp ráp cấu trúc Multi-block…',
  '📋 Đang định hình định dạng đầu ra…',
];

export default function StepDraft({ draft, onPatch }: StepDraftProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [narration, setNarration] = useState(0);

  useEffect(() => {
    if (!isGenerating) { setNarration(0); return; }
    const t = setInterval(() => setNarration((p) => Math.min(p + 1, GENERATING_STEPS.length - 1)), 1500);
    return () => clearInterval(t);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!draft.idea.trim()) {
      toast('Hãy nhập ý tưởng ở bước 1 trước.');
      return;
    }
    setIsGenerating(true);
    try {
      const { generateStructuredTemplateFromTopic } = await import('../../services/aiService');
      const topic = draft.category ? `${draft.idea.trim()} (thể loại: ${draft.category})` : draft.idea.trim();
      const result = await generateStructuredTemplateFromTopic(topic);
      // Blocks đổi → kết quả lint cũ (nếu có) không còn giá trị.
      onPatch({ template: result as PromptTemplate, lintIssues: [], lintRanAt: null });
      toast.success('Đã dựng bản nháp — xem và sửa các khối bên dưới.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Không dựng được bản nháp. Kiểm tra API key hoặc thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const patchTemplate = (patch: Partial<PromptTemplate>) => {
    if (!draft.template) return;
    onPatch({ template: { ...draft.template, ...patch } });
  };

  const updateBlockContent = (blockId: string, content: string) => {
    if (!draft.template) return;
    patchTemplate({
      blocks: draft.template.blocks.map((b) => (b.id === blockId ? { ...b, content } : b)),
    });
    // Nội dung đổi sau khi đã lint → yêu cầu chấm điểm lại.
    if (draft.lintRanAt) onPatch({ lintIssues: [], lintRanAt: null });
  };

  const removeBlock = (blockId: string) => {
    if (!draft.template) return;
    patchTemplate({ blocks: draft.template.blocks.filter((b) => b.id !== blockId) });
  };

  if (!draft.template) {
    return (
      <section className="space-y-5">
        <header>
          <h2 className="text-xl font-bold tracking-tight text-ink">Dựng bản nháp bằng AI</h2>
          <p className="mt-1 text-sm text-muted">
            AI sẽ chuyển ý tưởng của bạn thành khung prompt nhiều khối: vai trò, nhiệm vụ, bối cảnh, ràng buộc, định dạng.
          </p>
        </header>
        <div className="rounded-2xl border border-line bg-panel/70 p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-faint">Ý tưởng của bạn</div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {draft.idea.trim() || <span className="text-faint">Chưa có — quay lại bước 1 để nhập.</span>}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !draft.idea.trim()}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {isGenerating ? GENERATING_STEPS[narration] : 'Dựng bản nháp bằng AI'}
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={draft.template.title}
            onChange={(e) => patchTemplate({ title: e.target.value })}
            className="w-full bg-transparent text-xl font-bold tracking-tight text-ink focus:outline-none"
            placeholder="Tên prompt"
          />
          <p className="mt-1 text-sm text-muted">Sửa trực tiếp nội dung từng khối. Khối rỗng sẽ bị bỏ qua khi lắp ráp.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-50"
        >
          {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {isGenerating ? GENERATING_STEPS[narration] : 'Tạo lại'}
        </button>
      </header>

      <div className="space-y-3">
        {draft.template.blocks.map((block) => (
          <div key={block.id} className="group rounded-2xl border border-line bg-panel/80 p-4 transition-colors focus-within:border-violet-400/50">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{block.title}</div>
              <button
                onClick={() => removeBlock(block.id)}
                title="Xoá khối"
                className="cursor-pointer rounded-md p-1 text-faint opacity-0 transition-all hover:bg-hover hover:text-rose-500 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <textarea
              value={block.content}
              onChange={(e) => updateBlockContent(block.id, e.target.value)}
              rows={Math.min(8, Math.max(2, Math.ceil(block.content.length / 90)))}
              className="w-full resize-y bg-transparent text-sm leading-relaxed text-ink placeholder:text-faint focus:outline-none"
              placeholder="Nội dung khối…"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
