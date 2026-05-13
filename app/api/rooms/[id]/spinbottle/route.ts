import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";
import { SpinBottleGame } from "@/lib/types";
import { randomUUID } from "crypto";

const DEFAULT_QUESTIONS = [
  "What's your most embarrassing moment?",
  "What's the wildest thing you've done at a party?",
  "What's a secret you've never told anyone in this room?",
  "Who here would you call at 3am in an emergency?",
  "Have you ever lied to get out of plans? What was the excuse?",
  "What's the most childish thing you still secretly enjoy?",
  "Have you ever ghosted someone? Tell the story.",
  "What's the biggest misconception people have about you?",
  "What's one thing you've done that you'd never admit sober?",
  "What's your worst dating experience?",
  "What's the most spontaneous decision you've ever made?",
  "What's something you pretend to like but actually hate?",
  "What's the most trouble you've ever gotten into?",
  "Who was your first crush and how did it end?",
  "What's a lie you told that totally backfired?",
  "What's the most embarrassing song on your playlist?",
  "Have you ever cheated at a game tonight or ever?",
  "What's the wildest dare you've actually done?",
  "If you had to pick someone in this room to survive a zombie apocalypse with, who and why?",
  "What's the one thing you'd change about last night?",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.endedAt) return NextResponse.json({ error: "Room is closed" }, { status: 403 });

  const body = await request.json();
  const { action, nickname } = body;

  switch (action) {
    case "create": {
      if (room.spinBottleGame && room.spinBottleGame.status !== "finished") {
        return NextResponse.json({ error: "Game already active" }, { status: 400 });
      }
      room.spinBottleGame = {
        id: randomUUID(),
        status: "collecting",
        createdBy: nickname,
        mode: body.mode ?? "default",
        playerQuestions: {},
        readyPlayers: [],
        currentTarget: null,
        currentQuestion: null,
        usedQuestions: [],
        history: [],
      } satisfies SpinBottleGame;
      break;
    }

    case "submit_question": {
      const g = room.spinBottleGame;
      if (!g || g.status !== "collecting") {
        return NextResponse.json({ error: "Not in collecting phase" }, { status: 400 });
      }
      g.playerQuestions[nickname] = (body.question ?? "").trim();
      break;
    }

    case "ready": {
      const g = room.spinBottleGame;
      if (!g || g.status !== "collecting") {
        return NextResponse.json({ error: "Not in collecting phase" }, { status: 400 });
      }
      if (!g.readyPlayers.includes(nickname)) g.readyPlayers.push(nickname);
      const allPlayers = Object.keys(room.members);
      if (allPlayers.every(p => g.readyPlayers.includes(p))) g.status = "active";
      break;
    }

    case "force_start": {
      const g = room.spinBottleGame;
      if (!g || g.status !== "collecting") {
        return NextResponse.json({ error: "Not in collecting phase" }, { status: 400 });
      }
      if (nickname !== g.createdBy) {
        return NextResponse.json({ error: "Only host can force start" }, { status: 403 });
      }
      g.status = "active";
      break;
    }

    case "spin": {
      const g = room.spinBottleGame;
      if (!g || g.status !== "active") {
        return NextResponse.json({ error: "Game not active" }, { status: 400 });
      }
      if (nickname !== g.createdBy) {
        return NextResponse.json({ error: "Only host can spin" }, { status: 403 });
      }
      const players = Object.keys(room.members);
      const target = players[Math.floor(Math.random() * players.length)];

      const pool = g.mode === "custom" && Object.keys(g.playerQuestions).length > 0
        ? Object.values(g.playerQuestions).filter(q => q.length > 0)
        : DEFAULT_QUESTIONS;
      const available = pool.filter(q => !g.usedQuestions.includes(q));
      const finalPool = available.length > 0 ? available : pool;
      const question = finalPool[Math.floor(Math.random() * finalPool.length)];
      if (available.length > 0) g.usedQuestions.push(question);
      else g.usedQuestions = [question]; // reset cycle

      g.currentTarget = target;
      g.currentQuestion = question;
      g.history.push({ target, question });
      break;
    }

    case "end": {
      const g = room.spinBottleGame;
      if (!g) return NextResponse.json({ error: "No game" }, { status: 400 });
      if (nickname !== g.createdBy) {
        return NextResponse.json({ error: "Only host can end" }, { status: 403 });
      }
      g.status = "finished";
      g.currentTarget = null;
      g.currentQuestion = null;
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await setRoom(roomId, room);
  return NextResponse.json({ success: true, spinBottleGame: room.spinBottleGame });
}
