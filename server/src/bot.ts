/**
 * A heuristic diver: it weighs how far it is from the submarine against how
 * many rounds of air are left, given what everybody is carrying.
 * Also plays for anyone who drops off mid-game.
 */

import { SUB, actOptions, canTurnBack, landingSpots, occupiedBy, type Diver, type Game } from '../../shared/engine';
import type { ActAction } from '../../shared/types';

export type BotMove = { type: 'roll'; turnBack: boolean } | { type: 'act'; action: ActAction };

/** The two dice sum to 2–6 with weights 1,2,3,2,1 (out of 9). */
const SUMS: [number, number][] = [
  [2, 1 / 9],
  [3, 2 / 9],
  [4, 3 / 9],
  [5, 2 / 9],
  [6, 1 / 9],
];

/** Expected tiles moved per turn while carrying k chips. */
function expectedMove(k: number): number {
  return SUMS.reduce((s, [sum, p]) => s + Math.max(0, sum - k) * p, 0);
}

/** Air spent per full round of turns, if we carry `mine` chips. */
function burnPerRound(g: Game, me: Diver, mine: number): number {
  let burn = 0;
  for (const d of g.divers) {
    if (d.id === me.id) burn += mine;
    else if (!(d.position === SUB && d.direction === 'up')) burn += d.carrying.length;
  }
  return Math.max(1, burn);
}

/**
 * Rounds of air left minus rounds needed to get home with `k` chips.
 * Negative means we are probably going to drown.
 */
function margin(g: Game, me: Diver, k: number, airNow = g.air): number {
  const roundsLeft = airNow / burnPerRound(g, me, k);
  const distance = me.position + 1;
  const roundsNeeded = distance / Math.max(0.35, expectedMove(k));
  return roundsLeft - roundsNeeded * 1.25;
}

export function chooseMove(g: Game, id: string, rng: () => number = Math.random): BotMove {
  const me = g.divers.find((d) => d.id === id)!;
  const k = me.carrying.length;

  if (g.step === 'roll') {
    if (!canTurnBack(me)) return { type: 'roll', turnBack: false };
    const ahead = landingSpots(g.path.length, occupiedBy(g.divers, me.id), me.position, 'down');
    if (ahead.length === 0) return { type: 'roll', turnBack: true };
    // Empty-handed and too deep to make use of anything further down: head home.
    if (k === 0) return { type: 'roll', turnBack: margin(g, me, 1) < -1 };
    // A little greed varies from bot to bot and turn to turn.
    const greed = rng();
    const turnBack = k >= 4 || margin(g, me, k) < 0.9 - greed || (k >= 3 && me.position > g.path.length * 0.6);
    return { type: 'roll', turnBack };
  }

  const opts = actOptions(g.path, me);
  const tile = g.path[me.position];

  if (opts.pickup) {
    const level = Math.max(...tile.chips.map((c) => c.level));
    // On the way down, save the air for the deep stuff; on the way up, take what is safe.
    const worthIt =
      me.direction === 'up' || tile.chips.length > 1 || level >= 3 || (level === 2 && k === 0 && g.air < 20);
    const safe = margin(g, me, k + 1) > (me.direction === 'up' ? 0.4 : 1.2);
    // Coming home with nothing is the worst outcome; take one chip if it is still survivable.
    const lastChance = k === 0 && margin(g, me, 1) > -0.5 && (me.direction === 'up' || margin(g, me, 1) < 2.5);
    if ((worthIt && safe && k < 5) || lastChance) return { type: 'act', action: { kind: 'pickup' } };
  }

  if (opts.drop && me.direction === 'up' && k >= 2 && margin(g, me, k) < 0.5) {
    // Shed the cheapest-looking load: the lowest level, single chips before stacks.
    let best = 0;
    me.carrying.forEach((s, i) => {
      const lv = (x: typeof s) => Math.max(...x.map((c) => c.level)) + x.length;
      if (lv(s) < lv(me.carrying[best])) best = i;
    });
    return { type: 'act', action: { kind: 'drop', index: best } };
  }

  return { type: 'act', action: { kind: 'skip' } };
}
