/**
 * Deep Sea Adventure realtime server — Express + Socket.IO.
 * Deploys as a single always-on web service (Render, Fly, Railway…).
 */

import './env';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';

import { Room, DIVE_END_PAUSE_MS, DIVER_COLORS } from './room';
import { chooseMove } from './bot';
import { requestCode, verifyCode, verifyToken, type User, hostingIsRestricted } from './auth';
import { MAX_PLAYERS } from '../../shared/engine';
import type { ActAction } from '../../shared/types';

const PORT = Number(process.env.PORT) || 4100;
/** "https://a.vercel.app/" and "HTTPS://A.vercel.app" name the same origin as the browser's "https://a.vercel.app". */
const normalizeOrigin = (o: string) => o.trim().replace(/\/+$/, '').toLowerCase();

const ORIGINS = (process.env.CLIENT_ORIGIN ?? '*').split(',').map(normalizeOrigin).filter(Boolean);

/** Entries may use `*` as a wildcard, e.g. https://deepsea-*.vercel.app for preview deploys. */
const ORIGIN_PATTERNS = ORIGINS.map(
  (o) => new RegExp(`^${o.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`),
);

const rejectedOrigins = new Set<string>();

function originAllowed(origin: string | undefined): boolean {
  // Same-origin requests, curl and health checks send no Origin header.
  if (!origin || ORIGINS.includes('*')) return true;
  const o = normalizeOrigin(origin);
  if (ORIGIN_PATTERNS.some((re) => re.test(o))) return true;
  if (!rejectedOrigins.has(o) && rejectedOrigins.size < 50) {
    rejectedOrigins.add(o);
    console.warn(`[cors] blocked origin ${o} — CLIENT_ORIGIN is "${process.env.CLIENT_ORIGIN}"`);
  }
  return false;
}

const corsOrigin = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
  cb(null, originAllowed(origin));

const app = express();
// Render (and most hosts) sit behind a proxy; the rate limits need the real client IP.
app.set('trust proxy', 1);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '4kb' }));

const rooms = new Map<string, Room>();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    sockets: io.engine.clientsCount,
    // false means HOST_EMAILS is unset and *anyone* who logs in can open a table
    hostRestricted: hostingIsRestricted(),
    // what CLIENT_ORIGIN resolved to, so a CORS mismatch can be spotted from outside
    allowedOrigins: ORIGINS,
    uptime: process.uptime(),
  });
});

/* ------------------------------------------------------------------ auth */

app.post('/auth/request', async (req, res) => {
  const result = await requestCode(req.body?.email, req.ip ?? 'unknown');
  res.status(result.ok ? 200 : 400).json(result);
});

app.post('/auth/verify', (req, res) => {
  const result = verifyCode(req.body?.email, req.body?.code, req.body?.challenge);
  res.status(result.ok ? 200 : 400).json(result);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  pingInterval: 20000,
  pingTimeout: 25000,
});

/* ------------------------------------------------------------------ utils */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes

function newCode(): string {
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name: unknown): string {
  const n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 14) : '';
  return n || 'Thợ lặn';
}

function cleanColor(color: unknown): number {
  const c = Number(color);
  return Number.isInteger(c) && c >= 0 && c < DIVER_COLORS ? c : 0;
}

const BOT_NAMES = ['Mực Ống', 'Sao Biển', 'Cá Nóc', 'Rùa Già', 'Sứa Con', 'Tôm Hùm', 'Cua Đá'];

function broadcast(room: Room): void {
  io.to(room.code).emit('state', room.publicState());
}

/* ------------------------------------------------------------- autopilot */

/** Bots (and abandoned seats) play themselves, after the table has seen the last move. */
const pending = new Map<string, NodeJS.Timeout>();

function clearPending(key: string): void {
  const t = pending.get(key);
  if (t) clearTimeout(t);
  pending.delete(key);
}

/** Nobody should be stuck staring at a summary because the host walked away. */
function scheduleDiveAdvance(room: Room): void {
  const key = `${room.code}:dive`;
  clearPending(key);
  if (room.phase !== 'diveEnd') return;
  const delay = Math.max(1000, (room.autoAdvanceAt ?? Date.now() + DIVE_END_PAUSE_MS) - Date.now());
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      if (room.phase !== 'diveEnd') return;
      room.nextDive();
      broadcast(room);
      scheduleAuto(room);
    }, delay),
  );
}

function scheduleAuto(room: Room): void {
  if (room.phase === 'diveEnd') return scheduleDiveAdvance(room);
  clearPending(room.code);
  if (room.phase !== 'playing' || !room.game) return;

  const p = room.currentPlayer;
  if (!p) return;
  const abandoned = !p.isBot && !p.connected && Date.now() - (p.disconnectedAt ?? 0) > 15000;
  const think = p.isBot ? 450 + Math.random() * 700 : 300;
  // A connected human gets until the turn deadline; after that one move is made for them.
  const delay =
    p.isBot || abandoned
      ? Math.max(0, room.busyUntil - Date.now()) + think
      : Math.max(0, (room.turnDeadline ?? Date.now()) - Date.now());
  const step = room.game.step;
  pending.set(
    room.code,
    setTimeout(() => {
      pending.delete(room.code);
      const g = room.game;
      if (room.phase !== 'playing' || !g || room.currentPlayer?.id !== p.id || g.step !== step) return;
      if (!p.isBot && p.connected) room.pushLog('system', `${p.name} chậm quá — máy đi hộ một nước`, p.id);
      const move = chooseMove(g, p.id);
      const err = move.type === 'roll' ? room.roll(p.id, move.turnBack) : room.act(p.id, move.action);
      if (err) {
        // Should never happen, but a confused bot must not freeze the table.
        console.warn(`[bot] ${p.name}: ${err}`);
        if (move.type === 'act') room.act(p.id, { kind: 'skip' });
      }
      broadcast(room);
      scheduleAuto(room);
    }, delay),
  );
}

/** Rooms nobody has touched for an hour are swept away. */
setInterval(
  () => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [code, room] of rooms) {
      const anyoneHome = room.players.some((p) => p.connected && !p.isBot);
      if (!anyoneHome && room.lastActivity < cutoff) {
        clearPending(code);
        clearPending(`${code}:dive`);
        rooms.delete(code);
      }
    }
  },
  5 * 60 * 1000,
).unref();

/* ---------------------------------------------------------------- sockets */

type Ack<T> = (res: T) => void;
type JoinAck = Ack<{ roomCode?: string; error?: string }>;

/** Anyone may connect, but only a signed-in socket gets a seat. */
io.use((socket, next) => {
  socket.data.user = verifyToken(socket.handshake.auth?.token);
  next();
});

const NEED_LOGIN = 'Bạn cần đăng nhập trước';

io.on('connection', (socket: Socket) => {
  const user: User | null = socket.data.user;
  let joinedCode: string | null = null;
  let playerId: string | null = null;
  const chatTimes: number[] = [];

  socket.emit('session', { user });

  const fail = (msg: string) => socket.emit('errorMsg', { message: msg });
  const myRoom = () => (joinedCode ? rooms.get(joinedCode) : undefined);

  /** The same account open in two tabs: only the newest one owns the seat. */
  const ownsSeat = (room: Room) => !!playerId && room.find(playerId)?.socketId === socket.id;

  const enter = (room: Room, pid: string, ack?: JoinAck) => {
    socket.join(room.code);
    joinedCode = room.code;
    playerId = pid;
    ack?.({ roomCode: room.code });
    socket.emit('chat:history', room.chat);
    broadcast(room);
    scheduleAuto(room);
  };

  socket.on('room:create', ({ name, color }: { name: string; color: number }, ack?: JoinAck) => {
    if (!user) return ack?.({ error: NEED_LOGIN });
    if (!user.canHost) return ack?.({ error: 'Tài khoản này chỉ được vào bàn, không được tạo bàn' });
    const room = new Room(newCode());
    rooms.set(room.code, room);
    const player = room.addPlayer({ id: user.id, name: cleanName(name), color: cleanColor(color), socketId: socket.id });
    if (!player) return ack?.({ error: 'Không tạo được phòng' });
    enter(room, user.id, ack);
  });

  socket.on(
    'room:join',
    ({ roomCode, name, color }: { roomCode: string; name: string; color: number }, ack?: JoinAck) => {
      if (!user) return ack?.({ error: NEED_LOGIN });
      const room = rooms.get(String(roomCode ?? '').toUpperCase().trim());
      if (!room) return ack?.({ error: 'Không tìm thấy phòng' });

      if (room.find(user.id)) {
        // Reconnecting into a seat we already own — works mid-game too.
        room.setConnected(user.id, true, socket.id);
      } else {
        const player = room.addPlayer({ id: user.id, name: cleanName(name), color: cleanColor(color), socketId: socket.id });
        if (!player) {
          return ack?.({ error: room.phase === 'lobby' ? `Tàu đã đủ ${MAX_PLAYERS} thợ lặn` : 'Ván đã bắt đầu' });
        }
      }
      enter(room, user.id, ack);
    },
  );

  socket.on('room:addBot', () => {
    const room = myRoom();
    if (!room || room.hostId !== playerId || room.phase !== 'lobby') return;
    const used = new Set(room.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.players.length}`;
    const taken = new Set(room.players.map((p) => p.color));
    const color = [...Array(DIVER_COLORS).keys()].find((c) => !taken.has(c)) ?? 0;
    room.addPlayer({ id: `bot-${Math.random().toString(36).slice(2, 9)}`, name, color, isBot: true });
    broadcast(room);
  });

  socket.on('room:kick', ({ id }: { id: string }) => {
    const room = myRoom();
    if (!room || room.hostId !== playerId || room.phase !== 'lobby' || id === playerId) return;
    room.removePlayer(id);
    broadcast(room);
  });

  socket.on('room:color', ({ color }: { color: number }) => {
    const room = myRoom();
    if (!room || !playerId) return;
    const err = room.setColor(playerId, Number(color));
    if (err) return fail(err);
    broadcast(room);
  });

  socket.on('game:start', () => {
    const room = myRoom();
    if (!room) return;
    if (room.hostId !== playerId) return fail('Chỉ chủ phòng mới bắt đầu được');
    const err = room.start();
    if (err) return fail(err);
    broadcast(room);
    scheduleAuto(room);
  });

  socket.on('turn:roll', ({ turnBack }: { turnBack?: boolean } = {}) => {
    const room = myRoom();
    if (!room || !playerId || !ownsSeat(room)) return;
    const err = room.roll(playerId, !!turnBack);
    if (err) return fail(err);
    broadcast(room);
    scheduleAuto(room);
  });

  socket.on('turn:act', ({ action }: { action?: ActAction } = {}) => {
    const room = myRoom();
    if (!room || !playerId || !ownsSeat(room) || !action || typeof action !== 'object') return;
    const err = room.act(playerId, action);
    if (err) return fail(err);
    broadcast(room);
    scheduleAuto(room);
  });

  socket.on('dive:next', () => {
    const room = myRoom();
    if (!room) return;
    if (room.hostId !== playerId) return fail('Chờ chủ phòng tiếp tục');
    const err = room.nextDive();
    if (err) return fail(err);
    clearPending(`${room.code}:dive`);
    broadcast(room);
    scheduleAuto(room);
  });

  socket.on('game:restart', () => {
    const room = myRoom();
    if (!room || room.hostId !== playerId) return;
    clearPending(room.code);
    clearPending(`${room.code}:dive`);
    room.resetToLobby();
    broadcast(room);
  });

  socket.on('chat:send', ({ text }: { text?: string } = {}) => {
    const room = myRoom();
    if (!room || !playerId || typeof text !== 'string') return;
    const now = Date.now();
    while (chatTimes.length && now - chatTimes[0] > 5000) chatTimes.shift();
    if (chatTimes.length >= 5) return fail('Bạn chat nhanh quá, chậm lại chút');
    const msg = room.addChat(playerId, text);
    if (!msg) return;
    chatTimes.push(now);
    io.to(room.code).emit('chat:msg', msg);
  });

  const leaveSeat = () => {
    const room = myRoom();
    if (!room || !playerId || !ownsSeat(room)) return null;
    if (room.phase === 'lobby') room.removePlayer(playerId);
    else room.setConnected(playerId, false);
    broadcast(room);
    return room;
  };

  socket.on('room:leave', () => {
    const room = myRoom();
    leaveSeat();
    if (room) {
      socket.leave(room.code);
      // Someone who walks out mid-game is played by the autopilot straight away.
      const p = playerId ? room.find(playerId) : undefined;
      if (p) p.disconnectedAt = 0;
      scheduleAuto(room);
    }
    joinedCode = null;
  });

  socket.on('disconnect', () => {
    const room = leaveSeat();
    if (!room) return;
    // Give the seat a grace period before the autopilot takes over.
    setTimeout(() => {
      const still = rooms.get(room.code);
      if (still) scheduleAuto(still);
    }, 16000).unref();
  });
});

server.listen(PORT, () => {
  console.log(`Deep Sea server listening on :${PORT}`);
});
