import React from 'react';

/**
 * Faint film-grain texture layered over the whole app. Purely decorative,
 * non-interactive, and very low opacity (see `.grain-overlay` in index.css).
 * Rendered once at the app root.
 */
export default function GrainOverlay() {
  return <div aria-hidden className="grain-overlay" />;
}
