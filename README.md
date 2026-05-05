# TALLY 🍺

> An 8-bit arcade themed drink tracker. Create a room, invite friends, and see who drank the most on the leaderboard.

![TALLY Home](https://github.com/user-attachments/assets/bfcb8acc-bf50-415e-ad6b-a83f8521d6f4)

## Features

- **Create a room** – get a 6-character share code
- **Join with a nickname** – no sign-up needed
- **Live leaderboard** – auto-refreshes every 3 seconds
- **One-tap drink button** – thumb-friendly, mobile-first
- **8-bit arcade theme** – Press Start 2P font, pixel borders, CRT scanlines

## Screenshots

| Home | Room |
|------|------|
| ![Home](https://github.com/user-attachments/assets/bfcb8acc-bf50-415e-ad6b-a83f8521d6f4) | ![Room](https://github.com/user-attachments/assets/7ab44c91-4617-4a79-b464-4c4d151a4dc2) |

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS** (custom 8-bit theme)
- **Press Start 2P** font via `@fontsource`
- **Upstash Redis** (optional – in-memory fallback for development)

---

## Getting Started

### Local development (no setup required)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Rooms are stored in memory while the process runs.

### Production on Vercel

Rooms need a persistent store across serverless function invocations.
The app uses **Upstash Redis** when the environment variables are set.

1. Deploy to Vercel: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/temuulenbodio/tally)

2. In the Vercel dashboard → **Storage** → **Create Database** → choose **Upstash Redis**.

3. Vercel will automatically add the required env vars:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

4. Redeploy – rooms now persist for 24 hours.

> **Tip:** You can also use Upstash locally by copying the env vars to a `.env.local` file.

---

## Project Structure

```
app/
  page.tsx               # Home – create / join room
  room/[id]/page.tsx     # Room – leaderboard + drink button
  api/rooms/
    route.ts             # POST  /api/rooms        (create room)
    [id]/route.ts        # GET   /api/rooms/[id]   (get room)
    [id]/join/route.ts   # POST  /api/rooms/[id]/join
    [id]/drink/route.ts  # POST  /api/rooms/[id]/drink
lib/
  store.ts               # Storage abstraction (in-memory ↔ Upstash Redis)
  types.ts               # TypeScript interfaces
  utils.ts               # Room ID generator
```

## How It Works

1. **Creator** opens the site, clicks **CREATE ROOM**, names the room → gets a 6-char code like `AB3XZ9`.
2. **Friends** visit the site, click **JOIN ROOM**, enter the code + their nickname.
3. Everyone lands on the same room page. The leaderboard polls every 3 s.
4. Tap **+1 DRINK** to add a drink. Your count updates immediately (optimistic UI) and syncs to the server.
