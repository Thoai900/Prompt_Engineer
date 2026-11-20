import React, { useState } from 'react';
import { Plus, Trash2, Loader2, Wand2, Copy, Check, ExternalLink, Save } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ALL_MODEL_OPTIONS, GEMINI_FLASH } from '../../config/models';
import { generateJsonText, runPromptOnModel } from '../../services/aiService';
import { PromptTemplate } from '../../types';
import { promptToTemplate } from '../../utils/labUtils';
import { toast } from '../common/Toaster';
import {
  validateExamples, runInduction, MAX_EXAMPLES, MAX_ROUNDS,
  type Example, type InductionRound,
} from '../../utils/promptInduction';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

interface Props {
  onApplyTemplate?: (t: PromptTemplate) => void;
  onSaveTemplate?: (t: PromptTemplate) => Promise<void> | void;
}

/** Suy ngược prompt từ các cặp Đầu vào → Đầu ra mong muốn, có chạy thử và tự sửa. */
export default function InductionPanel({ onApplyTemplate, onSaveTemplate }: Props) {
  const { geminiApiKey, groqApiKey, openaiApiKey, useSystemGeminiKey } = useWorkspace();
  const [examples, setExamples] = useState<Example[]>([{ input: '', output: '' }, { input: '', output: '' }]);
  const [hint, setHint] = useState('');
  const [model, setModel] = useState(GEMINI_FLASH);
  const [rounds, setRounds] = useState(MAX_ROUNDS);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ rounds: InductionRound[]; best: InductionRound } | null>(null);
  const [copied, setCopied] = useState(false);

  const setExample = (i: number, patch: Partial<Example>) =>
    setExamples((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const start = async () => {
    const v = validateExamples(examples);
    if (v.ok === false) { toast.error(v.error); return; }
    const apiKeys = {
      gemini: useSystemGeminiKey ? undefined : (geminiApiKey || undefined),
      groq: groqApiKey || undefined,
      openai: openaiApiKey || undefined,
    };
    const provider = ALL_MODEL_OPTIONS.find((m) => m.value === model)?.provider || 'gemini';
    setRunning(true);
    setResult(null);
    try {
      const r = await runInduction(v.examples, { hint, rounds }, {
        ask: (req) => generateJsonText(req, { apiKey: apiKeys.gemini, groqApiKey: apiKeys.groq }),
        run: async (systemInstruction, input) =>
          (await runPromptOnModel({ model, provider, systemInstruction, userContent: input, apiKeys })).text,
        onProgress: setProgress,
      });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message || 'Không suy ngược được prompt.');
    } finally {
      setRunning(false);
      setProgress('');
    }
  };

  const best = result?.best;
  const copyPrompt = async () => {
    if (!best) return;
    try { await navigator.clipboard.writeText(best.prompt); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error('Không sao chép được.'); }
  };

  return (
    <>
      <p className="mb-4 text-sm text-muted">
        Có sẵn vài cặp <span className="font-semibold text-ink">đầu vào → đầu ra mong muốn</span> nhưng chưa có prompt? AI suy ngược prompt từ ví dụ, chạy thử trên chính các ví dụ đó, chấm mức khớp và tự sửa.
      </p>

      <div className="mb-6 rounded-2xl border border-glass-edge glass-1 p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-muted">Cặp ví dụ ({examples.length}/{MAX_EXAMPLES})</span>
          <button
            onClick={() => setExamples((p) => [...p, { input: '', output: '' }])}
            disabled={examples.length >= MAX_EXAMPLES}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-600 disabled:opacity-40 dark:text-emerald-400"
          >
            <Plus size={13} /> Thêm cặp
          </button>
        </div>
        <div className="mb-4 space-y-3">
          {examples.map((e, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`ex-in-${i}`} className="mb-1 block text-xs font-semibold text-faint">Đầu vào {i + 1}</label>
                <textarea
                  id={`ex-in-${i}`}
                  value={e.input}
                  onChange={(ev) => setExample(i, { input: ev.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor={`ex-out-${i}`} className="text-xs font-semibold text-faint">Đầu ra mong muốn {i + 1}</label>
                  {examples.length > 2 && (
                    <button onClick={() => setExamples((p) => p.filter((_, j) => j !== i))} aria-label={`Xoá cặp ${i + 1}`} className="text-faint hover:text-rose-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <textarea
                  id={`ex-out-${i}`}
                  value={e.output}
                  onChange={(ev) => setExample(i, { output: ev.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <label htmlFor="induce-hint" className="mb-1.5 block text-xs font-bold text-muted">Gợi ý (tuỳ chọn)</label>
        <input
          id="induce-hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Vd: đây là bài toán phân loại cảm xúc cho bình luận khách hàng"
          className="mb-4 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            Model chạy thử
            <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink">
              {ALL_MODEL_OPTIONS.filter((m) => !m.requiresUserKey || openaiApiKey).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            Số vòng
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink">
              {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button
            onClick={start}
            disabled={running}
            className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {running ? (progress || 'Đang chạy…') : 'Suy ngược prompt'}
          </button>
        </div>
      </div>

      {result && best && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-glass-edge glass-1 p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-ink">Prompt tốt nhất (vòng {best.round})</span>
              <span className={`text-2xl font-black ${scoreColor(best.average)}`}>{best.average}</span>
              <span className="text-xs text-faint">điểm khớp trung bình</span>
              {result.rounds.length > 1 && (
                <span className="text-xs text-muted">· {result.rounds.map((r) => `vòng ${r.round}: ${r.average}`).join(' → ')}</span>
              )}
            </div>
            <pre className="mb-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-3 text-xs text-ink">{best.prompt}</pre>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyPrompt} className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted hover:bg-hover">
                {copied ? <Check size={13} /> : <Copy size={13} />} Sao chép
              </button>
              {onApplyTemplate && (
                <button onClick={() => onApplyTemplate(promptToTemplate(best.prompt, 'suy-nguoc'))} className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted hover:bg-hover">
                  <ExternalLink size={13} /> Mở trong Builder
                </button>
              )}
              {onSaveTemplate && (
                <button
                  onClick={async () => { await onSaveTemplate(promptToTemplate(best.prompt, 'suy-nguoc')); }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  <Save size={13} /> Lưu vào thư viện
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-glass-edge glass-1 p-5">
            <div className="mb-3 text-xs font-bold text-muted">Chạy thử prompt trên từng ví dụ</div>
            <div className="space-y-3">
              {best.scored.map((s, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface p-3 text-xs">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold text-ink">Cặp {i + 1}</span>
                    <span className={`font-black ${scoreColor(s.score)}`}>{s.score}</span>
                    <span className="truncate text-muted" title={s.reason}>{s.reason}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-faint">Mong muốn</div>
                      <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-panel p-2 text-ink">{s.expected}</pre>
                    </div>
                    <div>
                      <div className="mb-1 text-faint">Thực tế</div>
                      <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-panel p-2 text-ink">{s.error ? `Lỗi: ${s.error}` : s.actual}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
