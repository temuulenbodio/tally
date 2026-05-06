"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

interface DrinkType {
  name: string;
  price: number;
  emoji?: string;
}

interface Member {
  nickname: string;
  drinks: number;
  totalSpent: number;
  joinedAt: number;
}

interface RoomData {
  id: string;
  name: string;
  drinkTypes: DrinkType[];
  members: Member[];
}

const RANK_ICONS = ["🥇", "🥈", "🥉"];
const RANK_COLORS = ["text-pixel-yellow", "text-gray-300", "text-amber-600"];
const DRINK_BTN_COLORS = [
  "drink-type-btn-yellow",
  "drink-type-btn-blue",
  "drink-type-btn-green",
  "drink-type-btn-pink",
  "drink-type-btn-orange",
  "drink-type-btn-purple",
];
const STATUSES = [
  { min: 0,  max: 0,  label: "SOBER",      emoji: "😐", color: "#00ff41" },
  { min: 1,  max: 2,  label: "WARMING UP", emoji: "😊", color: "#b8ff00" },
  { min: 3,  max: 4,  label: "TIPSY",      emoji: "😄", color: "#ffdd00" },
  { min: 5,  max: 7,  label: "BUZZED",     emoji: "😵", color: "#ff8c00" },
  { min: 8,  max: 11, label: "DRUNK",      emoji: "🥴", color: "#ff4400" },
  { min: 12, max: Infinity, label: "WASTED", emoji: "💀", color: "#ff0080" },
];
const POLL_MS = 3000;

function getStatusIdx(drinks: number): number {
  const idx = STATUSES.findIndex((s) => drinks >= s.min && drinks <= s.max);
  return idx === -1 ? STATUSES.length - 1 : idx;
}

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
  const [totalSpent, setTotalSpent] = useState(0);
  const [drinkAnim, setDrinkAnim] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [drinkTimestamps, setDrinkTimestamps] = useState<number[]>([]);
  const [showWaterReminder, setShowWaterReminder] = useState(false);
  const [showSlowDown, setShowSlowDown] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (res.status === 404) { setRoomNotFound(true); return; }
      if (!res.ok) return;
      const data: RoomData = await res.json();
      setRoom(data);
      const me = data.members.find((m) => m.nickname === nickname);
      if (me) {
        setDrinkCount(me.drinks);
        setTotalSpent(me.totalSpent ?? 0);
      }
    } catch { /* ignore polling errors */ }
  }, [roomId, nickname]);

  useEffect(() => {
    const saved = localStorage.getItem(`tally_nick_${roomId}`);
    if (saved) setNickname(saved);
  }, [roomId]);

  useEffect(() => {
    if (!nickname) return;
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [nickname, fetchRoom]);

  // Cleanup water timer on unmount
  useEffect(() => () => { if (waterTimerRef.current) clearTimeout(waterTimerRef.current); }, []);

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

  async function handleDrink(drinkName: string) {
    if (!nickname || !room) return;
    const drinkType = room.drinkTypes.find((d) => d.name === drinkName);
    const price = drinkType?.price ?? 0;

    // Status level-up → water reminder
    const prevIdx = getStatusIdx(drinkCount);
    const newIdx  = getStatusIdx(drinkCount + 1);
    if (newIdx > prevIdx) {
      setShowWaterReminder(true);
      if (waterTimerRef.current) clearTimeout(waterTimerRef.current);
      waterTimerRef.current = setTimeout(() => setShowWaterReminder(false), 5000);
    }

    // Speed check → slow-down popup (3 drinks within 8 min)
    const now = Date.now();
    const recent = [...drinkTimestamps, now].filter((ts) => now - ts < 8 * 60 * 1000);
    setDrinkTimestamps(recent);
    if (recent.length >= 3) setShowSlowDown(true);

    setDrinkCount((c) => c + 1);
    setTotalSpent((s) => Math.round((s + price) * 100) / 100);
    setDrinkAnim(true);
    setTimeout(() => setDrinkAnim(false), 400);

    try {
      const res = await fetch(`/api/rooms/${roomId}/drink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, drinkName }),
      });
      const data = await res.json();
      if (res.ok) {
        setDrinkCount(data.drinks);
        setTotalSpent(data.totalSpent ?? 0);
        fetchRoom();
      }
    } catch {
      setDrinkCount((c) => Math.max(0, c - 1));
      setTotalSpent((s) => Math.max(0, Math.round((s - price) * 100) / 100));
    }
  }

  async function handleCopyCode() {
    try { await navigator.clipboard.writeText(roomId); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // ── Join form ─────────────────────────────────────────────────────────
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
          <div className="text-pixel-green text-xs font-pixel mb-1">▸ ENTER YOUR NAME</div>
          <div>
            <label className="block text-[9px] text-gray-400 font-pixel mb-2">NICKNAME</label>
            <input
              className="pixel-input"
              placeholder="PLAYER1"
              value={joinNick}
              onChange={(e) => setJoinNick(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>
          {error && <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>}
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

  // ── Room view ─────────────────────────────────────────────────────────
  const maxDrinks = room?.members[0]?.drinks ?? 1;
  const myRank = room ? room.members.findIndex((m) => m.nickname === nickname) + 1 : 0;
  const drinkTypes = room?.drinkTypes ?? [];
  const cols = drinkTypes.length === 1 ? 1 : drinkTypes.length <= 4 ? 2 : 3;
  const statusIdx = getStatusIdx(drinkCount);
  const currentStatus = STATUSES[statusIdx];

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

      {/* ── Status bar ── */}
      <div className="px-3 py-2 border-b border-pixel-border" style={{ background: "rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontFamily: "initial" }} className="text-xl">{currentStatus.emoji}</span>
          <span className="font-pixel text-[9px]" style={{ color: currentStatus.color }}>
            {currentStatus.label}
          </span>
          <span className="text-[8px] text-gray-500 font-pixel">{drinkCount} drinks</span>
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s, i) => (
            <div
              key={i}
              className="flex-1 h-2 transition-all duration-300"
              style={{
                background: i <= statusIdx ? s.color : "#1a1a2e",
                boxShadow: i === statusIdx ? `0 0 8px ${s.color}` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Room name + player info ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-[9px] text-gray-400 font-pixel truncate">{room?.name ?? "..."}</div>
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
        <div className={`pixel-card-yellow p-4 text-center ${drinkAnim ? "animate-drink-pop" : ""}`}>
          <div className="text-[9px] text-gray-400 font-pixel mb-1">YOUR DRINKS</div>
          <div className="text-pixel-yellow text-5xl font-pixel drop-shadow-[0_0_12px_rgba(255,221,0,0.7)]">
            {drinkCount}
          </div>
          <div className="text-[9px] text-gray-500 font-pixel mt-1">🍺 × {drinkCount}</div>
          {totalSpent > 0 && (
            <div className="text-pixel-green text-[9px] font-pixel mt-2">
              SPENT: ${totalSpent.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* ── Drink buttons ── */}
      <div className="mx-3 mb-4">
        <div className="text-pixel-yellow text-[10px] font-pixel mb-2">▸ ADD DRINK</div>
        {drinkTypes.length === 0 ? (
          <div className="text-gray-600 text-[8px] font-pixel text-center py-3">
            NO DRINKS CONFIGURED
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {drinkTypes.map((drink, idx) => (
              <button
                key={drink.name}
                className={`drink-type-btn ${DRINK_BTN_COLORS[idx % DRINK_BTN_COLORS.length]}`}
                onClick={() => handleDrink(drink.name)}
              >
                <span className="text-3xl leading-none" style={{ fontFamily: "initial" }}>
                  {drink.emoji ?? "🍺"}
                </span>
                <span className="text-[10px] font-pixel leading-tight mt-1">{drink.name}</span>
                <span className="text-[8px] font-pixel opacity-80">${drink.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Leaderboard ── */}
      <div className="mx-3 flex-1">
        <div className="text-pixel-pink text-[10px] font-pixel mb-2 drop-shadow-[0_0_8px_rgba(255,0,128,0.5)]">
          ▸ LEADERBOARD
        </div>
        {!room ? (
          <div className="text-gray-500 text-[9px] font-pixel text-center py-4">
            LOADING<span className="blink">...</span>
          </div>
        ) : room.members.length === 0 ? (
          <div className="text-gray-500 text-[9px] font-pixel text-center py-4">
            NO PLAYERS YET
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {room.members.map((member, idx) => {
              const isMe = member.nickname === nickname;
              const pct = maxDrinks > 0 ? Math.round((member.drinks / maxDrinks) * 100) : 0;
              const mIdx = getStatusIdx(member.drinks);
              return (
                <div
                  key={member.nickname}
                  className={`p-3 animate-slide-up ${isMe ? "pixel-card-yellow" : "pixel-card"}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">
                        {idx < 3 ? RANK_ICONS[idx] : `#${idx + 1}`}
                      </span>
                      <span className={`text-[9px] font-pixel truncate ${isMe ? "text-pixel-yellow" : "text-white"}`}>
                        {member.nickname}{isMe && " ◀"}
                      </span>
                      <span style={{ fontFamily: "initial" }} className="text-xs">
                        {STATUSES[mIdx].emoji}
                      </span>
                    </div>
                    <div className="flex flex-col items-end ml-2 flex-shrink-0">
                      <span className={`text-xs font-pixel ${idx < 3 ? RANK_COLORS[idx] : "text-white"}`}>
                        {member.drinks} 🍺
                      </span>
                      {(member.totalSpent ?? 0) > 0 && (
                        <span className="text-[8px] font-pixel text-pixel-green">
                          ${(member.totalSpent ?? 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-black/40 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isMe ? "bg-pixel-yellow" : "bg-pixel-green"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Water reminder toast ── */}
      {showWaterReminder && (
        <div className="fixed bottom-6 left-3 right-3 z-40 animate-slide-up">
          <div
            className="pixel-card p-3 text-center"
            style={{ borderColor: "#00d4ff", boxShadow: "4px 4px 0 #007a90" }}
          >
            <span style={{ fontFamily: "initial" }} className="text-2xl">💧</span>
            <div className="text-[9px] font-pixel mt-1" style={{ color: "#00d4ff" }}>
              DRINK SOME WATER!
            </div>
            <div className="text-[8px] text-gray-500 font-pixel mt-1">STAY HYDRATED</div>
          </div>
        </div>
      )}

      {/* ── Slow-down modal ── */}
      {showSlowDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="pixel-card-pink p-5 max-w-xs w-full text-center animate-slide-up">
            <div className="text-4xl mb-3" style={{ fontFamily: "initial" }}>⚠️</div>
            <div className="text-pixel-pink text-xs font-pixel mb-3">SLOW DOWN!</div>
            <div className="text-[9px] text-gray-300 font-pixel mb-4 leading-relaxed">
              3 DRINKS IN 8 MINUTES. TAKE A BREAK AND DRINK SOME WATER FIRST.
            </div>
            <button
              className="pixel-btn pixel-btn-blue w-full"
              onClick={() => setShowSlowDown(false)}
            >
              <span style={{ fontFamily: "initial" }}>💧</span> GOT IT
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
