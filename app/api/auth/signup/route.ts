import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUser, createUser } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json();
  const username = (body.username ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();

  if (!username || username.length < 3 || username.length > 20) {
    return NextResponse.json({ error: "Username must be 3–20 characters" }, { status: 400 });
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: "Letters, numbers, underscores only" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const existing = await getUser(username);
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await createUser({ username, passwordHash, createdAt: Date.now() });

  return NextResponse.json({ success: true });
}
