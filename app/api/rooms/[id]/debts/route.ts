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

  const { debtId, nickname } = await request.json();
  const debt = (room.debts ?? []).find((d) => d.id === debtId);

  if (!debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  if (debt.from !== nickname) return NextResponse.json({ error: "Not your debt" }, { status: 403 });

  debt.settled = true;
  await setRoom(roomId, room);
  return NextResponse.json({ success: true });
}
