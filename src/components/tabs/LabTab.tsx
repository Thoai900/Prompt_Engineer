import React, { useEffect, useState } from 'react';
import { FlaskConical, Scale, Sparkles, Activity, Fingerprint } from 'lucide-react';
import { PromptTemplate } from '../../types';
import BakeoffPanel from '../lab/BakeoffPanel';
import OptimizerPanel from '../lab/OptimizerPanel';
import HealthPanel from '../lab/HealthPanel';
import TastePanel from '../lab/TastePanel';
import { LAB_SEED_EVENT, takeLabSeed, type LabSeed } from '../../services/labSeed';

type LabMode = 'bakeoff' | 'optimizer' | 'health' | 'taste';

const MODES: { id: LabMode; label: string; icon: React.ReactNode }[] = [
  { id: 'bakeoff', label: 'So tài Model', icon: <Scale size={15} /> },
  { id: 'optimizer', label: 'Auto-Optimizer', icon: <Sparkles size={15} /> },
  { id: 'health', label: 'Prompt Health', icon: <Activity size={15} /> },
  { id: 'taste', label: 'Cá nhân hoá', icon: <Fingerprint size={15} /> },
];

/**
 * Lab (Tầng 1 · trung tâm chất lượng prompt). Chứa các công cụ "đo & cải thiện":
 * - Bake-off: so tài cùng prompt trên nhiều model (chất lượng × chi phí × tốc độ).
 * - Auto-Optimizer: tự tiến hoá prompt theo tiêu chí (chạy ở backend).
 * Linter đã thành Prompt Inspector dùng chung; Gia sư chuyển sang Learn; Chain → App sang Project Chain.
 */
interface LabTabProps {
  /** Template của tôi — để vòng chất lượng lưu bản tối ưu thành phiên bản của template gốc. */
  myTemplates?: PromptTemplate[];
  /** Mở một template trong Builder (App.tsx điều hướng). */
  onApplyTemplate?: (t: PromptTemplate) => void;
  /** Lưu một template vào thư viện (App.tsx xử lý Firestore + lịch sử phiên bản). */
  onSaveTemplate?: (t: PromptTemplate) => Promise<void> | void;
}

export default function LabTab({ myTemplates = [], onApplyTemplate, onSaveTemplate }: LabTabProps) {
  const [mode, setMode] = useState<LabMode>('bakeoff');
  // Seed gửi từ tab khác (Prompt Inspector, Health, Library, Studio) → mồi sẵn từng chế độ.
  // Giữ nguyên object seed để panel nhận lại cả khi gửi lặp cùng một prompt.
  const [bakeoffSeed, setBakeoffSeed] = useState('');
  const [optimizerSeed, setOptimizerSeed] = useState<LabSeed | null>(null);
  const [healthSeed, setHealthSeed] = useState<LabSeed | null>(null);

  useEffect(() => {
    const consume = () => {
      const seed = takeLabSeed();
      if (!seed) return;
      if (seed.mode === 'bakeoff') setBakeoffSeed(seed.prompt);
      else if (seed.mode === 'optimizer') setOptimizerSeed(seed);
      else setHealthSeed(seed);
      setMode(seed.mode);
    };
    consume();
    window.addEventListener(LAB_SEED_EVENT, consume);
    return () => window.removeEventListener(LAB_SEED_EVENT, consume);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-surface p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FlaskConical size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Lab <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Tầng 1</span></h2>
            <p className="text-sm text-muted">Trung tâm đo &amp; cải thiện chất lượng prompt.</p>
          </div>
        </div>

        <div className="mb-6 inline-flex max-w-full overflow-x-auto no-scrollbar rounded-xl border border-line bg-panel p-1" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 min-h-10 text-sm font-semibold transition-colors ${mode === m.id ? 'bg-emerald-600 text-white' : 'text-muted hover:text-ink'}`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {mode === 'bakeoff' && <BakeoffPanel initialPrompt={bakeoffSeed} />}
        {mode === 'optimizer' && <OptimizerPanel seed={optimizerSeed} myTemplates={myTemplates} onApplyTemplate={onApplyTemplate} onSaveTemplate={onSaveTemplate} />}
        {mode === 'health' && <HealthPanel seed={healthSeed} />}
        {mode === 'taste' && <TastePanel />}
      </div>
    </div>
  );
}
