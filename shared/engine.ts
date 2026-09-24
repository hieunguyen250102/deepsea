/**
 * Deep Sea Adventure rules, with no I/O. The server runs the game with it;
 * the client uses the same helpers (movement preview, legal actions) so the
 * two can never disagree about the rules.
 */

import type { ActAction, Chip, ChipView, Direction, DiveSummary, GameEvent, Level, Step, Tile } from './types';

export const MAX_AIR = 25;
export const TOTAL_DIVES = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** each die shows 1–3 dots, twice */
export const DIE_FACES = [1, 1, 2, 2, 3, 3] as const;
/** drowned treasure is piled at the end of the line three chips to a stack */
export const STACK_SIZE = 3;
/** the submarine, as a position */
export const SUB = -1;

export type Rng = () => number;

export interface Diver {
  id: string;
  /** SUB (-1) or an index into the path */
  position: number;
  direction: Direction;
  /** one entry per stack picked up; a stack counts as a single chip */
  carrying: Chip[][];
  /** brought home in earlier dives */
  banked: Chip[];
}

export interface Game {
  /** seat order; turns go around this list */
  divers: Diver[];
  path: Tile[];
  air: number;
  dive: number;
  turn: number;
  step: Step;
  airOut: boolean;
  /** who got back aboard this dive, in order */
  returnOrder: string[];
  phase: 'playing' | 'diveEnd' | 'gameEnd';
  events: GameEvent[];
  lastDive?: DiveSummary;
  nextStarter: number;
  eventSeq: number;
  tileSeq: number;
}

/* ------------------------------------------------------------------ setup */

/** 4 levels × 4 values × 2 copies: L1 0–3, L2 4–7, L3 8–11, L4 12–15. */
export function makeChips(): Chip[] {
  const chips: Chip[] = [];
  let id = 1;
  for (let level = 1; level <= 4; level++) {
    for (let v = 0; v < 4; v++) {
      for (let copy = 0; copy < 2; copy++) {
        chips.push({ id: id++, level: level as Level, value: (level - 1) * 4 + v });
      }
    }
  }
  return chips;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(playerIds: string[], rng: Rng, firstPlayer = 0): Game {
  const chips = makeChips();
  // Shuffle within each level, then lay them out shallow to deep.
  const path: Tile[] = [];
  let tileSeq = 0;
  for (let level = 1; level <= 4; level++) {
    for (const chip of shuffle(
      chips.filter((c) => c.level === level),
      rng,
    )) {
      path.push({ id: ++tileSeq, chips: [chip] });
    }
  }
  const game: Game = {
    divers: playerIds.map((id) => ({ id, position: SUB, direction: 'down', carrying: [], banked: [] })),
    path,
    air: MAX_AIR,
    dive: 1,
    turn: firstPlayer,
    step: 'roll',
    airOut: false,
    returnOrder: [],
    phase: 'playing',
    events: [],
    nextStarter: firstPlayer,
    eventSeq: 0,
    tileSeq,
  };
  startDive(game, firstPlayer);
  return game;
}

function startDive(g: Game, starter: number): void {
  g.air = MAX_AIR;
  g.airOut = false;
  g.returnOrder = [];
  g.phase = 'playing';
  for (const d of g.divers) {
    d.position = SUB;
    d.direction = 'down';
    d.carrying = [];
  }
  g.turn = starter;
  beginTurn(g);
}

/* ---------------------------------------------------------------- queries */

export function isReturned(d: Pick<Diver, 'position' | 'direction'>): boolean {
  return d.position === SUB && d.direction === 'up';
}

export function current(g: Game): Diver {
  return g.divers[g.turn];
}

function emit(g: Game, e: DistributiveOmit<GameEvent, 'id'>): void {
  g.events.push({ ...e, id: ++g.eventSeq } as GameEvent);
  if (g.events.length > 24) g.events = g.events.slice(-24);
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

/**
 * The spots a diver could land on, nearest first. Tiles held by other divers
 * are jumped over without being counted; heading up, the submarine is always
 * the last stop.
 */
export function landingSpots(
  pathLength: number,
  occupied: ReadonlySet<number>,
  from: number,
  direction: Direction,
): number[] {
  const spots: number[] = [];
  if (direction === 'down') {
    for (let i = from + 1; i < pathLength; i++) if (!occupied.has(i)) spots.push(i);
  } else {
    for (let i = from - 1; i >= 0; i--) if (!occupied.has(i)) spots.push(i);
    spots.push(SUB);
  }
  return spots;
}

/** Positions held by other divers still in the water. */
export function occupiedBy(divers: readonly Pick<Diver, 'id' | 'position'>[], exceptId: string): Set<number> {
  return new Set(divers.filter((d) => d.id !== exceptId && d.position >= 0).map((d) => d.position));
}

export function canTurnBack(d: Pick<Diver, 'position' | 'direction'>): boolean {
  return d.direction === 'down' && d.position >= 0;
}

/** Which treasure actions make sense where the diver stands. */
export function actOptions(
  path: readonly Tile<unknown>[],
  d: { position: number; carrying: readonly unknown[] },
): { pickup: boolean; drop: boolean } {
  if (d.position < 0) return { pickup: false, drop: false };
  const tile = path[d.position];
  if (!tile) return { pickup: false, drop: false };
  return { pickup: tile.chips.length > 0, drop: tile.chips.length === 0 && d.carrying.length > 0 };
}

export function stackValue(chips: readonly Chip[]): number {
  return chips.reduce((s, c) => s + c.value, 0);
}

export function score(d: Pick<Diver, 'banked'>): number {
  return stackValue(d.banked);
}

/* ---------------------------------------------------------------- actions */

/** Step 1: breathe. Runs automatically as a turn begins. */
function beginTurn(g: Game): void {
  const d = current(g);
  g.step = 'roll';
  const amount = d.carrying.length;
  if (amount > 0) {
    g.air = Math.max(0, g.air - amount);
    emit(g, { type: 'breathe', playerId: d.id, amount, air: g.air });
  }
  if (g.air <= 0 && !g.airOut) {
    // Whoever emptied the tank still finishes this turn; then the dive is over.
    g.airOut = true;
    emit(g, { type: 'airOut' });
  }
}

export type RollResult = { error: string } | { error: null; dice: [number, number]; steps: number; hops: number[] };

/** Steps 2 and 3: optionally turn back, then roll and swim. */
export function roll(g: Game, playerId: string, turnBack: boolean, rng: Rng): RollResult {
  if (g.phase !== 'playing') return { error: 'Lượt lặn đã kết thúc' };
  const d = current(g);
  if (d.id !== playerId) return { error: 'Chưa đến lượt bạn' };
  if (g.step !== 'roll') return { error: 'Bạn đã tung xúc xắc rồi' };
  if (turnBack && !canTurnBack(d)) return { error: 'Bạn không thể quay đầu lúc này' };

  if (turnBack) d.direction = 'up';
  const face = () => DIE_FACES[Math.floor(rng() * DIE_FACES.length)];
  const dice: [number, number] = [face(), face()];
  const penalty = d.carrying.length;
  const steps = Math.max(0, dice[0] + dice[1] - penalty);

  const from = d.position;
  const spots = landingSpots(g.path.length, occupiedBy(g.divers, d.id), d.position, d.direction);
  const hops = spots.slice(0, Math.min(steps, spots.length));
  if (hops.length) d.position = hops[hops.length - 1];
  // Nowhere to go from the sub (the line is empty or every tile is taken):
  // stay aboard for the rest of the dive rather than spin forever.
  else if (d.position === SUB && spots.length === 0) d.direction = 'up';

  emit(g, { type: 'roll', playerId: d.id, dice, penalty, steps, from, hops, turnedBack: turnBack });

  if (isReturned(d)) {
    g.returnOrder.push(d.id);
    endTurn(g);
  } else {
    const opts = actOptions(g.path, d);
    if (opts.pickup || opts.drop) g.step = 'act';
    else endTurn(g);
  }
  return { error: null, dice, steps, hops };
}

/** Step 4: pick up, drop, or leave things as they are. */
export function act(g: Game, playerId: string, action: ActAction): string | null {
  if (g.phase !== 'playing') return 'Lượt lặn đã kết thúc';
  const d = current(g);
  if (d.id !== playerId) return 'Chưa đến lượt bạn';
  if (g.step !== 'act') return 'Hãy tung xúc xắc trước';
  const opts = actOptions(g.path, d);
  const tile = g.path[d.position];

  if (action.kind === 'pickup') {
    if (!opts.pickup) return 'Không có kho báu ở đây';
    const stack = tile.chips;
    d.carrying.push(stack);
    tile.chips = [];
    emit(g, { type: 'pickup', playerId: d.id, tileId: tile.id, stackId: stack[0].id });
  } else if (action.kind === 'drop') {
    if (!opts.drop) return 'Chỉ thả được kho báu xuống ô trống';
    const idx = Number(action.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= d.carrying.length) return 'Chọn kho báu để thả';
    const [stack] = d.carrying.splice(idx, 1);
    tile.chips = stack;
    emit(g, { type: 'drop', playerId: d.id, tileId: tile.id, stackId: stack[0].id });
  } else if (action.kind !== 'skip') {
    return 'Hành động không hợp lệ';
  }
  endTurn(g);
  return null;
}

function endTurn(g: Game): void {
  if (g.airOut || g.divers.every(isReturned)) return endDive(g);
  const n = g.divers.length;
  for (let i = 1; i <= n; i++) {
    const next = (g.turn + i) % n;
    if (!isReturned(g.divers[next])) {
      g.turn = next;
      beginTurn(g);
      return;
    }
  }
}

/* -------------------------------------------------------------- dive end */

function endDive(g: Game): void {
  const results: DiveSummary['results'] = [];

  // The survivors flip their chips and keep them.
  for (const d of g.divers) {
    if (!isReturned(d)) continue;
    const chips = d.carrying.flat();
    d.banked.push(...chips);
    results.push({
      playerId: d.id,
      returned: true,
      revealed: chips.map((c) => ({ ...c })),
      lost: 0,
      diveScore: stackValue(chips),
    });
  }

  // The rest drop everything; closest to the sub stacks first.
  const drowned = g.divers.filter((d) => !isReturned(d)).sort((a, b) => a.position - b.position);
  const sunk: Chip[] = [];
  for (const d of drowned) {
    const chips = d.carrying.flat();
    sunk.push(...chips);
    results.push({ playerId: d.id, returned: false, revealed: [], lost: chips.length, diveScore: 0 });
  }

  // Clear the blanks, close the gaps, and pile the lost treasure at the end.
  g.path = g.path.filter((t) => t.chips.length > 0);
  let sunkStacks = 0;
  for (let i = 0; i < sunk.length; i += STACK_SIZE) {
    g.path.push({ id: ++g.tileSeq, chips: sunk.slice(i, i + STACK_SIZE) });
    sunkStacks++;
  }

  for (const d of g.divers) {
    d.carrying = [];
    d.position = SUB;
    d.direction = 'down';
  }

  // The last diver back starts the next dive; if nobody made it, the deepest one does.
  const lastBack = g.returnOrder[g.returnOrder.length - 1];
  const starterId = lastBack ?? drowned[drowned.length - 1]?.id ?? g.divers[0].id;
  g.nextStarter = Math.max(
    0,
    g.divers.findIndex((d) => d.id === starterId),
  );

  results.sort((a, b) => g.divers.findIndex((d) => d.id === a.playerId) - g.divers.findIndex((d) => d.id === b.playerId));
  g.lastDive = { dive: g.dive, results, sunkStacks, nextStarterId: starterId };
  g.phase = g.dive >= TOTAL_DIVES ? 'gameEnd' : 'diveEnd';
  emit(g, { type: 'diveEnd', dive: g.dive });
}

export function nextDive(g: Game): string | null {
  if (g.phase !== 'diveEnd') return 'Chưa hết lượt lặn';
  g.dive += 1;
  startDive(g, g.nextStarter);
  return null;
}

/* ---------------------------------------------------------------- winner */

/** Chips per level, deepest first — the tie-breaker compares these in order. */
export function levelCounts(chips: readonly Pick<Chip, 'level'>[]): number[] {
  const counts = [0, 0, 0, 0];
  for (const c of chips) counts[4 - c.level]++;
  return counts;
}

/** Highest score wins; ties go to more high-level chips; a full tie is a draw. */
export function winners(g: Pick<Game, 'divers'>): string[] {
  const ranked = g.divers.map((d) => ({ id: d.id, score: score(d), counts: levelCounts(d.banked) }));
  const cmp = (a: (typeof ranked)[number], b: (typeof ranked)[number]) => {
    if (a.score !== b.score) return b.score - a.score;
    for (let i = 0; i < 4; i++) if (a.counts[i] !== b.counts[i]) return b.counts[i] - a.counts[i];
    return 0;
  };
  ranked.sort(cmp);
  return ranked.filter((r) => cmp(r, ranked[0]) === 0).map((r) => r.id);
}

/* ------------------------------------------------------------------ views */

export function hidden(c: Chip): ChipView {
  return { id: c.id, level: c.level };
}

export function revealed(c: Chip): ChipView {
  return { id: c.id, level: c.level, value: c.value };
}
