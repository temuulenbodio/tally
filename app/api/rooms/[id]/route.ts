import { NextResponse } from "next/server";
import { getRoom } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const room = await getRoom(params.id.toUpperCase());
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Return members as sorted array (highest drinks first)
  const members = Object.values(room.members).sort(
    (a, b) => b.drinks - a.drinks
  );

  return NextResponse.json({ id: room.id, name: room.name, members });
}
