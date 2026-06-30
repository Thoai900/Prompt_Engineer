import React, { useMemo, useState } from 'react';
import { Play, Loader2, Plus, X, Gauge, Trophy, BadgeCheck, AlertCircle, Coins } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ALL_MODEL_OPTIONS, estimateCostUSD } from '../../config/models';
import { runPromptOnModel, scoreOutputQuality } from '../../services/aiService';
import { toast } from '../common/Toaster';

type RunState = 'running' | 'scoring' | 'done' | 'error';

interface ModelResult {
  state: RunState;
  text?: string;
  latencyMs?: number;
  costUSD?: number;
  score?: number;
  feedback?: string;
  error?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function fmtLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function fmtCostPer1k(costUSD: number): string {
  return `$${(costUSD * 1000).toFixed(2)} / 1K lượt`;
}

/** So tài cùng một prompt trên nhiều model: chất lượng × chi phí × tốc độ. */
export default function BakeoffPanel() {
  const { geminiApiKey, groqApiKey, openaiApiKey, useSystemGeminiKey } = useWorkspace();

  const [promptText, setPromptText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [criterionDraft, setCriterionDraft] = useState('');
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    () => new Set(ALL_MODEL_OPTIONS.filter((m) => !m.requiresUserKey).map((m) => m.value)),
  );
  const [results, setResults] = useState<Record<string, ModelResult>>({});
  const [running, setRunning] = useState(false);

  const hasOpenAiKey = !!openaiApiKey;

  const toggleModel = (value: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const addCriterion = () => {
    const c = criterionDraft.trim();
    if (!c) return;
    setCriteria((prev) => [...prev, c]);
    setCriterionDraft('');
  };

  const { bestQualityModel, bestValueModel } = useMemo(() => {
    const done = Object.entries(results).filter(([, r]) => r.state === 'done' && typeof r.score === 'number');
    if (done.length === 0) return { bestQualityModel: null as string | null, bestValueModel: null as string | null };
    const maxScore = Math.max(...done.map(([, r]) => r.score!));
    const bestQuality = done.find(([, r]) => r.score === maxScore)?.[0] ?? null;
    const value = done
      .filter(([, r]) => r.score! >= maxScore - 8)
      .sort((a, b) => (a[1].costUSD ?? 0) - (b[1].costUSD ?? 0))[0]?.[0] ?? null;
    return { bestQualityModel: bestQuality, bestValueModel: value };
  }, [results]);

  const runBakeoff = async () => {
    if (!promptText.trim()) { toast.error('Hãy nhập prompt cần so tài.'); return; }
    if (selectedModels.size === 0) { toast.error('Chọn ít nhất một model.'); return; }

    setRunning(true);
    const sys = promptText.trim();
    const userContent = userInput.trim() || 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.';
    const models = ALL_MODEL_OPTIONS.filter((m) => selectedModels.has(m.value));
    setResults(Object.fromEntries(models.map((m) => [m.value, { state: 'running' as RunState }])));

    const apiKeys = {
      gemini: useSystemGeminiKey ? undefined : (geminiApiKey || undefined),
      groq: groqApiKey || undefined,
      openai: openaiApiKey || undefined,
    };

    await Promise.allSettled(models.map(async (m) => {
      try {
        const { text, latencyMs } = await runPromptOnModel({
          model: m.value, provider: m.provider, systemInstruction: sys, userContent, apiKeys,
        });
        const costUSD = estimateCostUSD(m.value, sys + userContent, text);
        setResults((prev) => ({ ...prev, [m.value]: { ...prev[m.value], state: 'scoring', text, latencyMs, costUSD } }));

        const q = await scoreOutputQuality(text, criteria);
        setResults((prev) => ({ ...prev, [m.value]: { ...prev[m.value], state: 'done', score: q.score, feedback: q.feedback } }));
      } catch (e: any) {
        setResults((prev) => ({ ...prev, [m.value]: { state: 'error', error: e?.message || 'Lỗi không xác định' } }));
      }
    }));

    setRunning(false);
  };

  const resultEntries = ALL_MODEL_OPTIONS.filter((m) => results[m.value]);

  return (
    <>
      <p className="mb-4 text-sm text-muted">Chạy cùng một prompt trên nhiều model — đo chất lượng × chi phí × tốc độ để chọn model đáng tiền nhất.</p>

      <div className="mb-6 rounded-2xl border border-line bg-panel p-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Prompt / chỉ dẫn hệ thống</label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={4}
          placeholder="Vd: Bạn là chuyên gia tóm tắt. Tóm tắt văn bản người dùng thành 3 gạch đầu dòng súc tích…"
          className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Đầu vào thử (tuỳ chọn)</label>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={2}
          placeholder="Nội dung người dùng gửi cho prompt ở trên. Để trống nếu prompt tự chạy."
          className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Tiêu chí chấm điểm <span className="font-normal normal-case text-faint">(trống = giám khảo dùng tiêu chí mặc định)</span></label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {criteria.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {c}
              <button onClick={() => setCriteria((prev) => prev.filter((_, j) => j !== i))} className="text-emerald-500 hover:text-emerald-700" aria-label={`Xoá tiêu chí ${c}`}><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="mb-4 flex gap-2">
          <input
            value={criterionDraft}
            onChange={(e) => setCriterionDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCriterion(); } }}
            placeholder="Vd: Đúng trọng tâm, không bịa thông tin…"
            className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button onClick={addCriterion} className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-hover"><Plus size={14} /> Thêm</button>
        </div>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Model tham gia</label>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_MODEL_OPTIONS.map((m) => {
            const disabled = m.requiresUserKey && !hasOpenAiKey;
            const checked = selectedModels.has(m.value);
            return (
              <button
                key={m.value}
                onClick={() => toggleModel(m.value, disabled)}
                disabled={disabled}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  disabled ? 'cursor-not-allowed border-line bg-surface opacity-50'
                  : checked ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-line bg-surface hover:bg-hover'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line'}`}>{checked && <BadgeCheck size={11} />}</span>
                  <span className="font-semibold text-ink">{m.label}</span>
                </span>
                {disabled && <span className="text-[10px] text-faint">cần OpenAI key</span>}
              </button>
            );
          })}
        </div>

        <button
          onClick={runBakeoff}
          disabled={running}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? 'Đang so tài…' : 'Chạy Bake-off'}
        </button>
      </div>

      {resultEntries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resultEntries.map((m) => {
            const r = results[m.value];
            const isBestQuality = bestQualityModel === m.value;
            const isBestValue = bestValueModel === m.value;
            return (
              <div key={m.value} className={`rounded-2xl border bg-panel p-4 ${isBestValue ? 'border-emerald-400 ring-1 ring-emerald-400/40' : 'border-line'}`}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-ink">{m.label}</span>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {isBestValue && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><Trophy size={10} /> Đáng giá nhất</span>}
                    {isBestQuality && !isBestValue && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Gauge size={10} /> Chất lượng nhất</span>}
                  </div>
                </div>

                {r.state === 'running' && <div className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> Đang chạy model…</div>}
                {r.state === 'scoring' && <div className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> Đang chấm điểm…</div>}
                {r.state === 'error' && (
                  <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span className="break-words">{r.error}</span>
                  </div>
                )}

                {r.state === 'done' && (
                  <>
                    <div className="mb-3 flex items-end gap-4">
                      <div>
                        <div className={`text-3xl font-black leading-none ${scoreColor(r.score ?? 0)}`}>{r.score}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">chất lượng</div>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted">
                        <span className="flex items-center gap-1"><Gauge size={12} /> {fmtLatency(r.latencyMs ?? 0)}</span>
                        <span className="flex items-center gap-1"><Coins size={12} /> {fmtCostPer1k(r.costUSD ?? 0)}</span>
                      </div>
                    </div>
                    {r.feedback && <p className="mb-2 text-[11px] italic leading-relaxed text-faint">{r.feedback}</p>}
                    <details className="text-xs">
                      <summary className="cursor-pointer font-semibold text-muted hover:text-ink">Xem đầu ra</summary>
                      <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-2.5 font-mono text-[11px] leading-relaxed text-ink">{r.text}</pre>
                    </details>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
