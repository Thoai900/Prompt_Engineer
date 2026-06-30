import React, { useState } from 'react';
import { FlaskConical, Scale, Sparkles, Activity, ShieldCheck, Fingerprint } from 'lucide-react';
import BakeoffPanel from '../lab/BakeoffPanel';
import OptimizerPanel from '../lab/OptimizerPanel';
import HealthPanel from '../lab/HealthPanel';
import LinterPanel from '../lab/LinterPanel';
import TastePanel from '../lab/TastePanel';

type LabMode = 'bakeoff' | 'optimizer' | 'health' | 'linter' | 'taste';

/**
 * Lab (Tầng 1 · trung tâm chất lượng prompt). Chứa các công cụ "đo & cải thiện":
 * - Bake-off: so tài cùng prompt trên nhiều model (chất lượng × chi phí × tốc độ).
 * - Auto-Optimizer: tự tiến hoá prompt theo tiêu chí (chạy ở backend).
 */
export default function LabTab() {
  const [mode, setMode] = useState<LabMode>('bakeoff');

  return (
    <div className="flex-1 overflow-y-auto bg-surface p-6">
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

        <div className="mb-6 inline-flex rounded-xl border border-line bg-panel p-1">
          <button
            onClick={() => setMode('bakeoff')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === 'bakeoff' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-ink'}`}
          >
            <Scale size={15} /> So tài Model
          </button>
          <button
            onClick={() => setMode('optimizer')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === 'optimizer' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-ink'}`}
          >
            <Sparkles size={15} /> Auto-Optimizer
          </button>
          <button
            onClick={() => setMode('health')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === 'health' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-ink'}`}
          >
            <Activity size={15} /> Prompt Health
          </button>
          <button
            onClick={() => setMode('linter')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === 'linter' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-ink'}`}
          >
            <ShieldCheck size={15} /> Linter
          </button>
          <button
            onClick={() => setMode('taste')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === 'taste' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-ink'}`}
          >
            <Fingerprint size={15} /> Cá nhân hoá
          </button>
        </div>

        {mode === 'bakeoff' && <BakeoffPanel />}
        {mode === 'optimizer' && <OptimizerPanel />}
        {mode === 'health' && <HealthPanel />}
        {mode === 'linter' && <LinterPanel />}
        {mode === 'taste' && <TastePanel />}
      </div>
    </div>
  );
}
