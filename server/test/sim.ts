/**
 * Rules checks plus a few hundred bot-vs-bot games with invariants checked
 * after every move. Run with `npm test`.
 */

import {
  MAX_AIR,
  SUB,
  act,
  current,
  isReturned,
  landingSpots,
  makeChips,
  newGame,
  nextDive,
  roll,
  score,
  winners,
  type Game,
} from '../../shared/engine';
import { chooseMove } from '../src/bot';

let checks = 0;
let failures = 0;

function ok(cond: unknown, msg: string): void {
  checks++;
  if (!cond) {
    failures++;
    console.error('✗', msg);
  }
}

function eq<T>(a: T, b: T, msg: string): void {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An rng that makes the dice show exactly these faces, in order. */
function dice(...faces: number[]) {
  let i = 0;
  return () => (2 * (faces[i++ % faces.length] - 1) + 0.5) / 6;
}

/* ------------------------------------------------------------ chips */
{
  const chips = makeChips();
  eq(chips.length, 32, 'chip count');
  for (let lv = 1; lv <= 4; lv++) {
    const values = chips.filter((c) => c.level === lv).map((c) => c.value);
    eq(
      values,
      [0, 0, 1, 1, 2, 2, 3, 3].map((v) => v + (lv - 1) * 4),
      `level ${lv} values`,
    );
  }
}

/* ------------------------------------------------------------ setup */
{
  const g = newGame(['a', 'b', 'c'], mulberry32(1), 1);
  eq(g.path.length, 32, 'path length');
  eq(
    g.path.map((t) => t.chips[0].level),
    [...Array(8).fill(1), ...Array(8).fill(2), ...Array(8).fill(3), ...Array(8).fill(4)],
    'path sorted by level',
  );
  eq(g.air, MAX_AIR, 'full tank');
  eq(g.turn, 1, 'first player');
  ok(g.divers.every((d) => d.position === SUB && d.direction === 'down'), 'everyone aboard, facing down');
}

/* --------------------------------------------------------- movement */
{
  // Occupied tiles are jumped without counting; heading up ends at the sub.
  eq(landingSpots(10, new Set([1, 2]), SUB, 'down'), [0, 3, 4, 5, 6, 7, 8, 9], 'skip occupied going down');
  eq(landingSpots(10, new Set([3]), 5, 'up'), [4, 2, 1, 0, SUB], 'skip occupied going up');
  eq(landingSpots(5, new Set([4]), 2, 'down'), [3], 'the last tile is the floor');

  const g = newGame(['a', 'b'], mulberry32(2), 0);
  roll(g, 'a', false, dice(1, 2)); // a → tile 2
  eq(g.divers[0].position, 2, 'a swims 3');
  eq(g.step, 'act', 'a may pick up');
  act(g, 'a', { kind: 'pickup' });
  eq(g.divers[0].carrying.length, 1, 'a carries one');
  eq(g.path[2].chips.length, 0, 'a blank is left behind');
  eq(current(g).id, 'b', "b's turn");
  roll(g, 'b', false, dice(1, 2)); // b: spots 0,1,3 → lands on 3 (skips a on 2)
  eq(g.divers[1].position, 3, 'b jumps over a');
  act(g, 'b', { kind: 'skip' });

  // a breathes one, then rolls 1+1−1 = 1.
  eq(g.air, MAX_AIR - 1, 'a breathes for one chip');
  ok(roll(g, 'a', true, mulberry32(3)).error === null, 'a turns back');
  eq(g.divers[0].direction, 'up', 'a faces the sub');
  const idle = g.divers.find((d) => d.id !== current(g).id)!;
  ok(roll(g, idle.id, false, dice(1, 1)).error !== null, 'out of turn is rejected');
}

/* ----------------------------------------------- carrying slows you */
{
  const g = newGame(['a', 'b'], mulberry32(4), 0);
  const a = g.divers[0];
  a.position = 10;
  a.carrying = [[g.path[20].chips[0]], [g.path[21].chips[0]], [g.path[22].chips[0]]];
  g.path[20].chips = [];
  g.path[21].chips = [];
  g.path[22].chips = [];
  const res = roll(g, 'a', false, dice(1, 1));
  ok(res.error === null && res.steps === 0 && a.position === 10, '2 − 3 means no movement');
}

/* --------------------------------------------------------- air runs out */
{
  const g = newGame(['a', 'b'], mulberry32(5), 0);
  const [a, b] = g.divers;
  a.position = 31;
  b.position = 5;
  b.direction = 'up';
  // Hand b three chips so they breathe 3 a turn.
  b.carrying = [[g.path[0].chips[0]], [g.path[1].chips[0]], [g.path[2].chips[0]]];
  g.path[0].chips = [];
  g.path[1].chips = [];
  g.path[2].chips = [];
  a.carrying = [[g.path[31].chips[0]]];
  g.path[31].chips = [];
  g.air = 3;
  g.step = 'roll';
  roll(g, 'a', false, dice(1, 1)); // a is on the floor and can't move
  eq(g.step, 'act', 'a could drop on the blank');
  act(g, 'a', { kind: 'skip' });
  eq(current(g).id, 'b', "b's turn");
  eq(g.air, 0, 'b empties the tank');
  ok(g.airOut, 'air-out flagged');
  eq(g.phase, 'playing', 'b still finishes the turn');
  roll(g, 'b', false, dice(3, 3)); // 6 − 3 = 3: 4,3,2 … not home
  eq(g.divers[1].position, 2, 'b stops short');
  act(g, 'b', { kind: 'skip' });
  eq(g.phase, 'diveEnd', 'dive ends after that turn');
  const s = g.lastDive!;
  ok(s.results.every((r) => !r.returned), 'nobody made it');
  // b (closer, at 2) stacks first: 3 chips, then a's 1 chip.
  const tail = g.path.slice(-2);
  eq(
    tail.map((t) => t.chips.length),
    [3, 1],
    'drowned chips stacked 3 + 1',
  );
  eq(s.nextStarterId, 'a', 'deepest diver starts when nobody returned');
  eq(g.path.length, 28 + 2, 'blanks removed, stacks appended');
  ok(g.path.every((t) => t.chips.length > 0), 'no blanks left');
  eq(nextDive(g), null, 'next dive');
  eq(g.air, MAX_AIR, 'tank refilled');
  eq(current(g).id, 'a', 'a starts dive 2');
}

/* ------------------------------------------------ banking and winner */
{
  const g = newGame(['a', 'b'], mulberry32(6), 0);
  const a = g.divers[0];
  a.position = 0;
  a.direction = 'up';
  a.carrying = [[g.path[31].chips[0]]];
  const val = g.path[31].chips[0].value;
  g.path[31].chips = [];
  roll(g, 'a', false, dice(1, 1));
  ok(isReturned(a), 'a is home');
  eq(g.returnOrder, ['a'], 'return order');
  // b dives, then turns home.
  roll(g, 'b', false, dice(1, 1));
  act(g, 'b', { kind: 'skip' });
  roll(g, 'b', true, dice(3, 3));
  eq(g.phase, 'diveEnd', 'everyone home ends the dive');
  eq(score(a), val, 'a banks the chip');
  eq(g.lastDive!.nextStarterId, 'b', 'last one back starts next');

  const t = { divers: [a, { ...g.divers[1], banked: [{ id: 99, level: 1 as const, value: val }] }] };
  eq(winners(t), a.banked[0].level > 1 ? ['a'] : ['a', 'b'], 'tie-break by higher-level chips');
}

/* ------------------------------------------------- bot-vs-bot games */
{
  let games = 0;
  let totalTurns = 0;
  const outcomes = { returned: 0, drowned: 0 };
  for (let seed = 1; seed <= 600; seed++) {
    const rng = mulberry32(seed);
    const n = 2 + (seed % 5);
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    const g: Game = newGame(ids, rng, seed % n);
    let turns = 0;
    while (g.phase !== 'gameEnd') {
      if (g.phase === 'diveEnd') {
        for (const r of g.lastDive!.results) outcomes[r.returned ? 'returned' : 'drowned']++;
        nextDive(g);
        continue;
      }
      const d = current(g);
      const move = chooseMove(g, d.id, rng);
      const err =
        move.type === 'roll' ? roll(g, d.id, move.turnBack, rng).error : act(g, d.id, move.action);
      if (err) {
        ok(false, `seed ${seed}: bot made an illegal move: ${err}`);
        break;
      }
      if (++turns > 2000) {
        ok(false, `seed ${seed}: game did not finish`);
        break;
      }

      // Invariants after every move.
      const inPath = g.path.reduce((s, t) => s + t.chips.length, 0);
      const carried = g.divers.reduce((s, x) => s + x.carrying.flat().length, 0);
      const banked = g.divers.reduce((s, x) => s + x.banked.length, 0);
      if (inPath + carried + banked !== 32) ok(false, `seed ${seed}: chips not conserved`);
      const wet = g.divers.filter((x) => x.position >= 0).map((x) => x.position);
      if (new Set(wet).size !== wet.length) ok(false, `seed ${seed}: two divers share a tile`);
      if (g.air < 0 || g.air > MAX_AIR) ok(false, `seed ${seed}: air out of range`);
      if (g.path.some((t) => t.chips.length > 3)) ok(false, `seed ${seed}: stack taller than 3`);
      checks += 5;
    }
    ok(g.phase === 'gameEnd', `seed ${seed}: reached the end`);
    ok(winners(g).length >= 1, `seed ${seed}: has a winner`);
    for (const r of g.lastDive!.results) outcomes[r.returned ? 'returned' : 'drowned']++;
    games++;
    totalTurns += turns;
  }
  const rate = Math.round((100 * outcomes.returned) / (outcomes.returned + outcomes.drowned));
  console.log(`${games} bot games, ~${Math.round(totalTurns / games)} moves each, bots got home ${rate}% of dives`);
  ok(rate > 35 && rate < 95, 'bots are neither suicidal nor timid');
}

console.log(`${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
