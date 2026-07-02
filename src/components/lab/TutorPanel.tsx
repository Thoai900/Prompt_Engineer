import React, { useMemo, useState } from 'react';
import { GraduationCap, Loader2, AlertCircle, BookOpen, Dumbbell, Lightbulb } from 'lucide-react';
import { PromptTemplate } from '../../types';
import { diagnosePromptSkills, type TutorDiagnosis, type SkillGap } from '../../services/aiService';
import { toast } from '../common/Toaster';

interface TutorPanelProps {
  libraryTemplates?: PromptTemplate[];
}

function levelStyle(level: SkillGap['level']) {
  if (level === 'yếu') return { badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', bar: 'bg-rose-400', pct: 33 };
  if (level === 'trung bình') return { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', bar: 'bg-amber-400', pct: 66 };
  return { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', bar: 'bg-emerald-500', pct: 100 };
}

/** Gia sư thích ứng: chẩn đoán kỹ năng từ chính prompt của bạn → bài học nhắm đúng yếu. */
export default function TutorPanel({ libraryTemplates = [] }: TutorPanelProps) {
  const [pasted, setPasted] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TutorDiagnosis | null>(null);

  const libraryPrompts = useMemo(
    () => libraryTemplates
      .map((t) => (t.blocks || []).map((b) => b.content).filter(Boolean).join('\n'))
      .filter((p) => p.trim().length > 0),
    [libraryTemplates],
  );

  const run = async (prompts: string[]) => {
    if (prompts.length === 0) { toast.error('Chưa có prompt để phân tích.'); return; }
    setRunning(true);
    setError('');
    setResult(null);
    try {
      setResult(await diagnosePromptSkills(prompts));
    } catch (e: any) {
      setError(e?.message || 'Chẩn đoán thất bại. Hãy đăng nhập và thử lại.');
    } finally {
      setRunning(false);
    }
  };

  const runLibrary = () => run(libraryPrompts);
  const runPasted = () => run(pasted.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));

  return (
    <>
      <p className="mb-4 text-sm text-muted">Gia sư cá nhân hoá: chẩn đoán kỹ năng viết prompt từ <span className="font-semibold text-ink">chính thư viện của bạn</span>, rồi soạn bài học &amp; bài tập nhắm đúng điểm yếu.</p>

      <div className="mb-6 rounded-2xl border border-line bg-panel p-5">
        {libraryPrompts.length > 0 ? (
          <button onClick={runLibrary} disabled={running} className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
            {running ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
            {running ? 'Đang chẩn đoán…' : `Phân tích thư viện của tôi (${libraryPrompts.length} prompt)`}
          </button>
        ) : (
          <p className="mb-3 text-xs text-faint">Thư viện của bạn chưa có prompt nào — hãy dán prompt bên dưới để phân tích, hoặc lưu vài prompt ở Builder trước.</p>
        )}

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Hoặc dán prompt để phân tích <span className="font-normal normal-case text-faint">(cách nhau bằng dòng trống)</span></label>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder="Dán một hoặc nhiều prompt của bạn…"
          className="mb-3 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
        <button onClick={runPasted} disabled={running || !pasted.trim()} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-muted hover:bg-hover disabled:opacity-50">
          {running ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />} Phân tích phần đã dán
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Chẩn đoán kỹ năng */}
          {result.skills.length > 0 && (
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><BookOpen size={15} className="text-emerald-500" /> Chẩn đoán kỹ năng</h3>
              <div className="space-y-3">
                {result.skills.map((s, i) => {
                  const st = levelStyle(s.level);
                  return (
                    <div key={i}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">{s.skill}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.badge}`}>{s.level}</span>
                      </div>
                      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${st.pct}%` }} />
                      </div>
                      {s.evidence && <p className="text-[11px] italic text-faint">{s.evidence}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bài học nhắm đúng yếu */}
          {result.lessons.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Lightbulb size={15} className="text-emerald-500" /> Bài học cho bạn</h3>
              {result.lessons.map((l, i) => (
                <div key={i} className="rounded-2xl border border-line bg-panel p-4">
                  <h4 className="mb-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">{l.title}</h4>
                  {l.why && <p className="mb-2 text-xs text-muted">{l.why}</p>}
                  {l.tip && <p className="mb-2 rounded-lg bg-surface p-2.5 text-xs leading-relaxed text-ink"><span className="font-bold text-emerald-600 dark:text-emerald-400">Mẹo: </span>{l.tip}</p>}
                  {l.exercise && (
                    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                      <Dumbbell size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span><span className="font-semibold text-ink">Bài tập: </span>{l.exercise}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
