/**
 * The crew list: one card per diver with where they are, what they are
 * hauling (face down) and what they have banked. The chips here share
 * layout ids with the ones on the rope, so picking one up flies it over.
 */

import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameState, PublicPlayer } from '@shared/types';
import { ChipStack } from './art/Chip';
import { DiverHead } from './art/Diver';
import { diverColor } from '../lib/theme';
import { useTick } from '../lib/hooks';

function status(p: PublicPlayer, phase: GameState['phase']): { text: string; tone: string } {
  if (phase !== 'playing') return { text: 'Trên tàu', tone: 'text-ink-soft' };
  if (p.returned) return { text: 'Đã về tàu ✓', tone: 'text-kelp' };
  if (p.position < 0) return { text: 'Chờ xuống nước', tone: 'text-ink-soft' };
  return p.direction === 'down'
    ? { text: `Đang lặn ↓ ô ${p.position + 1}`, tone: 'text-sea' }
    : { text: `Đang về ↑ ô ${p.position + 1}`, tone: 'text-coral-deep' };
}

export const Crew = memo(function Crew({
  state,
  youId,
  row,
}: {
  state: GameState;
  youId: string;
  /** horizontal strip for small screens */
  row?: boolean;
}) {
  const turnId = state.phase === 'playing' ? state.players[state.turn]?.id : undefined;
  return (
    <div className={row ? 'scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1' : 'space-y-2'}>
      {state.players.map((p) => (
        <Seat
          key={p.id}
          p={p}
          you={p.id === youId}
          active={p.id === turnId}
          phase={state.phase}
          deadline={p.id === turnId ? state.turnDeadline : undefined}
          row={row}
        />
      ))}
    </div>
  );
});

function Seat({
  p,
  you,
  active,
  phase,
  deadline,
  row,
}: {
  p: PublicPlayer;
  you: boolean;
  active: boolean;
  phase: GameState['phase'];
  deadline?: number;
  row?: boolean;
}) {
  const c = diverColor(p.color);
  const s = status(p, phase);
  return (
    <motion.div
      layout
      className={`paper relative overflow-hidden rounded-2xl ${row ? 'w-[208px] shrink-0 px-2.5 py-1.5' : 'px-3 py-2'}`}
      animate={{ scale: active ? 1 : 0.985 }}
      style={{ boxShadow: active ? `0 0 0 3px ${c.body}, 0 10px 24px -14px rgba(0,0,0,0.8)` : undefined }}
    >
      <div className={`flex items-center ${row ? 'gap-1.5' : 'gap-2'}`}>
        <motion.div animate={active ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }} transition={{ repeat: active ? Infinity : 0, duration: 1.6 }}>
          <DiverHead color={p.color} size={row ? 24 : 30} muted={!p.connected && !p.isBot} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="display flex items-center gap-1 truncate text-[15px] font-extrabold leading-tight text-ink">
            <span className="truncate">{p.name}</span>
            {you && !row && <span className="text-[11px] font-semibold text-ink-soft">(bạn)</span>}
            {p.isBot && <span className="shrink-0 rounded bg-kelp/15 px-1 text-[9px] font-bold text-kelp">BOT</span>}
          </div>
          <div className={`truncate text-[11px] font-semibold ${s.tone}`}>
            {!p.connected && !p.isBot ? 'Mất kết nối…' : s.text}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`display font-extrabold leading-none text-ink tabular-nums ${row ? 'text-lg' : 'text-xl'}`}>
            {p.score}
          </div>
          <div className="text-[9px] font-bold tracking-wide text-ink-soft uppercase">điểm</div>
        </div>
      </div>

      {/* what they are carrying, face down */}
      <div className="mt-1.5 flex min-h-[26px] flex-wrap items-center gap-1">
        <AnimatePresence initial={false}>
          {p.carrying.map((stack) => (
            <motion.div
              key={stack[0].id}
              layoutId={`stack-${stack[0].id}`}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              exit={{ opacity: 0, y: 12, scale: 0.5 }}
            >
              <ChipStack chips={stack} size={22} showCount={stack.length > 1} />
            </motion.div>
          ))}
        </AnimatePresence>
        {p.carrying.length === 0 && <span className="text-[11px] text-ink-soft/60">— tay không —</span>}
        {p.carrying.length > 0 && (
          <span className="ml-auto text-[10px] font-semibold text-danger">−{p.carrying.length} khí/lượt</span>
        )}
      </div>

      {deadline && <TurnTimer deadline={deadline} color={c.body} />}
    </motion.div>
  );
}

/** A thin bar that drains until the autopilot steps in. */
function TurnTimer({ deadline, color }: { deadline: number; color: string }) {
  useTick(1000);
  const left = Math.max(0, deadline - Date.now());
  const frac = Math.min(1, left / 60000);
  return (
    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/10">
      <motion.div
        className="h-full"
        style={{ background: left < 15000 ? '#d4533f' : color }}
        animate={{ width: `${frac * 100}%` }}
        transition={{ duration: 1, ease: 'linear' }}
      />
    </div>
  );
}
