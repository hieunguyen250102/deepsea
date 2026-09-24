/**
 * The last roll: two dice tumble, settle on the real faces, then the sum
 * is worked out in plain sight — minus one for every treasure carried.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameEvent, PublicPlayer } from '@shared/types';
import { ANIM } from '@shared/timing';
import { Die } from './art/Die';
import { DiverHead } from './art/Diver';

type RollEvent = Extract<GameEvent, { type: 'roll' }>;

const randomFace = () => 1 + Math.floor(Math.random() * 3);

export function DiceTray({ roll, players, compact }: { roll: RollEvent | null; players: PublicPlayer[]; compact?: boolean }) {
  const [tumbling, setTumbling] = useState(false);
  const [faces, setFaces] = useState<[number, number]>([1, 1]);

  useEffect(() => {
    // The parent only hands over rolls that just happened, never replayed history.
    if (!roll) return;
    setTumbling(true);
    const spin = setInterval(() => setFaces([randomFace(), randomFace()]), 90);
    const stop = setTimeout(() => {
      clearInterval(spin);
      setFaces(roll.dice);
      setTumbling(false);
    }, ANIM.dice - 120);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [roll?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!roll) return null;
  const who = players.find((p) => p.id === roll.playerId);
  const size = compact ? 30 : 38;

  return (
    <div className="flex items-center gap-2.5">
      {who && <DiverHead color={who.color} size={compact ? 22 : 26} />}
      <div className="flex gap-1.5">
        {faces.map((f, i) => (
          <motion.div
            key={i}
            animate={
              tumbling
                ? { rotate: [0, 90, 180, 270, 360], y: [0, -10, 0, -6, 0] }
                : { rotate: 0, y: 0, scale: [1.25, 1] }
            }
            transition={tumbling ? { duration: 0.45, repeat: Infinity, delay: i * 0.08 } : { type: 'spring', stiffness: 400, damping: 12 }}
          >
            <Die value={f} size={size} />
          </motion.div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {!tumbling && (
          <motion.div
            key={roll.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="display leading-tight"
          >
            <div className={`font-extrabold tabular-nums text-ink ${compact ? 'text-sm' : 'text-base'}`}>
              {roll.dice[0]} + {roll.dice[1]}
              {roll.penalty > 0 && <span className="text-danger"> − {roll.penalty}</span>}
              <span className="text-ink-soft"> = </span>
              {roll.steps}
            </div>
            <div className="text-[11px] font-semibold text-ink-soft">
              {roll.hops.length === 0
                ? 'đứng yên'
                : roll.hops[roll.hops.length - 1] === -1
                  ? 'về tới tàu!'
                  : `bơi ${roll.hops.length} ô ${roll.hops[0] < roll.from ? '↑' : '↓'}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
