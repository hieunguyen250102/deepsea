/**
 * The living sea behind everything: soft light shafts, rising bubbles, a few
 * fish crossing slowly, kelp swaying along the bottom. Pure CSS animation,
 * low contrast, and it switches off with prefers-reduced-motion.
 */

import { memo, useMemo } from 'react';

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function Fish({ flip, color }: { flip?: boolean; color: string }) {
  return (
    <svg width="46" height="24" viewBox="0 0 46 24" style={{ transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden>
      <path d="M4 12 Q14 1 28 5 Q36 8 40 12 Q36 16 28 19 Q14 23 4 12 Z" fill={color} />
      <path d="M38 12 L46 4 V20 Z" fill={color} />
      <circle cx="12" cy="10.5" r="1.8" fill="rgba(11,29,43,0.7)" />
    </svg>
  );
}

function Kelp({ height, color, delay }: { height: number; color: string; delay: number }) {
  return (
    <svg
      width="34"
      height={height}
      viewBox={`0 0 34 ${height}`}
      className="sway"
      style={{ animationDuration: `${5 + delay}s`, animationDelay: `-${delay}s` }}
      aria-hidden
    >
      <path
        d={`M17 ${height} C4 ${height * 0.75} 30 ${height * 0.55} 14 ${height * 0.35} C2 ${height * 0.2} 22 ${height * 0.1} 17 0`}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const Ambience = memo(function Ambience({ dense = false }: { dense?: boolean }) {
  const bubbles = useMemo(() => {
    const rnd = seeded(7);
    return Array.from({ length: dense ? 22 : 14 }, (_, i) => ({
      id: i,
      left: rnd() * 100,
      size: 4 + rnd() * 12,
      duration: 12 + rnd() * 16,
      delay: -rnd() * 28,
      dx: (rnd() - 0.5) * 40,
      opacity: 0.25 + rnd() * 0.35,
    }));
  }, [dense]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }} aria-hidden>
      {/* light from the surface */}
      <svg className="rays absolute inset-x-0 top-0 h-[70vh] w-full" viewBox="0 0 100 70" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9f3ef" stopOpacity="0.16" />
            <stop offset="1" stopColor="#e9f3ef" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points="18,0 26,0 40,70 22,70" fill="url(#ray)" />
        <polygon points="44,0 49,0 60,70 48,70" fill="url(#ray)" />
        <polygon points="66,0 74,0 86,70 70,70" fill="url(#ray)" />
      </svg>

      {/* fish crossing, far away and slow */}
      <div className="drift absolute top-[28%]" style={{ animationDuration: '46s', animationDelay: '-12s' }}>
        <Fish color="rgba(141,196,204,0.22)" flip />
      </div>
      <div className="drift absolute top-[56%]" style={{ animationDuration: '62s', animationDelay: '-40s' }}>
        <div className="scale-75">
          <Fish color="rgba(141,196,204,0.16)" flip />
        </div>
      </div>

      {bubbles.map((b) => (
        <span
          key={b.id}
          className="bubble"
          style={
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              '--dx': `${b.dx}px`,
              '--o': b.opacity,
            } as React.CSSProperties
          }
        />
      ))}

      {/* kelp along the sea floor */}
      <div className="absolute bottom-0 left-2 flex items-end gap-1 opacity-60">
        <Kelp height={120} color="#1f5a4a" delay={0.4} />
        <Kelp height={80} color="#276b57" delay={1.8} />
      </div>
      <div className="absolute bottom-0 right-3 flex items-end gap-1 opacity-60">
        <Kelp height={90} color="#276b57" delay={1.1} />
        <Kelp height={140} color="#1f5a4a" delay={2.6} />
        <Kelp height={70} color="#2d7a62" delay={0.2} />
      </div>
    </div>
  );
});
