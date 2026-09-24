/**
 * Wire types shared by the server (the referee) and the client (the view).
 * Everything here is plain JSON so it crosses Socket.IO untouched.
 */

export type Level = 1 | 2 | 3 | 4;

/** A treasure chip. Its value is secret until someone brings it home. */
export interface Chip {
  id: number;
  level: Level;
  value: number;
}

/** What the table can see of a chip: its shape always, its value only once revealed. */
export interface ChipView {
  id: number;
  level: Level;
  value?: number;
}

/**
 * One spot on the line of undersea chips. No chips means a blank chip;
 * more than one is a stack of drowned treasure, which acts as a single chip.
 * The id is stable while the tile exists so the client can animate it.
 */
export interface Tile<C = Chip> {
  id: number;
  chips: C[];
}

export type TileView = Tile<ChipView>;

export type Direction = 'down' | 'up';

export type Phase = 'lobby' | 'playing' | 'diveEnd' | 'gameEnd';

/** 'roll' = choose a direction and roll; 'act' = pick up, drop or pass. */
export type Step = 'roll' | 'act';

export type ActAction = { kind: 'pickup' } | { kind: 'drop'; index: number } | { kind: 'skip' };

/** Animation hints; the client plays every event whose id it has not seen yet. */
export type GameEvent =
  | { id: number; type: 'breathe'; playerId: string; amount: number; air: number }
  | {
      id: number;
      type: 'roll';
      playerId: string;
      dice: [number, number];
      penalty: number;
      steps: number;
      /** where the diver started; -1 is the submarine */
      from: number;
      /** every position the diver passes through, in order; -1 is the submarine */
      hops: number[];
      turnedBack: boolean;
    }
  | { id: number; type: 'pickup' | 'drop'; playerId: string; tileId: number; stackId: number }
  | { id: number; type: 'airOut' }
  | { id: number; type: 'diveEnd'; dive: number };

export interface DiveResult {
  playerId: string;
  returned: boolean;
  /** chips brought home, now face up */
  revealed: ChipView[];
  /** chips lost to the deep */
  lost: number;
  diveScore: number;
}

export interface DiveSummary {
  dive: number;
  results: DiveResult[];
  /** how many stacks of drowned treasure were added to the end of the line */
  sunkStacks: number;
  nextStarterId?: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  /** diver colour, index into DIVER_COLORS */
  color: number;
  isBot: boolean;
  connected: boolean;
  /** -1 = on the submarine */
  position: number;
  direction: Direction;
  returned: boolean;
  /** treasure being carried this dive, one entry per stack; values hidden */
  carrying: ChipView[][];
  /** treasure brought home in earlier dives, face up */
  banked: ChipView[];
  score: number;
}

export interface LogEntry {
  id: number;
  text: string;
  kind: 'system' | 'dive' | 'move' | 'treasure' | 'danger';
  playerId?: string;
}

export interface GameState {
  roomCode: string;
  phase: Phase;
  hostId: string;
  players: PublicPlayer[];
  dive: number;
  totalDives: number;
  air: number;
  maxAir: number;
  path: TileView[];
  /** index into players */
  turn: number;
  step: Step;
  /** the air ran out: the current turn is the last of this dive */
  airOut: boolean;
  events: GameEvent[];
  log: LogEntry[];
  lastDive?: DiveSummary;
  /** epoch ms at which the table moves on by itself, so an AFK host cannot stall it */
  autoAdvanceAt?: number;
  /** epoch ms at which an idle player's move is made for them */
  turnDeadline?: number;
  winnerIds?: string[];
}

export interface ChatMessage {
  id: number;
  playerId: string;
  name: string;
  color: number;
  text: string;
  /** epoch ms */
  at: number;
}
