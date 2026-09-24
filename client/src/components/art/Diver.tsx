/**
 * A chubby toy diver: round helmet with a porthole visor, air tank, flippers.
 * Drawn upright; whoever places it rotates it to show which way it swims.
 */

import { memo } from 'react';
import { INK, diverColor } from '../../lib/theme';

interface Props {
  color: number;
  size?: number;
  /** grey it out (drowned, disconnected) */
  muted?: boolean;
  className?: string;
}

export const Diver = memo(function Diver({ color, size = 48, muted, className }: Props) {
  const c = diverColor(color);
  const body = muted ? '#9aa6ad' : c.body;
  const shade = muted ? '#77848c' : c.shade;
  const light = muted ? '#c9d0d4' : c.light;
  return (
    <svg
      width={size}
      height={size * 1.375}
      viewBox="0 0 64 88"
      className={className}
      aria-hidden
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* air tank behind the shoulders */}
      <rect x="39" y="30" width="13" height="30" rx="6.5" fill="#b9c7cc" stroke={INK} strokeWidth="3" />
      <rect x="42" y="26" width="7" height="6" rx="2" fill="#8d9ca3" stroke={INK} strokeWidth="2.5" />

      {/* flippers */}
      <path d="M18 76 L12 86 H28 L28 76 Z" fill={shade} stroke={INK} strokeWidth="3" />
      <path d="M46 76 L52 86 H36 L36 76 Z" fill={shade} stroke={INK} strokeWidth="3" />

      {/* legs */}
      <rect x="19" y="58" width="11" height="21" rx="5" fill={body} stroke={INK} strokeWidth="3" />
      <rect x="34" y="58" width="11" height="21" rx="5" fill={body} stroke={INK} strokeWidth="3" />

      {/* arms */}
      <rect x="6" y="38" width="11" height="22" rx="5.5" fill={body} stroke={INK} strokeWidth="3" transform="rotate(12 11 40)" />
      <rect x="47" y="38" width="11" height="22" rx="5.5" fill={body} stroke={INK} strokeWidth="3" transform="rotate(-12 53 40)" />

      {/* torso */}
      <path d="M16 40 Q16 32 24 32 H40 Q48 32 48 40 V60 Q48 66 42 66 H22 Q16 66 16 60 Z" fill={body} stroke={INK} strokeWidth="3" />
      <path d="M40 34 Q46 34 46 41 V59 Q46 64 41 64 H37 Q42 60 42 52 V38 Z" fill={shade} opacity="0.55" />
      {/* belt */}
      <rect x="16" y="54" width="32" height="6" fill={INK} />
      <rect x="28" y="53" width="8" height="8" rx="2" fill="#d9dfe1" stroke={INK} strokeWidth="2" />

      {/* helmet */}
      <circle cx="32" cy="21" r="17" fill={body} stroke={INK} strokeWidth="3" />
      <path d="M44 11 A17 17 0 0 1 44 31 A20 20 0 0 0 44 11 Z" fill={shade} opacity="0.6" />
      <circle cx="32" cy="22" r="10.5" fill="#cfe9ec" stroke={INK} strokeWidth="3" />
      <path d="M26 18 A7 7 0 0 1 32 14" fill="none" stroke="#ffffff" strokeWidth="2.6" opacity="0.9" />
      {/* bolts */}
      <circle cx="17.5" cy="22" r="2" fill={light} stroke={INK} strokeWidth="1.6" />
      <circle cx="46.5" cy="22" r="2" fill={light} stroke={INK} strokeWidth="1.6" />
      <circle cx="32" cy="6.5" r="2" fill={light} stroke={INK} strokeWidth="1.6" />
    </svg>
  );
});

/** Just the helmet, for chat lines, lists and tight spots. */
export const DiverHead = memo(function DiverHead({
  color,
  size = 28,
  muted,
}: {
  color: number;
  size?: number;
  muted?: boolean;
}) {
  const c = diverColor(color);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="17" fill={muted ? '#9aa6ad' : c.body} stroke={INK} strokeWidth="3" />
      <path d="M31 9 A17 17 0 0 1 31 31 A20 20 0 0 0 31 9 Z" fill={muted ? '#77848c' : c.shade} opacity="0.6" />
      <circle cx="20" cy="21" r="10" fill="#cfe9ec" stroke={INK} strokeWidth="3" />
      <path d="M14.5 17.5 A6.5 6.5 0 0 1 20 14" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
});
