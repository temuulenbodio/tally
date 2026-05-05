"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

interface Member {
  nickname: string;
  drinks: number;
  joinedAt: number;
}

interface RoomData {
  id: string;
  name: string;
  members: Member[];
}

const RANK_ICONS = ["🥇", "🥈", "🥉"];
const RANK_COLORS = ["text-pixel-yellow", "text-gray-300", "text-amber-600"];
const POLL_MS = 3000;

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = (params.id as string).toUpperCase();

  const [nickname, setNickname] = useState<string | null>(null);
  const [joinNick, setJoinNick] = useState("");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [drinkCount, setDrinkCount] = useState(0);
  const [drinkAnim, setDrinkAnim] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (res.status === 404) {
        setRoomNotFound(true);
        return;
      }
      if (!res.ok) return;
      const data: RoomData = await res.json();
      setRoom(data);
      // Keep local drink count in sync
      const me = data.members.find((m) => m.nickname === nickname);
      if (me) setDrinkCount(me.drinks);
    } catch {
      // Ignore network errors during polling
    }
  }, [roomId, nickname]);

  // On mount: check localStorage for saved nickname
  useEffect(() => {
    const saved = localStorage.getItem(`tally_nick_${roomId}`);
    if (saved) setNickname(saved);
  }, [roomId]);

  // Start polling once we have a nickname
  useEffect(() => {
    if (!nickname) return;
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [nickname, fetchRoom]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = joinNick.trim();
    if (!name) return setError("Enter a nickname!");
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: name }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to join");
      localStorage.setItem(`tally_nick_${roomId}`, name);
      setNickname(name);
    } catch {
      setError("Network error – try again");
    } finally {
      setJoining(false);
    }
  }

  async function handleDrink() {
    if (!nickname) return;
    // Optimistic update
    setDrinkCount((c) => c + 1);
    setDrinkAnim(true);
    setTimeout(() => setDrinkAnim(false), 400);

    try {
      const res = await fetch(`/api/rooms/${roomId}/drink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrinkCount(data.drinks);
        // Refresh leaderboard immediately
        fetchRoom();
      }
    } catch {
      // Optimistic – revert on failure
      setDrinkCount((c) => Math.max(0, c - 1));
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleLeave() {
    localStorage.removeItem(`tally_nick_${roomId}`);
    router.push("/");
  }

  // ── Room not found ────────────────────────────────────────────────────
  if (roomNotFound) {
    return (
      <main className="min-h-screen bg-pixel-bg flex flex-col items-center justify-center p-4 text-center">
        <div className="text-pixel-pink text-3xl font-pixel mb-4">GAME OVER</div>
        <div className="text-white text-xs font-pixel mb-8">ROOM NOT FOUND</div>
        <button className="pixel-btn pixel-btn-yellow" onClick={() => router.push("/")}>
          ▶ MAIN MENU
        </button>
      </main>
    );
  }

  // ── Join form (no nickname yet) ────────────────────────────────────────
  if (!nickname) {
    return (
      <main className="min-h-screen bg-pixel-bg flex flex-col items-center justify-center p-4">
        <div className="text-pixel-green text-3xl font-pixel mb-2 drop-shadow-[0_0_12px_rgba(0,255,65,0.6)]">
          TALLY
        </div>
        <div className="text-[9px] text-gray-500 font-pixel mb-8">
          ROOM: <span className="text-pixel-yellow">{roomId}</span>
        </div>
        <form
          onSubmit={handleJoin}
          className="pixel-card p-5 w-full max-w-sm flex flex-col gap-4 animate-slide-up"
        >
          <div className="text-pixel-green text-xs font-pixel mb-1">
            ▸ ENTER YOUR NAME
          </div>
          <div>
            <label className="block text-[9px] text-gray-400 font-pixel mb-2">
              NICKNAME
            </label>
            <input
              className="pixel-input"
              placeholder="PLAYER1"
              value={joinNick}
              onChange={(e) => setJoinNick(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>
          {error && (
            <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>
          )}
          <button type="submit" className="pixel-btn w-full" disabled={joining}>
            {joining ? "LOADING..." : "▶ ENTER ROOM"}
          </button>
          <button
            type="button"
            className="pixel-btn pixel-btn-pink w-full"
            onClick={() => router.push("/")}
          >
            ✖ BACK
          </button>
        </form>
      </main>
    );
  }

  // ── Room view ────────────────────────────────────────────────────────
  const maxDrinks = room?.members[0]?.drinks ?? 1;
  const myRank = room ? room.members.findIndex((m) => m.nickname === nickname) + 1 : 0;

  return (
    <main className="min-h-screen bg-pixel-bg flex flex-col pb-4">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 py-3 border-b border-pixel-border">
        <div className="text-pixel-green text-base font-pixel drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]">
          TALLY
        </div>
        <button
          onClick={handleCopyCode}
          className="pixel-card px-3 py-2 text-[9px] font-pixel text-pixel-yellow cursor-pointer hover:opacity-80 transition-opacity"
          title="Copy room code"
        >
          {copied ? "✔ COPIED!" : `# ${roomId}`}
        </button>
        <button
          onClick={handleLeave}
          className="text-[9px] font-pixel text-gray-500 hover:text-pixel-pink transition-colors"
        >
          EXIT
        </button>
      </header>

      {/* ── Room name + player info ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-[9px] text-gray-400 font-pixel truncate">
          {room?.name ?? "..."}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-pixel-blue text-[10px] font-pixel truncate max-w-[60%]">
            ▸ {nickname}
          </div>
          {myRank > 0 && (
            <div className="text-[9px] font-pixel text-gray-400">
              RANK:{" "}
              <span className={myRank <= 3 ? RANK_COLORS[myRank - 1] : "text-white"}>
                #{myRank}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── My drink count ── */}
      <div className="mx-3 mb-3">
        <div
          className={`pixel-card-yellow p-4 text-center ${drinkAnim ? "animate-drink-pop" : ""}`}
        >
          <div className="text-[9px] text-gray-400 font-pixel mb-1">
            YOUR DRINKS
          </div>
          <div className="text-pixel-yellow text-5xl font-pixel drop-shadow-[0_0_12px_rgba(255,221,0,0.7)]">
            {drinkCount}
          </div>
          <div className="text-[9px] text-gray-500 font-pixel mt-1">
            🍺 × {drinkCount}
          </div>
        </div>
      </div>

      {/* ── Leaderboard ── */}
      <div className="mx-3 mb-4 flex-1">
        <div className="text-pixel-pink text-[10px] font-pixel mb-2 drop-shadow-[0_0_8px_rgba(255,0,128,0.5)]">
          ▸ LEADERBOARD
        </div>
        {!room ? (
          <div className="text-gray-500 text-[9px] font-pixel text-center py-4">
            LOADING
            <span className="blink">...</span>
          </div>
        ) : room.members.length === 0 ? (
          <div className="text-gray-500 text-[9px] font-pixel text-center py-4">
            NO PLAYERS YET
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {room.members.map((member, idx) => {
              const isMe = member.nickname === nickname;
              const pct =
                maxDrinks > 0 ? Math.round((member.drinks / maxDrinks) * 100) : 0;
              return (
                <div
                  key={member.nickname}
                  className={`p-3 animate-slide-up ${
                    isMe
                      ? "pixel-card-yellow"
                      : "pixel-card"
                  }`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">
                        {idx < 3 ? RANK_ICONS[idx] : `#${idx + 1}`}
                      </span>
                      <span
                        className={`text-[9px] font-pixel truncate ${
                          isMe ? "text-pixel-yellow" : "text-white"
                        }`}
                      >
                        {member.nickname}
                        {isMe && " ◀"}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-pixel ml-2 flex-shrink-0 ${
                        idx < 3 ? RANK_COLORS[idx] : "text-white"
                      }`}
                    >
                      {member.drinks} 🍺
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-black/40 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isMe ? "bg-pixel-yellow" : "bg-pixel-green"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Big drink button ── */}
      <div className="px-3 pt-2">
        <button
          className="drink-btn"
          onClick={handleDrink}
        >
          🍺 +1 DRINK
        </button>
        <div className="text-center text-[8px] text-gray-600 font-pixel mt-2">
          TAP TO ADD A DRINK
        </div>
      </div>
    </main>
  );
}
