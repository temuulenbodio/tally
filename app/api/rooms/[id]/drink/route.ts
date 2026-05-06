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

  if (room.endedAt) {
    return NextResponse.json({ error: "ROOM IS CLOSED" }, { status: 403 });
  }

  const body = await request.json();
  const nickname = (body.nickname ?? "").trim();
  const drinkName = (body.drinkName ?? "").trim();

  if (!nickname || !room.members[nickname]) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 400 });
  }

  const drinkType = room.drinkTypes?.find((d) => d.name === drinkName);
  const price = drinkType?.price ?? 0;

  room.members[nickname].drinks += 1;
  room.members[nickname].totalSpent =
    Math.round(((room.members[nickname].totalSpent ?? 0) + price) * 100) / 100;

  await setRoom(roomId, room);

  return NextResponse.json({
    success: true,
    drinks: room.members[nickname].drinks,
    totalSpent: room.members[nickname].totalSpent,
  });
}
