import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";
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
    const { challenged } = body as { challenged: string };
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

    const target = Math.floor(Math.random() * 90) + 10;
    const game: GameState = {
      id: crypto.randomUUID(),
      type: "number-finder",
      status: "pending",
      challenger: nickname,
      challenged,
      target,
      choices: generateChoices(target),
      startedAt: null,
      winner: null,
      finishedAt: null,
    };
    room.activeGame = game;
    await setRoom(roomId, room);
    return NextResponse.json({ game });
  }

  // ── accept ─────────────────────────────────────────────────────────────
  if (action === "accept") {
    const g = room.activeGame;
    if (!g || g.status !== "pending" || g.challenged !== nickname) {
      return NextResponse.json({ error: "No pending challenge for you" }, { status: 400 });
    }
    g.status = "active";
    g.startedAt = Date.now() + 3500;
    await setRoom(roomId, room);
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
    return NextResponse.json({ declined: true });
  }

  // ── answer ─────────────────────────────────────────────────────────────
  if (action === "answer") {
    const { answer } = body as { answer: number };
    const g = room.activeGame;
    if (!g || g.status !== "active") {
      return NextResponse.json({ error: "No active game" }, { status: 400 });
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

    // Correct answer — this player wins
    g.winner = nickname;
    g.finishedAt = Date.now();
    g.status = "finished";

    const loser = nickname === g.challenger ? g.challenged : g.challenger;
    const debt: DrinkDebt = {
      id: crypto.randomUUID(),
      from: loser,
      to: nickname,
      gameId: g.id,
      createdAt: Date.now(),
      settled: false,
    };
    room.debts = [...(room.debts ?? []), debt];
    await setRoom(roomId, room);
    return NextResponse.json({ correct: true, game: g });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
