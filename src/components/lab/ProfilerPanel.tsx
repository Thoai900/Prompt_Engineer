import React, { useMemo, useState } from 'react';
import { Play, Loader2, BadgeCheck, ShieldCheck, ShieldAlert, ShieldX, ChevronDown } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ALL_MODEL_OPTIONS, GEMINI_FLASH } from '../../config/models';
import { runPromptOnModel } from '../../services/aiService';
import { toast } from '../common/Toaster';
import {
  profileModel, runWithConcurrency, MAX_TOTAL_RUNS,
  type Expectation, type FormatKind, type ModelProfile, type RunSample, type Verdict,
} from '../../utils/profiler';

const MAX_MODELS = 3;
const RUN_OPTIONS = [3, 5, 8];
const TRIGGER = 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.';

const VERDICT_UI: Record<Verdict, { label: string; icon: React.ReactNode; cls: string }> = {
  stable: { label: 'Ổn định', icon: <ShieldCheck size={15} />, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  wobbly: { label: 'Dao động', icon: <ShieldAlert size={15} />, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  brittle: { label: 'Giòn', icon: <ShieldX size={15} />, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
};

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Chi phí cho 1.000 lượt; số rất nhỏ không làm tròn thành $0.00 (dễ hiểu nhầm là miễn phí). */
function fmtCostPer1k(costPerRun: number): string {
  if (!costPerRun) return '—';
  const v = costPerRun * 1000;
  return v < 0.01 ? '< $0.01/1K lượt' : `$${v.toFixed(2)}/1K lượt`;
}

interface ModelResult { profile: ModelProfile; samples: RunSample[] }

/** Prompt Profiler: chạy một prompt nhiều lần để biết nó ổn định hay "giòn" trước khi đưa vào dùng thật. */
export default function ProfilerPanel() {
  const { geminiApiKey, groqApiKey, openaiApiKey, useSystemGeminiKey } = useWorkspace();

  const [promptText, setPromptText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [models, setModels] = useState<string[]>([GEMINI_FLASH]);
  const [runs, setRuns] = useState(5);
  const [expectation, setExpectation] = useState<Expectation>('same');
  const [formatKind, setFormatKind] = useState<FormatKind>('none');
  const [phrases, setPhrases] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ModelResult[]>([]);
  const [openSamples, setOpenSamples] = useState<string | null>(null);

  const total = models.length * runs;
  const overLimit = total > MAX_TOTAL_RUNS;

  const toggleModel = (value: string) => {
    setModels((prev) => {
      if (prev.includes(value)) return prev.filter((m) => m !== value);
      if (prev.length >= MAX_MODELS) { toast(`Chọn tối đa ${MAX_MODELS} model.`); return prev; }
      return [...prev, value];
    });
  };

  const spec = useMemo(() => ({
    kind: formatKind,
    requiredPhrases: phrases.split('\n').map((p) => p.trim()).filter(Boolean),
  }), [formatKind, phrases]);

  const start = async () => {
    if (!promptText.trim()) { toast.error('Nhập prompt cần đo.'); return; }
    if (models.length === 0) { toast.error('Chọn ít nhất một model.'); return; }
    if (overLimit) { toast.error(`Tối đa ${MAX_TOTAL_RUNS} lượt chạy một lần đo.`); return; }

    const apiKeys = {
      gemini: useSystemGeminiKey ? undefined : (geminiApiKey || undefined),
      groq: groqApiKey || undefined,
      openai: openaiApiKey || undefined,
    };
    const userContent = userInput.trim() || TRIGGER;
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total });

    // Lượt chạy xen kẽ giữa các model để một model chậm/lỗi không chặn hết.
    const jobs: Array<{ model: string; idx: number }> = [];
    for (let i = 0; i < runs; i++) for (const m of models) jobs.push({ model: m, idx: i });
    const samples = await runWithConcurrency(jobs.map(({ model }) => async (): Promise<RunSample> => {
      const provider = ALL_MODEL_OPTIONS.find((o) => o.value === model)?.provider || 'gemini';
      try {
        const { text, latencyMs } = await runPromptOnModel({ model, provider, systemInstruction: promptText, userContent, apiKeys });
        return { text, latencyMs };
      } catch (e: any) {
        return { error: e?.message || 'Lỗi không xác định' };
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }), 3);

    const inputText = `${promptText}\n${userContent}`;
    setResults(models.map((model) => {
      const own = samples.filter((_, k) => jobs[k].model === model);
      return { samples: own, profile: profileModel(model, own, inputText, spec, expectation) };
    }));
    setRunning(false);
  };

  const label = (model: string) => ALL_MODEL_OPTIONS.find((m) => m.value === model)?.label || model;

  return (
    <>
      <p className="mb-4 text-sm text-muted">
        Chạy cùng một prompt nhiều lần để xem nó <span className="font-semibold text-ink">ổn định hay "giòn"</span> trước khi đưa vào dùng thật: độ nhất quán, tỉ lệ đúng định dạng, dao động độ dài, độ trễ và chi phí.
      </p>

      <div className="mb-6 rounded-2xl border border-glass-edge glass-1 p-5">
        <label className="mb-1.5 block text-xs font-bold text-muted">Prompt / chỉ dẫn hệ thống</label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={4}
          placeholder="Vd: Phân loại cảm xúc của câu người dùng. Chỉ trả JSON {&quot;nhan&quot;: &quot;tich_cuc|tieu_cuc|trung_tinh&quot;}."
          className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <label className="mb-1.5 block text-xs font-bold text-muted">Đầu vào thử (tuỳ chọn)</label>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          rows={2}
          placeholder="Nội dung người dùng gửi cho prompt. Để trống nếu prompt tự chạy."
          className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-xs font-bold text-muted">Kết quả mong đợi</span>
            <div className="flex flex-col gap-1.5 text-sm text-ink">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="expect" checked={expectation === 'same'} onChange={() => setExpectation('same')} className="mt-1 accent-emerald-600" />
                <span>Nên giống nhau mỗi lần <span className="text-xs text-faint">(trích xuất, phân loại, định dạng cố định)</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="expect" checked={expectation === 'diverse'} onChange={() => setExpectation('diverse')} className="mt-1 accent-emerald-600" />
                <span>Được phép khác nhau <span className="text-xs text-faint">(sáng tác, gợi ý ý tưởng)</span></span>
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="profiler-format" className="mb-1.5 block text-xs font-bold text-muted">Định dạng bắt buộc</label>
            <select
              id="profiler-format"
              value={formatKind}
              onChange={(e) => setFormatKind(e.target.value as FormatKind)}
              className="mb-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="none">Không kiểm</option>
              <option value="json">JSON hợp lệ</option>
              <option value="list">Danh sách gạch đầu dòng / đánh số</option>
            </select>
            <textarea
              value={phrases}
              onChange={(e) => setPhrases(e.target.value)}
              rows={2}
              aria-label="Cụm từ bắt buộc"
              placeholder="Cụm từ phải có trong mọi kết quả — mỗi dòng một cụm (tuỳ chọn)"
              className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <span className="mb-1.5 block text-xs font-bold text-muted">Model (tối đa {MAX_MODELS})</span>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_MODEL_OPTIONS.map((m) => {
            const disabled = m.requiresUserKey && !openaiApiKey;
            const checked = models.includes(m.value);
            return (
              <button
                key={m.value}
                onClick={() => !disabled && toggleModel(m.value)}
                disabled={disabled}
                aria-pressed={checked}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  disabled ? 'cursor-not-allowed border-line bg-surface opacity-50'
                  : checked ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-line bg-surface hover:bg-hover'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line'}`}>{checked && <BadgeCheck size={11} />}</span>
                  <span className="font-semibold text-ink">{m.label}</span>
                </span>
                {disabled && <span className="text-xs text-faint">cần OpenAI key</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            Số lần chạy mỗi model
            <select value={runs} onChange={(e) => setRuns(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink">
              {RUN_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className={`text-xs ${overLimit ? 'font-semibold text-rose-500' : 'text-faint'}`}>
            = {total} lượt gọi{overLimit ? ` (tối đa ${MAX_TOTAL_RUNS})` : ''}
          </span>
          <button
            onClick={start}
            disabled={running || overLimit}
            className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? `Đang chạy ${progress.done}/${progress.total}…` : 'Đo độ ổn định'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map(({ profile: p, samples }) => {
            const v = VERDICT_UI[p.verdict];
            const okCount = p.runs - p.errors;
            return (
              <div key={p.model} className="rounded-2xl border border-glass-edge glass-1 p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{label(p.model)}</span>
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${v.cls}`}>{v.icon} {v.label}</span>
                  <span className="ml-auto text-xs text-faint">{okCount}/{p.runs} lần chạy thành công</span>
                </div>

                <ul className="mb-4 space-y-0.5 text-sm text-muted">
                  {p.reasons.map((r) => <li key={r}>• {r}</li>)}
                </ul>

                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['Nhất quán', p.consistency === null ? '—' : `${p.consistency}/100${expectation === 'diverse' ? ' (không tính)' : ''}`],
                    ['Đúng định dạng', p.formatPassRate === null ? 'không kiểm' : `${Math.round(p.formatPassRate * 100)}%`],
                    ['Độ dài TB', `${p.lengthMean} ký tự ±${Math.round(p.lengthCv * 100)}%`],
                    ['Độ trễ TB', okCount ? fmtMs(p.latencyMean) : '—'],
                    ['Độ trễ p95', okCount ? fmtMs(p.latencyP95) : '—'],
                    ['Chi phí', fmtCostPer1k(p.costPerRun)],
                  ].map(([k, val]) => (
                    <div key={k} className="rounded-xl bg-surface px-3 py-2">
                      <div className="text-faint">{k}</div>
                      <div className="font-bold text-ink">{val}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setOpenSamples((o) => (o === p.model ? null : p.model))}
                  aria-expanded={openSamples === p.model}
                  className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  <ChevronDown size={13} className={openSamples === p.model ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  Xem {samples.length} kết quả
                </button>
                {openSamples === p.model && (
                  <div className="mt-2 space-y-2">
                    {samples.map((s, i) => (
                      <div key={i} className={`rounded-xl border p-3 text-xs ${s.error || p.formatFailures.includes(i) ? 'border-rose-300 dark:border-rose-800' : 'border-line'} bg-surface`}>
                        <div className="mb-1 flex items-center gap-2 text-faint">
                          Lần {i + 1}
                          {s.latencyMs !== undefined && <span>· {fmtMs(s.latencyMs)}</span>}
                          {s.error && <span className="font-semibold text-rose-500">· lỗi</span>}
                          {p.formatFailures.includes(i) && <span className="font-semibold text-rose-500">· sai định dạng</span>}
                        </div>
                        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-ink">{s.error || s.text}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-faint">
            Nhất quán = mức trùng cụm từ giữa các lần chạy (0–100). Chi phí ước tính theo số token xấp xỉ và bảng giá trong cấu hình model.
          </p>
        </div>
      )}
    </>
  );
}
