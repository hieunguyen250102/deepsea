/**
 * The playing field: the submarine bobbing at the surface, the rope of
 * undersea chips winding down into the dark, and the divers on it.
 * Everything shares one coordinate space so a diver can swim straight from
 * its hatch to a chip and back.
 */

import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameEvent, GameState, PublicPlayer, TileView } from '@shared/types';
import { ANIM } from '@shared/timing';
import { BlankChip, ChipStack } from './art/Chip';
import { Diver } from './art/Diver';
import { DOCKS, HATCH, SUB_H, SUB_W, Submarine, airSpot } from './art/Submarine';
import { INK, diverColor } from '../lib/theme';

type RollEvent = Extract<GameEvent, { type: 'roll' }>;

export interface Puff {
  id: number;
  amount: number;
}

interface Props {
  state: GameState;
  youId: string;
  /** the latest roll, so the roller's diver can hop along its path */
  lastRoll: RollEvent | null;
  /** tiles a roll could land on, while hovering a roll button */
  preview: number[] | null;
  /** latest chat line per player, shown as a speech bubble */
  bubbles: Record<string, string>;
  /** air spent this turn, floating up from the tank */
  puffs: Puff[];
}

interface Point {
  x: number;
  y: number;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Where everything sits for a given width and path length. */
function useLayout(width: number, tiles: number) {
  return useMemo(() => {
    const W = Math.max(280, width);
    const cols = Math.max(6, Math.min(10, Math.round(W / 74)));
    const cell = W / cols;
    const chip = Math.min(cell * 0.64, 54);
    const diverW = Math.min(cell * 0.44, 36);
    const subW = Math.min(W - 12, 440);
    const k = subW / SUB_W;
    const subH = SUB_H * k;
    const sub = { x: 6, y: 8 };
    const waterline = sub.y + subH * 0.36;
    const rowH = cell * 0.98;
    const top = sub.y + subH + chip * 0.35;
    const rows = Math.max(1, Math.ceil(tiles / cols));
    const height = top + rows * rowH + 56;

    const tile = (i: number): Point => {
      const row = Math.floor(i / cols);
      const inRow = i % cols;
      const col = row % 2 === 0 ? inRow : cols - 1 - inRow;
      return { x: (col + 0.5) * cell, y: top + row * rowH + rowH / 2 };
    };
    const dock = (seat: number): Point => ({ x: sub.x + DOCKS[seat % 6].x * k, y: sub.y + DOCKS[seat % 6].y * k });
    const hatch: Point = { x: sub.x + HATCH.x * k, y: sub.y + HATCH.y * k };
    const air = (n: number): Point => {
      const p = airSpot(n);
      return { x: sub.x + p.x * k, y: sub.y + p.y * k };
    };
    return { W, cols, cell, chip, diverW, subW, subH, sub, waterline, top, rows, rowH, height, tile, dock, hatch, air };
  }, [width, tiles]);
}

type Layout = ReturnType<typeof useLayout>;

/** The rope: from the hatch down to chip 0, then snaking row by row. */
function ropePath(L: Layout, n: number): string {
  if (n === 0) return '';
  const pts = [L.hatch, ...Array.from({ length: n }, (_, i) => L.tile(i))];
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (Math.abs(a.y - b.y) > 1 && i > 1) {
      // turning a corner: a soft loop off the side of the board
      const side = b.x > L.W / 2 ? 1 : -1;
      const bulge = L.cell * 0.55 * side;
      d += ` C${(a.x + bulge).toFixed(1)} ${a.y.toFixed(1)} ${(b.x + bulge).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    } else if (i === 1) {
      d += ` Q${a.x.toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    } else {
      // a little sag between chips, like a rope under its own weight
      d += ` Q${((a.x + b.x) / 2).toFixed(1)} ${(a.y + 6).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
  }
  return d;
}

export const Seascape = memo(function Seascape({ state, youId, lastRoll, preview, bubbles, puffs }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const L = useLayout(width, state.path.length);
  const current = state.phase === 'playing' ? state.players[state.turn] : undefined;
  const previewSet = useMemo(() => new Set(preview ?? []), [preview]);

  const diverPoint = (p: PublicPlayer, seat: number, pos = p.position): Point => {
    if (pos < 0) return L.dock(seat);
    const t = L.tile(pos);
    return { x: t.x + L.cell * 0.2, y: t.y - L.chip * 0.2 };
  };

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-3xl"
      style={{
        height: L.height,
        background: `linear-gradient(180deg, #d7ece8 0, #cde6e3 ${L.waterline}px, #5fa9b8 ${L.waterline}px, #3a86a0 ${
          L.waterline + 90
        }px, #1d5a76 45%, #123f59 72%, #0c2a3d 100%)`,
        boxShadow: 'inset 0 0 0 1px rgba(233,243,239,0.12), 0 24px 40px -28px rgba(0,0,0,0.9)',
      }}
    >
      {width > 0 && (
        <>
          <Surface L={L} />
          <Seabed L={L} />

          {/* the rope */}
          <svg className="pointer-events-none absolute inset-0" width={L.W} height={L.height} aria-hidden>
            <motion.path
              key={`rope-${state.dive}-${state.path.length}`}
              d={ropePath(L, state.path.length)}
              fill="none"
              stroke="#e8dcc0"
              strokeOpacity="0.55"
              strokeWidth="3"
              strokeDasharray="2 7"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>

          {/* the submarine; docked divers are drawn over its hatches */}
          <div className="absolute" style={{ left: L.sub.x, top: L.sub.y }}>
            <Submarine air={state.air} width={L.subW} dockColors={state.players.map((p) => p.color)} />
          </div>

          <AirPuffs puffs={puffs} at={L.air(state.air)} />

          {/* chips */}
          {state.path.map((t, i) => (
            <TileSpot
              key={t.id}
              tile={t}
              at={L.tile(i)}
              size={L.chip}
              index={i}
              highlight={previewSet.has(i)}
            />
          ))}

          {/* a preview ring for "back to the sub" */}
          {previewSet.has(-1) && (
            <motion.div
              className="pointer-events-none absolute rounded-full border-2 border-dashed border-coral"
              style={{ left: L.hatch.x - 20, top: L.hatch.y - 20, width: 40, height: 40 }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
          )}

          {/* divers */}
          {state.players.map((p, seat) => (
            <DiverToken
              key={p.id}
              player={p}
              seat={seat}
              you={p.id === youId}
              active={current?.id === p.id}
              point={diverPoint(p, seat)}
              roll={lastRoll && lastRoll.playerId === p.id ? lastRoll : null}
              hopPoint={(pos) => diverPoint(p, seat, pos)}
              width={L.diverW}
              cell={L.cell}
              inSub={p.position < 0}
              bubble={bubbles[p.id]}
            />
          ))}
        </>
      )}
    </div>
  );
});

/* ------------------------------------------------------------ scenery */

function Surface({ L }: { L: Layout }) {
  // Two wave bands sliding against each other along the waterline.
  const wave = (amp: number, len: number) => {
    let d = `M0 ${amp}`;
    for (let x = 0; x < L.W * 2 + len; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
    return `${d} V${amp * 3} H0 Z`;
  };
  return (
    <div className="pointer-events-none absolute inset-x-0" style={{ top: L.waterline - 8 }} aria-hidden>
      <motion.svg
        width={L.W * 2}
        height="24"
        className="absolute left-0"
        animate={{ x: [0, -60] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
      >
        <path d={wave(6, 60)} fill="#7fbfcb" />
      </motion.svg>
      <motion.svg
        width={L.W * 2}
        height="24"
        className="absolute left-0 top-1"
        animate={{ x: [-40, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
      >
        <path d={wave(5, 80)} fill="#5fa9b8" />
      </motion.svg>
    </div>
  );
}

function Seabed({ L }: { L: Layout }) {
  const h = 44;
  const d = `M0 ${h * 0.45} C${L.W * 0.2} ${h * 0.1} ${L.W * 0.35} ${h * 0.7} ${L.W * 0.55} ${h * 0.4} S${L.W * 0.85} ${
    h * 0.15
  } ${L.W} ${h * 0.4} V${h} H0 Z`;
  return (
    <svg className="pointer-events-none absolute bottom-0 left-0" width={L.W} height={h} aria-hidden>
      <path d={d} fill="#3a4a4a" opacity="0.55" />
      <path d={d} transform={`translate(0 ${h * 0.25})`} fill="#2c3a3c" opacity="0.8" />
      {/* a couple of pebbles and a shell */}
      <ellipse cx={L.W * 0.18} cy={h * 0.72} rx="9" ry="5" fill="#556768" />
      <ellipse cx={L.W * 0.72} cy={h * 0.62} rx="12" ry="6" fill="#4b5c5d" />
      <path
        d={`M${L.W * 0.44} ${h * 0.78} q7 -14 14 0 z`}
        fill="#c9a98a"
        stroke={INK}
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/* --------------------------------------------------------------- chips */

const TileSpot = memo(function TileSpot({
  tile,
  at,
  size,
  index,
  highlight,
}: {
  tile: TileView;
  at: Point;
  size: number;
  index: number;
  highlight: boolean;
}) {
  const stackId = tile.chips[0]?.id;
  return (
    <motion.div
      className="absolute left-0 top-0"
      initial={{ x: at.x, y: at.y + 30, opacity: 0 }}
      animate={{ x: at.x, y: at.y, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 22, delay: Math.min(index * 0.012, 0.4) }}
    >
      <div className="relative -translate-x-1/2 -translate-y-1/2" style={{ width: size, height: size }}>
        {highlight && (
          <motion.div
            className="absolute -inset-1.5 rounded-full border-2 border-dashed border-coral"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: [1, 1.08, 1] }}
            transition={{ scale: { repeat: Infinity, duration: 1.1 } }}
          />
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {stackId !== undefined ? (
            <motion.div
              key={`s${stackId}`}
              layoutId={`stack-${stackId}`}
              className="flex h-full w-full items-center justify-center"
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              <ChipStack chips={tile.chips} size={tile.chips.length > 1 ? size * 0.82 : size} />
            </motion.div>
          ) : (
            <motion.div
              key="blank"
              className="flex h-full w-full items-center justify-center"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 0.8, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
            >
              <BlankChip size={size} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

/* -------------------------------------------------------------- divers */

const DiverToken = memo(function DiverToken({
  player,
  seat,
  you,
  active,
  point,
  roll,
  hopPoint,
  width,
  cell,
  inSub,
  bubble,
}: {
  player: PublicPlayer;
  seat: number;
  you: boolean;
  active: boolean;
  point: Point;
  roll: RollEvent | null;
  hopPoint: (pos: number) => Point;
  width: number;
  cell: number;
  inSub: boolean;
  bubble?: string;
}) {
  const w = inSub ? width * 0.8 : width;
  const h = w * 1.375;

  // Hop along the roll's path (only while it still ends where we stand).
  const path = useMemo(() => {
    if (!roll || roll.hops.length === 0) return null;
    if (roll.hops[roll.hops.length - 1] !== player.position) return null;
    const stops = [roll.from, ...roll.hops].map(hopPoint);
    const xs: number[] = [stops[0].x];
    const ys: number[] = [stops[0].y];
    for (let i = 1; i < stops.length; i++) {
      xs.push((stops[i - 1].x + stops[i].x) / 2, stops[i].x);
      ys.push(Math.min(stops[i - 1].y, stops[i].y) - cell * 0.32, stops[i].y);
    }
    return { xs, ys, duration: (roll.hops.length * ANIM.hop) / 1000, id: roll.id };
    // hopPoint changes identity every render; the path only depends on these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll?.id, player.position, point.x, point.y, cell]);

  const down = player.direction === 'down' && !inSub;

  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0"
      style={{ zIndex: active ? 30 : 20 }}
      initial={false}
      animate={path ? { x: path.xs, y: path.ys } : { x: point.x, y: point.y }}
      transition={
        path
          ? { duration: path.duration, delay: ANIM.dice / 1000, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 160, damping: 20 }
      }
    >
      {/* speech bubble */}
      <div
        className="absolute left-0 z-10"
        style={{ top: -h * (inSub ? 0.92 : 0.5) - 20, transform: 'translate(-50%, -100%)' }}
      >
        <AnimatePresence>
          {bubble && (
            <motion.div
              key={bubble}
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-max max-w-[160px] rounded-2xl rounded-bl-sm bg-sand px-2.5 py-1 text-xs font-medium text-ink shadow-md"
            >
              {bubble}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative" style={{ transform: `translate(-50%, ${-h * (inSub ? 0.92 : 0.5)}px)` }}>
        {/* turn marker: a bouncing arrow above the active diver */}
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: [0, -5, 0] }}
              exit={{ opacity: 0 }}
              transition={{ y: { repeat: Infinity, duration: 1 } }}
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: -16 }}
            >
              <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden>
                <path d="M2 2 H14 L8 10 Z" fill={diverColor(player.color).body} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={false}
          animate={{ rotate: down ? 168 : 0, scale: active ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          style={{ width: w, height: h, opacity: player.connected || player.isBot ? 1 : 0.55 }}
        >
          <Diver color={player.color} size={w} />
        </motion.div>

        {/* what they are hauling */}
        {player.carrying.length > 0 && (
          <motion.span
            key={player.carrying.length}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            className="display absolute -right-2 top-1/2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-ink bg-gold px-1 text-[10px] font-extrabold text-ink"
          >
            {player.carrying.length}
          </motion.span>
        )}
        {you && !inSub && (
          <span className="display absolute left-1/2 top-full mt-0.5 -translate-x-1/2 rounded bg-ink/70 px-1 text-[9px] font-bold text-sand">
            BẠN
          </span>
        )}
      </div>
      <span className="sr-only">
        {player.name} ghế {seat + 1}
      </span>
    </motion.div>
  );
});

/* ------------------------------------------------------------ air puffs */

function AirPuffs({ puffs, at }: { puffs: Puff[]; at: Point }) {
  return (
    <div className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
      <AnimatePresence>
        {puffs.map((p) => (
          <motion.div
            key={p.id}
            className="absolute -translate-x-1/2"
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -58, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          >
            <span className="display flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-sm font-extrabold text-[#86d3c4]">
              −{p.amount}
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle cx="5" cy="8" r="3.5" fill="none" stroke="#86d3c4" strokeWidth="1.6" />
                <circle cx="10" cy="4" r="2.4" fill="none" stroke="#86d3c4" strokeWidth="1.4" />
              </svg>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
