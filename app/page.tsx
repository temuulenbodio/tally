"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Mode = "home" | "create" | "setup" | "join";
interface DrinkEntry { name: string; price: number; emoji: string }

const DRINK_EMOJIS = ["🍺","🍷","🍸","🍹","🥂","🍾","🥃","🧉","🫗","🧃","🥤","☕"];

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [mode, setMode] = useState<Mode>("home");

  // Create flow
  const [roomName, setRoomName] = useState("");
  const [drinkTypes, setDrinkTypes] = useState<DrinkEntry[]>([]);
  const [newDrinkName, setNewDrinkName] = useState("");
  const [newDrinkPrice, setNewDrinkPrice] = useState("");
  const [newDrinkEmoji, setNewDrinkEmoji] = useState("🍺");

  // Join flow
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Create: step 1 ───────────────────────────────────────────────────
  function handleNameNext(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) return setError("Enter a room name!");
    setError("");
    setMode("setup");
  }

  // ── Create: step 2 — drink management ───────────────────────────────
  function addDrink() {
    const name = newDrinkName.trim().toUpperCase();
    const price = parseFloat(newDrinkPrice);
    if (!name) return setError("Enter a drink name!");
    if (isNaN(price) || price < 0) return setError("Enter a valid price!");
    if (drinkTypes.some((d) => d.name === name)) return setError("Already added!");
    setDrinkTypes((prev) => [...prev, { name, price: Math.round(price * 100) / 100, emoji: newDrinkEmoji }]);
    setNewDrinkName("");
    setNewDrinkPrice("");
    setNewDrinkEmoji("🍺");
    setError("");
  }

  function removeDrink(idx: number) {
    setDrinkTypes((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (drinkTypes.length === 0) return setError("Add at least one drink!");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim(), drinkTypes }),
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

  // ── Join ─────────────────────────────────────────────────────────────
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
      localStorage.setItem(`tally_nick_${code}`, name);
      router.push(`/room/${code}`);
    } catch {
      setError("Network error – try again");
    } finally {
      setLoading(false);
    }
  }

  function resetCreate() {
    setRoomName("");
    setDrinkTypes([]);
    setNewDrinkName("");
    setNewDrinkPrice("");
    setError("");
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
          INSERT COIN TO PLAY<span className="blink">_</span>
        </div>
      </div>

      <div className="w-full max-w-sm">
        {/* ── Home ── */}
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
            <button
              className="pixel-btn text-base w-full"
              style={{ borderColor: "#9b59b6", color: "#9b59b6" }}
              onClick={() => router.push("/profile")}
            >
              {session ? "★ MY STATS" : "★ SIGN IN FOR STATS"}
            </button>
          </div>
        )}

        {/* ── Step 1: Room name ── */}
        {mode === "create" && (
          <form
            onSubmit={handleNameNext}
            className="pixel-card p-5 flex flex-col gap-4 animate-slide-up"
          >
            <div className="text-pixel-green text-xs font-pixel mb-1">▸ CREATE ROOM</div>
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
            {error && <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>}
            <button type="submit" className="pixel-btn w-full">
              ▶ NEXT
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-pink w-full"
              onClick={() => { resetCreate(); setMode("home"); }}
            >
              ✖ BACK
            </button>
          </form>
        )}

        {/* ── Step 2: Drink types ── */}
        {mode === "setup" && (
          <div className="pixel-card p-5 flex flex-col gap-4 animate-slide-up">
            <div className="text-pixel-green text-xs font-pixel">▸ DRINK MENU</div>
            <div className="text-[8px] text-gray-500 font-pixel">
              ROOM: <span className="text-pixel-yellow">{roomName.toUpperCase()}</span>
            </div>

            {/* Added drinks list */}
            {drinkTypes.length > 0 && (
              <div className="flex flex-col gap-2">
                {drinkTypes.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2"
                    style={{ border: "2px solid #2a2a5e", background: "#0a0a14" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl" style={{ fontFamily: "initial" }}>{d.emoji}</span>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-pixel-green font-pixel">{d.name}</span>
                        <span className="text-[8px] text-pixel-yellow font-pixel">
                          {Math.round(d.price).toLocaleString()}₮
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-pixel-pink text-[10px] font-pixel hover:opacity-70 ml-3"
                      onClick={() => removeDrink(i)}
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            )}

            {drinkTypes.length === 0 && (
              <div className="text-[8px] text-gray-600 font-pixel text-center py-2">
                NO DRINKS ADDED YET
              </div>
            )}

            {/* Add drink form */}
            {drinkTypes.length < 8 && (
              <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid #2a2a5e" }}>
                <div className="text-[8px] text-gray-500 font-pixel">ADD DRINK</div>
                <input
                  className="pixel-input"
                  placeholder="BEER"
                  value={newDrinkName}
                  onChange={(e) => setNewDrinkName(e.target.value.toUpperCase())}
                  maxLength={20}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDrink())}
                />
                <div className="text-[8px] text-gray-500 font-pixel">EMOJI</div>
                <div className="flex flex-wrap gap-1">
                  {DRINK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewDrinkEmoji(em)}
                      style={{ fontFamily: "initial" }}
                      className={`text-xl px-1 py-0.5 border-2 transition-none ${
                        newDrinkEmoji === em ? "border-pixel-green" : "border-transparent"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="pixel-input flex-1"
                    placeholder="5.00"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newDrinkPrice}
                    onChange={(e) => setNewDrinkPrice(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDrink())}
                  />
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-yellow"
                    style={{ padding: "12px 18px", fontSize: "0.9rem" }}
                    onClick={addDrink}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {error && <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>}

            <button
              type="button"
              className="pixel-btn w-full"
              onClick={handleCreate}
              disabled={loading || drinkTypes.length === 0}
            >
              {loading ? "LOADING..." : "✔ CREATE ROOM"}
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-pink w-full"
              onClick={() => { setError(""); setMode("create"); }}
            >
              ◀ BACK
            </button>
          </div>
        )}

        {/* ── Join ── */}
        {mode === "join" && (
          <form
            onSubmit={handleJoin}
            className="pixel-card p-5 flex flex-col gap-4 animate-slide-up"
          >
            <div className="text-pixel-green text-xs font-pixel mb-1">▸ JOIN ROOM</div>
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
            {error && <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>}
            <button type="submit" className="pixel-btn w-full" disabled={loading}>
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

      <div className="mt-12 text-[8px] text-gray-600 font-pixel text-center">
        © 2025 TALLY v1.0
      </div>
    </main>
  );
}
