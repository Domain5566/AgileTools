/**
 * WebSocket 事件協定（Socket.IO）
 * 命名：camelCase，payload 為 JSON 可序列化物件。
 */

/** Client → Server */
export const ClientEvents = {
  /** 建立房間：{ clientId, hostName, thinkSeconds? }，thinkSeconds 最少 5 */
  createRoom: 'pp:createRoom',
  /** 加入／重連：{ clientId, roomCode, name } */
  joinRoom: 'pp:joinRoom',
  /** 投票：{ roomCode, value }（身分由 socket 綁定解析） */
  vote: 'pp:vote',
  /** Host：開始第一輪或從 lobby 進入 Round 1 */
  hostStartVoting: 'pp:hostStartVoting',
  /** Host：揭示完成後進入下一輪（Round+1，至多到 3） */
  hostNextRound: 'pp:hostNextRound',
  /** Host：待估項目完結後，開始下一次投分（重置輪次/票/計時/結果） */
  hostNextItem: 'pp:hostNextItem',
  /** 參與者離開房間（Host 不可使用） */
  leaveRoom: 'pp:leaveRoom',
  /** Host 解散房間 */
  dissolveRoom: 'pp:dissolveRoom',
} as const;

/** Server → Client */
export const ServerEvents = {
  /** 完整房間狀態（廣播給房內所有人） */
  roomState: 'pp:roomState',
  /** 錯誤訊息（單播） */
  error: 'pp:error',
  /** 房間已解散（單播給原房內連線者） */
  roomDissolved: 'pp:roomDissolved',
} as const;

export interface CreateRoomPayload {
  clientId: string;
  hostName: string;
  thinkSeconds?: number;
}

export interface JoinRoomPayload {
  clientId: string;
  roomCode: string;
  name: string;
}

export interface VotePayload {
  roomCode: string;
  value: string;
}

export interface HostRoomPayload {
  roomCode: string;
}

export interface LeaveRoomPayload {
  roomCode: string;
}

export interface DissolveRoomPayload {
  roomCode: string;
}
