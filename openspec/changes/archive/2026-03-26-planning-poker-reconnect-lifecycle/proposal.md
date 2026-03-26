# Planning Poker：重連、房間生命週期與明確離開／解散

## 為什麼要做
目前實作以 `socket.id` 作為參與者鍵值，`handleDisconnect` 會直接 `removeParticipant`，且 Host 斷線會刪除整個房間。這與產品預期不符：**重新整理／短暫斷線應能回到同一房間**，**房間不因 Host 單純斷線而消失**；**離開房間**與**解散房間**必須是使用者明確操作，而非斷線的副作用。

## 範圍
- 穩定客戶端身分（`clientId`）＋可選的 `sessionStorage` 持久化與自動重連流程。
- 斷線預設不等於離開；明確事件：`leaveRoom`（參與者）、`dissolveRoom`（Host）。
- **選項 A**：Host 不得使用「僅離開房間」；只能留在房內或解散房間（已寫入 `openspec/specs/planning-poker/spec.md`）。

## 不在範圍（可列為後續）
- 帳號系統、跨瀏覽器同步（`clientId` 僅單一瀏覽器／分頁工作階段級）。
- 超長時間佔位參與者的自動清理策略（可先不做或另開變更）。
