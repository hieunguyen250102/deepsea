/** Full-screen moments: the end of a dive, the final tally, and small notices. */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChipView, DiveResult, GameState, PublicPlayer } from '@shared/types';
import { levelCounts } from '@shared/engine';
import { TreasureChip } from './art/Chip';
import { Diver, DiverHead } from './art/Diver';
import { sfx } from '../lib/sound';
import { useTick } from '../lib/hooks';

/* ---------------------------------------------------------------- toast */

export function Toast({ message }: { message: string | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            className="paper rounded-2xl px-4 py-2 text-sm font-semibold"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------------------------------------- air-out alarm */

export function AirOutBanner({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -4 }}
            animate={{ scale: 1, rotate: [-4, 3, -2, 0] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 12 }}
            className="rounded-3xl border-4 border-ink bg-danger px-7 py-4 text-center shadow-2xl"
          >
            <div className="display text-3xl font-extrabold text-sand sm:text-4xl">Hết không khí!</div>
            <div className="text-sm font-semibold text-sand/85">Lượt này là lượt cuối — ai chưa về tàu sẽ mất kho báu</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ flip chip */

/** A chip that turns over to show its value, after a delay. */
function FlipChip({ chip, delay, size = 34 }: { chip: ChipView; delay: number; size?: number }) {
  useEffect(() => {
    const t = setTimeout(() => sfx.reveal(), delay * 1000 + 150);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className="flip3d" style={{ width: size, height: size }}>
      <motion.div
        className="flip3d-inner relative h-full w-full"
        initial={{ rotateY: 180, y: -10, opacity: 0 }}
        animate={{ rotateY: 0, y: 0, opacity: 1 }}
        transition={{ delay, duration: 0.55, ease: 'easeOut' }}
      >
        <div className="flip3d-face absolute inset-0">
          <TreasureChip level={chip.level} value={chip.value} size={size} />
        </div>
        <div className="flip3d-face absolute inset-0" style={{ transform: 'rotateY(180deg)' }}>
          <TreasureChip level={chip.level} size={size} />
        </div>
      </motion.div>
    </div>
  );
}

function CountUp({ to, delay }: { to: number; delay: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 700));
      setN(Math.round(to * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <>{n}</>;
}

/* ------------------------------------------------------------ dive end */

function DiveResults({ state }: { state: GameState }) {
  const s = state.lastDive!;
  let flip = 0.5;
  return (
    <ul className="space-y-2">
      {s.results.map((r: DiveResult, row) => {
        const p = state.players.find((x) => x.id === r.playerId);
        if (!p) return null;
        const start = flip;
        flip += Math.max(1, r.revealed.length) * 0.28;
        return (
          <motion.li
            key={r.playerId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + row * 0.08 }}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.returned ? 'bg-white/70' : 'bg-danger/10'}`}
          >
            <motion.div
              initial={r.returned ? { y: 0 } : { y: 0, rotate: 0 }}
              animate={r.returned ? { y: [0, -6, 0] } : { y: [0, 6, 4], rotate: [0, 0, 170], opacity: [1, 1, 0.6] }}
              transition={{ delay: start, duration: r.returned ? 0.5 : 1.2 }}
            >
              <DiverHead color={p.color} size={30} muted={!r.returned} />
            </motion.div>
            <div className="w-24 min-w-0 shrink-0 sm:w-28">
              <div className="display truncate font-extrabold text-ink">{p.name}</div>
              <div className={`text-[11px] font-bold ${r.returned ? 'text-kelp' : 'text-danger'}`}>
                {r.returned ? 'Về tàu an toàn' : r.lost ? `Chìm · mất ${r.lost} kho báu` : 'Không kịp về tàu'}
              </div>
            </div>
            <div className="flex min-h-[34px] flex-1 flex-wrap items-center gap-1">
              {r.revealed.map((c, i) => (
                <FlipChip key={c.id} chip={c} delay={start + i * 0.28} size={30} />
              ))}
              {r.returned && r.revealed.length === 0 && <span className="text-xs text-ink-soft/70">tay không</span>}
            </div>
            <div className="w-14 text-right">
              <div className="display text-lg font-extrabold leading-none text-ink tabular-nums">
                +<CountUp to={r.diveScore} delay={start + r.revealed.length * 0.28} />
              </div>
              <div className="text-[10px] font-semibold text-ink-soft tabular-nums">tổng {p.score}</div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

export function DiveEnd({ state, isHost, onNext }: { state: GameState; isHost: boolean; onNext: () => void }) {
  useTick(1000);
  const s = state.lastDive!;
  const secs = state.autoAdvanceAt ? Math.max(0, Math.ceil((state.autoAdvanceAt - Date.now()) / 1000)) : null;
  const starter = state.players.find((p) => p.id === s.nextStarterId);
  const anyDrowned = s.results.some((r) => !r.returned);

  useEffect(() => {
    sfx.diveEnd();
    if (anyDrowned) setTimeout(() => sfx.sink(), 600);
  }, [anyDrowned]);

  return (
    <Backdrop>
      <div className="text-center">
        <div className="label">Lượt lặn {s.dive}/{state.totalDives}</div>
        <h2 className="display text-3xl font-extrabold text-ink">
          {state.airOut ? 'Bình khí đã cạn!' : 'Cả đội đã về tàu'}
        </h2>
      </div>

      <div className="mt-4">
        <DiveResults state={state} />
      </div>

      {s.sunkStacks > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-3 text-center text-xs font-semibold text-ink-soft"
        >
          {s.sunkStacks} chồng kho báu chìm xuống cuối đường lặn — lượt sau ai dám xuống lấy?
        </motion.p>
      )}

      <div className="mt-4 flex flex-col items-center gap-2">
        {starter && (
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <DiverHead color={starter.color} size={18} /> <b className="text-ink">{starter.name}</b> xuống nước trước
          </div>
        )}
        {isHost ? (
          <button type="button" className="btn btn-coral w-full max-w-xs" onClick={onNext}>
            Lặn tiếp {secs !== null && <span className="opacity-70">({secs}s)</span>}
          </button>
        ) : (
          <div className="text-xs text-ink-soft">Lượt lặn tiếp theo bắt đầu sau {secs ?? '…'}s</div>
        )}
      </div>
    </Backdrop>
  );
}

/* ------------------------------------------------------------ game end */

function ranked(players: PublicPlayer[]) {
  return [...players].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const ca = levelCounts(a.banked);
    const cb = levelCounts(b.banked);
    for (let i = 0; i < 4; i++) if (ca[i] !== cb[i]) return cb[i] - ca[i];
    return 0;
  });
}

export function Confetti({ count = 60 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.6 + Math.random() * 2,
        color: ['#e3ad45', '#e0694e', '#7ebfdc', '#f5ecd9', '#3f9c6d'][i % 5],
        size: 6 + Math.random() * 7,
        spin: Math.random() * 720 - 360,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${b.x}%`, width: b.size, height: b.size * 0.6, background: b.color }}
          initial={{ y: -30, opacity: 0, rotate: 0 }}
          animate={{ y: '105vh', opacity: [0, 1, 1, 0], rotate: b.spin }}
          transition={{ duration: b.duration, delay: b.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

export function GameEnd({
  state,
  youId,
  isHost,
  onRestart,
  onLeave,
}: {
  state: GameState;
  youId: string;
  isHost: boolean;
  onRestart: () => void;
  onLeave: () => void;
}) {
  const [stage, setStage] = useState<'dive' | 'podium'>('dive');
  const order = useMemo(() => ranked(state.players), [state.players]);
  const winners = new Set(state.winnerIds ?? []);
  const youWon = winners.has(youId);

  useEffect(() => {
    sfx.diveEnd();
    const reveal = state.lastDive?.results.reduce((s, r) => s + Math.max(1, r.revealed.length), 0) ?? 0;
    const t = setTimeout(() => setStage('podium'), 1500 + reveal * 280 + 1800);
    return () => clearTimeout(t);
  }, [state.lastDive]);

  useEffect(() => {
    if (stage === 'podium') sfx.win();
  }, [stage]);

  if (stage === 'dive') {
    return (
      <Backdrop>
        <div className="text-center">
          <div className="label">Lượt lặn cuối cùng</div>
          <h2 className="display text-3xl font-extrabold text-ink">{state.airOut ? 'Bình khí đã cạn!' : 'Cả đội đã về tàu'}</h2>
        </div>
        <div className="mt-4">
          <DiveResults state={state} />
        </div>
        <div className="mt-4 flex justify-center">
          <button type="button" className="btn btn-sea" onClick={() => setStage('podium')}>
            Xem bảng xếp hạng →
          </button>
        </div>
      </Backdrop>
    );
  }

  return (
    <>
      <Confetti />
      <Backdrop>
        <div className="text-center">
          <div className="label">Kết thúc 3 lượt lặn</div>
          <h2 className="display text-3xl font-extrabold text-ink">
            {winners.size > 1 ? 'Hoà nhau!' : youWon ? 'Bạn là thợ săn kho báu số 1!' : `${order[0]?.name} thắng cuộc!`}
          </h2>
        </div>

        {/* podium */}
        <div className="mt-5 flex items-end justify-center gap-3">
          {[order[1], order[0], order[2]].map((p, i) => {
            if (!p) return <div key={i} className="w-20" />;
            const place = order.indexOf(p);
            const h = [64, 96, 44][i];
            return (
              <motion.div
                key={p.id}
                className="flex w-20 flex-col items-center"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (2 - place) * 0.25, type: 'spring', stiffness: 200, damping: 16 }}
              >
                {winners.has(p.id) && (
                  <motion.div
                    initial={{ y: -20, opacity: 0, rotate: -20 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    transition={{ delay: 1, type: 'spring' }}
                    className="text-2xl"
                  >
                    👑
                  </motion.div>
                )}
                <Diver color={p.color} size={place === 0 ? 44 : 36} />
                <div className="display mt-1 w-full truncate text-center text-sm font-extrabold text-ink">{p.name}</div>
                <div
                  className="mt-1 flex w-full items-start justify-center rounded-t-xl bg-sea pt-1.5 text-sand"
                  style={{ height: h }}
                >
                  <span className="display text-2xl font-extrabold">{p.score}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <ul className="mt-4 space-y-1.5">
          {order.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-1.5">
              <span className="display w-5 text-center font-extrabold text-ink-soft">{i + 1}</span>
              <DiverHead color={p.color} size={22} />
              <span className="display min-w-0 flex-1 truncate font-bold text-ink">
                {p.name}
                {p.id === youId && <span className="ml-1 text-xs font-medium text-ink-soft">(bạn)</span>}
              </span>
              <span className="flex max-w-[45%] flex-wrap justify-end gap-0.5">
                {[...p.banked]
                  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                  .map((c) => (
                    <TreasureChip key={c.id} level={c.level} value={c.value} size={18} />
                  ))}
              </span>
              <span className="display w-8 text-right text-lg font-extrabold text-ink tabular-nums">{p.score}</span>
            </li>
          ))}
        </ul>
        {winners.size > 1 && (
          <p className="mt-2 text-center text-[11px] text-ink-soft">Bằng điểm và bằng cả số kho báu cấp cao — hoà!</p>
        )}

        <div className="mt-5 flex gap-2">
          {isHost && (
            <button type="button" className="btn btn-coral flex-1" onClick={onRestart}>
              Chơi ván mới
            </button>
          )}
          <button type="button" className="btn btn-sand flex-1" onClick={onLeave}>
            Rời bàn
          </button>
        </div>
      </Backdrop>
    </>
  );
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-abyss/75 px-3 py-6 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="paper my-auto w-full max-w-xl rounded-3xl p-5"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
