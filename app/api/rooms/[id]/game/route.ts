import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";
import { triggerRoomEvent } from "@/lib/pusher";
import { GameState, DrinkDebt } from "@/lib/types";

function generateChoices(target: number): number[] {
  const pool = new Set<number>([target]);
  while (pool.size < 9) pool.add(Math.floor(Math.random() * 90) + 10);
  const arr = Array.from(pool);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDebt(from: string, to: string, gameId: string): DrinkDebt {
  return { id: crypto.randomUUID(), from, to, gameId, createdAt: Date.now(), settled: false };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = await request.json();
  const { action, nickname } = body as { action: string; nickname: string };

  if (!nickname || !room.members[nickname]) {
    return NextResponse.json({ error: "Not a member" }, { status: 400 });
  }

  // ── challenge ──────────────────────────────────────────────────────────
  if (action === "challenge") {
    const { challenged, gameType } = body as { challenged: string; gameType?: string };
    if (!challenged || !room.members[challenged]) {
      return NextResponse.json({ error: "Player not found" }, { status: 400 });
    }
    if (nickname === challenged) {
      return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 });
    }
    const g = room.activeGame;
    if (g && (g.status === "pending" || g.status === "active")) {
      return NextResponse.json({ error: "GAME IN PROGRESS" }, { status: 409 });
    }

    const type = gameType === "shootout" ? "shootout" : "number-finder";
    const target = Math.floor(Math.random() * 90) + 10;
    const game: GameState = {
      id: crypto.randomUUID(),
      type,
      status: "pending",
      challenger: nickname,
      challenged,
      target,
      choices: type === "number-finder" ? generateChoices(target) : [],
      startedAt: null,
      winner: null,
      finishedAt: null,
    };
    room.activeGame = game;
    await setRoom(roomId, room);
    await triggerRoomEvent(roomId, "game-update", { activeGame: game });
    return NextResponse.json({ game });
  }

  // ── accept ─────────────────────────────────────────────────────────────
  if (action === "accept") {
    const g = room.activeGame;
    if (!g || g.status !== "pending" || g.challenged !== nickname) {
      return NextResponse.json({ error: "No pending challenge for you" }, { status: 400 });
    }
    g.status = "active";
    if (g.type === "shootout") {
      // Random green light: 4–6 seconds after accept
      g.startedAt = Date.now() + 4000 + Math.floor(Math.random() * 2001);
    } else {
      g.startedAt = Date.now() + 5000;
    }
    await setRoom(roomId, room);
    await triggerRoomEvent(roomId, "game-update", { activeGame: g });
    return NextResponse.json({ game: g });
  }

  // ── decline ────────────────────────────────────────────────────────────
  if (action === "decline") {
    const g = room.activeGame;
    if (!g || g.status !== "pending" || g.challenged !== nickname) {
      return NextResponse.json({ error: "No pending challenge for you" }, { status: 400 });
    }
    room.activeGame = null;
    await setRoom(roomId, room);
    await triggerRoomEvent(roomId, "game-update", { activeGame: null });
    return NextResponse.json({ declined: true });
  }

  // ── answer (number-finder) ─────────────────────────────────────────────
  if (action === "answer") {
    const { answer } = body as { answer: number };
    const g = room.activeGame;
    if (!g || g.status !== "active" || g.type !== "number-finder") {
      return NextResponse.json({ error: "No active number-finder game" }, { status: 400 });
    }
    if (!g.startedAt || Date.now() < g.startedAt) {
      return NextResponse.json({ error: "Too early" }, { status: 400 });
    }
    if (g.winner) {
      return NextResponse.json({ error: "Already won", winner: g.winner }, { status: 400 });
    }
    if (nickname !== g.challenger && nickname !== g.challenged) {
      return NextResponse.json({ error: "Not a participant" }, { status: 400 });
    }
    if (answer !== g.target) {
      return NextResponse.json({ correct: false });
    }

    g.winner = nickname;
    g.finishedAt = Date.now();
    g.status = "finished";
    const loser = nickname === g.challenger ? g.challenged : g.challenger;
    room.debts = [...(room.debts ?? []), createDebt(loser, nickname, g.id)];
    await setRoom(roomId, room);
    await triggerRoomEvent(roomId, "game-update", { activeGame: g });
    return NextResponse.json({ correct: true, game: g });
  }

  // ── shoot (shootout) ───────────────────────────────────────────────────
  if (action === "shoot") {
    const g = room.activeGame;
    if (!g || g.status !== "active" || g.type !== "shootout") {
      return NextResponse.json({ error: "No active shootout" }, { status: 400 });
    }
    if (!g.startedAt || Date.now() < g.startedAt) {
      return NextResponse.json({ error: "Too early" }, { status: 400 });
    }
    if (g.winner) {
      return NextResponse.json({ error: "Already won", winner: g.winner }, { status: 400 });
    }
    if (nickname !== g.challenger && nickname !== g.challenged) {
      return NextResponse.json({ error: "Not a participant" }, { status: 400 });
    }

    g.winner = nickname;
    g.finishedAt = Date.now();
    g.status = "finished";
    const loser = nickname === g.challenger ? g.challenged : g.challenger;
    room.debts = [...(room.debts ?? []), createDebt(loser, nickname, g.id)];
    await setRoom(roomId, room);
    await triggerRoomEvent(roomId, "game-update", { activeGame: g });
    return NextResponse.json({ won: true, game: g });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
