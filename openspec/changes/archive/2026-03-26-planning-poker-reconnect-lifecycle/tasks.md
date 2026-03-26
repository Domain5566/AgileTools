## 1. 通訊協定與型別

- [x] 1.1 更新 `ws-events.ts`：`joinRoom` / `createRoom` payload 加入 **`clientId: string`**；新增 **`leaveRoom`**、**`dissolveRoom`**；新增伺服器事件如 **`roomDissolved`**（或等價錯誤碼）供前端重置
- [x] 1.2 更新 `room.types.ts`（及相關 DTO）：participant 以 **`clientId`** 對外；snapshot 內參與者 **`id` 改為 `clientId`**（或保留 `id` 欄位但語意等同 `clientId`，前後端一致即可）

## 2. 後端：房間模型與狀態機

- [x] 2.1 `InternalRoom`：`participants` 改為 **`Map<clientId, Participant>`**，內含 **`socketId: string | null`**；新增 **`hostClientId`**
- [x] 2.2 維護 **`socketId → clientId`**（或 `socketId → { roomCode, clientId }`）對照表，供 `handleDisconnect` 與廣播查詢
- [x] 2.3 `votes`、eligible 投票者、`snapshotFor` 的 `viewer` 參數、所有 host 權限檢查，全面改為 **`clientId`** 基準
- [x] 2.4 **`handleDisconnect`**：僅解除 socket 綁定／對照表，**不**刪 participant、**不**刪房
- [x] 2.5 實作 **`leaveRoom(clientId, roomCode)`**：Host → 失敗；參與者 → 移除並 `touch`／廣播
- [x] 2.6 實作 **`dissolveRoom(clientId, roomCode)`**：非 Host → 失敗；Host → 清 timer、刪房、通知連線中成員
- [x] 2.7 `joinRoom`：**已存在之 `clientId`** → 重連（更新 socket、可選更新名稱）；否則新建 participant
- [x] 2.8 `createRoom`：綁定 **`hostClientId`** 與 Host 的 participant 列
- [x] 2.9 廣播邏輯：只對 **`socketId != null`** 的成員 emit（或改用 `socket.join` + `to(room)` 一致化）
- [x] 2.10 刪除或重構舊 **`removeParticipant(socketId)`** 的「刪房／刪人」語意，避免與新斷線行為衝突

## 3. 後端：Gateway

- [x] 3.1 新增 `@SubscribeMessage`：**`leaveRoom`**、**`dissolveRoom`**
- [x] 3.2 建立／加入成功後：`socket.join`（若採用 room 廣播）與 **`client.data`** 保存 `ppRoomCode` / `clientId` 一致性
- [x] 3.3 單元測試：斷線不刪房、Host 斷線房間仍在、參與者 `leaveRoom`、Host `dissolveRoom`、Host `leaveRoom` 拒絕、`clientId` 重連恢復投票身分（依現有 phase 規則）

## 4. 前端：`apps/web`

- [x] 4.1 首次載入產生或讀取 **`sessionStorage`** 的 `clientId`；建立／加入成功後寫入 **`roomCode`**
- [x] 4.2 Socket 連線後：**有快取則自動 `joinRoom`（含 clientId）**；失敗時清除無效快取並回到首頁流
- [x] 4.3 **參與者**：提供 **「離開房間」** 按鈕 → 發 `leaveRoom`、清 `sessionStorage`、斷線或留連線但離開 UI
- [x] 4.4 **Host**：**不**提供「離開房間」；提供 **「解散房間」** → 發 `dissolveRoom`；處理 **`roomDissolved`** 清除狀態
- [x] 4.5 所有送出事件帶上 **`roomCode` + `clientId`**（與後端協定一致）；`vote` / host 事件之 viewer 身分與後端驗證一致

## 5. 規格與文件

- [x] 5.1 於 `openspec/specs/planning-poker/spec.md` 補充：**斷線／重連**、**明確離開／解散** 之需求與情境（若尚未完整覆蓋）
- [x] 5.2 `README` 或開發說明：簡述 **clientId 與 sessionStorage** 行為與限制（可選，不強制長篇）

## 6. 驗收

- [x] 6.1 手動：Host F5 後仍為 Host、房間碼不變、參與者列表正確
- [x] 6.2 手動：參與者 F5 後自動回房、可繼續流程（符合晚加入／當前 phase 規則）
- [x] 6.3 手動：參與者按離開 → 僅自己消失；Host 按解散 → 全員被踢回建立／加入畫面
- [x] 6.4 Host 無法透過 UI 或偽造事件完成「僅離開」（後端拒絕）
