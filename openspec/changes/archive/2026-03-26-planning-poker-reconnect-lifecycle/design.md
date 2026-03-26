## Context
Planning Poker 已上線基本多房、狀態機與投票流程（NestJS Gateway + `PlanningPokerService`）。參與者與 Host 目前綁在 **Socket.IO 的 `socket.id`** 上，`removeParticipant(socketId)` 在斷線時觸發，且 Host 斷線會 `rooms.delete`，導致 **F5 即失房／失身分**。

本變更要把「傳輸連線（socket）」與「房內成員身分（client）」分離，並用明確事件表達 **離開** 與 **解散**。

## Goals / Non-Goals

**Goals:**
- 每位使用者具 **穩定 `clientId`**（建議瀏覽器產生 UUID，存 `sessionStorage`），重連後可 **恢復同一房內角色與狀態**（在房間仍存在的前提下）。
- **`disconnect` 預設不移除成員、不刪房**；房間僅在 **Host 明確解散** 時結束（或後續若定義「最後一人離開」等規則再擴充，但本變更不採「Host 斷線＝刪房」）。
- 提供 **`leaveRoom`**：僅移除該參與者；**Host 不得成功執行 leave**（選項 A，後端拒絕 + 前端不提供或停用）。
- 提供 **`dissolveRoom`**：僅 Host 可執行；刪除房間、斷開／通知房內所有人，並清前端持久狀態。
- 刷新頁面後，若有保存的 `roomCode` + `clientId`，**自動嘗試重連**（join／resume 單一路徑即可，見決策）。

**Non-Goals:**
- 不做完整帳號體系；`clientId` 遺失即視為新使用者（需重新加入或建新房）。
- 不在此變更強制實作「閒置 N 分鐘自動踢除」（可於 Open Questions 保留）。

## Decisions

### 1. 身分模型：以 `clientId` 為房內成員主鍵
- 伺服器內 `Room`／`participants` 以 **`clientId: string`** 為 key，欄位包含：`name`、`role`（`host` | `participant`）、**`socketId: string | null`**（當前連線，斷線時置 `null`）。
- Host 權限改以 **`hostClientId`**（或等價欄位）判斷，不再依賴「當下 socket 是否等於某個 hostSocketId」作為唯一依據。
- 投票與 `votes`、`canVoteThisRound` 等對參與者的索引，一律改為 **`clientId`**。

### 2. 連線生命週期：`disconnect` 只卸載 socket，不刪成員
- `handleDisconnect`：**查詢該 socket 對應的 `clientId`**，將該參與者的 `socketId` 設為 `null`（或從「socket → clientId」對照表移除），**不**從 `participants` 刪除，**不**因 Host 斷線刪除房間。
- 廣播 `roomState` 時：只對 **目前 `socketId !== null` 的成員** 發送（或對所有已連線 socket 發送；離線者收不到屬正常）。
- 可選在 snapshot 中附帶 **`connected: boolean`** 或僅在列表顯示「離線」——若產品要顯示離線成員，則 snapshot 應包含離線者名稱與角色但不暴露其未揭示投票細節（沿用既有「亮牌前隱藏」規則）。

### 3. 重連與入房：單一 `joinRoom`（或 `resume`）承載 `clientId`
- 客戶端 payload：**`{ roomCode, name, clientId }`**，`clientId` 必填（或由伺服器在首次 `createRoom` 回傳並由前端保存）。
- 伺服器行為：
  - 若 **`clientId` 已在該房**：更新 `name`（可選、允許空則保留舊名）、綁定 **新 `socketId`**、加入 Socket.IO room（若使用 `socket.join(code)`），回傳成功並廣播。
  - 若 **不在該房**：走現有加入邏輯，建立 `participant` 角色與 `socketId`。
- **`createRoom`**：客戶端帶 `hostName`、`thinkSeconds`、**`clientId`**；Host 的 `clientId` 寫入為 `hostClientId` 並建立第一筆 participant。

### 4. 明確事件：`leaveRoom` / `dissolveRoom`
- **`leaveRoom`**：`{ roomCode }` + 由連線解析出的 `clientId`。若為 **Host** → **拒絕**（理由與 spec 一致）。若為參與者 → 從房間移除、清除該 `clientId` 的票與計時關聯（與現有 `removeParticipant` 類似但只針對非 Host）。
- **`dissolveRoom`**：`{ roomCode }`，僅當 `clientId === hostClientId` 時成功 → `disposeRoomTimers`、`rooms.delete`、對房內所有仍連線 socket 發 **`roomDissolved`**（或統一用 `error` + 前端重置）後斷開或請前端離開 namespace。
- 現有 **`removeParticipant(socketId)`** 改為內部輔助或移除；斷線路徑不再呼叫「刪人版」的邏輯。

### 5. 前端持久化與自動重連
- **`sessionStorage`**（或同等）：`pp:clientId`、`pp:roomCode`；可選 `pp:name`、`pp:role` 僅作 UI 初值，**權威以伺服器 snapshot 為準**。
- 首次進入：無 `clientId` 則 `crypto.randomUUID()` 並寫入。
- Socket 連上後：若存在 `roomCode` + `clientId`，自動發 **`joinRoom`**（含名稱）；若房間不存在或 `clientId` 不在房內，顯示錯誤並清除過期狀態，回到建立／加入畫面。
- **Host 選項 A**：僅顯示 **「解散房間」**；不顯示「離開房間」。參與者顯示 **「離開房間」**。

### 6. Socket.IO 與 Nest Gateway
- 廣播迴圈改為：對房內每個 **目前有效的 `socketId`** 執行 `server.to(socketId).emit(...)`（或維護 `Set<socketId>` per room）。
- 若使用 `client.join(roomCode)`，可改為 **`socket.join(internalRoomId)`** 與 `server.to(roomCode).emit` 簡化廣播——與現有「手動 iterate participants」二選一，**擇一並全檔案一致**即可。

## Risks / Trade-offs
- **殭屍成員**：斷線不踢人會讓名單長期留名；可接受作法為 UI 標示離線，或後續加「僅參與者、長閒置清除」政策。
- **clientId 外洩／猜測**：房間碼已非高機密；若擔心冒名重連，可後續加一次性 token（本變更不實作）。
- **同一 clientId 多開分頁**：最後連線的 socket 覆寫前者；行為需文件化（與一般 WebSocket 應用相同）。

## Migration Plan
- 屬行為變更，無資料庫 migration。
- 上線後舊客戶端若未送 `clientId`，可 **拒絕 join／create** 並提示更新頁面，或暫時相容一版（僅開發期可考慮）。

## Open Questions
- 是否在 snapshot 中顯示 **離線成員**（僅名稱／角色）？
- 參與者 **永久關閉瀏覽器** 是否要在數小時後自動從名單移除（需背景 job 或 lazy cleanup）？
