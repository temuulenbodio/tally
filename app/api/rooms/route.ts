import { NextResponse } from "next/server";
import { getRoom, setRoom } from "@/lib/store";
import { generateRoomId } from "@/lib/utils";
import { Room } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").trim();

    if (!name || name.length > 30) {
      return NextResponse.json({ error: "Invalid room name" }, { status: 400 });
    }

    // Generate a unique 6-char room ID
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
      members: {},
    };

    await setRoom(id, room);

    return NextResponse.json({ id, name });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
