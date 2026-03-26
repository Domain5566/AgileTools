import { PlanningPokerService } from './planning-poker.service';

describe('planning-poker reconnect / leave / dissolve', () => {
  let svc: PlanningPokerService;

  beforeEach(() => {
    svc = new PlanningPokerService();
    svc.setOnRoomChange(() => undefined);
  });

  it('Host 斷線不刪房', () => {
    const hostC = 'h1';
    const sockH = 'sock-h';
    const code = svc.createRoom(hostC, 'Host', sockH, 5);
    svc.handleSocketDisconnect(sockH);
    const room = svc.getRoom(code);
    expect(room).toBeDefined();
    expect(room!.participants.get(hostC)?.socketId).toBeNull();
  });

  it('參與者 leaveRoom 成功；Host leaveRoom 拒絕', () => {
    const hostC = 'h2';
    const pC = 'p2';
    const sockH = 'sock-h2';
    const sockP = 'sock-p2';
    const code = svc.createRoom(hostC, 'Host', sockH, 5);
    svc.joinRoom(sockP, code, 'P', pC);

    const hostLeave = svc.leaveRoom(sockH, code);
    expect(hostLeave.ok).toBe(false);

    const partLeave = svc.leaveRoom(sockP, code);
    expect(partLeave.ok).toBe(true);
    expect(svc.getRoom(code)!.participants.has(pC)).toBe(false);
  });

  it('Host dissolveRoom 刪房並列出要通知的 socket', () => {
    const hostC = 'h3';
    const pC = 'p3';
    const sockH = 'sock-h3';
    const sockP = 'sock-p3';
    const code = svc.createRoom(hostC, 'Host', sockH, 5);
    svc.joinRoom(sockP, code, 'P', pC);

    const res = svc.dissolveRoom(sockH, code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.notifiedSocketIds.sort()).toEqual([sockH, sockP].sort());
    }
    expect(svc.getRoom(code)).toBeUndefined();
  });

  it('participant 不可 dissolveRoom', () => {
    const hostC = 'h4';
    const pC = 'p4';
    const sockH = 'sock-h4';
    const sockP = 'sock-p4';
    const code = svc.createRoom(hostC, 'Host', sockH, 5);
    svc.joinRoom(sockP, code, 'P', pC);

    const res = svc.dissolveRoom(sockP, code);
    expect(res.ok).toBe(false);
    expect(svc.getRoom(code)).toBeDefined();
  });

  it('以相同 clientId 重連：綁定新 socket 仍可操作', () => {
    const hostC = 'h5';
    const sock1 = 'sock-a';
    const sock2 = 'sock-b';
    const code = svc.createRoom(hostC, 'Host', sock1, 5);
    svc.handleSocketDisconnect(sock1);
    svc.joinRoom(sock2, code, 'Host', hostC);
    const start = svc.hostStartVoting(hostC, code);
    expect(start.ok).toBe(true);
  });

  it('resolveClientInRoom 在 leave 後失效', () => {
    const hostC = 'h6';
    const pC = 'p6';
    const sockH = 'sock-h6';
    const sockP = 'sock-p6';
    const code = svc.createRoom(hostC, 'Host', sockH, 5);
    svc.joinRoom(sockP, code, 'P', pC);
    svc.leaveRoom(sockP, code);
    const r = svc.resolveClientInRoom(sockP, code);
    expect('error' in r).toBe(true);
  });
});
