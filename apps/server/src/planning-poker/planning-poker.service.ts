import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { evaluateRound12, evaluateRound3, isAllowedCard, type CardString } from './poker-rules';
import type { Participant, RoomPhase, RoomSnapshot, RoomSummaryPayload } from './room.types';

interface InternalRoom {
  code: string;
  hostSocketId: string;
  phase: RoomPhase;
  round: 1 | 2 | 3;
  thinkSeconds: number;
  thinkRemaining: number | null;
  revealTick: 3 | 2 | 1 | null;
  participants: Map<string, Participant>;
  votes: Map<string, string>;
  awaitingRevealKickoff: boolean;
  thinkInterval: ReturnType<typeof setInterval> | null;
  revealTimeouts: Array<ReturnType<typeof setTimeout>>;
  summary: RoomSummaryPayload | null;
  revealedVotes: Record<string, CardString> | null;
}

@Injectable()
export class PlanningPokerService {
  private readonly rooms = new Map<string, InternalRoom>();
  private onRoomChange?: (code: string) => void;

  setOnRoomChange(cb: (code: string) => void): void {
    this.onRoomChange = cb;
  }

  private touch(room: InternalRoom): void {
    this.onRoomChange?.(room.code);
  }

  private genRoomCode(): string {
    return randomBytes(4).toString('base64url').slice(0, 6).toUpperCase();
  }

  createRoom(hostSocketId: string, hostName: string, thinkSeconds?: number): string {
    const sec = Math.max(5, thinkSeconds ?? 60);
    let code = this.genRoomCode();
    while (this.rooms.has(code)) code = this.genRoomCode();

    const room: InternalRoom = {
      code,
      hostSocketId,
      phase: 'lobby',
      round: 1,
      thinkSeconds: sec,
      thinkRemaining: null,
      revealTick: null,
      participants: new Map([
        [
          hostSocketId,
          {
            socketId: hostSocketId,
            name: hostName.trim() || 'Host',
            role: 'host',
            canVoteThisRound: true,
          },
        ],
      ]),
      votes: new Map(),
      awaitingRevealKickoff: false,
      thinkInterval: null,
      revealTimeouts: [],
      summary: null,
      revealedVotes: null,
    };
    this.rooms.set(code, room);
    this.touch(room);
    return code;
  }

  getRoom(code: string): InternalRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** 回傳仍存在的房間代碼（Host 離開則刪房，回傳 undefined） */
  removeParticipant(socketId: string): string | undefined {
    for (const room of this.rooms.values()) {
      if (!room.participants.has(socketId)) continue;
      const code = room.code;
      room.participants.delete(socketId);
      room.votes.delete(socketId);
      if (room.hostSocketId === socketId) {
        this.disposeRoomTimers(room);
        this.rooms.delete(room.code);
        return undefined;
      }
      return code;
    }
    return undefined;
  }

  joinRoom(socketId: string, rawCode: string, name: string): { ok: true } | { ok: false; reason: string } {
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: '找不到房間' };

    const trimmed = name.trim() || 'Participant';
    const lateJoinNoVote =
      room.awaitingRevealKickoff ||
      room.phase === 'reveal_countdown' ||
      room.phase === 'revealed' ||
      room.phase === 'item_complete';

    room.participants.set(socketId, {
      socketId,
      name: trimmed,
      role: 'participant',
      canVoteThisRound: room.phase === 'voting' && !lateJoinNoVote,
    });

    this.touch(room);
    return { ok: true };
  }

  hostStartVoting(hostSocketId: string, code: string): { ok: true } | { ok: false; reason: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, reason: '找不到房間' };
    if (room.hostSocketId !== hostSocketId) return { ok: false, reason: '僅 Host 可開始投票' };
    if (room.phase !== 'lobby') return { ok: false, reason: '僅能在等待室開始首輪投票' };

    room.round = 1;
    this.enterVoting(room);
    return { ok: true };
  }

  hostNextRound(hostSocketId: string, code: string): { ok: true } | { ok: false; reason: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, reason: '找不到房間' };
    if (room.hostSocketId !== hostSocketId) return { ok: false, reason: '僅 Host 可推進輪次' };
    if (room.phase !== 'revealed') return { ok: false, reason: '請先完成本輪揭示' };
    if (room.round >= 3) return { ok: false, reason: '已完成 Round 3' };

    room.round = (room.round + 1) as 1 | 2 | 3;
    this.enterVoting(room);
    return { ok: true };
  }

  hostNextItem(hostSocketId: string, code: string): { ok: true } | { ok: false; reason: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, reason: '找不到房間' };
    if (room.hostSocketId !== hostSocketId) return { ok: false, reason: '僅 Host 可開始下一次投分' };
    if (room.phase !== 'item_complete') return { ok: false, reason: '目前無可開始下一次投分' };

    // Reset: 重置為等待室，等待 Host 開始 Round 1
    this.disposeRoomTimers(room);
    room.phase = 'lobby';
    room.round = 1;
    room.thinkRemaining = null;
    room.revealTick = null;
    room.awaitingRevealKickoff = false;
    room.votes.clear();
    room.summary = null;
    room.revealedVotes = null;
    for (const p of room.participants.values()) {
      p.canVoteThisRound = false;
    }

    this.touch(room);
    return { ok: true };
  }

  private enterVoting(room: InternalRoom): void {
    this.disposeRoomTimers(room);
    room.phase = 'voting';
    room.votes.clear();
    room.summary = null;
    room.revealedVotes = null;
    room.revealTick = null;
    room.awaitingRevealKickoff = false;
    for (const p of room.participants.values()) {
      p.canVoteThisRound = true;
    }
    room.thinkRemaining = room.thinkSeconds;
    this.startThinkTimer(room);
    this.touch(room);
  }

  vote(
    socketId: string,
    code: string,
    value: string,
  ): { ok: true } | { ok: false; reason: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, reason: '找不到房間' };
    if (room.phase !== 'voting') return { ok: false, reason: '目前非投票階段' };

    const p = room.participants.get(socketId);
    if (!p?.canVoteThisRound) return { ok: false, reason: '本輪無法投票（晚加入規則）' };
    if (!isAllowedCard(value)) return { ok: false, reason: '不合法的投票值' };

    room.votes.set(socketId, value);

    const eligible = this.eligibleVoterIds(room);
    const allIn = eligible.length > 0 && eligible.every((id) => room.votes.has(id));
    if (allIn) {
      room.awaitingRevealKickoff = true;
      this.touch(room);
      queueMicrotask(() => this.kickoffRevealCountdown(room));
    } else {
      this.touch(room);
    }

    return { ok: true };
  }

  eligibleVoterIds(room: InternalRoom): string[] {
    return [...room.participants.values()].filter((p) => p.canVoteThisRound).map((p) => p.socketId);
  }

  private startThinkTimer(room: InternalRoom): void {
    if (room.thinkInterval) clearInterval(room.thinkInterval);
    room.thinkInterval = setInterval(() => {
      if (room.phase !== 'voting' || room.thinkRemaining === null) return;

      const eligible = this.eligibleVoterIds(room);
      if (eligible.length > 0 && eligible.every((id) => room.votes.has(id))) {
        return;
      }

      room.thinkRemaining -= 1;
      if (room.thinkRemaining <= 0) {
        room.thinkRemaining = 0;
        clearInterval(room.thinkInterval!);
        room.thinkInterval = null;
      }
      this.touch(room);
    }, 1000);
  }

  private kickoffRevealCountdown(room: InternalRoom): void {
    if (room.phase !== 'voting') return;
    const eligible = this.eligibleVoterIds(room);
    const allIn = eligible.length > 0 && eligible.every((id) => room.votes.has(id));
    if (!allIn) {
      room.awaitingRevealKickoff = false;
      this.touch(room);
      return;
    }

    if (room.thinkInterval) {
      clearInterval(room.thinkInterval);
      room.thinkInterval = null;
    }
    room.thinkRemaining = null;
    room.awaitingRevealKickoff = false;
    room.phase = 'reveal_countdown';

    const runTick = (n: 3 | 2 | 1) => {
      room.revealTick = n;
      this.touch(room);
      const t = setTimeout(() => {
        if (n === 3) runTick(2);
        else if (n === 2) runTick(1);
        else this.finishReveal(room);
      }, 1000);
      room.revealTimeouts.push(t);
    };
    runTick(3);
  }

  private finishReveal(room: InternalRoom): void {
    room.revealTick = null;

    const eligible = this.eligibleVoterIds(room);
    const voteList = eligible.map((id) => room.votes.get(id) ?? '?');

    const names: Record<string, CardString> = {};
    for (const id of eligible) {
      const raw = room.votes.get(id) ?? '?';
      if (!isAllowedCard(raw)) continue;
      const part = room.participants.get(id);
      names[part?.name ?? id] = raw as CardString;
    }
    room.revealedVotes = names;

    const round = room.round;
    const summary = this.computeSummary(round, voteList);
    room.summary = summary;

    // 早停規則：Round 1/2 只要拿到「成功平均」就直接完結本項
    if (round < 3 && summary.outcome === 'success_avg') {
      room.phase = 'item_complete';
    } else if (round === 3) {
      // Round 3 完成後，本項無論結果都完結
      room.phase = 'item_complete';
    } else {
      room.phase = 'revealed';
    }

    this.touch(room);
  }

  private computeSummary(round: 1 | 2 | 3, votes: string[]): RoomSummaryPayload {
    if (round === 3) {
      const r3 = evaluateRound3(votes);
      if (r3.kind === 'cannot_estimate') {
        return { outcome: 'round3_cannot_estimate', message: '無法估算' };
      }
      return {
        outcome: 'round3_converged',
        message: `Round 3 收斂後平均：${r3.average}`,
        average: r3.average,
        round3Remaining: r3.remaining,
      };
    }

    const r12 = evaluateRound12(votes);
    if (r12.kind === 'cannot_estimate') {
      return { outcome: 'cannot_estimate', message: '無法估算（含 ?）' };
    }
    if (r12.kind === 'success') {
      return {
        outcome: 'success_avg',
        message: `成功，平均：${r12.average}`,
        average: r12.average,
      };
    }
    return {
      outcome: 'failure_high_low',
      message: '請線下討論最高／最低估值',
      min: r12.min,
      max: r12.max,
    };
  }

  private disposeRoomTimers(room: InternalRoom): void {
    if (room.thinkInterval) {
      clearInterval(room.thinkInterval);
      room.thinkInterval = null;
    }
    for (const t of room.revealTimeouts) clearTimeout(t);
    room.revealTimeouts = [];
  }

  snapshotFor(room: InternalRoom, viewerSocketId: string): RoomSnapshot {
    const participants = [...room.participants.values()].map((p) => ({
      id: p.socketId,
      name: p.name,
      role: p.role,
      canVoteThisRound: p.canVoteThisRound,
      hasVoted: room.votes.has(p.socketId),
    }));

    const showThink =
      room.phase === 'voting' &&
      room.thinkRemaining !== null &&
      room.thinkRemaining > 0 &&
      room.thinkRemaining <= 5;

    const rawMine = room.votes.get(viewerSocketId);
    const myVote =
      room.phase === 'voting' && rawMine && isAllowedCard(rawMine)
        ? (rawMine as CardString)
        : null;

    const revealed =
      room.phase === 'revealed' || room.phase === 'item_complete'
        ? room.revealedVotes
        : null;

    return {
      roomCode: room.code,
      phase: room.phase,
      round: room.round,
      thinkSeconds: room.thinkSeconds,
      thinkRemainingSeconds: room.thinkRemaining,
      showThinkCountdown: showThink,
      revealTick: room.revealTick,
      myVote,
      revealedVotes: revealed,
      summary: room.summary,
      participants,
    };
  }
}
