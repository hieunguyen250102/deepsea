/**
 * One table: who is sitting at it, the game in progress, the log and the chat.
 * Every rule decision is delegated to the shared engine; clients only send intents.
 */

import {
  MAX_AIR,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TOTAL_DIVES,
  act,
  current,
  hidden,
  isReturned,
  newGame,
  nextDive,
  revealed,
  roll,
  score,
  winners,
  type Game,
} from '../../shared/engine';
import type { ActAction, ChatMessage, GameState, LogEntry, PublicPlayer } from '../../shared/types';
import { ANIM } from '../../shared/timing';

/** How long the dive summary stays up before the table moves on by itself. */
export const DIVE_END_PAUSE_MS = 20000;
/** A connected player who sits on their turn this long gets one move made for them. */
export const TURN_LIMIT_MS = 60000;
export const DIVER_COLORS = 6;

export interface Player {
  id: string;
  name: string;
  color: number;
  isBot: boolean;
  connected: boolean;
  socketId?: string;
  /** epoch ms of the disconnect, used to hand the seat to the autopilot */
  disconnectedAt?: number;
}

const DIVE_NAMES = ['', 'Lượt lặn thứ nhất', 'Lượt lặn thứ hai', 'Lượt lặn cuối cùng'];

export class Room {
  code: string;
  players: Player[] = [];
  hostId = '';
  phase: GameState['phase'] = 'lobby';
  game: Game | null = null;
  log: LogEntry[] = [];
  chat: ChatMessage[] = [];
  lastActivity = Date.now();
  autoAdvanceAt?: number;
  winnerIds?: string[];
  /** epoch ms until which clients are still animating the last move */
  busyUntil = 0;
  /** epoch ms at which the autopilot moves for an idle player */
  turnDeadline?: number;

  private logSeq = 0;
  private chatSeq = 0;

  constructor(code: string) {
    this.code = code;
  }

  /* --------------------------------------------------------- membership */

  /** Keeps the requested colour if free, otherwise hands out the first free one. */
  private freeColor(wanted: number): number {
    const taken = new Set(this.players.map((p) => p.color));
    if (!taken.has(wanted)) return wanted;
    for (let c = 0; c < DIVER_COLORS; c++) if (!taken.has(c)) return c;
    return wanted;
  }

  addPlayer(p: { id: string; name: string; color: number; isBot?: boolean; socketId?: string }): Player | null {
    if (this.phase !== 'lobby' || this.players.length >= MAX_PLAYERS) return null;
    const player: Player = {
      id: p.id,
      name: p.name,
      color: this.freeColor(p.color),
      isBot: !!p.isBot,
      connected: true,
      socketId: p.socketId,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = player.id;
    this.pushLog('system', `${player.name} đã lên tàu`);
    this.touch();
    return player;
  }

  removePlayer(id: string): void {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const [gone] = this.players.splice(idx, 1);
    this.pushLog('system', `${gone.name} rời tàu`);
    if (this.hostId === id) this.hostId = this.players.find((p) => !p.isBot)?.id ?? '';
    this.touch();
  }

  setColor(id: string, color: number): string | null {
    if (this.phase !== 'lobby') return 'Ván đã bắt đầu';
    const p = this.find(id);
    if (!p || !Number.isInteger(color) || color < 0 || color >= DIVER_COLORS) return 'Màu không hợp lệ';
    if (this.players.some((o) => o.id !== id && o.color === color)) return 'Màu này đã có người chọn';
    p.color = color;
    this.touch();
    return null;
  }

  find(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  setConnected(id: string, connected: boolean, socketId?: string): void {
    const p = this.find(id);
    if (!p) return;
    p.connected = connected;
    p.socketId = connected ? socketId : undefined;
    p.disconnectedAt = connected ? undefined : Date.now();
    this.touch();
  }

  /** The player whose turn it is, if a dive is under way. */
  get currentPlayer(): Player | undefined {
    if (this.phase !== 'playing' || !this.game) return undefined;
    return this.find(current(this.game).id);
  }

  /* --------------------------------------------------------------- game */

  start(): string | null {
    if (this.phase !== 'lobby') return 'Ván đã bắt đầu';
    if (this.players.length < MIN_PLAYERS) return `Cần ít nhất ${MIN_PLAYERS} người chơi`;
    const first = Math.floor(Math.random() * this.players.length);
    this.winnerIds = undefined;
    this.log = [];
    this.pushLog('dive', `${DIVE_NAMES[1]} — bình khí đầy ${MAX_AIR}`);
    this.game = newGame(
      this.players.map((p) => p.id),
      Math.random,
      first,
    );
    this.phase = 'playing';
    this.pushLog('system', `${this.players[first].name} xuống nước trước`, this.players[first].id);
    this.afterChange();
    return null;
  }

  roll(playerId: string, turnBack: boolean): string | null {
    const g = this.game;
    if (!g || this.phase !== 'playing') return 'Ván chưa bắt đầu';
    const p = this.find(playerId);
    const before = current(g);
    const wasCarrying = before.carrying.length;
    const res = roll(g, playerId, turnBack, Math.random);
    if (res.error !== null) return res.error;

    const [a, b] = res.dice;
    const penalty = wasCarrying ? ` − ${wasCarrying}` : '';
    const where = res.hops[res.hops.length - 1] === -1 ? ' và về tới tàu 🎉' : '';
    this.busyUntil = Date.now() + ANIM.dice + res.hops.length * ANIM.hop;
    if (turnBack) this.pushLog('move', `${p?.name} quay đầu về tàu`, playerId);
    this.pushLog('move', `${p?.name} tung ${a}+${b}${penalty} → bơi ${res.hops.length} ô${where}`, playerId);
    this.afterChange();
    return null;
  }

  act(playerId: string, action: ActAction): string | null {
    const g = this.game;
    if (!g || this.phase !== 'playing') return 'Ván chưa bắt đầu';
    const p = this.find(playerId);
    const d = current(g);
    const tile = g.path[d.position];
    const level = tile?.chips[0]?.level;
    const size = tile?.chips.length ?? 0;
    const err = act(g, playerId, action);
    if (err) return err;

    if (action.kind !== 'skip') this.busyUntil = Date.now() + ANIM.treasure;
    if (action.kind === 'pickup') {
      const what = size > 1 ? `chồng ${size} kho báu` : `kho báu cấp ${level}`;
      this.pushLog('treasure', `${p?.name} nhặt ${what}`, playerId);
    } else if (action.kind === 'drop') {
      this.pushLog('treasure', `${p?.name} thả lại một kho báu`, playerId);
    }
    this.afterChange();
    return null;
  }

  nextDive(): string | null {
    if (!this.game) return 'Ván chưa bắt đầu';
    const err = nextDive(this.game);
    if (err) return err;
    this.pushLog('dive', `${DIVE_NAMES[this.game.dive] ?? `Lượt lặn ${this.game.dive}`} — bình khí đầy lại ${MAX_AIR}`);
    this.afterChange();
    return null;
  }

  resetToLobby(): void {
    this.phase = 'lobby';
    this.game = null;
    this.turnDeadline = undefined;
    this.winnerIds = undefined;
    this.autoAdvanceAt = undefined;
    // Seats whose owners left mid-game are freed now.
    this.players = this.players.filter((p) => p.isBot || p.connected);
    if (!this.find(this.hostId)) this.hostId = this.players.find((p) => !p.isBot)?.id ?? '';
    this.pushLog('system', 'Quay lại phòng chờ');
    this.touch();
  }

  /** Mirrors the engine's phase and writes the log lines for dive transitions. */
  private afterChange(): void {
    const g = this.game!;
    const was = this.phase;
    this.phase = g.phase;

    if (g.phase === 'playing') {
      this.autoAdvanceAt = undefined;
      this.turnDeadline = Math.max(Date.now(), this.busyUntil) + TURN_LIMIT_MS;
    } else if (was === 'playing') {
      this.turnDeadline = undefined;
      const s = g.lastDive!;
      if (g.airOut) this.pushLog('danger', 'Hết không khí! Ai chưa về tàu sẽ mất hết kho báu');
      else this.pushLog('dive', 'Mọi người đã về tàu');
      for (const r of s.results) {
        const name = this.find(r.playerId)?.name;
        if (r.returned && r.revealed.length) this.pushLog('treasure', `${name} mang về ${r.diveScore} điểm`, r.playerId);
        if (!r.returned && r.lost) this.pushLog('danger', `${name} đánh rơi ${r.lost} kho báu xuống đáy biển`, r.playerId);
      }
      if (g.phase === 'gameEnd') {
        this.winnerIds = winners(g);
        const names = this.winnerIds.map((id) => this.find(id)?.name).join(', ');
        this.pushLog('dive', this.winnerIds.length > 1 ? `Hoà! ${names}` : `${names} thắng cuộc!`);
        this.autoAdvanceAt = undefined;
      } else {
        this.autoAdvanceAt = Date.now() + DIVE_END_PAUSE_MS;
      }
    }
    this.touch();
  }

  /* -------------------------------------------------------------- views */

  publicState(): GameState {
    const g = this.game;
    const players: PublicPlayer[] = this.players.map((p) => {
      const d = g?.divers.find((x) => x.id === p.id);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        isBot: p.isBot,
        connected: p.connected,
        position: d?.position ?? -1,
        direction: d?.direction ?? 'down',
        returned: d ? isReturned(d) : false,
        carrying: d ? d.carrying.map((s) => s.map(hidden)) : [],
        banked: d ? d.banked.map(revealed) : [],
        score: d ? score(d) : 0,
      };
    });
    return {
      roomCode: this.code,
      phase: this.phase,
      hostId: this.hostId,
      players,
      dive: g?.dive ?? 0,
      totalDives: TOTAL_DIVES,
      air: g?.air ?? MAX_AIR,
      maxAir: MAX_AIR,
      path: g ? g.path.map((t) => ({ id: t.id, chips: t.chips.map(hidden) })) : [],
      turn: g && this.players.length ? this.players.findIndex((p) => p.id === current(g).id) : 0,
      step: g?.step ?? 'roll',
      airOut: g?.airOut ?? false,
      events: g?.events ?? [],
      log: this.log,
      lastDive: g?.lastDive,
      autoAdvanceAt: this.autoAdvanceAt,
      turnDeadline: this.phase === 'playing' ? this.turnDeadline : undefined,
      winnerIds: this.winnerIds,
    };
  }

  /* ---------------------------------------------------------- log, chat */

  pushLog(kind: LogEntry['kind'], text: string, playerId?: string): void {
    this.log.push({ id: ++this.logSeq, kind, text, playerId });
    if (this.log.length > 60) this.log = this.log.slice(-60);
  }

  addChat(playerId: string, text: string): ChatMessage | null {
    const p = this.find(playerId);
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!p || !clean) return null;
    const msg: ChatMessage = { id: ++this.chatSeq, playerId, name: p.name, color: p.color, text: clean, at: Date.now() };
    this.chat.push(msg);
    if (this.chat.length > 80) this.chat = this.chat.slice(-80);
    this.touch();
    return msg;
  }

  touch(): void {
    this.lastActivity = Date.now();
  }
}
