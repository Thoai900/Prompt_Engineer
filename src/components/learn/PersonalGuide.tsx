import React, { useMemo, useState } from 'react';
import { Sparkles, GraduationCap, Loader2, RefreshCw, ChevronRight, Trophy } from 'lucide-react';
import { PromptTemplate } from '../../types';
import { diagnosePromptSkills, type TutorDiagnosis } from '../../services/aiService';
import { toast } from '../common/Toaster';
import { type LearnModuleId, pickFocusSkill, suggestModuleForSkill } from '../../utils/learnProgress';

const CACHE_KEY = 'learn_guide_diagnosis';

interface PersonalGuideProps {
  libraryTemplates?: PromptTemplate[];
  onNavigate: (view: LearnModuleId) => void;
}

function readCache(): TutorDiagnosis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.skills) ? (parsed as TutorDiagnosis) : null;
  } catch {
    return null;
  }
}

/** "Dành riêng cho bạn": chẩn đoán kỹ năng từ prompt thật trong Thư viện → gợi ý đúng module cần luyện. */
export default function PersonalGuide({ libraryTemplates = [], onNavigate }: PersonalGuideProps) {
  const [diagnosis, setDiagnosis] = useState<TutorDiagnosis | null>(readCache);
  const [running, setRunning] = useState(false);

  const prompts = useMemo(
    () => libraryTemplates
      .map((t) => (t.blocks || []).map((b) => b.content).filter(Boolean).join('\n'))
      .filter((p) => p.trim().length > 0),
    [libraryTemplates],
  );

  const run = async () => {
    if (prompts.length === 0) {
      toast.info('Thư viện chưa có prompt nào — hãy lưu vài prompt ở Builder trước nhé.');
      return;
    }
    setRunning(true);
    try {
      const result = await diagnosePromptSkills(prompts);
      setDiagnosis(result);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch { /* quota — bỏ qua */ }
    } catch (e: any) {
      toast.error(e?.message || 'Chẩn đoán thất bại. Hãy đăng nhập và thử lại.');
    } finally {
      setRunning(false);
    }
  };

  const focus = diagnosis ? pickFocusSkill(diagnosis.skills) : null;
  const suggestion = focus ? suggestModuleForSkill(focus.skill) : null;
  const levelBadge = focus?.level === 'yếu'
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-amber-500" />
          <h3 className="text-lg font-bold text-ink">Dành riêng cho bạn</h3>
        </div>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
          Chẩn đoán từ thư viện của bạn
        </span>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20 dark:to-orange-950/10">
        {!diagnosis ? (
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel text-xl shadow-sm">🎯</div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-ink">AI Gia sư chẩn đoán điểm yếu của bạn</h4>
              <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
                Phân tích các prompt bạn đã lưu trong Thư viện để tìm kỹ năng cần luyện nhất, rồi dẫn bạn tới đúng bài học hoặc phòng lab.
              </p>
              <button
                onClick={run}
                disabled={running || prompts.length === 0}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
                {running ? 'Đang chẩn đoán…' : `Chẩn đoán ngay (${prompts.length} prompt)`}
              </button>
              {prompts.length === 0 && (
                <p className="mt-2 text-[11px] text-faint">
                  Thư viện đang trống — hãy lưu vài prompt ở Builder, hoặc dùng chế độ Gia sư trong Lab để dán prompt tự do.
                </p>
              )}
            </div>
          </div>
        ) : focus && suggestion ? (
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel text-xl shadow-sm">🎯</div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-bold text-ink">Kỹ năng cần luyện: {focus.skill}</h4>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${levelBadge}`}>{focus.level}</span>
              </div>
              {focus.evidence && (
                <p className="mt-1 text-[11px] italic text-faint">Bằng chứng từ prompt của bạn: “{focus.evidence}”</p>
              )}
              <p className="mb-3 mt-1.5 text-xs leading-relaxed text-muted">{suggestion.reason}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onNavigate(suggestion.view)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-600 hover:scale-105 active:scale-95"
                >
                  Luyện ngay: {suggestion.title} <ChevronRight size={14} />
                </button>
                <button
                  onClick={run}
                  disabled={running}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-hover disabled:opacity-50"
                >
                  {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Chẩn đoán lại
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-panel text-amber-500 shadow-sm">
              <Trophy size={22} />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-ink">Các kỹ năng cốt lõi của bạn đều Tốt!</h4>
              <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
                Không còn điểm yếu rõ rệt — hãy mài sắc "mắt thẩm định" của bạn ở Đấu trường, hoặc thử thách bản thân trong các Phòng Lab.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onNavigate('versus')}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-600 hover:scale-105 active:scale-95"
                >
                  Vào Đấu trường Versus <ChevronRight size={14} />
                </button>
                <button
                  onClick={run}
                  disabled={running}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-hover disabled:opacity-50"
                >
                  {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Chẩn đoán lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
