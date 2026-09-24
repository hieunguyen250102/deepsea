/** A special die: faces show 1, 2 or 3 pips. */

import { memo } from 'react';
import { INK } from '../../lib/theme';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [30, 30],
    [70, 70],
  ],
  3: [
    [27, 27],
    [50, 50],
    [73, 73],
  ],
};

export const Die = memo(function Die({ value, size = 44 }: { value: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-4 -4 108 108" aria-hidden>
      <rect x="4" y="10" width="92" height="92" rx="20" fill="rgba(4,16,24,0.3)" />
      <rect x="4" y="4" width="92" height="92" rx="20" fill="#fbf3e1" stroke={INK} strokeWidth="5" />
      <path d="M16 20 Q16 14 24 14 H60" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      {(PIPS[value] ?? PIPS[1]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9.5" fill={INK} />
      ))}
    </svg>
  );
});
