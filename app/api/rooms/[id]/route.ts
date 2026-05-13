import { NextResponse } from "next/server";
import { getRoom } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = await getRoom(id.toUpperCase());
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const members = Object.values(room.members).sort((a, b) => b.drinks - a.drinks);

  return NextResponse.json({
    id: room.id,
    name: room.name,
    drinkTypes: room.drinkTypes ?? [],
    members,
    activeGame: room.activeGame ?? null,
    debts: (room.debts ?? []).filter((d) => !d.settled),
    endedAt: room.endedAt ?? null,
    spinBottleGame: room.spinBottleGame ?? null,
  });
}
