import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { nickname } = await request.json();
  if (!nickname || !room.members[nickname]) {
    return NextResponse.json({ error: "Not a member" }, { status: 400 });
  }

  room.endedAt = Date.now();
  await setRoom(roomId, room);
  return NextResponse.json({ success: true, endedAt: room.endedAt });
}
