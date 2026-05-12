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
  if (room.endedAt) return NextResponse.json({ error: "Room is closed" }, { status: 403 });

  const body = await request.json();
  const name  = (body.name  ?? "").trim().toUpperCase();
  const price = parseFloat(body.price ?? 0);
  const emoji = (body.emoji ?? "🍺").trim();

  if (!name) return NextResponse.json({ error: "Enter a drink name" }, { status: 400 });
  if (isNaN(price) || price < 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  if ((room.drinkTypes ?? []).length >= 8) return NextResponse.json({ error: "Max 8 drink types" }, { status: 400 });
  if ((room.drinkTypes ?? []).some(d => d.name === name)) {
    return NextResponse.json({ error: "Drink already exists" }, { status: 409 });
  }

  room.drinkTypes = [...(room.drinkTypes ?? []), { name, price: Math.round(price * 100) / 100, emoji }];
  await setRoom(roomId, room);

  return NextResponse.json({ success: true, drinkTypes: room.drinkTypes });
}
