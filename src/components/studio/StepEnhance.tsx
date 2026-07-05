/**
 * Bước 3 — Tăng cường: gợi ý Rules & Skills khớp với draft (heuristic thuần,
 * không tốn lượt gọi AI) dưới dạng thẻ Áp dụng / Bỏ qua; kèm kho đầy đủ
 * để tự chọn. Muốn quản lý sâu → deep-link sang tab Rules & Skills.
 */
import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ChevronDown, ExternalLink, ScrollText, Wrench, X } from 'lucide-react';
import { AiRule, AiSkill, TabType } from '../../types';
import { StudioDraft, suggestRules, suggestSkills, toggleId } from '../../utils/studioFlow';
import SuggestionCard from './SuggestionCard';

interface StepEnhanceProps {
  draft: StudioDraft;
  rules: AiRule[];
  skills: AiSkill[];
  onPatch: (patch: Partial<StudioDraft>) => void;
  onNavigateToTab: (tab: TabType) => void;
}

export default function StepEnhance({ draft, rules, skills, onPatch, onNavigateToTab }: StepEnhanceProps) {
  const [showAll, setShowAll] = useState(false);

  const ruleSuggestions = useMemo(() => suggestRules(draft, rules), [draft, rules]);
  const skillSuggestions = useMemo(() => suggestSkills(draft, skills), [draft, skills]);

  const selectedRules = draft.selectedRuleIds
    .map((id) => rules.find((r) => r.id === id))
    .filter((r): r is AiRule => !!r);
  const appliedSkills = draft.appliedSkillIds
    .map((id) => skills.find((s) => s.id === id))
    .filter((s): s is AiSkill => !!s);

  const hasSuggestions = ruleSuggestions.length + skillSuggestions.length > 0;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-ink">Tăng cường bằng Rules & Skills</h2>
        <p className="mt-1 text-sm text-muted">
          Quy tắc là rào chắn, kỹ năng là năng lực — cả hai sẽ được lắp vào prompt cuối. Bước này miễn phí (không gọi AI).
        </p>
      </header>

      {/* Đã gắn */}
      {(selectedRules.length > 0 || appliedSkills.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {selectedRules.map((r) => (
            <button
              key={r.id}
              onClick={() => onPatch({ selectedRuleIds: toggleId(draft.selectedRuleIds, r.id) })}
              title="Bấm để gỡ"
              className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-violet-300/50 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-500 transition-colors hover:bg-violet-500/20 dark:border-violet-800/50"
            >
              <ScrollText size={12} /> {r.title} <X size={11} className="opacity-50 group-hover:opacity-100" />
            </button>
          ))}
          {appliedSkills.map((s) => (
            <button
              key={s.id}
              onClick={() => onPatch({ appliedSkillIds: toggleId(draft.appliedSkillIds, s.id) })}
              title="Bấm để gỡ"
              className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-cyan-300/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-600 transition-colors hover:bg-cyan-500/20 dark:border-cyan-800/50 dark:text-cyan-400"
            >
              <Wrench size={12} /> {s.title} <X size={11} className="opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {/* Đề xuất */}
      <div>
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-faint">Đề xuất cho prompt này</div>
        {hasSuggestions ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <AnimatePresence>
              {ruleSuggestions.map(({ item, matched }) => (
                <SuggestionCard
                  key={`rule-${item.id}`}
                  icon={<ScrollText size={16} />}
                  eyebrow="Quy tắc"
                  title={item.title}
                  description={item.description}
                  reason={`trùng khớp “${matched.slice(0, 3).join(', ')}”`}
                  onApply={() => onPatch({ selectedRuleIds: [...draft.selectedRuleIds, item.id] })}
                  onDismiss={() => onPatch({ dismissedRuleIds: [...draft.dismissedRuleIds, item.id] })}
                />
              ))}
              {skillSuggestions.map(({ item, matched }) => (
                <SuggestionCard
                  key={`skill-${item.id}`}
                  icon={<Wrench size={16} />}
                  eyebrow="Kỹ năng"
                  title={item.title}
                  description={item.description}
                  reason={`trùng khớp “${matched.slice(0, 3).join(', ')}”`}
                  onApply={() => onPatch({ appliedSkillIds: [...draft.appliedSkillIds, item.id] })}
                  onDismiss={() => onPatch({ dismissedSkillIds: [...draft.dismissedSkillIds, item.id] })}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-4 text-xs leading-relaxed text-faint">
            Không tìm thấy đề xuất khớp với chủ đề — bạn vẫn có thể chọn thủ công từ kho bên dưới,
            hoặc bỏ qua bước này.
          </p>
        )}
      </div>

      {/* Kho đầy đủ */}
      <div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-muted transition-colors hover:text-ink"
        >
          <ChevronDown size={14} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
          Kho của bạn ({rules.length} quy tắc · {skills.length} kỹ năng)
        </button>
        {showAll && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              {rules.map((r) => {
                const on = draft.selectedRuleIds.includes(r.id);
                return (
                  <label key={r.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-panel/60 px-3 py-2.5 transition-colors hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onPatch({ selectedRuleIds: toggleId(draft.selectedRuleIds, r.id) })}
                      className="mt-0.5 accent-violet-500"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-ink">{r.title}</span>
                      <span className="block text-[11px] text-faint line-clamp-1">{r.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="space-y-1.5">
              {skills.map((s) => {
                const on = draft.appliedSkillIds.includes(s.id);
                return (
                  <label key={s.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-panel/60 px-3 py-2.5 transition-colors hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onPatch({ appliedSkillIds: toggleId(draft.appliedSkillIds, s.id) })}
                      className="mt-0.5 accent-cyan-500"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-ink">{s.title}</span>
                      <span className="block text-[11px] text-faint line-clamp-1">{s.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <button
          onClick={() => onNavigateToTab('rulesskills')}
          className="mt-3 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-violet-500 transition-colors hover:text-violet-400"
        >
          <ExternalLink size={11} /> Quản lý Rules & Skills đầy đủ
        </button>
      </div>
    </section>
  );
}
