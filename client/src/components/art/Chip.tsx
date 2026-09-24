/**
 * Treasure chips: triangle, square, pentagon, hexagon for levels 1–4.
 * Face down they show dots for the level; face up, the value.
 */

import { memo } from 'react';
import type { ChipView, Level } from '@shared/types';
import { INK, LEVELS } from '../../lib/theme';

function polygon(sides: number, r: number, cx: number, cy: number): string {
  // Squares sit flat; everything else points up.
  const start = sides === 4 ? -Math.PI / 4 : -Math.PI / 2;
  return Array.from({ length: sides }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / sides;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** Geometry per shape in a 100×100 box: outer radius and the visual centre. */
const SHAPE: Record<Level, { r: number; cy: number; content: number }> = {
  1: { r: 52, cy: 60, content: 66 },
  2: { r: 58, cy: 50, content: 50 },
  3: { r: 49, cy: 54, content: 56 },
  4: { r: 47, cy: 50, content: 50 },
};

interface ChipProps {
  level: Level;
  value?: number;
  size?: number;
  className?: string;
}

export const TreasureChip = memo(function TreasureChip({ level, value, size = 40, className }: ChipProps) {
  const lv = LEVELS[level];
  const s = SHAPE[level];
  const faceUp = value !== undefined;
  const outer = polygon(lv.sides, s.r, 50, s.cy);
  const inner = polygon(lv.sides, s.r * 0.7, 50, s.cy);
  const dotGap = 13;
  const dots = Array.from({ length: level }, (_, i) => 50 + (i - (level - 1) / 2) * dotGap);

  return (
    <svg width={size} height={size} viewBox="-4 -4 108 108" className={className} aria-hidden strokeLinejoin="round">
      {/* soft drop shadow, not a glow */}
      <polygon points={outer} transform="translate(0 5)" fill="rgba(4,16,24,0.28)" />
      <polygon points={outer} fill={faceUp ? '#fbf3e1' : lv.fill} stroke={INK} strokeWidth="5" />
      {faceUp ? (
        <>
          <polygon points={inner} fill="none" stroke={lv.rim} strokeWidth="6" opacity="0.9" />
          <text
            x="50"
            y={s.content + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Baloo 2', system-ui, sans-serif"
            fontWeight="800"
            fontSize={value >= 10 ? 34 : 40}
            fill={INK}
          >
            {value}
          </text>
        </>
      ) : (
        <>
          <polygon points={inner} fill="rgba(255,255,255,0.22)" />
          {/* a highlight along the top-left edge */}
          <polygon points={inner} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeDasharray="30 400" />
          {dots.map((x, i) => (
            <circle key={i} cx={x} cy={s.content} r="5" fill={INK} />
          ))}
        </>
      )}
    </svg>
  );
});

/** A pile of up to three drowned chips that behaves as one. */
export const ChipStack = memo(function ChipStack({
  chips,
  size = 40,
  showCount = true,
}: {
  chips: ChipView[];
  size?: number;
  showCount?: boolean;
}) {
  if (chips.length === 1) return <TreasureChip level={chips[0].level} value={chips[0].value} size={size} />;
  const step = size * 0.14;
  return (
    <div className="relative" style={{ width: size + step * (chips.length - 1), height: size + step * (chips.length - 1) }}>
      {chips.map((c, i) => (
        <div key={c.id} className="absolute" style={{ left: i * step, top: (chips.length - 1 - i) * step }}>
          <TreasureChip level={c.level} value={c.value} size={size} />
        </div>
      ))}
      {showCount && (
        <span
          className="display absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-extrabold leading-none text-sand"
          style={{ fontSize: Math.max(9, size * 0.24) }}
        >
          ×{chips.length}
        </span>
      )}
    </div>
  );
});

/** An empty spot: a pale sand disc where treasure used to be. */
export const BlankChip = memo(function BlankChip({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="54" r="30" fill="rgba(4,16,24,0.25)" />
      <circle cx="50" cy="50" r="30" fill="#d9e6e2" stroke={INK} strokeWidth="4.5" opacity="0.85" />
      <circle cx="50" cy="50" r="19" fill="none" stroke="#9fbcb8" strokeWidth="3" strokeDasharray="5 6" />
    </svg>
  );
});
