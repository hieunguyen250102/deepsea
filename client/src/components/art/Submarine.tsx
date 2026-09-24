/**
 * The shared submarine: a bright hull with the air track (25 → 0) and six
 * docking hatches. Divers are drawn by the seascape on top, so they can swim
 * out of their hatch; this file exports where those hatches are.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { INK, airColor, diverColor } from '../../lib/theme';

export const SUB_W = 520;
export const SUB_H = 270;

/** Hatch centres in the submarine's own coordinates. */
export const DOCKS = Array.from({ length: 6 }, (_, i) => ({ x: 170 + i * 46, y: 232 }));
/** Where the rope to the first chip leaves the hull. */
export const HATCH = { x: 108, y: 238 };

const COL0 = 110;
const COL_GAP = 28.5;
const ROW_Y = [112, 152];

/** Air value → its circle on the track: 25…13 left to right on top, 0…12 below. */
export function airSpot(n: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(25, n));
  return clamped >= 13
    ? { x: COL0 + (25 - clamped) * COL_GAP, y: ROW_Y[0] }
    : { x: COL0 + clamped * COL_GAP, y: ROW_Y[1] };
}

interface Props {
  air: number;
  width: number;
  /** colours of the divers at this table, to tint their hatches */
  dockColors: number[];
}

export const Submarine = memo(function Submarine({ air, width, dockColors }: Props) {
  const marker = airSpot(air);
  const danger = air <= 5;
  return (
    <svg width={width} height={(width * SUB_H) / SUB_W} viewBox={`0 0 ${SUB_W} ${SUB_H}`} aria-label={`Không khí còn ${air}`}>
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* tail fin and propeller */}
        <path d="M58 118 L14 84 Q8 80 8 88 V210 Q8 218 14 214 L58 184 Z" fill="#dca233" stroke={INK} strokeWidth="6" />
        {/* conning tower + periscope */}
        <path d="M300 34 V14 Q300 6 308 6 H340" fill="none" stroke={INK} strokeWidth="10" />
        <rect x="244" y="28" width="116" height="62" rx="20" fill="#f0c24b" stroke={INK} strokeWidth="6" />
        <circle cx="276" cy="58" r="10" fill="#cfe9ec" stroke={INK} strokeWidth="4" />
        <text x="318" y="66" textAnchor="middle" fontFamily="'Baloo 2', system-ui" fontWeight="800" fontSize="24" fill={INK}>
          O₂
        </text>

        {/* hull */}
        <rect x="40" y="72" width="468" height="186" rx="93" fill="#f0c24b" stroke={INK} strokeWidth="6" />
        <path d="M70 200 Q140 250 260 252 H420 Q490 248 500 196 Q470 236 410 240 H250 Q130 238 70 200 Z" fill="#d9a638" opacity="0.7" />
        <path d="M110 92 Q170 80 250 80" fill="none" stroke="#fff4c8" strokeWidth="7" opacity="0.8" />

        {/* air track */}
        <rect x="88" y="90" width="392" height="84" rx="22" fill={INK} />
        <path
          d={`M${COL0 + 12 * COL_GAP + 13} ${ROW_Y[0]} Q${COL0 + 12 * COL_GAP + 30} ${(ROW_Y[0] + ROW_Y[1]) / 2} ${COL0 + 12 * COL_GAP + 13} ${ROW_Y[1]}`}
          fill="none"
          stroke="#fbf3e1"
          strokeWidth="3"
        />
        {Array.from({ length: 26 }, (_, n) => {
          const { x, y } = airSpot(n);
          const spent = n > air;
          return (
            <g key={n} opacity={spent ? 0.3 : 1}>
              <circle cx={x} cy={y} r="12.5" fill={airColor(n)} />
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Baloo 2', system-ui"
                fontWeight="800"
                fontSize="13"
                fill={INK}
              >
                {n}
              </text>
            </g>
          );
        })}
        {/* the air marker slides along the track */}
        <motion.g
          initial={false}
          animate={{ x: marker.x, y: marker.y }}
          transition={{ type: 'spring', stiffness: 140, damping: 16 }}
        >
          <motion.circle
            r="16"
            fill="none"
            stroke="#e0694e"
            strokeWidth="5"
            animate={danger ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={danger ? { repeat: Infinity, duration: 1.1 } : {}}
          />
        </motion.g>

        {/* docking hatches */}
        {DOCKS.map((d, i) => {
          const c = dockColors[i];
          return (
            <g key={i}>
              <ellipse cx={d.x} cy={d.y + 4} rx="18" ry="8" fill="rgba(19,41,58,0.25)" />
              <ellipse
                cx={d.x}
                cy={d.y}
                rx="18"
                ry="8"
                fill={c !== undefined ? diverColor(c).light : '#e7cf86'}
                stroke={INK}
                strokeWidth="3.5"
              />
            </g>
          );
        })}

        {/* rope hatch */}
        <circle cx={HATCH.x} cy={HATCH.y} r="7" fill="#fbf3e1" stroke={INK} strokeWidth="4" />
      </g>
    </svg>
  );
});
