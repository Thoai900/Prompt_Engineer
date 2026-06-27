import React, { useRef } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Color of the cursor-tracking glow. Defaults to the indigo glow in index.css. */
  glow?: string;
}

/**
 * Wraps content in a card whose hover glow tracks the cursor. The pointer
 * position is written straight to CSS custom properties on mousemove, so the
 * effect runs without triggering a React re-render. Pass `className` to control
 * the card's own surface/border/radius — the glow inherits the radius. Pass
 * `glow` to tint the glow (e.g. an emerald or amber accent per card).
 */
export default function SpotlightCard({ children, className = '', glow, style, ...rest }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`spotlight-card ${className}`}
      style={glow ? ({ '--spot-color': glow, ...style } as React.CSSProperties) : style}
      {...rest}
    >
      {children}
    </div>
  );
}
