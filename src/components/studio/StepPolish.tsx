/**
 * Bước 5 — Nâng cấp (tuỳ chọn, đợt 2): ba công cụ sức mạnh từ Lab thu nhỏ,
 * mỗi cái do người dùng bấm mới chạy (kiểm soát quota):
 *   1. Chạy thử & chấm điểm — chạy prompt thật, giám khảo LLM chấm 0–100.
 *   2. Tối ưu bằng AI — thẩm định (prompt + đầu ra) → các bản vá Áp dụng/Bỏ qua.
 *   3. Bake-off nhanh — so cùng prompt trên 2 model (độ trễ + chi phí ước tính).
 */
import React, { useState } from 'react';
import { Gauge, Loader2, Play, Scale, Wand2 } from 'lucide-react';
import { toast } from '../common/Toaster';
import { DEFAULT_MODEL, GROQ_LLAMA_8B, estimateCostUSD } from '../../config/models';
import { StudioDraft } from '../../utils/studioFlow';
import SuggestionCard from './SuggestionCard';

interface StepPolishProps {
  draft: StudioDraft;
  /** Prompt đã lắp ráp KHÔNG kèm persona. */
  assembledText: string;
  onPatch: (patch: Partial<StudioDraft>) => void;
}

const RUN_USER_CONTENT = 'Hãy thực hiện đúng nhiệm vụ được giao trong hướng dẫn hệ thống ở trên.';

interface BakeoffResult {
  model: string;
  text: string;
  latencyMs: number;
  costUSD: number;
  error?: string;
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-rose-500';
}

export default function StepPolish({ draft, assembledText, onPatch }: StepPolishProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isBaking, setIsBaking] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [bakeoff, setBakeoff] = useState<BakeoffResult[] | null>(null);

  const hasPrompt = assembledText.trim().length > 0;

  // ── 1. Chạy thử & chấm điểm ────────────────────────────────────────────────
  const handleRun = async () => {
    if (!hasPrompt) { toast('Chưa có prompt — dựng bản nháp trước.'); return; }
    setIsRunning(true);
    try {
      const { runPromptOnModel, scoreOutputQuality } = await import('../../services/aiService');
      const { text } = await runPromptOnModel({
        model: DEFAULT_MODEL,
        provider: 'gemini',
        systemInstruction: assembledText,
        userContent: RUN_USER_CONTENT,
      });
      const score = await scoreOutputQuality(text, []);
      onPatch({ runOutput: text, runScore: score });
      toast.success(`Chạy thử xong — giám khảo chấm ${score.score}/100.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Chạy thử thất bại. Thử lại sau.');
    } finally {
      setIsRunning(false);
    }
  };

  // ── 2. Tối ưu bằng AI ──────────────────────────────────────────────────────
  const handleOptimize = async () => {
    if (!draft.runOutput) { toast('Chạy thử trước để có đầu ra cho thẩm định.'); return; }
    setIsOptimizing(true);
    try {
      const { evaluateAndEnhancePrompt } = await import('../../services/aiService');
      const evaluation = await evaluateAndEnhancePrompt(assembledText, draft.runOutput);
      onPatch({ optimizeEval: evaluation });
      if (evaluation.suggestions.length === 0) toast.success('Thẩm định xong — không có đề xuất vá nào.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Thẩm định thất bại. Thử lại sau.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const applySuggestion = (index: number) => {
    if (!draft.template || !draft.optimizeEval) return;
    const s = draft.optimizeEval.suggestions[index];
    const block = {
      id: `studio-opt-${Date.now()}-${index}`,
      type: 'constraints' as const,
      title: `🩹 ${s.title || 'Bản vá tối ưu'}`,
      content: s.content.trim(),
    };
    onPatch({
      template: { ...draft.template, blocks: [...draft.template.blocks, block] },
      optimizeEval: { ...draft.optimizeEval, suggestions: draft.optimizeEval.suggestions.filter((_, i) => i !== index) },
      // Blocks đổi → kết quả lint cũ hết hiệu lực.
      lintIssues: [],
      lintRanAt: null,
    });
    toast.success('Đã nối bản vá vào prompt.');
  };

  const dismissSuggestion = (index: number) => {
    if (!draft.optimizeEval) return;
    onPatch({
      optimizeEval: { ...draft.optimizeEval, suggestions: draft.optimizeEval.suggestions.filter((_, i) => i !== index) },
    });
  };

  // ── 3. Bake-off nhanh ──────────────────────────────────────────────────────
  const handleBakeoff = async () => {
    if (!hasPrompt) { toast('Chưa có prompt — dựng bản nháp trước.'); return; }
    setIsBaking(true);
    setBakeoff(null);
    try {
      const { runPromptOnModel } = await import('../../services/aiService');
      const contenders = [
        { model: DEFAULT_MODEL, provider: 'gemini' as const },
        { model: GROQ_LLAMA_8B, provider: 'groq' as const },
      ];
      const results = await Promise.all(contenders.map(async (c): Promise<BakeoffResult> => {
        try {
          const { text, latencyMs } = await runPromptOnModel({
            model: c.model,
            provider: c.provider,
            systemInstruction: assembledText,
            userContent: RUN_USER_CONTENT,
          });
          return { model: c.model, text, latencyMs, costUSD: estimateCostUSD(c.model, assembledText, text) };
        } catch (err: any) {
          return { model: c.model, text: '', latencyMs: 0, costUSD: 0, error: err?.message || 'Lỗi không rõ' };
        }
      }));
      setBakeoff(results);
    } finally {
      setIsBaking(false);
    }
  };

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-ink">Nâng cấp (tuỳ chọn)</h2>
        <p className="mt-1 text-sm text-muted">
          Ba công cụ đo và tối ưu prompt bằng lượt chạy thật. Mỗi công cụ tốn 1–2 lượt gọi AI, chỉ chạy khi bạn bấm.
        </p>
      </header>

      {/* 1. Chạy thử & chấm điểm */}
      <div className="rounded-2xl border border-line bg-panel/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-violet-500">
              <Gauge size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Chạy thử & chấm điểm</div>
              <div className="text-xs text-muted">Chạy prompt trên {DEFAULT_MODEL}, giám khảo LLM chấm đầu ra 0–100.</div>
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning || !hasPrompt}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {isRunning ? 'Đang chạy…' : draft.runScore ? 'Chạy lại' : 'Chạy thử'}
          </button>
        </div>
        {draft.runScore && (
          <div className="mt-4 border-t border-line/60 pt-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold tracking-tight ${scoreTone(draft.runScore.score)}`}>{draft.runScore.score}</span>
              <span className="text-xs font-semibold text-faint">/100 theo giám khảo LLM</span>
            </div>
            {draft.runScore.feedback && <p className="mt-1.5 text-xs leading-relaxed text-muted">{draft.runScore.feedback}</p>}
            {draft.runOutput && (
              <button onClick={() => setShowOutput(!showOutput)} className="mt-2 cursor-pointer text-[11px] font-semibold text-violet-500 hover:text-violet-400">
                {showOutput ? 'Ẩn đầu ra' : 'Xem đầu ra thử nghiệm'}
              </button>
            )}
            {showOutput && draft.runOutput && (
              <pre className="custom-scrollbar mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-3 font-mono text-[11px] leading-relaxed text-muted">{draft.runOutput}</pre>
            )}
          </div>
        )}
      </div>

      {/* 2. Tối ưu bằng AI */}
      <div className="rounded-2xl border border-line bg-panel/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-violet-500">
              <Wand2 size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Tối ưu bằng AI</div>
              <div className="text-xs text-muted">Thẩm định prompt + đầu ra chạy thử, đề xuất các bản vá nối thêm.</div>
            </div>
          </div>
          <button
            onClick={handleOptimize}
            disabled={isOptimizing || !draft.runOutput}
            title={!draft.runOutput ? 'Cần chạy thử trước' : undefined}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            {isOptimizing ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            {isOptimizing ? 'Đang thẩm định…' : draft.optimizeEval ? 'Thẩm định lại' : 'Thẩm định'}
          </button>
        </div>
        {draft.optimizeEval && (
          <div className="mt-4 space-y-3 border-t border-line/60 pt-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold tracking-tight ${scoreTone(draft.optimizeEval.score)}`}>{draft.optimizeEval.score}</span>
              <span className="text-xs font-semibold text-faint">/100 điểm thẩm định</span>
            </div>
            {draft.optimizeEval.weaknesses.length > 0 && (
              <ul className="space-y-1 text-xs leading-relaxed text-muted">
                {draft.optimizeEval.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2"><span className="text-rose-400">•</span>{w}</li>
                ))}
              </ul>
            )}
            {draft.optimizeEval.suggestions.map((s, i) => (
              <SuggestionCard
                key={`${s.title}-${i}`}
                icon={<Wand2 size={16} />}
                eyebrow="Bản vá"
                title={s.title || 'Bản vá tối ưu'}
                description={s.description || ''}
                applyLabel="Nối vào prompt"
                onApply={() => applySuggestion(i)}
                onDismiss={() => dismissSuggestion(i)}
              />
            ))}
            {draft.optimizeEval.suggestions.length === 0 && (
              <p className="text-xs text-faint">Không còn đề xuất vá nào chờ xử lý.</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Bake-off nhanh */}
      <div className="rounded-2xl border border-line bg-panel/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-violet-500">
              <Scale size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Bake-off nhanh</div>
              <div className="text-xs text-muted">Cùng prompt trên 2 model — so đầu ra, độ trễ, chi phí ước tính. Bản đầy đủ ở tab Lab.</div>
            </div>
          </div>
          <button
            onClick={handleBakeoff}
            disabled={isBaking || !hasPrompt}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            {isBaking ? <Loader2 size={13} className="animate-spin" /> : <Scale size={13} />}
            {isBaking ? 'Đang so tài…' : 'So 2 model'}
          </button>
        </div>
        {bakeoff && (
          <div className="mt-4 grid gap-3 border-t border-line/60 pt-3 md:grid-cols-2">
            {bakeoff.map((r) => (
              <div key={r.model} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink">{r.model}</span>
                  {!r.error && (
                    <span className="text-[10px] font-semibold text-faint">
                      {(r.latencyMs / 1000).toFixed(1)}s · ~${r.costUSD.toFixed(5)}
                    </span>
                  )}
                </div>
                {r.error ? (
                  <p className="mt-2 text-[11px] text-rose-500">{r.error}</p>
                ) : (
                  <pre className="custom-scrollbar mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted">{r.text}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
