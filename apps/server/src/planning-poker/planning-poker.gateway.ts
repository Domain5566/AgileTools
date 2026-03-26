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
  type HostRoomPayload,
  type JoinRoomPayload,
  ServerEvents,
  type VotePayload,
} from './ws-events';

const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

@WebSocketGateway({
  namespace: '/planning-poker',
  cors: { origin: webOrigin, credentials: true },
})
export class PlanningPokerGateway implements OnModuleInit, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly poker: PlanningPokerService) {}

  onModuleInit(): void {
    this.poker.setOnRoomChange((code) => this.broadcast(code));
  }

  handleDisconnect(client: Socket): void {
    const code = this.poker.removeParticipant(client.id);
    if (code) this.broadcast(code);
  }

  private broadcast(code: string): void {
    const room = this.poker.getRoom(code);
    if (!room) return;
    for (const socketId of room.participants.keys()) {
      const snapshot = this.poker.snapshotFor(room, socketId);
      this.server.to(socketId).emit(ServerEvents.roomState, snapshot);
    }
  }

  @SubscribeMessage(ClientEvents.createRoom)
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CreateRoomPayload,
  ): { roomCode: string } | { error: string } {
    const code = this.poker.createRoom(client.id, body.hostName, body.thinkSeconds);
    client.data.ppRoomCode = code;
    return { roomCode: code };
  }

  @SubscribeMessage(ClientEvents.joinRoom)
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const res = this.poker.joinRoom(client.id, body.roomCode, body.name);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    client.data.ppRoomCode = body.roomCode.trim().toUpperCase();
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.hostStartVoting)
  handleHostStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: HostRoomPayload,
  ): { ok: true } | { ok: false; error: string } {
    const res = this.poker.hostStartVoting(client.id, body.roomCode);
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
    const res = this.poker.hostNextRound(client.id, body.roomCode);
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
    const res = this.poker.hostNextItem(client.id, body.roomCode);
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
    const res = this.poker.vote(client.id, body.roomCode, body.value);
    if (!res.ok) {
      client.emit(ServerEvents.error, { message: res.reason });
      return { ok: false, error: res.reason };
    }
    return { ok: true };
  }
}
