import React, { useEffect, useState } from 'react';
import { Target, Loader2, Dumbbell, CheckCircle2, RotateCcw } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { generateJsonText } from '../../services/aiService';
import { loadMistakeLog, markBucketPracticed, MISTAKE_LOG_EVENT } from '../../services/mistakeLogService';
import {
  recurringMistakes, buildDrillRequest, buildGradeRequest, parseDrill, parseGrade, PASS_SCORE,
  type Drill, type DrillGrade, type RecurringMistake,
} from '../../utils/mistakeLog';
import { toast } from '../common/Toaster';

/**
 * Gia sư cá nhân hoá: các lỗi prompt bạn mắc lặp lại (ghi từ Prompt Inspector / Studio) →
 * bài luyện riêng cho từng lỗi; luyện đạt thì lỗi đó chỉ được đếm lại từ lần mắc sau.
 */
export default function MistakeCoach() {
  const { geminiApiKey, groqApiKey, useSystemGeminiKey } = useWorkspace();
  const [mistakes, setMistakes] = useState<RecurringMistake[]>(() => recurringMistakes(loadMistakeLog()));
  const [active, setActive] = useState<RecurringMistake | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [answer, setAnswer] = useState('');
  const [grade, setGrade] = useState<DrillGrade | null>(null);
  const [busy, setBusy] = useState<'drill' | 'grade' | null>(null);

  useEffect(() => {
    const refresh = () => setMistakes(recurringMistakes(loadMistakeLog()));
    window.addEventListener(MISTAKE_LOG_EVENT, refresh);
    return () => window.removeEventListener(MISTAKE_LOG_EVENT, refresh);
  }, []);

  const opts = {
    apiKey: useSystemGeminiKey ? undefined : (geminiApiKey || undefined),
    groqApiKey: groqApiKey || undefined,
    temperature: 0.7,
  };

  const startDrill = async (m: RecurringMistake) => {
    setActive(m);
    setDrill(null);
    setGrade(null);
    setAnswer('');
    setBusy('drill');
    try {
      const d = parseDrill(await generateJsonText(buildDrillRequest(m), opts));
      if (!d) throw new Error('AI không tạo được bài luyện — thử lại.');
      setDrill(d);
      setAnswer(d.flawedPrompt); // sửa trực tiếp trên prompt gốc
    } catch (e: any) {
      toast.error(e?.message || 'Không tạo được bài luyện.');
      setActive(null);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!active || !drill) return;
    if (answer.trim() === drill.flawedPrompt.trim()) { toast('Bạn chưa sửa gì — chỉnh prompt rồi nộp nhé.'); return; }
    setBusy('grade');
    try {
      const g = parseGrade(await generateJsonText(buildGradeRequest(active.label, drill, answer), { ...opts, temperature: 0.2 }));
      if (!g) throw new Error('AI không chấm được — thử lại.');
      setGrade(g);
      if (g.score >= PASS_SCORE) {
        markBucketPracticed(active.bucket);
        toast.success(`Đạt ${g.score} điểm — đã ghi nhận bạn luyện xong lỗi "${active.label}".`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Không chấm được bài.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-glass-edge glass-1 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Target size={18} className="text-rose-500" />
        <h3 className="text-base font-bold text-ink">Lỗi bạn hay mắc</h3>
      </div>
      <p className="mb-4 text-xs text-muted">
        Ghi lại từ những lần bạn bấm "Kiểm tra prompt" (Prompt Inspector, Studio) trong 30 ngày — lỗi lặp lại từ 2 lần trở lên có bài luyện riêng.
      </p>

      {mistakes.length === 0 ? (
        <p className="text-sm text-faint">
          Chưa thấy lỗi lặp lại. Dùng "Kiểm tra prompt" khi soạn prompt — gia sư sẽ nhận ra thói quen cần sửa của bạn.
        </p>
      ) : (
        <div className="space-y-2">
          {mistakes.slice(0, 3).map((m) => (
            <div key={m.bucket} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">{m.label}</span>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{m.count} lần</span>
                <button
                  onClick={() => startDrill(m)}
                  disabled={busy !== null}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {busy === 'drill' && active?.bucket === m.bucket ? <Loader2 size={12} className="animate-spin" /> : <Dumbbell size={12} />}
                  Luyện ngay
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">{m.advice}</p>
              {m.examples[0] && <p className="mt-1 text-xs italic text-faint">Gần nhất: “{m.examples[0]}”</p>}
            </div>
          ))}
        </div>
      )}

      {active && drill && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="mb-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">Bài luyện · {active.label}</div>
          <p className="mb-1 text-sm font-semibold text-ink">{drill.task}</p>
          {drill.hint && <p className="mb-2 text-xs text-muted">Gợi ý: {drill.hint}</p>}
          <label htmlFor="drill-answer" className="mb-1 block text-xs font-bold text-muted">Sửa prompt dưới đây</label>
          <textarea
            id="drill-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            className="mb-2 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy !== null} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
              {busy === 'grade' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Nộp bài
            </button>
            <button onClick={() => setAnswer(drill.flawedPrompt)} disabled={busy !== null} className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-hover">
              <RotateCcw size={13} /> Làm lại
            </button>
          </div>

          {grade && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-black ${grade.score >= PASS_SCORE ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{grade.score}</span>
                <span className="text-xs text-muted">{grade.score >= PASS_SCORE ? 'Đạt — lỗi này được tính lại từ lần mắc sau.' : `Chưa đạt (cần ${PASS_SCORE}) — sửa tiếp rồi nộp lại.`}</span>
              </div>
              {grade.feedback && <p className="text-ink">{grade.feedback}</p>}
              {grade.improved && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-emerald-600 dark:text-emerald-400">Xem một bản sửa tham khảo</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-surface p-2 text-xs text-ink">{grade.improved}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
