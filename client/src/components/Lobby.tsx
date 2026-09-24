/** Waiting on the dock: the table code to share, the crew, and the start button. */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameState } from '@shared/types';
import { MAX_PLAYERS, MIN_PLAYERS } from '@shared/engine';
import { Diver } from './art/Diver';
import { DiverPicker } from './Home';
import { Logo } from './Logo';
import { sfx } from '../lib/sound';
import { diverColor } from '../lib/theme';
import { ChatBox, type ChatItem } from './Chat';

interface Props {
  state: GameState;
  youId: string;
  onStart: () => void;
  onAddBot: () => void;
  onKick: (id: string) => void;
  onColor: (color: number) => void;
  onLeave: () => void;
  onShowRules: () => void;
  chat: ChatItem[];
  onSendChat: (text: string) => void;
}

export function Lobby({ state, youId, onStart, onAddBot, onKick, onColor, onLeave, onShowRules, chat, onSendChat }: Props) {
  const [copied, setCopied] = useState(false);
  const isHost = state.hostId === youId;
  const me = state.players.find((p) => p.id === youId);
  const canStart = state.players.length >= MIN_PLAYERS;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode);
      setCopied(true);
      sfx.pickup();
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked — the code is on screen anyway */
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-5 px-4 py-8 lg:max-w-4xl">
      <Logo compact />

      <div className="grid w-full gap-5 lg:grid-cols-2">
        <div className="flex w-full flex-col items-center gap-4">
          <motion.button
            type="button"
            onClick={copy}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="paper w-full rounded-3xl px-5 py-4 text-center transition-transform hover:-translate-y-0.5"
          >
            <div className="label">Mã bàn — chạm để chép, gửi cho bạn bè</div>
            <div className="display mt-1 text-5xl font-extrabold tracking-[0.3em] text-sea">{state.roomCode}</div>
            <div className="mt-1 h-4 text-xs font-semibold text-kelp">{copied ? 'Đã chép!' : ''}</div>
          </motion.button>

          <div className="paper w-full rounded-3xl p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="display text-lg font-extrabold text-ink">
                Thợ lặn ({state.players.length}/{MAX_PLAYERS})
              </h2>
              <span className="text-[11px] text-ink-soft">3 lượt lặn · 25 ô không khí</span>
            </div>

            {/* the crew standing on the dock */}
            <div className="mt-3 flex min-h-[74px] items-end justify-center gap-2 rounded-2xl bg-sea/90 px-3 pt-3 pb-2">
              <AnimatePresence>
                {state.players.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.04 }}
                  >
                    <div className="bob" style={{ animationDelay: `${-i * 0.5}s` }}>
                      <Diver color={p.color} size={34} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <ul className="mt-3 space-y-1.5">
              <AnimatePresence initial={false}>
                {state.players.map((p) => (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className="flex items-center gap-2.5 rounded-xl bg-white/60 px-3 py-1.5"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-ink/20" style={{ background: diverColor(p.color).body }} />
                    <span className="display flex-1 truncate font-bold text-ink">
                      {p.name}
                      {p.id === youId && <span className="ml-1.5 text-xs font-medium text-ink-soft">(bạn)</span>}
                    </span>
                    {state.hostId === p.id && (
                      <span className="rounded-md bg-gold/25 px-1.5 py-0.5 text-[10px] font-bold text-[#8a5f12]">CHỦ BÀN</span>
                    )}
                    {p.isBot && (
                      <span className="rounded-md bg-kelp/20 px-1.5 py-0.5 text-[10px] font-bold text-kelp">BOT</span>
                    )}
                    {isHost && p.id !== youId && (
                      <button
                        type="button"
                        onClick={() => onKick(p.id)}
                        className="rounded-lg px-2 py-0.5 text-xs text-danger hover:bg-danger/10"
                        aria-label={`Mời ${p.name} xuống tàu`}
                      >
                        ✕
                      </button>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {isHost && state.players.length < MAX_PLAYERS && (
              <button type="button" onClick={onAddBot} className="btn btn-sand mt-3 w-full text-sm">
                + Thêm bot
              </button>
            )}

            {me && (
              <>
                <div className="rule my-3" />
                <span className="label">Bộ đồ lặn của bạn</span>
                <div className="mt-1">
                  <DiverPicker
                    value={me.color}
                    onChange={onColor}
                    taken={state.players.filter((p) => p.id !== youId).map((p) => p.color)}
                  />
                </div>
              </>
            )}
          </div>

          {isHost ? (
            <button
              type="button"
              disabled={!canStart}
              onClick={() => {
                sfx.diveEnd();
                onStart();
              }}
              className="btn btn-coral w-full text-lg"
            >
              {canStart ? 'Xuống nước thôi!' : `Cần ít nhất ${MIN_PLAYERS} thợ lặn`}
            </button>
          ) : (
            <div className="display animate-pulse text-sm text-foam/70">Đang chờ chủ bàn bắt đầu…</div>
          )}
        </div>

        <div className="paper flex h-80 w-full flex-col rounded-3xl p-4 lg:h-auto">
          <h2 className="display text-lg font-extrabold text-ink">Trò chuyện</h2>
          <ChatBox messages={chat} youId={youId} onSend={onSendChat} className="mt-2 flex-1" />
        </div>
      </div>

      <div className="flex gap-4 text-xs">
        <button type="button" onClick={onShowRules} className="text-foam/70 underline-offset-4 hover:text-foam hover:underline">
          Luật chơi
        </button>
        <button type="button" onClick={onLeave} className="text-foam/55 underline-offset-4 hover:underline">
          Rời bàn
        </button>
      </div>
    </div>
  );
}
