# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A realtime online version of Oink Games' **Deep Sea Adventure** (2–6 players), with a Vietnamese UI. The architecture (auth, deploy, socket layout) mirrors the sibling project `../scout`. `Deep-Sea-Adventure-Rules.pdf` is the source of truth for game rules; `pdftotext -layout Deep-Sea-Adventure-Rules.pdf -` extracts it. `images/` holds the original reference PNGs. The game does **not** use them — every piece is redrawn as SVG in `client/src/components/art/`.

## Commands

```bash
npm install && npm run install:all   # root + server + client deps
npm run dev                          # server :4100 + client :5180 (ports differ from scout's so both can run)
npm test                             # server/test/sim.ts: rules checks + 600 bot-vs-bot games with invariants
npm run typecheck                    # tsc for server and client
npm run build                        # tsup server → server/dist, vite client → client/dist
```

There is no test framework. `server/test/sim.ts` is a plain script using `ok`/`eq` helpers, run by `tsx`. To test one rule, add a `{ ... }` block there. The `dice(...faces)` rng helper forces exact die faces. Tests poke engine state directly: set `diver.position` and `carrying`, and blank the path tiles. When doing that, remember `roll()` may leave the turn in the `act` step, e.g. landing on a blank tile while carrying makes a drop legal.

Without mail config, the dev server prints login codes to its console, and the client shows the code under the input. `HOST_EMAILS` empty means anyone can create a table.

## Architecture

- **`shared/engine.ts`** holds the pure rules on a plain `Game` object, with the rng injected and no I/O.
  - `newGame` → `roll(turnBack)` → `act(pickup|drop|skip)` → (internal `endTurn`/`endDive`) → `nextDive`.
  - Breathing happens automatically in `beginTurn` when a turn starts.
  - `roll` auto-ends the turn when no pick-up or drop is possible.
  - A diver is "returned" when `position === -1 && direction === 'up'`; there is no separate flag.
  - A carried or path "stack" is a `Chip[]` and counts as one chip for air and movement.
  - Every state change pushes to `game.events` (capped at 24, with monotonically increasing ids). These are animation hints for the client.
- **`shared/timing.ts`**: `ANIM` durations. The server's `room.busyUntil` uses them so bots wait until the client has finished animating the previous move. Change both sides together.
- **`server/src/room.ts`**: `Room` wraps membership, colours, the log and chat around a `Game`. `publicState()` is the only thing sent to clients. Carried and path chip **values are stripped** (`hidden()`) and only banked chips are revealed. There is no per-player private state, because nobody may see carried values, not even the carrier.
- **`server/src/index.ts`**: Socket.IO handlers plus `scheduleAuto`, one timer per room. It drives:
  - bots and seats abandoned for 15s or more;
  - connected humans who pass `turnDeadline` (60s);
  - the dive-end auto-advance (`autoAdvanceAt`, 20s).
  After every mutating handler, call `broadcast(room)` and then `scheduleAuto(room)`.
- **`server/src/auth.ts`** and **`api/send-code.js`** are copied from scout: email-code login with HMAC-signed stateless challenges and tokens, `HOST_EMAILS` gating `room:create`, and mail sent via a Vercel relay, Brevo, Resend or SMTP.
- **`server/src/bot.ts`** is a heuristic. `margin()` compares rounds of air left (given everyone's load) against rounds needed to get home. Tune it against `npm test`'s "bots got home N%" line. The test asserts the rate stays under 95%.

### Client

- **`GameScreen.tsx`** turns new `state.events` (ids above `seen`) into:
  - the dice tray and diver hop animation (`lastRoll`);
  - air puffs, sounds, and the air-out banner;
  - a delayed dive-end overlay (`overlayDive`).
  On first mount, or when event ids restart for a new game, it skips history instead of replaying it.
- **`Seascape.tsx`** puts the submarine, rope, tiles and divers in one absolute coordinate space computed by `useLayout(width, pathLength)`, so divers can animate between dock and tiles. Hops use framer keyframes built from `roll.from` + `roll.hops`. They are applied only while the last hop still equals the diver's position.
- **Chip flying uses framer `layoutId={`stack-${firstChipId}`}`**, shared between `Seascape` tiles and `Crew` carried chips. Only one `Crew` may be mounted at a time. That's why `GameScreen` picks the row or sidebar layout with `useMediaQuery` rather than CSS hiding.
- Styling is Tailwind v4 with tokens in `client/src/index.css` `@theme`: `paper` (sand panels, ink text), `tide`, and `btn-*`. The design brief is a matte picture-book look: **no neon or glow effects**.
- `@shared/*` is a Vite and tsconfig alias to `../shared`. The server imports shared code by relative path.

## Deploy

The client goes to Vercel (`vercel.json`, env `VITE_SERVER_URL`). The server goes to Render (`render.yaml` blueprint, `/health`). Room state is in memory, so a server restart (including `tsx watch` reloads in dev) drops all tables. Sessions survive because tokens are signed with `SESSION_SECRET`. See README.md for the env var table.
