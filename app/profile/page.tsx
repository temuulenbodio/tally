"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DrinkRecord {
  roomId: string;
  roomName: string;
  drinkName: string;
  price: number;
  timestamp: number;
}

const DAY_LABELS  = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function cellStyle(count: number, isToday: boolean): React.CSSProperties {
  const todayBorder = "2px solid #ffffff";
  if (count === 0) return { background: "#0a0a14", border: isToday ? todayBorder : "2px solid transparent" };
  if (count <= 2)  return { background: "#00ff4118", border: isToday ? todayBorder : "2px solid #00ff41", color: "#00ff41" };
  if (count <= 4)  return { background: "#ffdd0018", border: isToday ? todayBorder : "2px solid #ffdd00", color: "#ffdd00" };
  return             { background: "#ff008018", border: isToday ? todayBorder : "2px solid #ff0080",  color: "#ff0080" };
}

// ── Auth form ─────────────────────────────────────────────────────────────────
function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode,     setMode]     = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Signup failed"); setLoading(false); return; }
    }

    const result = await signIn("credentials", { username: username.toLowerCase(), password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(mode === "signin" ? "Wrong username or password" : "Account created but sign-in failed");
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pixel-card p-5 flex flex-col gap-4 w-full max-w-xs">
      <div className="text-pixel-green text-xs font-pixel">
        {mode === "signin" ? "▸ SIGN IN" : "▸ CREATE ACCOUNT"}
      </div>

      <div>
        <label className="block text-[8px] text-gray-400 font-pixel mb-2">USERNAME</label>
        <input
          className="pixel-input w-full"
          placeholder="PLAYER1"
          value={username}
          onChange={e => setUsername(e.target.value)}
          maxLength={20}
          autoFocus
          autoComplete="username"
        />
      </div>
      <div>
        <label className="block text-[8px] text-gray-400 font-pixel mb-2">PASSWORD</label>
        <input
          className="pixel-input w-full"
          type="password"
          placeholder="••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </div>

      {error && <div className="text-pixel-pink text-[8px] font-pixel">{error}</div>}

      <button type="submit" className="pixel-btn pixel-btn-yellow w-full" disabled={loading}>
        {loading ? "LOADING..." : mode === "signin" ? "▶ SIGN IN" : "▶ CREATE ACCOUNT"}
      </button>

      <button
        type="button"
        className="text-gray-500 text-[8px] font-pixel hover:text-pixel-blue"
        onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setError(""); }}
      >
        {mode === "signin" ? "NO ACCOUNT? CREATE ONE" : "HAVE AN ACCOUNT? SIGN IN"}
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [records,  setRecords]  = useState<DrinkRecord[]>([]);
  const [fetching, setFetching] = useState(false);
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  useEffect(() => {
    if (status !== "authenticated") return;
    setFetching(true);
    fetch("/api/profile/history")
      .then(r => r.json())
      .then(d => { setRecords(d.records ?? []); setFetching(false); })
      .catch(() => setFetching(false));
  }, [status]);

  // Group by YYYY-MM-DD
  const byDate: Record<string, number> = {};
  for (const r of records) {
    const d = new Date(r.timestamp);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    byDate[k] = (byDate[k] ?? 0) + 1;
  }

  function dk(day: number) {
    return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  // Calendar grid
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthTotal = cells.reduce((s, d) => d ? s + (byDate[dk(d)] ?? 0) : s, 0);
  const monthSpent = records
    .filter(r => { const d = new Date(r.timestamp); return d.getFullYear()===year && d.getMonth()===month; })
    .reduce((s, r) => s + r.price, 0);

  // Sessions grouped by date+room
  type Sesh = { date: string; roomName: string; drinks: DrinkRecord[] };
  const seshMap: Record<string, Sesh> = {};
  for (const r of records) {
    const d = new Date(r.timestamp);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const dateStr = dk(d.getDate());
    const key = `${dateStr}:${r.roomId}`;
    if (!seshMap[key]) seshMap[key] = { date: dateStr, roomName: r.roomName, drinks: [] };
    seshMap[key].drinks.push(r);
  }
  const sessions = Object.values(seshMap).sort((a, b) => b.date.localeCompare(a.date));

  function prevMonth() { if (month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); }
  function nextMonth() { if (month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); }

  // ── loading ────────────────────────────────────────────────────────────────
  if (status === "loading") return (
    <main className="min-h-screen bg-pixel-bg flex items-center justify-center">
      <div className="text-pixel-green font-pixel text-xs animate-blink">LOADING...</div>
    </main>
  );

  // ── signed out ─────────────────────────────────────────────────────────────
  if (status === "unauthenticated") return (
    <main className="min-h-screen bg-pixel-bg flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center">
        <div className="text-pixel-green text-3xl font-pixel mb-3 drop-shadow-[0_0_16px_rgba(0,255,65,0.7)]">
          MY STATS
        </div>
        <div className="text-gray-500 text-[8px] font-pixel leading-6">
          TRACK YOUR DRINK HISTORY<br/>ACROSS ALL ROOMS
        </div>
      </div>
      <AuthForm onSuccess={() => update().then(() => router.refresh())} />
      <button className="pixel-btn pixel-btn-pink w-full max-w-xs" onClick={() => router.push("/")}>
        ◀ BACK
      </button>
    </main>
  );

  // ── signed in ──────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-pixel-bg p-4 pb-12" style={{ maxWidth: 420, margin: "0 auto" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button className="text-pixel-pink text-[10px] font-pixel" onClick={() => router.push("/")}>◀ BACK</button>
        <div className="text-pixel-green text-xs font-pixel">MY STATS</div>
        <button className="text-gray-500 text-[8px] font-pixel hover:text-pixel-pink" onClick={() => signOut({ callbackUrl: "/" })}>
          SIGN OUT
        </button>
      </div>

      {/* User card */}
      <div className="pixel-card p-4 mb-5 flex items-center gap-3">
        <div className="w-9 h-9 flex items-center justify-center font-pixel text-pixel-green text-sm"
          style={{ border: "2px solid #00ff41", background: "#0a0a14" }}>
          {(session?.user?.name ?? "?")[0].toUpperCase()}
        </div>
        <div>
          <div className="text-pixel-yellow text-[10px] font-pixel">{session?.user?.name?.toUpperCase()}</div>
          <div className="text-gray-500 text-[8px] font-pixel mt-1">{records.length} DRINKS LOGGED TOTAL</div>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button className="pixel-btn text-xs" style={{ padding: "6px 12px" }} onClick={prevMonth}>◀</button>
        <div className="text-pixel-green text-[10px] font-pixel">{MONTH_LABELS[month]} {year}</div>
        <button className="pixel-btn text-xs" style={{ padding: "6px 12px" }} onClick={nextMonth}>▶</button>
      </div>

      {/* Calendar */}
      <div className="pixel-card p-3 mb-4">
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center font-pixel text-gray-600" style={{ fontSize: 6 }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const count   = byDate[dk(day)] ?? 0;
            const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===day;
            return (
              <div key={i} className="flex flex-col items-center justify-center font-pixel"
                style={{ ...cellStyle(count, isToday), aspectRatio: "1", fontSize: 6 }}>
                <span>{day}</span>
                {count > 0 && <span style={{ fontSize: 7, marginTop: 1 }}>{count}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="pixel-card-yellow p-3 text-center">
          <div className="text-[7px] text-gray-400 font-pixel mb-1">DRINKS</div>
          <div className="text-pixel-yellow text-2xl font-pixel">{monthTotal}</div>
        </div>
        <div className="pixel-card p-3 text-center" style={{ border: "2px solid #00ff41" }}>
          <div className="text-[7px] text-gray-400 font-pixel mb-1">SPENT</div>
          <div className="text-pixel-green text-lg font-pixel">{Math.round(monthSpent).toLocaleString()}₮</div>
        </div>
      </div>

      {/* Sessions */}
      {fetching ? (
        <div className="text-center text-pixel-green text-[8px] font-pixel animate-blink">LOADING...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center text-gray-600 text-[8px] font-pixel py-6">NO SESSIONS THIS MONTH</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-[8px] text-gray-500 font-pixel mb-1">SESSIONS</div>
          {sessions.map((s, i) => {
            const counts: Record<string, number> = {};
            for (const r of s.drinks) counts[r.drinkName] = (counts[r.drinkName] ?? 0) + 1;
            const total = s.drinks.reduce((sum, r) => sum + r.price, 0);
            const [, mm, dd] = s.date.split("-");
            return (
              <div key={i} className="pixel-card p-3">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-pixel-yellow text-[9px] font-pixel truncate mr-2">{s.roomName.toUpperCase()}</div>
                  <div className="text-gray-500 text-[7px] font-pixel shrink-0">{mm}/{dd}</div>
                </div>
                <div className="text-gray-400 text-[7px] font-pixel leading-5">
                  {Object.entries(counts).map(([name, n]) => `${name}${n>1?` ×${n}`:""}`).join(" · ")}
                </div>
                {total > 0 && <div className="text-pixel-green text-[7px] font-pixel mt-1">{Math.round(total).toLocaleString()}₮</div>}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
