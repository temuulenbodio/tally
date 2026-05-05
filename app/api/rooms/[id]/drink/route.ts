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

  if (!nickname || !room.members[nickname]) {
    return NextResponse.json(
      { error: "Not a member of this room" },
      { status: 400 }
    );
  }

  room.members[nickname].drinks += 1;
  await setRoom(roomId, room);

  return NextResponse.json({
    success: true,
    drinks: room.members[nickname].drinks,
  });
}
