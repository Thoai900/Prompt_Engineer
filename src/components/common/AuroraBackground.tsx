import React from 'react';

interface AuroraBackgroundProps {
  /**
   * `ambient` (default) — faint app-wide wash used behind every tab.
   * `hero` — brighter, more saturated blobs for the dark hero stage.
   */
  intensity?: 'ambient' | 'hero';
}

/**
 * Ambient, slowly-drifting gradient blobs rendered behind the app content.
 * Pure CSS animation (no JS, no re-renders); frozen for users who prefer
 * reduced motion via the `.aurora-blob` guard in index.css.
 */
export default function AuroraBackground({ intensity = 'ambient' }: AuroraBackgroundProps) {
  const hero = intensity === 'hero';

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className={`aurora-blob animate-aurora-a absolute -left-1/4 -top-1/4 rounded-full ${
          hero
            ? 'h-[65vh] w-[65vh] bg-emerald-400/25 blur-[100px] dark:bg-emerald-500/25'
            : 'h-[60vh] w-[60vh] bg-emerald-300/15 blur-[100px] dark:bg-emerald-500/15'
        }`}
      />
      <div
        className={`aurora-blob animate-aurora-b absolute right-0 top-1/4 rounded-full ${
          hero
            ? 'h-[55vh] w-[55vh] bg-teal-400/20 blur-[110px] dark:bg-teal-500/20'
            : 'h-[55vh] w-[55vh] bg-teal-300/12 blur-[110px] dark:bg-teal-500/12'
        }`}
      />
      <div
        className={`aurora-blob animate-aurora-c absolute bottom-0 left-1/3 rounded-full ${
          hero
            ? 'h-[50vh] w-[50vh] bg-green-400/18 blur-[120px] dark:bg-green-500/18'
            : 'h-[50vh] w-[50vh] bg-emerald-200/12 blur-[120px] dark:bg-emerald-600/12'
        }`}
      />
      {hero && (
        <div className="aurora-blob animate-aurora-a absolute right-1/4 bottom-1/4 h-[42vh] w-[42vh] rounded-full bg-teal-400/15 blur-[100px] dark:bg-teal-500/18" />
      )}
    </div>
  );
}
