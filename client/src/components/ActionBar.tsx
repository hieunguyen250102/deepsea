/**
 * What you can do right now. On your turn: choose a direction and roll,
 * then pick up, drop or pass. Otherwise: whose turn it is.
 */

import { AnimatePresence, motion } from 'framer-motion';
import type { ActAction, Direction, GameState, PublicPlayer } from '@shared/types';
import { actOptions, canTurnBack } from '@shared/engine';
import { ChipStack } from './art/Chip';
import { DiverHead } from './art/Diver';
import { sfx } from '../lib/sound';

interface Props {
  state: GameState;
  me?: PublicPlayer;
  /** animations of the previous move are still playing */
  busy: boolean;
  onRoll: (turnBack: boolean) => void;
  onAct: (action: ActAction) => void;
  onPreview: (dir: Direction | null) => void;
}

export function ActionBar({ state, me, busy, onRoll, onAct, onPreview }: Props) {
  const current = state.players[state.turn];
  const mine = !!me && current?.id === me.id && state.phase === 'playing';

  return (
    <div className="paper rounded-3xl px-4 py-3">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state.phase !== 'playing' ? 'rest' : mine ? `me-${state.step}-${busy}` : `other-${current?.id}-${state.step}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {state.phase !== 'playing' ? (
            <div className="display flex h-11 items-center text-sm font-bold text-ink-soft">
              Lượt lặn đã kết thúc — mọi người đang ở trên tàu.
            </div>
          ) : !mine || !me ? (
            <Waiting state={state} current={current} spectator={!me} />
          ) : busy ? (
            <div className="display flex h-11 items-center gap-2 text-sm font-bold text-ink-soft">
              <DiverHead color={me.color} size={24} />
              <span className="animate-pulse">Lượt của bạn — đợi thợ lặn bơi xong…</span>
            </div>
          ) : state.step === 'roll' ? (
            <RollChoice state={state} me={me} onRoll={onRoll} onPreview={onPreview} />
          ) : (
            <ActChoice state={state} me={me} onAct={onAct} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Waiting({ state, current, spectator }: { state: GameState; current?: PublicPlayer; spectator: boolean }) {
  if (!current) return null;
  return (
    <div className="flex h-11 items-center gap-2.5">
      <DiverHead color={current.color} size={28} />
      <div className="display text-sm leading-tight">
        <div className="font-extrabold text-ink">Lượt của {current.name}</div>
        <div className="text-xs font-semibold text-ink-soft">
          {state.step === 'roll' ? 'đang quyết định hướng bơi…' : 'đang cân nhắc kho báu…'}
          {spectator && ' · bạn đang xem'}
        </div>
      </div>
      <span className="ml-auto flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ink-soft/60"
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
          />
        ))}
      </span>
    </div>
  );
}

function RollChoice({
  state,
  me,
  onRoll,
  onPreview,
}: {
  state: GameState;
  me: PublicPlayer;
  onRoll: (turnBack: boolean) => void;
  onPreview: (dir: Direction | null) => void;
}) {
  const k = me.carrying.length;
  const lo = Math.max(0, 2 - k);
  const hi = Math.max(0, 6 - k);
  const turnable = canTurnBack(me);
  const hover = (dir: Direction | null) => ({
    onPointerEnter: () => onPreview(dir),
    onPointerLeave: () => onPreview(null),
    onFocus: () => onPreview(dir),
    onBlur: () => onPreview(null),
  });
  const roll = (turnBack: boolean) => {
    onPreview(null);
    sfx.dice();
    onRoll(turnBack);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="display text-base font-extrabold text-ink">Lượt của bạn!</span>
        <span className="font-semibold text-ink-soft">
          {k > 0 ? (
            <>
              Mang {k} kho báu → bơi <b className="text-ink">{lo}–{hi}</b> ô
            </>
          ) : (
            <>
              Bơi <b className="text-ink">2–6</b> ô
            </>
          )}
        </span>
      </div>
      {state.airOut && (
        <p className="mb-2 rounded-lg bg-danger/10 px-2 py-1 text-xs font-bold text-danger">
          Hết không khí — đây là lượt cuối của lượt lặn này!
        </p>
      )}
      <div className="flex gap-2">
        {turnable ? (
          <>
            <button type="button" className="btn btn-sea flex-1" onClick={() => roll(false)} {...hover('down')}>
              Lặn tiếp ↓
            </button>
            <button type="button" className="btn btn-coral flex-1" onClick={() => roll(true)} {...hover('up')}>
              Quay về tàu ↑
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`btn flex-1 ${me.direction === 'up' ? 'btn-coral' : 'btn-sea'}`}
            onClick={() => roll(false)}
            {...hover(me.direction)}
          >
            {me.position < 0 ? 'Nhảy xuống biển 🎲' : me.direction === 'up' ? 'Bơi về tàu 🎲' : 'Tung xúc xắc 🎲'}
          </button>
        )}
      </div>
      {turnable && (
        <p className="mt-1.5 text-[11px] text-ink-soft">Chỉ được quay đầu một lần mỗi lượt lặn.</p>
      )}
    </div>
  );
}

function ActChoice({ state, me, onAct }: { state: GameState; me: PublicPlayer; onAct: (a: ActAction) => void }) {
  const opts = actOptions(state.path, me);
  const tile = state.path[me.position];

  return (
    <div>
      <div className="display mb-2 text-base font-extrabold text-ink">
        {opts.pickup ? 'Có kho báu ở đây!' : 'Một ô trống'}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {opts.pickup && tile && (
          <button
            type="button"
            className="btn btn-kelp flex items-center gap-2"
            onClick={() => {
              sfx.pickup();
              onAct({ kind: 'pickup' });
            }}
          >
            <ChipStack chips={tile.chips} size={22} />
            Nhặt lên
          </button>
        )}
        {opts.drop && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Thả xuống:</span>
            {me.carrying.map((stack, i) => (
              <button
                key={stack[0].id}
                type="button"
                title="Thả kho báu này"
                className="btn btn-sand !px-2 !py-1.5"
                onClick={() => {
                  sfx.drop();
                  onAct({ kind: 'drop', index: i });
                }}
              >
                <ChipStack chips={stack} size={22} />
              </button>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-sand ml-auto" onClick={() => onAct({ kind: 'skip' })}>
          Bỏ qua
        </button>
      </div>
      {opts.pickup && (
        <p className="mt-1.5 text-[11px] text-ink-soft">
          Mỗi kho báu mang theo làm tốn thêm 1 khí mỗi lượt và bơi chậm đi 1 ô.
        </p>
      )}
    </div>
  );
}
