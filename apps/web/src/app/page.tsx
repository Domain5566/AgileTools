"use client";

import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

const CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "?"] as const;

type RoomSnapshot = {
  roomCode: string;
  phase: string;
  round: 1 | 2 | 3;
  thinkSeconds: number;
  thinkRemainingSeconds: number | null;
  showThinkCountdown: boolean;
  revealTick: 3 | 2 | 1 | null;
  myVote: string | null;
  revealedVotes: Record<string, string> | null;
  summary: {
    outcome: string;
    message: string;
    average?: number;
    min?: number;
    max?: number;
    round3Remaining?: number[];
  } | null;
  participants: Array<{
    id: string;
    name: string;
    role: string;
    canVoteThisRound: boolean;
    hasVoted: boolean;
  }>;
};

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [hostName, setHostName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [thinkSeconds, setThinkSeconds] = useState(30);
  const [state, setState] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const origin =
      process.env.NEXT_PUBLIC_WS_ORIGIN ?? "http://localhost:4000";
    const s = io(`${origin}/planning-poker`, {
      transports: ["websocket"],
    });
    setSocket(s);
    s.on("connect", () => setMySocketId(s.id ?? null));
    s.on("pp:roomState", (payload: RoomSnapshot) => {
      setState(payload);
      setRoomCode(payload.roomCode);
    });
    s.on("pp:error", (payload: { message?: string }) => {
      setError(payload.message ?? "錯誤");
    });
    return () => {
      s.disconnect();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const createRoom = () => {
    clearError();
    if (!socket) return;
    socket.emit(
      "pp:createRoom",
      { hostName: hostName || "Host", thinkSeconds },
      (res: { roomCode?: string; error?: string }) => {
        if (res?.error) setError(res.error);
        if (res?.roomCode) setRoomCode(res.roomCode);
      },
    );
  };

  const joinRoom = () => {
    clearError();
    if (!socket?.connected) {
      setError("尚未連線到伺服器，請稍候再試");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("請輸入房間代碼");
      return;
    }
    socket.emit(
      "pp:joinRoom",
      { roomCode: code, name: joinName || "Participant" },
      (res: { ok?: boolean; error?: string }) => {
        if (res?.ok === true) setError(null);
        if (res?.ok === false && res?.error) setError(res.error);
      },
    );
  };

  const startVoting = () => {
    clearError();
    if (!socket || !roomCode) return;
    socket.emit("pp:hostStartVoting", { roomCode }, () => undefined);
  };

  const nextRound = () => {
    clearError();
    if (!socket || !roomCode) return;
    socket.emit("pp:hostNextRound", { roomCode }, () => undefined);
  };

  const nextItem = () => {
    clearError();
    if (!socket || !roomCode) return;
    socket.emit("pp:hostNextItem", { roomCode }, () => undefined);
  };

  const vote = (value: string) => {
    clearError();
    if (!socket || !roomCode) return;
    socket.emit("pp:vote", { roomCode, value }, () => undefined);
  };

  const me = state?.participants.find((p) => p.id === mySocketId);
  const isHost = me?.role === "host";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-slate-950 px-4 py-6 text-slate-100">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Planning Poker</h1>
        <p className="text-sm text-slate-400">行動端即時估算（WebSocket）</p>
      </header>

      {error && (
        <div
          className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </div>
      )}

      {!state && (
        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-medium text-slate-300">建立房間</h2>
          <label className="block text-xs text-slate-400">
            Host 名稱
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="你的名字"
            />
          </label>
          <label className="block text-xs text-slate-400">
            思考時間（秒，至少 5）
            <input
              type="number"
              min={5}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={thinkSeconds}
              onChange={(e) => setThinkSeconds(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={createRoom}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            建立房間
          </button>

          <hr className="border-slate-800" />

          <h2 className="text-sm font-medium text-slate-300">加入房間</h2>
          <label className="block text-xs text-slate-400">
            房間代碼
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm uppercase"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="例如 ABC123"
            />
          </label>
          <label className="block text-xs text-slate-400">
            顯示名稱
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="你的名字"
            />
          </label>
          <button
            type="button"
            onClick={joinRoom}
            className="w-full rounded-lg border border-slate-600 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            加入
          </button>
        </section>
      )}

      {state && (
        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-400">房間</span>
            <code className="rounded bg-slate-950 px-2 py-1 text-sm font-mono tracking-wider">
              {state.roomCode}
            </code>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-slate-800 px-3 py-1">Round {state.round}</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 capitalize">
              {state.phase.replaceAll("_", " ")}
            </span>
          </div>

          {state.phase === "lobby" && isHost && (
            <button
              type="button"
              onClick={startVoting}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              開始 Round 1 投票
            </button>
          )}

          {state.phase === "voting" && (
            <div className="space-y-3">
              {state.showThinkCountdown && state.thinkRemainingSeconds !== null && (
                <p className="text-center text-3xl font-bold text-amber-300">
                  {state.thinkRemainingSeconds}
                </p>
              )}
              {!state.showThinkCountdown &&
                state.thinkRemainingSeconds !== null &&
                state.thinkRemainingSeconds > 5 && (
                  <p className="text-center text-sm text-slate-400">
                    思考剩餘 {state.thinkRemainingSeconds} 秒
                  </p>
                )}
              {me?.canVoteThisRound && (
                <div>
                  <p className="mb-2 text-xs text-slate-400">選擇卡片</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CARDS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => vote(c)}
                        className={`rounded-lg border py-3 text-lg font-semibold ${
                          state.myVote === c
                            ? "border-indigo-400 bg-indigo-950 text-indigo-100"
                            : "border-slate-700 bg-slate-950 hover:border-slate-500"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {state.myVote && (
                    <p className="mt-2 text-center text-xs text-slate-500">
                      已選：{state.myVote}（他人看不到你的選擇）
                    </p>
                  )}
                </div>
              )}
              {!me?.canVoteThisRound && (
                <p className="text-sm text-amber-200/90">
                  本輪你無法投票（晚加入或本輪已鎖定），請等待下一輪。
                </p>
              )}
            </div>
          )}

          {state.phase === "reveal_countdown" && state.revealTick && (
            <p className="text-center text-4xl font-bold text-sky-300">
              亮牌 {state.revealTick}
            </p>
          )}

          {state.phase === "revealed" && (
            <div className="space-y-3">
              {state.revealedVotes && (
                <ul className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-sm">
                  {Object.entries(state.revealedVotes).map(([n, v]) => (
                    <li key={n} className="flex justify-between">
                      <span className="text-slate-400">{n}</span>
                      <span className="font-mono font-medium">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
              {state.summary && (
                <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                  <p className="font-medium">{state.summary.message}</p>
                  {state.summary.outcome === "failure_high_low" && (
                    <p className="mt-1 text-xs text-slate-400">
                      最低 {state.summary.min}／最高 {state.summary.max}
                    </p>
                  )}
                </div>
              )}
              {isHost && state.round < 3 && (
                <button
                  type="button"
                  onClick={nextRound}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  開始下一輪（Round {state.round + 1}）
                </button>
              )}
              {state.round >= 3 && (
                <p className="text-center text-xs text-slate-500">已完成三輪流程</p>
              )}
            </div>
          )}

          {state.phase === "item_complete" && (
            <div className="space-y-3">
              <p className="text-center text-xs text-amber-200/90">本項已結束</p>
              {state.revealedVotes && (
                <ul className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-sm">
                  {Object.entries(state.revealedVotes).map(([n, v]) => (
                    <li key={n} className="flex justify-between">
                      <span className="text-slate-400">{n}</span>
                      <span className="font-mono font-medium">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
              {state.summary && (
                <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                  <p className="font-medium">{state.summary.message}</p>
                  {state.summary.outcome === "failure_high_low" && (
                    <p className="mt-1 text-xs text-slate-400">
                      最低 {state.summary.min}／最高 {state.summary.max}
                    </p>
                  )}
                </div>
              )}
              {isHost && (
                <button
                  type="button"
                  onClick={nextItem}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  開始下一次投分
                </button>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs text-slate-500">成員</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {state.participants.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>
                    {p.name}
                    {p.role === "host" ? "（Host）" : ""}
                  </span>
                  <span className="text-slate-500">
                    {p.hasVoted ? "已投" : "未投"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
