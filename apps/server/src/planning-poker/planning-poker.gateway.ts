import { OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlanningPokerService } from './planning-poker.service';
import {
  ClientEvents,
  type CreateRoomPayload,
  type DissolveRoomPayload,
  type HostRoomPayload,
  type JoinRoomPayload,
  type LeaveRoomPayload,
  ServerEvents,
  type VotePayload,
} from './ws-events';

const webOrigin = process.env.WEB_ORIGIN;

function requireClientId(body: { clientId?: string }): string | null {
  const id = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  return id.length > 0 ? id : null;
}

@WebSocketGateway({
  namespace: '/planning-poker',
  cors: { origin: webOrigin?.trim() ? webOrigin.trim() : true, credentials: true },
})
export class PlanningPokerGateway implements OnModuleInit, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly poker: PlanningPokerService) {}

  onModuleInit(): void {
    this.poker.setOnRoomChange((code) => this.broadcast(code));
  }

  handleDisconnect(client: Socket): void {
    const code = this.poker.handleSocketDisconnect(client.id);
    if (code) this.broadcast(code);
  }

  private broadcast(code: string): void {
    const room = this.poker.getRoom(code);
    if (!room) return;
    for (const p of room.participants.values()) {
      if (!p.socketId) continue;
      const snapshot = this.poker.snapshotFor(room, p.clientId);
      this.server.to(p.socketId).emit(ServerEvents.roomState, snapshot);
    }
  }

  @SubscribeMessage(ClientEvents.createRoom)
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CreateRoomPayload,
  ): { roomCode: string } | { error: string } {
    const clientId = requireClientId(body);
    if (!clientId) return { error: '缺少 clientId' };
    const code = this.poker.createRoom(clientId, body.hostName, client.id, body.thinkSeconds);
    client.data.ppRoomCode = code;
    client.data.ppClientId = clientId;
    return { roomCode: code };
  }

  @SubscribeMessage(ClientEvents.joinRoom)
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const clientId = requireClientId(body);
    if (!clientId) {
      client.emit(ServerEvents.error, { message: '缺少 clientId' });
      return { ok: false, error: '缺少 clientId' };
    }
    const res = this.poker.joinRoom(client.id, body.roomCode, body.name, clientId);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    client.data.ppRoomCode = body.roomCode.trim().toUpperCase();
    client.data.ppClientId = clientId;
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.leaveRoom)
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LeaveRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const res = this.poker.leaveRoom(client.id, body.roomCode);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    client.emit(ServerEvents.roomDissolved, { reason: 'left' });
    delete client.data.ppRoomCode;
    delete client.data.ppClientId;
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.dissolveRoom)
  handleDissolve(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: DissolveRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const res = this.poker.dissolveRoom(client.id, body.roomCode);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    for (const sid of res.notifiedSocketIds) {
      this.server.to(sid).emit(ServerEvents.roomDissolved, { reason: 'dissolved' });
    }
    delete client.data.ppRoomCode;
    delete client.data.ppClientId;
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.hostStartVoting)
  handleHostStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: HostRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const resolved = this.poker.resolveClientInRoom(client.id, body.roomCode);
    if ('error' in resolved) {
      client.emit(ServerEvents.error, { message: resolved.error });
      return { ok: false, error: resolved.error };
    }
    const res = this.poker.hostStartVoting(resolved.clientId, body.roomCode);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.hostNextRound)
  handleHostNext(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: HostRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const resolved = this.poker.resolveClientInRoom(client.id, body.roomCode);
    if ('error' in resolved) {
      client.emit(ServerEvents.error, { message: resolved.error });
      return { ok: false, error: resolved.error };
    }
    const res = this.poker.hostNextRound(resolved.clientId, body.roomCode);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.hostNextItem)
  handleHostNextItem(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: HostRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const resolved = this.poker.resolveClientInRoom(client.id, body.roomCode);
    if ('error' in resolved) {
      client.emit(ServerEvents.error, { message: resolved.error });
      return { ok: false, error: resolved.error };
    }
    const res = this.poker.hostNextItem(resolved.clientId, body.roomCode);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.vote)
  handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: VotePayload,
  ): { ok: true } | { ok: false; error: string } {
    const resolved = this.poker.resolveClientInRoom(client.id, body.roomCode);
    if ('error' in resolved) {
      client.emit(ServerEvents.error, { message: resolved.error });
      return { ok: false, error: resolved.error };
    }
    const res = this.poker.vote(resolved.clientId, body.roomCode, body.value);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    return { ok: true };
  }
}
