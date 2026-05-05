"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "home" | "create" | "join";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("home");
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!roomName.trim()) return setError("Enter a room name!");
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to create room");
      router.push(`/room/${data.id}`);
    } catch {
      setError("Network error – try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const code = roomCode.trim().toUpperCase();
    const name = nickname.trim();
    if (!code || code.length !== 6) return setError("Enter a 6-char room code!");
    if (!name) return setError("Enter a nickname!");
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: name }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to join room");
      // Store nickname so the room page knows who you are
      localStorage.setItem(`tally_nick_${code}`, name);
      router.push(`/room/${code}`);
    } catch {
      setError("Network error – try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-pixel-bg flex flex-col items-center justify-center p-4">
      {/* Title */}
      <div className="mb-10 text-center">
        <div className="text-pixel-green text-4xl sm:text-5xl font-pixel mb-3 drop-shadow-[0_0_16px_rgba(0,255,65,0.7)]">
          TALLY
        </div>
        <div className="text-pixel-yellow text-xs font-pixel mt-2">
          🍺 DRINK TRACKER 🍺
        </div>
        <div className="mt-3 text-[9px] text-gray-500 font-pixel">
          INSERT COIN TO PLAY
          <span className="blink">_</span>
        </div>
      </div>

      <div className="w-full max-w-sm">
        {mode === "home" && (
          <div className="flex flex-col gap-5 animate-slide-up">
            <button
              className="pixel-btn pixel-btn-yellow text-base w-full"
              onClick={() => setMode("create")}
            >
              ▶ CREATE ROOM
            </button>
            <button
              className="pixel-btn pixel-btn-blue text-base w-full"
              onClick={() => setMode("join")}
            >
              ▶ JOIN ROOM
            </button>
          </div>
        )}

        {mode === "create" && (
          <form
            onSubmit={handleCreate}
            className="pixel-card p-5 flex flex-col gap-4 animate-slide-up"
          >
            <div className="text-pixel-green text-xs font-pixel mb-1">
              ▸ CREATE ROOM
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-pixel mb-2">
                ROOM NAME
              </label>
              <input
                className="pixel-input"
                placeholder="PARTY NIGHT"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={30}
                autoFocus
              />
            </div>
            {error && (
              <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>
            )}
            <button
              type="submit"
              className="pixel-btn w-full"
              disabled={loading}
            >
              {loading ? "LOADING..." : "✔ CREATE"}
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-pink w-full"
              onClick={() => { setMode("home"); setError(""); }}
            >
              ✖ BACK
            </button>
          </form>
        )}

        {mode === "join" && (
          <form
            onSubmit={handleJoin}
            className="pixel-card p-5 flex flex-col gap-4 animate-slide-up"
          >
            <div className="text-pixel-green text-xs font-pixel mb-1">
              ▸ JOIN ROOM
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-pixel mb-2">
                ROOM CODE
              </label>
              <input
                className="pixel-input uppercase"
                placeholder="ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-pixel mb-2">
                YOUR NICKNAME
              </label>
              <input
                className="pixel-input"
                placeholder="PLAYER1"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
              />
            </div>
            {error && (
              <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>
            )}
            <button
              type="submit"
              className="pixel-btn w-full"
              disabled={loading}
            >
              {loading ? "LOADING..." : "✔ JOIN"}
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-pink w-full"
              onClick={() => { setMode("home"); setError(""); }}
            >
              ✖ BACK
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-[8px] text-gray-600 font-pixel text-center">
        © 2025 TALLY v1.0
      </div>
    </main>
  );
}
