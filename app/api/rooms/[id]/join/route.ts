import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();
  const room = await getRoom(roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const body = await request.json();
  const nickname = (body.nickname ?? "").trim();

  if (!nickname || nickname.length > 20) {
    return NextResponse.json({ error: "Invalid nickname" }, { status: 400 });
  }

  if (!room.members[nickname]) {
    room.members[nickname] = {
      nickname,
      drinks: 0,
      totalSpent: 0,
      joinedAt: Date.now(),
    };
    await setRoom(roomId, room);
  }

  return NextResponse.json({ success: true, nickname });
}
