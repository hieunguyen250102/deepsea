/**
 * The dive in progress. Turns the server's event feed into animation and
 * sound, and lays the table out: seascape + action bar, with the crew and
 * the chat beside it (desktop) or around it (phone).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ActAction, Direction, GameEvent, GameState } from '@shared/types';
import { SUB, landingSpots, occupiedBy } from '@shared/engine';
import { ANIM } from '@shared/timing';
import { Seascape, type Puff } from './Seascape';
import { Crew } from './Crew';
import { ActionBar } from './ActionBar';
import { DiceTray } from './DiceTray';
import { ChatBox, type ChatItem } from './Chat';
import { AirOutBanner, DiveEnd, GameEnd } from './Overlays';
import { Logo } from './Logo';
import { sfx } from '../lib/sound';
import { airColor } from '../lib/theme';
import { useMediaQuery, useTick } from '../lib/hooks';

type RollEvent = Extract<GameEvent, { type: 'roll' }>;

interface Props {
  state: GameState;
  youId: string;
  chat: ChatItem[];
  muted: boolean;
  onToggleMute: () => void;
  onSendChat: (text: string) => void;
  onRoll: (turnBack: boolean) => void;
  onAct: (action: ActAction) => void;
  onNextDive: () => void;
  onRestart: () => void;
  onLeave: () => void;
  onShowRules: () => void;
}

const BUBBLE_MS = 4500;

export function GameScreen(props: Props) {
  const { state, youId, chat } = props;
  const desktop = useMediaQuery('(min-width: 1024px)');
  const me = state.players.find((p) => p.id === youId);
  const isHost = state.hostId === youId;
  const myTurn = !!me && state.phase === 'playing' && state.players[state.turn]?.id === youId;

  /* ------------------------------------------------------ event feed */

  const [lastRoll, setLastRoll] = useState<RollEvent | null>(null);
  const [puffs, setPuffs] = useState<Puff[]>([]);
  const [busy, setBusy] = useState(false);
  const [airOutBanner, setAirOutBanner] = useState(false);
  // The dive summary waits for the last swim to finish; on a reload it shows at once.
  const [overlayDive, setOverlayDive] = useState<number | null>(() =>
    state.phase === 'diveEnd' || state.phase === 'gameEnd' ? (state.lastDive?.dive ?? null) : null,
  );
  const seen = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const evs = state.events;
    const maxId = evs.length ? evs[evs.length - 1].id : 0;
    // First look, or a fresh game (ids restart): don't replay history.
    if (seen.current === null || maxId < seen.current) {
      seen.current = maxId;
      return;
    }
    const fresh = evs.filter((e) => e.id > seen.current!);
    seen.current = maxId;

    let t = 0;
    for (const e of fresh) {
      switch (e.type) {
        case 'roll': {
          setLastRoll(e);
          if (e.playerId !== youId) sfx.dice();
          if (e.turnedBack) sfx.turnBack();
          const swim = ANIM.dice + e.hops.length * ANIM.hop;
          e.hops.forEach((_, i) => later(ANIM.dice + i * ANIM.hop + ANIM.hop * 0.6, () => sfx.hop()));
          if (e.hops[e.hops.length - 1] === SUB) later(swim, () => sfx.home());
          setBusy(true);
          later(swim, () => setBusy(false));
          t = Math.max(t, swim);
          break;
        }
        case 'breathe': {
          const { id, amount } = e;
          later(t, () => {
            setPuffs((p) => [...p.slice(-4), { id, amount }]);
            sfx.breathe(amount);
            later(1700, () => setPuffs((p) => p.filter((x) => x.id !== id)));
          });
          break;
        }
        case 'pickup':
          if (e.playerId !== youId) later(t, () => sfx.pickup());
          break;
        case 'drop':
          if (e.playerId !== youId) later(t, () => sfx.drop());
          break;
        case 'airOut':
          later(t, () => {
            setAirOutBanner(true);
            sfx.alarm();
            later(2300, () => setAirOutBanner(false));
          });
          t += 2400;
          break;
        case 'diveEnd': {
          const dive = e.dive;
          later(t + 700, () => setOverlayDive(dive));
          break;
        }
      }
    }
  }, [state.events, youId, later]);

  // A new dive clears the stage.
  useEffect(() => {
    if (state.phase === 'playing') setOverlayDive(null);
  }, [state.phase, state.dive]);

  // Your turn: a chime, and the tab title says so.
  const wasMyTurn = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) later(busy ? 900 : 0, () => sfx.turn());
    wasMyTurn.current = myTurn;
    document.title = myTurn ? '🫧 Lượt của bạn! — Deep Sea' : 'Deep Sea Adventure — Phiêu lưu biển sâu';
  }, [myTurn, busy, later]);
  useEffect(() => () => void (document.title = 'Deep Sea Adventure — Phiêu lưu biển sâu'), []);

  /* --------------------------------------------------------- preview */

  const [previewDir, setPreviewDir] = useState<Direction | null>(null);
  const preview = useMemo(() => {
    if (!previewDir || !me || !myTurn) return null;
    const spots = landingSpots(state.path.length, occupiedBy(state.players, me.id), me.position, previewDir);
    const k = me.carrying.length;
    const out = new Set<number>();
    for (let steps = Math.max(0, 2 - k); steps <= Math.max(0, 6 - k); steps++) {
      if (steps === 0 || spots.length === 0) out.add(me.position);
      else out.add(spots[Math.min(steps, spots.length) - 1]);
    }
    return [...out];
  }, [previewDir, me, myTurn, state.path.length, state.players]);

  /* ----------------------------------------------------------- chat */

  const recent = chat.some((m) => m.recvAt && Date.now() - m.recvAt < BUBBLE_MS);
  useTick(1000, recent);
  const bubbles: Record<string, string> = {};
  for (const m of chat) if (m.recvAt && Date.now() - m.recvAt < BUBBLE_MS) bubbles[m.playerId] = m.text;

  const [chatOpen, setChatOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'log'>('chat');
  const [readCount, setReadCount] = useState(chat.length);
  const chatVisible = desktop ? tab === 'chat' : chatOpen;
  useEffect(() => {
    if (chatVisible) setReadCount(chat.length);
  }, [chatVisible, chat.length]);
  const unread = Math.max(0, chat.length - readCount);

  /* --------------------------------------------------------- render */

  const showDiveEnd = state.phase === 'diveEnd' && overlayDive === state.lastDive?.dive;
  const showGameEnd = state.phase === 'gameEnd' && overlayDive === state.lastDive?.dive;

  const actionBar = (
    <ActionBar
      state={state}
      me={me}
      busy={busy}
      onRoll={props.onRoll}
      onAct={props.onAct}
      onPreview={setPreviewDir}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar {...props} unread={unread} desktop={desktop} onOpenChat={() => setChatOpen(true)} />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-3 pb-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-3">
          {!desktop && <Crew state={state} youId={youId} row />}

          <div className="relative">
            <Seascape
              state={state}
              youId={youId}
              lastRoll={lastRoll}
              preview={preview}
              bubbles={bubbles}
              puffs={puffs}
            />
            {desktop && lastRoll && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="paper absolute right-3 top-3 rounded-2xl px-3 py-2"
              >
                <DiceTray roll={lastRoll} players={state.players} />
              </motion.div>
            )}
          </div>

          <div className="sticky bottom-2 z-30 space-y-2">
            {!desktop && lastRoll && (
              <div className="flex justify-center">
                <div className="paper rounded-2xl px-3 py-1.5">
                  <DiceTray roll={lastRoll} players={state.players} compact />
                </div>
              </div>
            )}
            {actionBar}
          </div>
        </section>

        {desktop && (
          <aside className="flex min-h-0 flex-col gap-3 lg:sticky lg:top-3 lg:h-[calc(100dvh-5rem)]">
            <Crew state={state} youId={youId} />
            <div className="paper flex min-h-[260px] flex-1 flex-col rounded-3xl p-3">
              <div className="mb-2 flex gap-1 rounded-xl bg-sand-2 p-1">
                {(['chat', 'log'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`display relative flex-1 rounded-lg py-1 text-sm font-bold transition-colors ${
                      tab === k ? 'bg-sand text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {k === 'chat' ? 'Trò chuyện' : 'Nhật ký'}
                    {k === 'chat' && unread > 0 && tab !== 'chat' && (
                      <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-coral" />
                    )}
                  </button>
                ))}
              </div>
              {tab === 'chat' ? (
                <ChatBox messages={chat} youId={youId} onSend={props.onSendChat} className="flex-1" />
              ) : (
                <Log state={state} />
              )}
            </div>
          </aside>
        )}
      </main>

      {/* phone chat drawer */}
      <AnimatePresence>
        {!desktop && chatOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-abyss/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
            />
            <motion.div
              className="paper fixed inset-x-0 bottom-0 z-50 flex h-[70dvh] flex-col rounded-t-3xl p-4"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-1 rounded-xl bg-sand-2 p-1">
                  {(['chat', 'log'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={`display rounded-lg px-3 py-1 text-sm font-bold ${
                        tab === k ? 'bg-sand text-ink shadow-sm' : 'text-ink-soft'
                      }`}
                    >
                      {k === 'chat' ? 'Trò chuyện' : 'Nhật ký'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-full px-2.5 py-1 text-ink-soft hover:bg-sand-2"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
              {tab === 'chat' ? (
                <ChatBox messages={chat} youId={youId} onSend={props.onSendChat} className="flex-1" autoFocus />
              ) : (
                <Log state={state} />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AirOutBanner show={airOutBanner} />
      <AnimatePresence>
        {showDiveEnd && <DiveEnd key={`dive-${state.dive}`} state={state} isHost={isHost} onNext={props.onNextDive} />}
        {showGameEnd && (
          <GameEnd
            key="end"
            state={state}
            youId={youId}
            isHost={isHost}
            onRestart={props.onRestart}
            onLeave={props.onLeave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ top bar */

function TopBar({
  state,
  muted,
  onToggleMute,
  onShowRules,
  onLeave,
  unread,
  desktop,
  onOpenChat,
}: Props & { unread: number; desktop: boolean; onOpenChat: () => void }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const low = state.air <= 8;
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2.5">
      {desktop && <Logo compact />}

      {/* dive progress */}
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-abyss/50 px-2.5 py-1" title="Lượt lặn">
        {Array.from({ length: state.totalDives }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full border-2 border-foam/60 ${i < state.dive ? 'bg-foam' : ''} ${
              i === state.dive - 1 && state.phase === 'playing' ? 'animate-pulse' : ''
            }`}
          />
        ))}
        <span className="display ml-1 whitespace-nowrap text-xs font-bold text-foam/80">
          <span className="hidden sm:inline">Lặn </span>
          {state.dive}/{state.totalDives}
        </span>
      </div>

      {/* air gauge */}
      <motion.div
        key={state.air}
        initial={{ scale: 1.25 }}
        animate={{ scale: 1, x: low ? [0, -3, 3, -2, 0] : 0 }}
        transition={{ duration: 0.4 }}
        className="display flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-extrabold text-ink"
        style={{ background: airColor(state.air) }}
        title="Không khí còn lại"
      >
        O₂ <span className="tabular-nums">{state.air}</span>
        <span className="text-[10px] font-bold opacity-60">/{state.maxAir}</span>
      </motion.div>

      <span className="display ml-1 hidden text-xs font-bold tracking-[0.2em] text-foam/50 sm:inline">
        BÀN {state.roomCode}
      </span>

      <div className="ml-auto flex items-center gap-1">
        {!desktop && (
          <IconButton label="Trò chuyện" onClick={onOpenChat}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
              <path d="M4 5h16v11H9l-5 4z" />
            </svg>
            {unread > 0 && (
              <span className="display absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-extrabold text-white">
                {unread}
              </span>
            )}
          </IconButton>
        )}
        <IconButton label="Luật chơi" onClick={onShowRules}>
          <span className="display text-base font-extrabold">?</span>
        </IconButton>
        <IconButton label={muted ? 'Bật tiếng' : 'Tắt tiếng'} onClick={onToggleMute}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 10v4h4l5 4V6L8 10z" />
            {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
          </svg>
        </IconButton>
        {confirmLeave ? (
          <span className="flex items-center gap-1">
            <button type="button" onClick={onLeave} className="btn btn-coral !px-2.5 !py-1 text-xs">
              Rời bàn
            </button>
            <button type="button" onClick={() => setConfirmLeave(false)} className="btn btn-ghost !px-2.5 !py-1 text-xs">
              Ở lại
            </button>
          </span>
        ) : (
          <IconButton label="Rời bàn" onClick={() => setConfirmLeave(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
            </svg>
          </IconButton>
        )}
      </div>
    </header>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-foam/80 transition-colors hover:bg-foam/10 hover:text-foam"
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- log */

const LOG_DOT: Record<string, string> = {
  system: 'bg-ink-soft/40',
  dive: 'bg-sea',
  move: 'bg-[#7ebfdc]',
  treasure: 'bg-gold',
  danger: 'bg-danger',
};

function Log({ state }: { state: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);
  return (
    <div ref={ref} className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-xs">
      {state.log.map((l) => (
        <motion.div
          key={l.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex items-start gap-2 ${l.kind === 'dive' ? 'display pt-1 font-extrabold text-ink' : 'text-ink-soft'}`}
        >
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${LOG_DOT[l.kind]}`} />
          <span>{l.text}</span>
        </motion.div>
      ))}
    </div>
  );
}
