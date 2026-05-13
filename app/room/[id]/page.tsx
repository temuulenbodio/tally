"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface DrinkType  { name: string; price: number; emoji?: string }
interface Member     { nickname: string; drinks: number; totalSpent: number; joinedAt: number }
interface GameState  {
  id: string; type: "number-finder" | "shootout";
  status: "pending" | "active" | "finished";
  challenger: string; challenged: string;
  target: number; choices: number[];
  startedAt: number | null; winner: string | null; finishedAt: number | null;
}
interface DrinkDebt  { id: string; from: string; to: string; gameId: string; createdAt: number; settled: boolean }
interface SpinBottleGame {
  id: string; status: "collecting" | "active" | "finished";
  createdBy: string; mode: "default" | "custom";
  playerQuestions: { [n: string]: string }; readyPlayers: string[];
  currentTarget: string | null; currentQuestion: string | null;
  usedQuestions: string[]; history: { target: string; question: string }[];
}
interface RoomData   {
  id: string; name: string;
  drinkTypes: DrinkType[]; members: Member[];
  activeGame: GameState | null; debts: DrinkDebt[];
  endedAt: number | null; spinBottleGame: SpinBottleGame | null;
}

const DRINK_EMOJIS = ["🍺","🍷","🍸","🍹","🥂","🍾","🥃","🧉","🫗","🧃","🥤","☕"];

const RANK_ICONS   = ["🥇","🥈","🥉"];
const RANK_COLORS  = ["text-pixel-yellow","text-gray-300","text-amber-600"];
const DRINK_BTN_COLORS = [
  "drink-type-btn-yellow","drink-type-btn-blue","drink-type-btn-green",
  "drink-type-btn-pink","drink-type-btn-orange","drink-type-btn-purple",
];
const STATUSES = [
  { min:0,  max:0,  label:"SOBER",      emoji:"😐", color:"#00ff41" },
  { min:1,  max:2,  label:"WARMING UP", emoji:"😊", color:"#b8ff00" },
  { min:3,  max:4,  label:"TIPSY",      emoji:"😄", color:"#ffdd00" },
  { min:5,  max:7,  label:"BUZZED",     emoji:"😵", color:"#ff8c00" },
  { min:8,  max:11, label:"DRUNK",      emoji:"🥴", color:"#ff4400" },
  { min:12, max:Infinity, label:"WASTED", emoji:"💀", color:"#ff0080" },
];

function getStatusIdx(drinks: number) {
  const i = STATUSES.findIndex(s => drinks >= s.min && drinks <= s.max);
  return i === -1 ? STATUSES.length - 1 : i;
}

function calcBillSplit(members: Member[]) {
  const total  = members.reduce((s, m) => s + (m.totalSpent ?? 0), 0);
  const share  = members.length > 0 ? total / members.length : 0;
  const bal    = members.map(m => ({ nick: m.nickname, bal: parseFloat(((m.totalSpent ?? 0) - share).toFixed(2)) }));
  const creds  = bal.filter(b => b.bal >  0.005).sort((a,b) => b.bal - a.bal);
  const debts  = bal.filter(b => b.bal < -0.005).sort((a,b) => a.bal - b.bal);
  const txns: { from: string; to: string; amount: number }[] = [];
  let ci = 0, di = 0;
  while (ci < creds.length && di < debts.length) {
    const amt = Math.min(creds[ci].bal, -debts[di].bal);
    txns.push({ from: debts[di].nick, to: creds[ci].nick, amount: parseFloat(amt.toFixed(2)) });
    creds[ci].bal  -= amt; debts[di].bal += amt;
    if (creds[ci].bal  < 0.005) ci++;
    if (debts[di].bal > -0.005) di++;
  }
  return { total, share, txns };
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = (params.id as string).toUpperCase();
  const { data: session, status: authStatus } = useSession();

  const [nickname, setNickname]   = useState<string | null>(null);
  const [joinNick, setJoinNick]   = useState("");
  const [room,    setRoom]        = useState<RoomData | null>(null);
  const [error,   setError]       = useState("");
  const [joining, setJoining]     = useState(false);
  const [drinkCount, setDrinkCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [drinkAnim,  setDrinkAnim]  = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [roomNotFound, setRoomNotFound] = useState(false);

  const [drinkTimestamps, setDrinkTimestamps] = useState<number[]>([]);
  const [showWaterReminder, setShowWaterReminder] = useState(false);
  const [showSlowDown,      setShowSlowDown]      = useState(false);

  // tabs & games
  const [activeTab,    setActiveTab]    = useState<"drinks"|"games"|"debts"|"total">("drinks");
  const [gamesScreen,  setGamesScreen]  = useState<"lobby"|"challenge"|"duel">("lobby");
  const [tappedAnswer, setTappedAnswer] = useState<number | null>(null);
  const [countdown,      setCountdown]      = useState(5);
  const [settlingDebt,   setSettlingDebt]   = useState<string | null>(null);
  const [selectedGame,   setSelectedGame]   = useState<"number-finder" | "shootout">("number-finder");
  const [shootoutIsGreen, setShootoutIsGreen] = useState(false);
  const [shotFired,      setShotFired]      = useState(false);
  const [gameError,    setGameError]    = useState("");
  const [showBillSplit, setShowBillSplit] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [sbMode,       setSbMode]       = useState<"default"|"custom">("default");
  const [sbQuestion,   setSbQuestion]   = useState("");
  const [sbSubmitted,  setSbSubmitted]  = useState(false);
  const [bottleAngle,  setBottleAngle]  = useState(0);
  const [bottleSpinning, setBottleSpinning] = useState(false);
  const [sbDismissed,  setSbDismissed]  = useState(false);
  const [showAddDrink,  setShowAddDrink]  = useState(false);
  const [newDrinkName,  setNewDrinkName]  = useState("");
  const [newDrinkPrice, setNewDrinkPrice] = useState("");
  const [newDrinkEmoji, setNewDrinkEmoji] = useState("🍺");
  const [addDrinkError, setAddDrinkError] = useState("");
  const [addDrinkLoading, setAddDrinkLoading] = useState(false);

  const pollRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waterTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notFoundCount  = useRef(0);
  const lastSuccessRef = useRef<number>(Date.now());
  const autoJoinedRef  = useRef(false);
  const hasGameRef     = useRef(false);
  const activeTabRef   = useRef<"drinks"|"games"|"debts"|"total">("drinks");

  // ── fetch ───────────────────────────────────────────────────────────────
  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (res.status === 404) {
        notFoundCount.current += 1;
        const timeSinceSuccess = Date.now() - lastSuccessRef.current;
        if (notFoundCount.current >= 10 && timeSinceSuccess > 30000) setRoomNotFound(true);
        return;
      }
      notFoundCount.current = 0;
      if (!res.ok) return;
      setRoomNotFound(false);
      lastSuccessRef.current = Date.now();
      const data: RoomData = await res.json();
      hasGameRef.current = !!(
        data.activeGame &&
        (data.activeGame.status === "active" || data.activeGame.status === "pending")
      );
      setRoom(data);
      const me = data.members.find(m => m.nickname === nickname);
      if (me) { setDrinkCount(me.drinks); setTotalSpent(me.totalSpent ?? 0); }
    } catch { /* ignore */ }
  }, [roomId, nickname]);

  useEffect(() => {
    const saved = localStorage.getItem(`tally_nick_${roomId}`);
    if (saved) setNickname(saved);
  }, [roomId]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (autoJoinedRef.current) return;
    if (localStorage.getItem(`tally_nick_${roomId}`)) return;
    const username = session?.user?.name;
    if (!username) return;
    autoJoinedRef.current = true;
    fetch(`/api/rooms/${roomId}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: username }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          localStorage.setItem(`tally_nick_${roomId}`, username);
          setNickname(username);
        }
      })
      .catch(() => {});
  }, [authStatus, session, roomId]);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    if (!nickname) return;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      await fetchRoom();
      if (cancelled) return;
      const onGamesTab = activeTabRef.current === "games";
      const delay = (onGamesTab || hasGameRef.current) ? 500 : 3000;
      pollRef.current = setTimeout(poll, delay);
    }

    poll();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [nickname, fetchRoom]);

  useEffect(() => () => { if (waterTimerRef.current) clearTimeout(waterTimerRef.current); }, []);

  // countdown timer
  useEffect(() => {
    const g = room?.activeGame;
    if (!g || g.status !== "active" || !g.startedAt || Date.now() >= g.startedAt) return;
    const tick = setInterval(() => {
      const left = g.startedAt! - Date.now();
      setCountdown(left <= 0 ? 0 : Math.ceil(left / 1000));
      if (left <= 0) clearInterval(tick);
    }, 100);
    return () => clearInterval(tick);
  }, [room?.activeGame?.id, room?.activeGame?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // reset per game
  useEffect(() => {
    setTappedAnswer(null);
    setShootoutIsGreen(false);
    setShotFired(false);
    if (room?.activeGame) setGamesScreen("duel");
  }, [room?.activeGame?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // reset spin bottle dismissed state on new game
  useEffect(() => {
    if (room?.spinBottleGame?.status === "collecting") setSbDismissed(false);
  }, [room?.spinBottleGame?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // shootout green-light timer
  useEffect(() => {
    const g = room?.activeGame;
    if (!g || g.type !== "shootout" || g.status !== "active" || !g.startedAt) return;
    const delay = g.startedAt - Date.now();
    if (delay <= 0) { setShootoutIsGreen(true); return; }
    const t = setTimeout(() => setShootoutIsGreen(true), delay);
    return () => clearTimeout(t);
  }, [room?.activeGame?.id, room?.activeGame?.startedAt, room?.activeGame?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── handlers ────────────────────────────────────────────────────────────
  async function handleJoin(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const name = joinNick.trim();
    if (!name) return setError("Enter a nickname!");
    setJoining(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nickname: name }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to join");
      localStorage.setItem(`tally_nick_${roomId}`, name);
      setNickname(name);
    } catch { setError("Network error"); } finally { setJoining(false); }
  }

  async function handleDrink(drinkName: string) {
    if (!nickname || !room || room.endedAt) return;
    const dt = room.drinkTypes.find(d => d.name === drinkName);
    const price = dt?.price ?? 0;
    const prevIdx = getStatusIdx(drinkCount);
    const newIdx  = getStatusIdx(drinkCount + 1);
    if (newIdx > prevIdx) {
      setShowWaterReminder(true);
      if (waterTimerRef.current) clearTimeout(waterTimerRef.current);
      waterTimerRef.current = setTimeout(() => setShowWaterReminder(false), 5000);
    }
    const now = Date.now();
    const recent = [...drinkTimestamps, now].filter(ts => now - ts < 8 * 60 * 1000);
    setDrinkTimestamps(recent);
    if (recent.length >= 3) setShowSlowDown(true);
    setDrinkCount(c => c + 1);
    setTotalSpent(s => Math.round((s + price) * 100) / 100);
    setDrinkAnim(true); setTimeout(() => setDrinkAnim(false), 400);
    try {
      const res = await fetch(`/api/rooms/${roomId}/drink`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nickname, drinkName }),
      });
      const data = await res.json();
      if (res.ok) { setDrinkCount(data.drinks); setTotalSpent(data.totalSpent ?? 0); fetchRoom(); }
    } catch {
      setDrinkCount(c => Math.max(0, c - 1));
      setTotalSpent(s => Math.max(0, Math.round((s - price) * 100) / 100));
    }
  }

  async function handleChallenge(challenged: string) {
    if (!nickname) return; setGameError("");
    const res = await fetch(`/api/rooms/${roomId}/game`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"challenge", nickname, challenged, gameType: selectedGame }),
    });
    const data = await res.json();
    if (!res.ok) { setGameError(data.error ?? "Error"); return; }
    setGamesScreen("duel");
    fetchRoom();
  }

  async function handleShoot() {
    if (!nickname || shotFired || !shootoutIsGreen) return;
    setShotFired(true);
    const res = await fetch(`/api/rooms/${roomId}/game`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"shoot", nickname }),
    });
    if (res.ok) fetchRoom();
  }

  async function handleAccept() {
    if (!nickname) return;
    await fetch(`/api/rooms/${roomId}/game`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"accept", nickname }),
    });
    setActiveTab("games");
    setGamesScreen("duel");
    fetchRoom();
  }

  async function handleDecline() {
    if (!nickname) return;
    await fetch(`/api/rooms/${roomId}/game`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"decline", nickname }),
    });
    fetchRoom();
  }

  async function handleAnswer(answer: number) {
    if (!nickname || tappedAnswer !== null) return;
    setTappedAnswer(answer);
    const res = await fetch(`/api/rooms/${roomId}/game`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"answer", nickname, answer }),
    });
    if (res.ok) fetchRoom();
  }

  async function handleSettle(debtId: string, drinkName: string) {
    if (!nickname) return;
    await fetch(`/api/rooms/${roomId}/debts`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ debtId, nickname, drinkName }),
    });
    setSettlingDebt(null);
    fetchRoom();
  }

  async function handleEndRoom() {
    if (!nickname) return;
    const res = await fetch(`/api/rooms/${roomId}/end`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ nickname }),
    });
    if (res.ok) { fetchRoom(); setShowBillSplit(false); }
  }

  async function handleCopyCode() {
    try { await navigator.clipboard.writeText(roomId); } catch { /* fallback */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function handleLeave() {
    setShowLeaveConfirm(true);
  }

  function confirmLeave() {
    localStorage.removeItem(`tally_nick_${roomId}`);
    router.push("/");
  }

  async function sbAction(action: string, extra?: object) {
    await fetch(`/api/rooms/${roomId}/spinbottle`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, nickname, ...extra }),
    });
    await fetchRoom();
  }

  async function handleSpin() {
    if (bottleSpinning) return;
    const res = await fetch(`/api/rooms/${roomId}/spinbottle`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "spin", nickname }),
    });
    const data = await res.json();
    if (!res.ok || !data.spinBottleGame?.currentTarget) return;

    const players = room?.members.map(m => m.nickname) ?? [];
    const targetIdx = players.indexOf(data.spinBottleGame.currentTarget);
    const targetDeg = -90 + (targetIdx / Math.max(players.length, 1)) * 360;
    const cur = bottleAngle % 360;
    const delta = ((targetDeg - cur + 360) % 360);
    setBottleSpinning(true);
    setBottleAngle(bottleAngle + 3 * 360 + delta);
    setTimeout(async () => { setBottleSpinning(false); await fetchRoom(); }, 2600);
  }

  async function handleAddDrinkType(e: React.FormEvent) {
    e.preventDefault();
    setAddDrinkError("");
    const name  = newDrinkName.trim().toUpperCase();
    const price = parseFloat(newDrinkPrice);
    if (!name) return setAddDrinkError("Enter a drink name!");
    if (isNaN(price) || price < 0) return setAddDrinkError("Enter a valid price!");
    setAddDrinkLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/drinks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, emoji: newDrinkEmoji }),
      });
      const data = await res.json();
      if (!res.ok) { setAddDrinkError(data.error ?? "Failed to add"); setAddDrinkLoading(false); return; }
      setNewDrinkName(""); setNewDrinkPrice(""); setNewDrinkEmoji("🍺");
      setShowAddDrink(false);
      await fetchRoom();
    } catch { setAddDrinkError("Network error"); }
    finally { setAddDrinkLoading(false); }
  }

  // ── room not found ───────────────────────────────────────────────────────
  if (roomNotFound) return (
    <main className="min-h-screen bg-pixel-bg flex flex-col items-center justify-center p-4 text-center">
      <div className="text-pixel-pink text-3xl font-pixel mb-4">GAME OVER</div>
      <div className="text-white text-xs font-pixel mb-8">ROOM NOT FOUND</div>
      <button className="pixel-btn pixel-btn-yellow" onClick={() => router.push("/")}>▶ MAIN MENU</button>
    </main>
  );

  // ── join form ────────────────────────────────────────────────────────────
  if (!nickname) {
    if (authStatus === "authenticated" && session?.user?.name) return (
      <main className="min-h-screen bg-pixel-bg flex items-center justify-center">
        <div className="text-pixel-green text-xs font-pixel animate-blink">JOINING...</div>
      </main>
    );
    return (
      <main className="min-h-screen bg-pixel-bg flex flex-col items-center justify-center p-4">
        <div className="text-pixel-green text-3xl font-pixel mb-2 drop-shadow-[0_0_12px_rgba(0,255,65,0.6)]">TALLY</div>
        <div className="text-[9px] text-gray-500 font-pixel mb-8">ROOM: <span className="text-pixel-yellow">{roomId}</span></div>
        <form onSubmit={handleJoin} className="pixel-card p-5 w-full max-w-sm flex flex-col gap-4 animate-slide-up">
          <div className="text-pixel-green text-xs font-pixel mb-1">▸ ENTER YOUR NAME</div>
          <div>
            <label className="block text-[9px] text-gray-400 font-pixel mb-2">NICKNAME</label>
            <input className="pixel-input" placeholder="PLAYER1" value={joinNick}
              onChange={e => setJoinNick(e.target.value)} maxLength={20} autoFocus />
          </div>
          {error && <div className="text-pixel-pink text-[9px] font-pixel">{error}</div>}
          <button type="submit" className="pixel-btn w-full" disabled={joining}>{joining ? "LOADING..." : "▶ ENTER ROOM"}</button>
          <button type="button" className="pixel-btn pixel-btn-pink w-full" onClick={() => router.push("/")}>✖ BACK</button>
        </form>
      </main>
    );
  }

  // ── derived values ───────────────────────────────────────────────────────
  const maxDrinks   = room?.members[0]?.drinks ?? 1;
  const myRank      = room ? room.members.findIndex(m => m.nickname === nickname) + 1 : 0;
  const drinkTypes  = room?.drinkTypes ?? [];
  const cols        = drinkTypes.length === 1 ? 1 : drinkTypes.length <= 4 ? 2 : 3;
  const statusIdx   = getStatusIdx(drinkCount);
  const curStatus   = STATUSES[statusIdx];
  const game        = room?.activeGame ?? null;
  const sbGame      = room?.spinBottleGame ?? null;
  const isHost      = sbGame?.createdBy === nickname;
  const iAmReady    = sbGame?.readyPlayers.includes(nickname ?? "") ?? false;
  const now         = Date.now();
  const isCountdown = game?.status === "active" && game.startedAt != null && game.startedAt > now;
  const isActive    = game?.status === "active" && game.startedAt != null && game.startedAt <= now;
  const isFinished  = game?.status === "finished";
  const isPending   = game?.status === "pending";
  const isTimedOut  = game?.status === "active" && !game.finishedAt && game.startedAt != null && now > game.startedAt + 30000;
  const iAmInGame   = game && (game.challenger === nickname || game.challenged === nickname);
  const myDebts     = (room?.debts ?? []).filter(d => d.from === nickname);
  const owedToMe    = (room?.debts ?? []).filter(d => d.to   === nickname);
  const billSplit   = room ? calcBillSplit(room.members) : null;
  const maxSpent    = room ? Math.max(...room.members.map(m => m.totalSpent ?? 0), 0.01) : 0.01;

  // ── room view ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-pixel-bg flex flex-col pb-4">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 py-3 border-b border-pixel-border">
        <div className="text-pixel-green text-base font-pixel drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]">TALLY</div>
        <button onClick={handleCopyCode}
          className="pixel-card px-3 py-2 text-[9px] font-pixel text-pixel-yellow cursor-pointer hover:opacity-80 transition-opacity">
          {copied ? "✔ COPIED!" : `# ${roomId}`}
        </button>
        <button onClick={handleLeave} className="text-[9px] font-pixel text-gray-500 hover:text-pixel-pink transition-colors">EXIT</button>
      </header>

      {/* ── Ended banner ── */}
      {room?.endedAt && (
        <div className="px-3 py-2 text-center" style={{ background:"#1a0a0a", borderBottom:"2px solid var(--pixel-pink)" }}>
          <span className="text-pixel-pink text-[9px] font-pixel">
            🎰 NIGHT ENDED — {new Date(room.endedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
          </span>
        </div>
      )}

      {/* ── Status bar ── */}
      <div className="px-3 py-2 border-b border-pixel-border" style={{ background:"rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontFamily:"initial" }} className="text-xl">{curStatus.emoji}</span>
          <span className="font-pixel text-[9px]" style={{ color:curStatus.color }}>{curStatus.label}</span>
          <span className="text-[8px] text-gray-500 font-pixel">{drinkCount} drinks</span>
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s, i) => (
            <div key={i} className="flex-1 h-2 transition-all duration-300" style={{
              background: i <= statusIdx ? s.color : "#1a1a2e",
              boxShadow: i === statusIdx ? `0 0 8px ${s.color}` : "none",
            }} />
          ))}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-pixel-border">
        {(["DRINKS","GAMES","DEBTS","TOTAL"] as const).map(tab => {
          const key = tab.toLowerCase() as "drinks"|"games"|"debts"|"total";
          const badge = tab === "DEBTS" && myDebts.length > 0;
          return (
            <button key={tab} onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 text-[8px] font-pixel transition-colors ${
                activeTab === key
                  ? "text-pixel-green border-b-2 border-pixel-green bg-black/20"
                  : "text-gray-500"
              }`}>
              {tab}{badge && <span className="ml-0.5 text-pixel-pink">({myDebts.length})</span>}
            </button>
          );
        })}
      </div>

      {/* ── Room name + player info ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-[9px] text-gray-400 font-pixel truncate">{room?.name ?? "..."}</div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-pixel-blue text-[10px] font-pixel truncate max-w-[60%]">▸ {nickname}</div>
          {myRank > 0 && (
            <div className="text-[9px] font-pixel text-gray-400">
              RANK: <span className={myRank <= 3 ? RANK_COLORS[myRank-1] : "text-white"}>#{myRank}</span>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DRINKS TAB */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "drinks" && (<>

        {/* My drink count */}
        <div className="mx-3 mb-3">
          <div className={`pixel-card-yellow p-4 text-center ${drinkAnim ? "animate-drink-pop" : ""}`}>
            <div className="text-[9px] text-gray-400 font-pixel mb-1">YOUR DRINKS</div>
            <div className="text-pixel-yellow text-5xl font-pixel drop-shadow-[0_0_12px_rgba(255,221,0,0.7)]">{drinkCount}</div>
            <div className="text-[9px] text-gray-500 font-pixel mt-1">🍺 × {drinkCount}</div>
            {totalSpent > 0 && <div className="text-pixel-green text-[9px] font-pixel mt-2">SPENT: {Math.round(totalSpent).toLocaleString()}₮</div>}
          </div>
        </div>

        {/* Drink buttons */}
        <div className="mx-3 mb-4">
          <div className="text-pixel-yellow text-[10px] font-pixel mb-2">▸ ADD DRINK</div>
          {room?.endedAt ? (
            <div className="text-pixel-pink text-[9px] font-pixel text-center py-4 pixel-card-pink p-3">
              🎰 NIGHT IS OVER — NO MORE DRINKS
            </div>
          ) : drinkTypes.length === 0 ? (
            <div className="text-gray-600 text-[8px] font-pixel text-center py-3">NO DRINKS CONFIGURED</div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns:`repeat(${cols}, 1fr)` }}>
              {drinkTypes.map((drink, idx) => (
                <button key={drink.name}
                  className={`drink-type-btn ${DRINK_BTN_COLORS[idx % DRINK_BTN_COLORS.length]}`}
                  onClick={() => handleDrink(drink.name)}>
                  <span className="text-3xl leading-none" style={{ fontFamily:"initial" }}>{drink.emoji ?? "🍺"}</span>
                  <span className="text-[10px] font-pixel leading-tight mt-1">{drink.name}</span>
                  <span className="text-[8px] font-pixel opacity-80">{Math.round(drink.price).toLocaleString()}₮</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add drink type */}
        {!room?.endedAt && drinkTypes.length < 8 && (
          <div className="mx-3 mb-4">
            {!showAddDrink ? (
              <button
                className="pixel-btn pixel-btn-blue w-full text-[9px]"
                onClick={() => { setShowAddDrink(true); setAddDrinkError(""); }}
              >
                + ADD DRINK TYPE
              </button>
            ) : (
              <form onSubmit={handleAddDrinkType} className="pixel-card p-4 flex flex-col gap-3">
                <div className="text-pixel-blue text-[9px] font-pixel">▸ NEW DRINK TYPE</div>
                <input
                  className="pixel-input"
                  placeholder="BEER"
                  value={newDrinkName}
                  onChange={e => setNewDrinkName(e.target.value.toUpperCase())}
                  maxLength={20}
                  autoFocus
                />
                <div className="flex flex-wrap gap-1">
                  {DRINK_EMOJIS.map(em => (
                    <button key={em} type="button"
                      onClick={() => setNewDrinkEmoji(em)}
                      style={{ fontFamily: "initial" }}
                      className={`text-xl px-1 py-0.5 border-2 ${newDrinkEmoji === em ? "border-pixel-green" : "border-transparent"}`}>
                      {em}
                    </button>
                  ))}
                </div>
                <input
                  className="pixel-input"
                  placeholder="PRICE (₮)"
                  type="number" min="0" step="0.01"
                  value={newDrinkPrice}
                  onChange={e => setNewDrinkPrice(e.target.value)}
                />
                {addDrinkError && <div className="text-pixel-pink text-[8px] font-pixel">{addDrinkError}</div>}
                <div className="flex gap-2">
                  <button type="submit" className="pixel-btn pixel-btn-yellow flex-1 text-[9px]" disabled={addDrinkLoading}>
                    {addDrinkLoading ? "..." : "✔ ADD"}
                  </button>
                  <button type="button" className="pixel-btn pixel-btn-pink flex-1 text-[9px]"
                    onClick={() => { setShowAddDrink(false); setAddDrinkError(""); }}>
                    ✖ CANCEL
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div className="mx-3 flex-1">
          <div className="text-pixel-pink text-[10px] font-pixel mb-2 drop-shadow-[0_0_8px_rgba(255,0,128,0.5)]">▸ LEADERBOARD</div>
          {!room ? (
            <div className="text-gray-500 text-[9px] font-pixel text-center py-4">LOADING<span className="blink">...</span></div>
          ) : room.members.length === 0 ? (
            <div className="text-gray-500 text-[9px] font-pixel text-center py-4">NO PLAYERS YET</div>
          ) : (
            <div className="flex flex-col gap-2">
              {room.members.map((member, idx) => {
                const isMe = member.nickname === nickname;
                const pct  = maxDrinks > 0 ? Math.round((member.drinks / maxDrinks) * 100) : 0;
                const mIdx = getStatusIdx(member.drinks);
                return (
                  <div key={member.nickname}
                    className={`p-3 animate-slide-up ${isMe ? "pixel-card-yellow" : "pixel-card"}`}
                    style={{ animationDelay:`${idx * 40}ms` }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{idx < 3 ? RANK_ICONS[idx] : `#${idx+1}`}</span>
                        <span className={`text-[9px] font-pixel truncate ${isMe ? "text-pixel-yellow" : "text-white"}`}>
                          {member.nickname}{isMe && " ◀"}
                        </span>
                        <span style={{ fontFamily:"initial" }} className="text-xs">{STATUSES[mIdx].emoji}</span>
                      </div>
                      <div className="flex flex-col items-end ml-2 flex-shrink-0">
                        <span className={`text-xs font-pixel ${idx < 3 ? RANK_COLORS[idx] : "text-white"}`}>{member.drinks} 🍺</span>
                        {(member.totalSpent ?? 0) > 0 && (
                          <span className="text-[8px] font-pixel text-pixel-green">{Math.round(member.totalSpent ?? 0).toLocaleString()}₮</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-black/40 overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${isMe ? "bg-pixel-yellow" : "bg-pixel-green"}`}
                        style={{ width:`${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>)}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* GAMES TAB */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "games" && (
        <div className="mx-3 mt-2 flex-1">

          {/* Lobby */}
          {gamesScreen === "lobby" && (!game || game.status === "finished") && (
            <div className="flex flex-col gap-3">
              <div className="text-pixel-green text-[10px] font-pixel mb-1">▸ MINI GAMES</div>
              {/* Number Finder */}
              <div className="pixel-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-pixel-yellow text-[10px] font-pixel mb-1">
                      <span style={{ fontFamily:"initial" }}>🎯</span> NUMBER FINDER
                    </div>
                    <div className="text-[8px] text-gray-400 font-pixel leading-relaxed">
                      TAP THE TARGET NUMBER FIRST.<br />LOSER BUYS A ROUND.
                    </div>
                  </div>
                  <button className="pixel-btn pixel-btn-yellow flex-shrink-0 text-[8px]"
                    style={{ padding:"10px 14px" }}
                    onClick={() => { setSelectedGame("number-finder"); setGamesScreen("challenge"); }}>
                    PLAY ▶
                  </button>
                </div>
              </div>
              {/* Wild West Shootout */}
              <div className="pixel-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-pixel-yellow text-[10px] font-pixel mb-1">
                      <span style={{ fontFamily:"initial" }}>🤠</span> WILD WEST
                    </div>
                    <div className="text-[8px] text-gray-400 font-pixel leading-relaxed">
                      WAIT FOR THE GREEN.<br />SHOOT FIRST. LOSER DRINKS.
                    </div>
                  </div>
                  <button className="pixel-btn pixel-btn-pink flex-shrink-0 text-[8px]"
                    style={{ padding:"10px 14px" }}
                    onClick={() => { setSelectedGame("shootout"); setGamesScreen("challenge"); }}>
                    PLAY ▶
                  </button>
                </div>
              </div>
              {/* Spin the Bottle */}
              {!sbGame || sbGame.status === "finished" ? (
                <div className="pixel-card p-4" style={{ borderColor:"#9b59b6" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-pixel mb-1" style={{ color:"#9b59b6" }}>
                        <span style={{ fontFamily:"initial" }}>🍾</span> SPIN THE BOTTLE
                      </div>
                      <div className="text-[8px] text-gray-400 font-pixel leading-relaxed">
                        GROUP GAME. SPIN &amp; ANSWER<br />QUESTIONS. NO ESCAPE.
                      </div>
                      <div className="flex gap-2 mt-2">
                        {(["default","custom"] as const).map(m => (
                          <button key={m} type="button"
                            className="text-[7px] font-pixel px-2 py-1 border"
                            style={{ borderColor: sbMode===m ? "#9b59b6":"#2a2a5e", color: sbMode===m ? "#9b59b6":"#555" }}
                            onClick={() => setSbMode(m)}>
                            {m === "default" ? "20 BUILT-IN" : "CUSTOM Q"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button className="pixel-btn flex-shrink-0 text-[8px]"
                      style={{ padding:"10px 14px", borderColor:"#9b59b6", color:"#9b59b6" }}
                      onClick={() => sbAction("create", { mode: sbMode })}>
                      PLAY ▶
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Challenge: pick opponent */}
          {gamesScreen === "challenge" && (
            <div className="flex flex-col gap-3">
              <div className="text-pixel-green text-[10px] font-pixel mb-1">
                ▸ {selectedGame === "shootout" ? "🤠 WILD WEST" : "🎯 NUMBER FINDER"} — PICK OPPONENT
              </div>
              {gameError && <div className="text-pixel-pink text-[9px] font-pixel">{gameError}</div>}
              {room?.members.filter(m => m.nickname !== nickname).map(m => (
                <div key={m.nickname} className="pixel-card px-3 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily:"initial" }}>{STATUSES[getStatusIdx(m.drinks)].emoji}</span>
                    <div>
                      <div className="text-[9px] font-pixel text-white">{m.nickname}</div>
                      <div className="text-[8px] font-pixel" style={{ color: STATUSES[getStatusIdx(m.drinks)].color }}>
                        {STATUSES[getStatusIdx(m.drinks)].label}
                      </div>
                    </div>
                  </div>
                  <button className="pixel-btn pixel-btn-pink text-[8px]" style={{ padding:"8px 12px" }}
                    onClick={() => handleChallenge(m.nickname)}>
                    ⚔ DUEL
                  </button>
                </div>
              ))}
              {(room?.members.filter(m => m.nickname !== nickname).length ?? 0) === 0 && (
                <div className="text-gray-500 text-[9px] font-pixel text-center py-4">NO OTHER PLAYERS IN ROOM</div>
              )}
              <button className="pixel-btn pixel-btn-pink w-full" onClick={() => { setGamesScreen("lobby"); setGameError(""); }}>◀ BACK</button>
            </div>
          )}

          {/* Duel screens */}
          {gamesScreen === "duel" && game && (<>

            {/* Pending — challenger waiting */}
            {isPending && game.challenger === nickname && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="text-pixel-yellow text-[10px] font-pixel">⚔ CHALLENGE SENT</div>
                <div className="text-[9px] text-gray-400 font-pixel">
                  WAITING FOR <span className="text-pixel-blue">{game.challenged}</span><span className="blink">...</span>
                </div>
                <button className="pixel-btn pixel-btn-pink w-full" onClick={handleDecline}>✖ CANCEL</button>
              </div>
            )}

            {/* Pending — others see lobby while waiting */}
            {isPending && game.challenger !== nickname && game.challenged !== nickname && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="text-[9px] text-gray-500 font-pixel">
                  {game.challenger} VS {game.challenged}<br />DUEL IN PROGRESS...
                </div>
                <button className="pixel-btn pixel-btn-yellow w-full" onClick={() => setGamesScreen("lobby")}>◀ LOBBY</button>
              </div>
            )}

            {/* ── NUMBER FINDER: Countdown ── */}
            {isCountdown && iAmInGame && game.type === "number-finder" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="text-[9px] text-gray-400 font-pixel">{game.challenger} VS {game.challenged}</div>
                <div className="text-pixel-yellow font-pixel drop-shadow-[0_0_20px_rgba(255,221,0,0.9)]"
                  style={{ fontSize:"6rem", lineHeight:1 }}>
                  {countdown || "GO!"}
                </div>
                <div className="text-[9px] text-gray-500 font-pixel">GET READY<span className="blink">...</span></div>
              </div>
            )}

            {/* ── NUMBER FINDER: Active number grid ── */}
            {isActive && !isTimedOut && iAmInGame && game.type === "number-finder" && (
              <div className="flex flex-col gap-4 py-2">
                <div className="text-center">
                  <div className="text-[9px] text-gray-400 font-pixel mb-2">TARGET TO HIT:</div>
                  <div className="inline-block px-6 py-4 pixel-card-yellow">
                    <span className="text-pixel-yellow font-pixel drop-shadow-[0_0_16px_rgba(255,221,0,0.8)]"
                      style={{ fontSize:"3.5rem", lineHeight:1 }}>
                      {game.target}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {game.choices.map(num => {
                    const tapped  = tappedAnswer === num;
                    const correct = tapped && num === game.target;
                    const wrong   = tapped && num !== game.target;
                    return (
                      <button key={num}
                        className={`game-num-btn ${correct ? "game-num-btn-correct" : wrong ? "game-num-btn-wrong" : ""}`}
                        disabled={tappedAnswer !== null}
                        onClick={() => handleAnswer(num)}>
                        {num}
                      </button>
                    );
                  })}
                </div>
                <div className="text-center text-[8px] text-gray-500 font-pixel italic">
                  &quot;Draw fast, or be history.&quot;
                </div>
              </div>
            )}

            {/* ── SHOOTOUT: Red — HOLD! ── */}
            {game.type === "shootout" && game.status === "active" && iAmInGame && !shootoutIsGreen && !isFinished && (
              <div className="flex flex-col items-center justify-center gap-5 text-center"
                style={{ background:"#cc0000", minHeight:"280px", margin:"0 -0.75rem", padding:"2rem 1rem" }}>
                <div className="text-white font-pixel" style={{ fontSize:"3rem", lineHeight:1, textShadow:"4px 4px 0 #6a0000" }}>
                  HOLD!
                </div>
                <div className="text-[10px] font-pixel" style={{ color:"#ffaaaa" }}>
                  DON&apos;T SHOOT YET<span className="blink">...</span>
                </div>
                <div className="text-[9px] font-pixel" style={{ color:"#ff7777" }}>
                  {game.challenger} VS {game.challenged}
                </div>
              </div>
            )}

            {/* ── SHOOTOUT: Green — DRAW! ── */}
            {game.type === "shootout" && iAmInGame && shootoutIsGreen && !isFinished && (
              <div className="flex flex-col items-center justify-center gap-5 py-8 text-center"
                style={{ background:"#00ff41", minHeight:"280px", margin:"0 -0.75rem" }}>
                <div className="text-black font-pixel" style={{ fontSize:"3rem", lineHeight:1, textShadow:"4px 4px 0 #007a20" }}>
                  DRAW!
                </div>
                <button
                  disabled={shotFired}
                  onClick={handleShoot}
                  className="font-pixel text-black"
                  style={{
                    background: shotFired ? "#888" : "#000",
                    color: shotFired ? "#444" : "#00ff41",
                    padding: "24px 40px",
                    fontSize: "1.4rem",
                    border: "none",
                    boxShadow: shotFired ? "none" : "0 8px 0 #003310, 0 10px 0 rgba(0,0,0,0.5)",
                    cursor: shotFired ? "not-allowed" : "pointer",
                    transition: "transform 0.05s",
                    fontFamily: "'Press Start 2P', cursive",
                    userSelect: "none",
                  }}>
                  <span style={{ fontFamily:"initial" }}>🔫</span> {shotFired ? "SHOT!" : "SHOOT!"}
                </button>
              </div>
            )}

            {/* ── SHOOTOUT: Spectating ── */}
            {game.type === "shootout" && game.status === "active" && !iAmInGame && (
              <div className="flex flex-col items-center gap-3 py-6 text-center"
                style={{ background: shootoutIsGreen ? "#00ff41" : "#cc0000", transition:"background 0.15s", minHeight:"160px", justifyContent:"center" }}>
                <div className="font-pixel text-[10px]" style={{ color: shootoutIsGreen ? "#000" : "#fff", textShadow: shootoutIsGreen ? "none" : "2px 2px 0 #6a0000" }}>
                  {shootoutIsGreen ? "DRAW!" : "HOLD!"}
                </div>
                <div className="text-[8px] font-pixel" style={{ color: shootoutIsGreen ? "#003310" : "#ffaaaa" }}>
                  {game.challenger} VS {game.challenged}
                </div>
              </div>
            )}

            {/* ── Timed out (number-finder only) ── */}
            {isTimedOut && game.type === "number-finder" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="text-pixel-yellow text-[10px] font-pixel">&#9201; TIME&apos;S UP!</div>
                <div className="text-[9px] text-gray-400 font-pixel">NOBODY WINS THIS ROUND</div>
                <button className="pixel-btn pixel-btn-yellow w-full" onClick={() => setGamesScreen("lobby")}>PLAY AGAIN</button>
              </div>
            )}

            {/* ── Finished (both game types) ── */}
            {isFinished && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="text-4xl" style={{ fontFamily:"initial" }}>
                  {game.type === "shootout" ? "🏆" : "🏆"}
                </div>
                <div className="text-pixel-yellow text-xs font-pixel">{game.winner} WINS!</div>
                {game.type === "shootout" && game.winner === nickname && (
                  <div className="text-[9px] text-pixel-green font-pixel">
                    FASTEST DRAW IN THE WEST <span style={{ fontFamily:"initial" }}>🤠</span>
                  </div>
                )}
                {game.type === "shootout" && game.winner !== nickname && iAmInGame && (
                  <div className="text-[9px] text-pixel-pink font-pixel">
                    YOU WERE TOO SLOW <span style={{ fontFamily:"initial" }}>💀</span>
                  </div>
                )}
                <div className="text-[9px] text-gray-400 font-pixel">
                  {game.winner === game.challenger ? game.challenged : game.challenger} OWES A DRINK <span style={{ fontFamily:"initial" }}>🍺</span>
                </div>
                <button className="pixel-btn pixel-btn-yellow w-full"
                  onClick={() => { setGamesScreen("lobby"); fetchRoom(); }}>
                  PLAY AGAIN
                </button>
              </div>
            )}

            {/* Non-participant watching — number-finder only (shootout has its own spectator block) */}
            {game.type === "number-finder" && (isActive || isCountdown) && !iAmInGame && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="text-[9px] text-gray-400 font-pixel">
                  ⚔ {game.challenger} VS {game.challenged}
                </div>
                <div className="text-[8px] text-gray-600 font-pixel">SPECTATING...</div>
              </div>
            )}
          </>)}

          {/* No game, back to lobby button */}
          {!game && gamesScreen === "duel" && (
            <button className="pixel-btn pixel-btn-yellow w-full mt-4" onClick={() => setGamesScreen("lobby")}>◀ LOBBY</button>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DEBTS TAB */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "debts" && (
        <div className="mx-3 mt-2 flex-1 flex flex-col gap-4">
          {myDebts.length === 0 && owedToMe.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2" style={{ fontFamily:"initial" }}>🎉</div>
              <div className="text-pixel-green text-[9px] font-pixel">NO DEBTS!</div>
              <div className="text-[8px] text-gray-500 font-pixel mt-1">YOU&apos;RE EVEN</div>
            </div>
          ) : (<>
            {myDebts.length > 0 && (
              <div>
                <div className="text-pixel-pink text-[10px] font-pixel mb-2">▸ YOU OWE</div>
                <div className="flex flex-col gap-2">
                  {myDebts.map(d => (
                    <div key={d.id} className="pixel-card-pink p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white text-[9px] font-pixel">{d.to}</div>
                          <div className="text-[8px] text-gray-400 font-pixel mt-0.5">🍺 ×1 from game</div>
                        </div>
                        {settlingDebt !== d.id && (
                          <button className="pixel-btn pixel-btn-yellow text-[8px]" style={{ padding:"8px 12px" }}
                            onClick={() => setSettlingDebt(d.id)}>
                            🍺 SEND DRINK
                          </button>
                        )}
                        {settlingDebt === d.id && (
                          <button className="pixel-btn pixel-btn-pink text-[8px]" style={{ padding:"8px 12px" }}
                            onClick={() => setSettlingDebt(null)}>
                            ✖ CANCEL
                          </button>
                        )}
                      </div>
                      {settlingDebt === d.id && (
                        <div>
                          <div className="text-[8px] text-gray-400 font-pixel mb-2">PICK A DRINK TO SEND TO {d.to}:</div>
                          <div className="grid grid-cols-3 gap-2">
                            {(room?.drinkTypes ?? []).map((dt, idx) => (
                              <button key={dt.name}
                                className={`drink-type-btn ${DRINK_BTN_COLORS[idx % DRINK_BTN_COLORS.length]}`}
                                style={{ padding:"14px 6px" }}
                                onClick={() => handleSettle(d.id, dt.name)}>
                                <span className="text-2xl leading-none" style={{ fontFamily:"initial" }}>{dt.emoji ?? "🍺"}</span>
                                <span className="text-[8px] font-pixel leading-tight mt-1">{dt.name}</span>
                                <span className="text-[7px] font-pixel opacity-80">{Math.round(dt.price).toLocaleString()}₮</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {owedToMe.length > 0 && (
              <div>
                <div className="text-pixel-green text-[10px] font-pixel mb-2">▸ OWED TO YOU</div>
                <div className="flex flex-col gap-2">
                  {owedToMe.map(d => (
                    <div key={d.id} className="pixel-card p-3">
                      <div className="text-white text-[9px] font-pixel">{d.from}</div>
                      <div className="text-[8px] text-pixel-green font-pixel mt-0.5">owes you 🍺 ×1</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TOTAL TAB */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "total" && billSplit && (
        <div className="mx-3 mt-2 flex-1 flex flex-col gap-4">
          <div className="text-pixel-yellow text-[10px] font-pixel">▸ ROOM TOTAL</div>

          {/* Spend breakdown */}
          <div className="flex flex-col gap-2">
            {(room?.members ?? []).map((m, idx) => {
              const pct = maxSpent > 0 ? Math.round(((m.totalSpent ?? 0) / maxSpent) * 100) : 0;
              return (
                <div key={m.nickname} className={`p-3 ${m.nickname === nickname ? "pixel-card-yellow" : "pixel-card"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{idx < 3 ? RANK_ICONS[idx] : `#${idx+1}`}</span>
                      <span className={`text-[9px] font-pixel truncate ${m.nickname === nickname ? "text-pixel-yellow" : "text-white"}`}>
                        {m.nickname}
                      </span>
                    </div>
                    <div className="flex flex-col items-end ml-2 flex-shrink-0">
                      <span className="text-[9px] font-pixel text-white">{m.drinks} 🍺</span>
                      <span className="text-[8px] font-pixel text-pixel-green">{Math.round(m.totalSpent ?? 0).toLocaleString()}₮</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-black/40 overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${m.nickname === nickname ? "bg-pixel-yellow" : "bg-pixel-green"}`}
                      style={{ width:`${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="pixel-card p-4 flex flex-col gap-1">
            <div className="flex justify-between text-[9px] font-pixel">
              <span className="text-gray-400">ROOM TOTAL</span>
              <span className="text-white">{Math.round(billSplit.total).toLocaleString()}₮</span>
            </div>
            <div className="flex justify-between text-[9px] font-pixel">
              <span className="text-gray-400">EQUAL SHARE</span>
              <span className="text-pixel-yellow">{Math.round(billSplit.share).toLocaleString()}₮</span>
            </div>
          </div>

          {/* Ended: show final settlements */}
          {room?.endedAt ? (
            <div>
              <div className="text-pixel-pink text-[10px] font-pixel mb-2">▸ FINAL SETTLEMENTS</div>
              {billSplit.txns.length === 0 ? (
                <div className="text-pixel-green text-[9px] font-pixel text-center py-2">EVERYONE SPENT EQUALLY 🎉</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {billSplit.txns.map((t, i) => (
                    <div key={i} className="pixel-card p-3 flex items-center justify-between">
                      <div className="text-[9px] font-pixel">
                        <span className="text-pixel-pink">{t.from}</span>
                        <span className="text-gray-500"> → </span>
                        <span className="text-pixel-green">{t.to}</span>
                      </div>
                      <span className="text-pixel-yellow text-[9px] font-pixel">{Math.round(t.amount).toLocaleString()}₮</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button className="pixel-btn pixel-btn-pink w-full"
              onClick={() => setShowBillSplit(true)}
              disabled={billSplit.total === 0}>
              💰 CLOSE OUT THE NIGHT
            </button>
          )}
        </div>
      )}

      {/* ── Challenge incoming banner ── */}
      {isPending && game?.challenged === nickname && (
        <div className="fixed top-0 left-0 right-0 z-50 p-3 animate-slide-up"
          style={{ background:"#0d0d1a", borderBottom:"3px solid var(--pixel-pink)" }}>
          <div className="text-[9px] font-pixel text-pixel-pink mb-2">
            <span style={{ fontFamily:"initial" }}>⚔️</span> {game.challenger} CHALLENGES YOU!
          </div>
          <div className="flex gap-2">
            <button className="pixel-btn flex-1 text-[9px]" style={{ padding:"10px" }} onClick={handleAccept}>✔ ACCEPT</button>
            <button className="pixel-btn pixel-btn-pink flex-1 text-[9px]" style={{ padding:"10px" }} onClick={handleDecline}>✖ DECLINE</button>
          </div>
        </div>
      )}

      {/* ── Bill split modal ── */}
      {showBillSplit && billSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="pixel-card p-5 max-w-xs w-full animate-slide-up" style={{ borderColor:"var(--pixel-yellow)", boxShadow:"4px 4px 0 #8a7500" }}>
            <div className="text-pixel-yellow text-xs font-pixel mb-4 text-center">▸ SETTLE UP</div>
            {billSplit.txns.length === 0 ? (
              <div className="text-pixel-green text-[9px] font-pixel text-center mb-4">EVERYONE SPENT EQUALLY 🎉</div>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                <div className="text-[8px] text-gray-500 font-pixel mb-1">TO SPLIT EVENLY, PAY:</div>
                {billSplit.txns.map((t, i) => (
                  <div key={i} className="flex items-center justify-between pixel-card px-3 py-2">
                    <div className="text-[8px] font-pixel">
                      <span className="text-pixel-pink">{t.from}</span>
                      <span className="text-gray-500"> → </span>
                      <span className="text-pixel-green">{t.to}</span>
                    </div>
                    <span className="text-pixel-yellow text-[9px] font-pixel">{Math.round(t.amount).toLocaleString()}₮</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button className="pixel-btn w-full" onClick={handleEndRoom}>✔ END THE NIGHT</button>
              <button className="pixel-btn pixel-btn-pink w-full" onClick={() => setShowBillSplit(false)}>✖ KEEP DRINKING</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave confirmation ── */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="pixel-card p-5 max-w-xs w-full text-center animate-slide-up" style={{ borderColor:"#ff0080" }}>
            <div className="text-pixel-pink text-xs font-pixel mb-3">LEAVE ROOM?</div>
            <div className="text-[9px] text-gray-400 font-pixel mb-5 leading-relaxed">
              YOU CAN REJOIN WITH THE SAME NICKNAME LATER.
            </div>
            <div className="flex gap-3">
              <button className="pixel-btn pixel-btn-pink flex-1" onClick={confirmLeave}>✔ LEAVE</button>
              <button className="pixel-btn flex-1" onClick={() => setShowLeaveConfirm(false)}>✖ STAY</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Water reminder ── */}
      {showWaterReminder && (
        <div className="fixed bottom-6 left-3 right-3 z-40 animate-slide-up">
          <div className="pixel-card p-3 text-center" style={{ borderColor:"#00d4ff", boxShadow:"4px 4px 0 #007a90" }}>
            <span style={{ fontFamily:"initial" }} className="text-2xl">💧</span>
            <div className="text-[9px] font-pixel mt-1" style={{ color:"#00d4ff" }}>DRINK SOME WATER!</div>
            <div className="text-[8px] text-gray-500 font-pixel mt-1">STAY HYDRATED</div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SPIN THE BOTTLE OVERLAY — shown over any tab                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {sbGame && (sbGame.status === "collecting" || sbGame.status === "active" || (sbGame.status === "finished" && !sbDismissed)) && (
        <div className="fixed inset-0 flex flex-col" style={{ background: "#07071a", zIndex: 55 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "2px solid #9b59b6" }}>
            <div className="font-pixel text-[10px]" style={{ color: "#9b59b6" }}>
              <span style={{ fontFamily: "initial" }}>🍾</span> SPIN THE BOTTLE
            </div>
            <div className="flex items-center gap-3">
              {sbGame.status === "collecting" && isHost && (
                <button className="font-pixel text-[8px] text-gray-500 hover:text-pixel-pink"
                  onClick={() => sbAction("end")}>
                  ✖ CANCEL
                </button>
              )}
              {sbGame.status === "active" && isHost && (
                <button className="font-pixel text-[8px]" style={{ color: "#ff0080" }}
                  onClick={() => sbAction("end")}>
                  ✖ END
                </button>
              )}
              {sbGame.status === "finished" && (
                <button className="font-pixel text-[9px] text-gray-400"
                  onClick={() => setSbDismissed(true)}>
                  ✖ CLOSE
                </button>
              )}
            </div>
          </div>

          {/* ── Collecting phase ── */}
          {sbGame.status === "collecting" && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="text-center text-[8px] text-gray-500 font-pixel">
                {sbGame.mode === "custom" ? "SUBMIT YOUR QUESTION THEN MARK READY" : "MARK READY WHEN SET"}
              </div>

              {sbGame.mode === "custom" && (
                <div className="p-4" style={{ border: "2px solid #9b59b6", background: "#0f0a1e" }}>
                  <div className="text-[8px] text-gray-400 font-pixel mb-2">YOUR QUESTION:</div>
                  {(sbSubmitted || sbGame.playerQuestions[nickname ?? ""]) ? (
                    <div className="text-[9px] font-pixel" style={{ color: "#9b59b6" }}>
                      ✔ &quot;{sbGame.playerQuestions[nickname ?? ""]}&quot;
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <textarea
                        className="pixel-input w-full text-[8px]"
                        style={{ minHeight: "60px", resize: "none" }}
                        placeholder="TYPE YOUR QUESTION..."
                        value={sbQuestion}
                        onChange={e => setSbQuestion(e.target.value)}
                        maxLength={200}
                      />
                      <button
                        className="pixel-btn w-full text-[8px]"
                        style={{ borderColor: "#9b59b6", color: "#9b59b6" }}
                        disabled={!sbQuestion.trim()}
                        onClick={async () => {
                          await sbAction("submit_question", { question: sbQuestion });
                          setSbSubmitted(true);
                        }}>
                        ✔ SUBMIT
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4" style={{ border: "2px solid #2a2a5e", background: "#0a0a1a" }}>
                <div className="text-[8px] text-gray-500 font-pixel mb-3">
                  READY — {sbGame.readyPlayers.length} / {room?.members.length ?? 0}
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                  {(room?.members ?? []).map(m => {
                    const ready = sbGame.readyPlayers.includes(m.nickname);
                    const isMe = m.nickname === nickname;
                    return (
                      <div key={m.nickname} className="flex items-center gap-2">
                        <div style={{
                          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                          background: ready ? "#9b59b6" : "transparent",
                          border: "2px solid " + (ready ? "#9b59b6" : "#333"),
                        }} />
                        <span className="font-pixel text-[7px] truncate"
                          style={{ color: isMe ? "#d4a1f0" : ready ? "#aaa" : "#555" }}>
                          {m.nickname}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {!iAmReady ? (
                  <button
                    className="pixel-btn w-full"
                    style={{ borderColor: "#9b59b6", color: "#9b59b6" }}
                    disabled={sbGame.mode === "custom" && !sbGame.playerQuestions[nickname ?? ""]}
                    onClick={() => sbAction("ready")}>
                    ✔ I&apos;M READY
                  </button>
                ) : (
                  <div className="text-center text-[9px] font-pixel py-2" style={{ color: "#9b59b6" }}>
                    WAITING FOR OTHERS<span className="blink">...</span>
                  </div>
                )}
                {isHost && (
                  <button className="pixel-btn pixel-btn-yellow w-full"
                    onClick={() => sbAction("force_start")}>
                    ▶ FORCE START
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Active phase ── */}
          {sbGame.status === "active" && (() => {
            const players = room?.members.map(m => m.nickname) ?? [];
            const n = Math.max(players.length, 1);
            const SIZE = 280;
            const half = SIZE / 2;
            const circleR = 105;
            const bubbleR = 26;
            const needleLen = circleR - bubbleR - 8;
            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Circle */}
                <div className="flex-1 flex items-center justify-center py-3">
                  <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>

                    {/* Player bubbles */}
                    {players.map((p, i) => {
                      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                      const px = half + circleR * Math.cos(angle);
                      const py = half + circleR * Math.sin(angle);
                      const isTarget = sbGame.currentTarget === p;
                      const isMe = p === nickname;
                      return (
                        <div key={p} style={{
                          position: "absolute",
                          left: px - bubbleR, top: py - bubbleR,
                          width: bubbleR * 2, height: bubbleR * 2,
                          borderRadius: "50%",
                          background: isTarget ? "#9b59b6" : "#0d0d20",
                          border: `2px solid ${isTarget ? "#d4a1f0" : isMe ? "#5a3a8a" : "#2a2a5e"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: isTarget ? "0 0 18px #9b59b6, 0 0 36px rgba(155,89,182,0.35)" : "none",
                          transition: "all 0.4s ease",
                        }}>
                          <span style={{
                            fontFamily: "'Press Start 2P', cursive",
                            fontSize: 5, color: isTarget ? "#fff" : isMe ? "#9b7abf" : "#444",
                            textAlign: "center", lineHeight: 1.4,
                            maxWidth: bubbleR * 2 - 8, overflow: "hidden", wordBreak: "break-all",
                          }}>
                            {p.length > 6 ? p.slice(0, 6) : p}
                          </span>
                        </div>
                      );
                    })}

                    {/* Spinning needle */}
                    <div style={{
                      position: "absolute", left: half, top: half,
                      width: 0, height: 0,
                      transform: `rotate(${bottleAngle}deg)`,
                      transition: bottleSpinning
                        ? "transform 2.5s cubic-bezier(0.17,0.67,0.12,1)"
                        : "none",
                    }}>
                      {/* Tip (up) */}
                      <div style={{
                        position: "absolute", left: -4, bottom: 8,
                        width: 8, height: needleLen,
                        background: "linear-gradient(to bottom, #e0b0ff, #9b59b6)",
                        borderRadius: "4px 4px 0 0",
                      }} />
                      {/* Tail (down) */}
                      <div style={{
                        position: "absolute", left: -3, top: 8,
                        width: 6, height: needleLen * 0.35,
                        background: "#3a1a5e",
                        borderRadius: "0 0 3px 3px",
                      }} />
                    </div>

                    {/* Center pin */}
                    <div style={{
                      position: "absolute", left: half - 11, top: half - 11,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#9b59b6",
                      border: "3px solid #d4a1f0",
                      boxShadow: "0 0 14px rgba(155,89,182,0.9)",
                      zIndex: 2,
                    }} />
                  </div>
                </div>

                {/* Question + controls */}
                <div className="px-4 pb-5 flex-shrink-0 flex flex-col gap-3">
                  {sbGame.currentTarget && sbGame.currentQuestion && !bottleSpinning ? (
                    <div className="p-4 text-center animate-slide-up" style={{
                      border: "2px solid #9b59b6", background: "#0f0a1e",
                      boxShadow: "4px 4px 0 #3a1a5e",
                    }}>
                      <div className="text-[8px] text-gray-500 font-pixel mb-2">
                        <span style={{ color: "#d4a1f0" }}>{sbGame.currentTarget}</span> MUST ANSWER:
                      </div>
                      <div className="text-[9px] font-pixel leading-loose" style={{ color: "#e0c0ff" }}>
                        &quot;{sbGame.currentQuestion}&quot;
                      </div>
                    </div>
                  ) : !bottleSpinning && (
                    <div className="text-center text-[8px] text-gray-600 font-pixel py-2">
                      {isHost ? "PRESS SPIN TO START" : `WAITING FOR ${sbGame.createdBy.toUpperCase()} TO SPIN...`}
                    </div>
                  )}
                  {isHost ? (
                    <button
                      className="pixel-btn w-full"
                      style={{ borderColor: bottleSpinning ? "#3a1a5e" : "#9b59b6", color: bottleSpinning ? "#3a1a5e" : "#9b59b6" }}
                      disabled={bottleSpinning}
                      onClick={handleSpin}>
                      <span style={{ fontFamily: "initial" }}>🍾</span>{bottleSpinning ? " SPINNING..." : " SPIN"}
                    </button>
                  ) : (
                    <div className="text-center text-[8px] text-gray-600 font-pixel">
                      {sbGame.createdBy.toUpperCase()} IS THE HOST
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Finished phase ── */}
          {sbGame.status === "finished" && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              <div className="text-center py-3">
                <div className="text-2xl mb-2" style={{ fontFamily: "initial" }}>🍾</div>
                <div className="text-[10px] font-pixel mb-1" style={{ color: "#9b59b6" }}>GAME OVER</div>
                <div className="text-[8px] text-gray-600 font-pixel">{sbGame.history.length} ROUNDS PLAYED</div>
              </div>
              {sbGame.history.length === 0 ? (
                <div className="text-center text-gray-600 text-[8px] font-pixel py-4">NO SPINS YET</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...sbGame.history].reverse().map((h, i) => (
                    <div key={i} className="p-3" style={{ border: "2px solid #2a1a4e", background: "#0a081a" }}>
                      <div className="font-pixel text-[8px] mb-1" style={{ color: "#d4a1f0" }}>
                        {sbGame.history.length - i}. {h.target}
                      </div>
                      <div className="text-[7px] text-gray-500 font-pixel leading-relaxed">
                        &quot;{h.question}&quot;
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── Slow-down modal ── */}
      {showSlowDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="pixel-card-pink p-5 max-w-xs w-full text-center animate-slide-up">
            <div className="text-4xl mb-3" style={{ fontFamily:"initial" }}>⚠️</div>
            <div className="text-pixel-pink text-xs font-pixel mb-3">SLOW DOWN!</div>
            <div className="text-[9px] text-gray-300 font-pixel mb-4 leading-relaxed">
              3 DRINKS IN 8 MINUTES. TAKE A BREAK AND DRINK SOME WATER FIRST.
            </div>
            <button className="pixel-btn pixel-btn-blue w-full" onClick={() => setShowSlowDown(false)}>
              <span style={{ fontFamily:"initial" }}>💧</span> GOT IT
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
