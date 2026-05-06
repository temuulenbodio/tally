import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";
import { generateRoomId } from "@/lib/utils";
import { Room, DrinkType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();
    const rawDrinks: unknown[] = Array.isArray(body.drinkTypes) ? body.drinkTypes : [];

    if (!name || name.length > 30) {
      return NextResponse.json({ error: "Invalid room name" }, { status: 400 });
    }

    const drinkTypes: DrinkType[] = rawDrinks
      .filter(
        (d): d is { name: string; price: number } =>
          typeof (d as { name: unknown }).name === "string" &&
          typeof (d as { price: unknown }).price === "number"
      )
      .map((d) => {
        const rawEmoji = (d as { emoji?: unknown }).emoji;
        const emoji =
          typeof rawEmoji === "string" && rawEmoji.trim().length > 0
            ? rawEmoji.trim().slice(0, 2)
            : "🍺";
        return {
          name: d.name.trim().slice(0, 20),
          price: Math.round(Math.max(0, d.price) * 100) / 100,
          emoji,
        };
      })
      .filter((d) => d.name.length > 0)
      .slice(0, 8);

    if (drinkTypes.length === 0) {
      return NextResponse.json({ error: "Add at least one drink type" }, { status: 400 });
    }

    let id = generateRoomId();
    let attempts = 0;
    while ((await getRoom(id)) && attempts < 10) {
      id = generateRoomId();
      attempts++;
    }

    const room: Room = {
      id,
      name,
      createdAt: Date.now(),
      drinkTypes,
      members: {},
    };

    await setRoom(id, room);
    return NextResponse.json({ id, name });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
