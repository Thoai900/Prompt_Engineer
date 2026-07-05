/**
 * Bước 1 — Ý tưởng: mô tả nhiệm vụ + thể loại + persona.
 * Không gọi AI ở bước này (nhập liệu thuần).
 */
import React from 'react';
import { ArrowRight, Drama } from 'lucide-react';
import { AiPersona } from '../../types';
import { STUDIO_CATEGORIES, StudioDraft } from '../../utils/studioFlow';

interface StepIdeaProps {
  draft: StudioDraft;
  personas: AiPersona[];
  onPatch: (patch: Partial<StudioDraft>) => void;
  onNext: () => void;
}

export default function StepIdea({ draft, personas, onPatch, onNext }: StepIdeaProps) {
  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-ink">Bạn muốn AI làm gì?</h2>
        <p className="mt-1 text-sm text-muted">Mô tả càng cụ thể, bản nháp càng sát ý. Một câu cũng đủ để bắt đầu.</p>
      </header>

      <textarea
        value={draft.idea}
        onChange={(e) => onPatch({ idea: e.target.value })}
        placeholder="Ví dụ: Viết kịch bản video TikTok 60 giây về mẹo học từ vựng tiếng Anh cho học sinh cấp 3…"
        rows={4}
        autoFocus
        className="w-full resize-y rounded-2xl border border-line bg-panel/80 p-4 text-sm leading-relaxed text-ink placeholder:text-faint focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />

      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-faint">Thể loại (tuỳ chọn)</div>
        <div className="flex flex-wrap gap-2">
          {STUDIO_CATEGORIES.map((cat) => {
            const selected = draft.category === cat;
            return (
              <button
                key={cat}
                onClick={() => onPatch({ category: selected ? '' : cat })}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  selected
                    ? 'border-violet-400/60 bg-violet-500/10 text-violet-500'
                    : 'border-line bg-panel/60 text-muted hover:border-violet-300/50 hover:text-ink'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
          <Drama size={12} className="text-violet-500" /> Persona (tuỳ chọn)
        </div>
        <select
          value={draft.personaId}
          onChange={(e) => onPatch({ personaId: e.target.value })}
          className="w-full max-w-sm cursor-pointer rounded-xl border border-line bg-panel/80 px-3 py-2.5 text-sm text-ink focus:border-violet-400/60 focus:outline-none"
        >
          <option value="">Không dùng persona</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-faint">Persona sẽ đứng đầu prompt cuối như danh tính của AI thực thi.</p>
      </div>

      <button
        onClick={onNext}
        disabled={!draft.idea.trim()}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Tiếp tục — dựng bản nháp <ArrowRight size={16} />
      </button>
    </section>
  );
}
