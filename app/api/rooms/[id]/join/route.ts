import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const roomId = params.id.toUpperCase();
  const room = await getRoom(roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const body = await request.json();
  const nickname = (body.nickname ?? "").trim();

  if (!nickname || nickname.length > 20) {
    return NextResponse.json({ error: "Invalid nickname" }, { status: 400 });
  }

  // Re-joining the same room is fine (idempotent)
  if (!room.members[nickname]) {
    room.members[nickname] = {
      nickname,
      drinks: 0,
      joinedAt: Date.now(),
    };
    await setRoom(roomId, room);
  }

  return NextResponse.json({ success: true, nickname });
}
