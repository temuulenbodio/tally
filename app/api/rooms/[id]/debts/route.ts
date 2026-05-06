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

  const { debtId, nickname, drinkName } = await request.json();
  const debt = (room.debts ?? []).find((d) => d.id === debtId);

  if (!debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  if (debt.from !== nickname) return NextResponse.json({ error: "Not your debt" }, { status: 403 });
  if (!drinkName) return NextResponse.json({ error: "drinkName required" }, { status: 400 });

  const drinkType = room.drinkTypes.find((d) => d.name === drinkName);
  if (!drinkType) return NextResponse.json({ error: "Drink not found" }, { status: 400 });

  debt.settled = true;

  // Add the chosen drink to the winner's record
  const winner = room.members[debt.to];
  if (winner) {
    winner.drinks = (winner.drinks ?? 0) + 1;
    winner.totalSpent = Math.round(((winner.totalSpent ?? 0) + drinkType.price) * 100) / 100;
  }

  await setRoom(roomId, room);
  return NextResponse.json({ success: true });
}
