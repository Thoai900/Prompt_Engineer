import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';
import claudeImg from '../../../assest/Claude.png';
import gptImg from '../../../assest/GPT.png';
import geminiImg from '../../../assest/Gemini.png';

interface AIModel {
  name: string;
  src: string;
  /** Brand-tinted glow placed behind the active card. */
  glow: string;
  /** Brand color for the active nav dot. */
  dot: string;
}

const MODELS: AIModel[] = [
  { name: 'Claude', src: claudeImg, glow: 'rgba(217,119,87,0.55)', dot: '#d97757' },
  { name: 'ChatGPT', src: gptImg, glow: 'rgba(125,151,255,0.55)', dot: '#8aa0ff' },
  { name: 'Gemini', src: geminiImg, glow: 'rgba(66,133,244,0.55)', dot: '#4285f4' },
];

const AUTO_MS = 3800;

/**
 * 3D coverflow showcase of the supported AI models. The active card sits
 * forward; neighbours rotate back on either side. The stage tilts toward the
 * cursor (motion values — no re-render) and auto-advances unless hovered or the
 * user prefers reduced motion.
 */
export default function AIShowcase3D() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stageW, setStageW] = useState(820);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Track the stage width so the coverflow geometry scales with the viewport.
  // The component mounts while its tab may be hidden (width 0), so ignore zero
  // readings and keep the last good value to avoid collapsing the cards.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setStageW(w);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Auto-advance carousel.
  useEffect(() => {
    if (paused || reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % MODELS.length), AUTO_MS);
    return () => clearInterval(id);
  }, [paused, reduce]);

  // Cursor parallax → subtle stage tilt.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotX = useSpring(useTransform(py, (v) => v * -6), { stiffness: 80, damping: 18 });
  const rotY = useSpring(useTransform(px, (v) => v * 8), { stiffness: 80, damping: 18 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleLeave = () => {
    px.set(0);
    py.set(0);
  };

  const cardW = Math.min(stageW * 0.62, 440);
  const cardH = cardW * (768 / 1371); // preserve image aspect ratio
  const sideX = cardW * 0.64;

  return (
    <div className="w-full flex flex-col items-center select-none">
      <div
        ref={stageRef}
        className="relative w-full max-w-3xl"
        style={{ height: cardH + 90, perspective: 1400 }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onMouseEnter={() => setPaused(true)}
        onMouseOut={() => setPaused(false)}
      >
        {/* Reflective floor glow, brand-tinted to the active card. */}
        <div
          aria-hidden
          className={`absolute left-1/2 bottom-6 h-10 rounded-[100%] blur-2xl pointer-events-none ${reduce ? '' : 'floor-glow'}`}
          style={{
            width: cardW * 0.92,
            transform: 'translateX(-50%)',
            background: `radial-gradient(ellipse at center, ${MODELS[active].glow}, transparent 70%)`,
            zIndex: 0,
          }}
        />
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d', rotateX: reduce ? 0 : rotX, rotateY: reduce ? 0 : rotY }}
        >
          {MODELS.map((m, i) => {
            // shortest signed offset in [-1, 0, 1] for a 3-item loop
            const rel = (((i - active + 1 + MODELS.length) % MODELS.length) - 1);
            const isActive = rel === 0;
            return (
              <motion.button
                key={m.name}
                type="button"
                aria-label={`Xem ${m.name}`}
                onClick={() => setActive(i)}
                className="absolute top-1/2 left-1/2 cursor-pointer rounded-2xl overflow-hidden border border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                style={{ width: cardW, height: cardH, marginLeft: -cardW / 2, marginTop: -cardH / 2, zIndex: 30 - Math.abs(rel) * 10 }}
                animate={{
                  x: rel * sideX,
                  z: isActive ? 0 : -240,
                  rotateY: rel * -42,
                  scale: isActive ? 1 : 0.82,
                  opacity: isActive ? 1 : 0.5,
                  boxShadow: isActive
                    ? `0 0 100px 8px ${m.glow}, 0 30px 60px rgba(0,0,0,0.6)`
                    : '0 18px 40px rgba(0,0,0,0.45)',
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
              >
                <img
                  src={m.src}
                  alt={m.name}
                  draggable={false}
                  className="h-full w-full object-cover pointer-events-none"
                />
                {/* glass sheen + inner ring */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
                {!isActive && <div className="absolute inset-0 bg-slate-950/30 pointer-events-none" />}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* Nav dots */}
      <div className="mt-5 flex items-center gap-2.5">
        {MODELS.map((m, i) => (
          <button
            key={m.name}
            type="button"
            aria-label={`Chuyển tới ${m.name}`}
            onClick={() => setActive(i)}
            className="h-2 rounded-full transition-all duration-300 cursor-pointer"
            style={{
              width: i === active ? 28 : 8,
              backgroundColor: i === active ? m.dot : 'rgb(148 163 184 / 0.4)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
