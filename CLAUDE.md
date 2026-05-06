# Tally — Agent Context

8-bit arcade drink-tracking web app. Players join rooms, log drinks, play mini-games, and settle up at the end of the night.

**Stack:** Next.js 15 App Router · TypeScript · Tailwind CSS · Upstash Redis (in-memory fallback) · Docker

---

## Running the app

```bash
# Dev (live-reload, no build needed)
docker compose up dev

# Production build + run
docker compose build prod && docker compose up prod -d

# Logs
docker compose logs prod --tail=40
```

The app runs on **port 3000**. No `npm` / `node` on the host — everything runs inside Docker.

`.env.local` is optional. Without it the app falls back to an in-memory store (data is lost on container restart). For persistence, set:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Project structure

```
app/
  page.tsx                  Home page — CREATE / JOIN room flow (2-step)
  globals.css               All custom CSS: pixel-card, pixel-btn, drink-type-btn, game-num-btn, CSS vars
  layout.tsx                Root layout — loads Press Start 2P font from Google Fonts
  room/[id]/page.tsx        Main room page — ALL client-side logic lives here (tabs, games, polling)
  api/rooms/
    route.ts                POST  /api/rooms        — create room
    [id]/route.ts           GET   /api/rooms/:id    — fetch room state
    [id]/join/route.ts      POST  /api/rooms/:id/join
    [id]/drink/route.ts     POST  /api/rooms/:id/drink
    [id]/game/route.ts      POST  /api/rooms/:id/game   — all game actions
    [id]/debts/route.ts     POST  /api/rooms/:id/debts  — settle a debt
    [id]/end/route.ts       POST  /api/rooms/:id/end    — close out the night
lib/
  types.ts                  All shared TypeScript interfaces (Room, RoomMember, GameState, DrinkDebt, DrinkType)
  store.ts                  getRoom / setRoom — Redis if env vars present, else globalThis Map
  utils.ts                  generateRoomId (6-char, no confusing chars)
```

---

## Data model (`lib/types.ts`)

```typescript
interface DrinkType  { name: string; price: number; emoji?: string }
interface RoomMember { nickname: string; drinks: number; totalSpent: number; joinedAt: number }

interface GameState {
  id: string;
  type: "number-finder" | "shootout";
  status: "pending" | "active" | "finished";
  challenger: string; challenged: string;
  target: number; choices: number[];   // number-finder only; choices=[] for shootout
  startedAt: number | null;            // epoch ms when grid/green-light reveals
  winner: string | null; finishedAt: number | null;
}

interface DrinkDebt {
  id: string; from: string; to: string;
  gameId: string; createdAt: number; settled: boolean;
}

interface Room {
  id: string; name: string; createdAt: number;
  drinkTypes: DrinkType[];
  members: { [nickname: string]: RoomMember };   // keyed by nickname
  activeGame: GameState | null;
  debts: DrinkDebt[];
  endedAt: number | null;
}
```

Room members are stored as a map (`members[nickname]`). The GET route returns them sorted by `drinks` desc as an array.

---

## API routes

### `POST /api/rooms`
Body: `{ name, drinkTypes: [{name, price, emoji}] }` — max 8 drink types.
Returns: `{ id, name }`

### `GET /api/rooms/:id`
Returns full room state. `debts` only contains **unsettled** debts. Room ID is always uppercased.

### `POST /api/rooms/:id/join`
Body: `{ nickname }` — idempotent, re-joining returns existing member.

### `POST /api/rooms/:id/drink`
Body: `{ nickname, drinkName }` — blocked with 403 if `room.endedAt` is set.

### `POST /api/rooms/:id/game`
All game actions share this route, distinguished by `action`:

| action | who calls | body extras | effect |
|--------|-----------|-------------|--------|
| `challenge` | challenger | `challenged`, `gameType` (`"number-finder"` \| `"shootout"`) | creates pending GameState |
| `accept` | challenged | — | sets status=active, sets `startedAt`; number-finder: +5000ms; shootout: +4000–6000ms random |
| `decline` | challenged | — | clears `activeGame` |
| `answer` | either player | `answer: number` | number-finder only; correct → winner set, debt created |
| `shoot` | either player | — | shootout only; first valid POST after `startedAt` wins |

Server rejects `answer`/`shoot` if `Date.now() < startedAt`.

### `POST /api/rooms/:id/debts`
Body: `{ debtId, nickname, drinkName }` — marks debt settled **and adds the chosen drink to the winner's record** (drinks+1, totalSpent+price).

### `POST /api/rooms/:id/end`
Body: `{ nickname }` — sets `room.endedAt`. Any member can end the room.

---

## Room page (`app/room/[id]/page.tsx`)

Single client component. Key patterns:

**Polling:** `useCallback` + `useRef` interval. Default 3 s, drops to 500 ms when on the GAMES tab with an active game. Requires 3 consecutive 404s before showing "Room Not Found" (prevents transient kicks).

**Tabs:** `drinks | games | debts | total` stored in `activeTab` state.

**Game flow state:**
- `gamesScreen`: `"lobby" | "challenge" | "duel"` — sub-screen within the GAMES tab
- `selectedGame`: which game type was chosen in the lobby
- `tappedAnswer`: locks the number grid after first tap (number-finder)
- `shootoutIsGreen`: local boolean, set by a `setTimeout` keyed to `game.startedAt`; triggers green SHOOT screen
- `shotFired`: prevents double-POSTing shoot action
- `countdown`: local ticker (100 ms interval) showing 5→1→GO for number-finder
- `settlingDebt`: which debt ID is currently showing the inline drink picker

**Challenge banner:** Fixed top overlay (`z-50`) rendered on ANY tab when `game.challenged === nickname && game.status === "pending"`. Accepting auto-navigates to GAMES tab.

**Bill split:** `calcBillSplit(members)` — pure client function, greedy creditor/debtor matching for minimum transactions. Shows in TOTAL tab and bill-split modal.

**Status bar:** 6 levels (SOBER → WASTED) with per-level colour. Water reminder toast + slow-down modal triggered by drink events.

**Emoji rendering:** Press Start 2P has no emoji glyphs. Every element that renders emoji needs `style={{ fontFamily: "initial" }}`.

---

## CSS conventions (`app/globals.css` + Tailwind)

CSS variables defined in `:root`:
`--pixel-bg` `--pixel-panel` `--pixel-card` `--pixel-green` `--pixel-yellow` `--pixel-pink` `--pixel-blue` `--pixel-orange` `--pixel-purple`

Key utility classes:
- `.pixel-card` / `.pixel-card-yellow` / `.pixel-card-pink` — bordered cards with drop shadow
- `.pixel-btn` + colour modifiers (`-yellow`, `-pink`, `-blue`) — 3D press-down button
- `.drink-type-btn` + colour modifiers — grid drink buttons with emoji + name + price
- `.game-num-btn` / `.game-num-btn-correct` / `.game-num-btn-wrong` — 3×3 number grid buttons
- `.blink` — 1 s step-end opacity blink
- Tailwind classes use `font-pixel` (custom alias for Press Start 2P, set in `tailwind.config.ts`)

---

## Mini-games

### Number Finder
- 3×3 grid of shuffled numbers (10–99); one is the target
- Both players see the same grid simultaneously (grid revealed at `startedAt`)
- First to POST the correct `answer` wins
- Wrong answer: returns `{ correct: false }`, no state change — player can keep trying

### Wild West Shootout
- After accept, a red "HOLD!" screen shows immediately
- After 4–6 random seconds `startedAt` is reached → client flips `shootoutIsGreen` via `setTimeout`
- Both players' screens turn bright green — first to POST `action:"shoot"` wins
- Spectators see the red→green colour transition too
- Server rejects shoot before `startedAt` with 400 "Too early"

---

## Docker

Multi-stage build: `deps` → `builder` (`next build` with `output: "standalone"`) → `runner`.
`RUN mkdir -p public` before build because the `public/` directory may not exist.
`env_file` uses `required: false` so the compose file works without `.env.local`.
Redis key: `room:{ID}` with 24-hour TTL (`setex 86400`).

---

## Common gotchas

- **Room ID is always uppercased** — all routes call `.toUpperCase()` on the param.
- **`members` is a map, not array** — use `Object.values(room.members)` to iterate; `room.members[nickname]` to access one.
- **`startedAt` is a future timestamp** — clients must check `Date.now() >= game.startedAt` before showing content, not just check `status === "active"`.
- **Finished game blocks lobby** — the lobby renders when `gamesScreen === "lobby" && (!game || game.status === "finished")`. Do not change this back to `!game` only or the PLAY AGAIN button will stop working.
- **Emoji needs `fontFamily: "initial"`** — without this, Press Start 2P renders emoji as blank boxes.
- **ESLint bans unescaped `"` `'` in JSX** — use `&quot;` / `&apos;` in string literals inside JSX text nodes.
