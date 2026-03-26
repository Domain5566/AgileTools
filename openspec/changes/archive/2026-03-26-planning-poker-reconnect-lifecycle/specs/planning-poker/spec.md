# planning-poker Delta Specification — reconnect & room lifecycle

> 本檔為 `planning-poker-reconnect-lifecycle` 之 delta specs，描述相對於主規格新增/修正之行為。

## Requirement: 斷線、重連與房間存續
系統 SHALL 以穩定 **`clientId`**（與 Socket 連線分離）識別房內成員。**Socket 斷線** SHALL **不得**將該成員自房間移除，且 **不得**因 Host 斷線而刪除房間。使用者以相同 **`clientId`** 與房間代碼重新連線並完成入房／恢復流程後，SHALL 恢復原角色與房內狀態（在房間仍存在且未被解散的前提下）。

### Scenario: 重新整理後自動回到同一房
- **WHEN** 使用者曾成功建立或加入某房，且客戶端保存了 **`clientId`** 與房間代碼後重新載入頁面
- **THEN** 系統自動嘗試恢復連線至該房；若房間仍存在且身分有效，使用者回到與斷線前一致之房內流程狀態

### Scenario: Host 短暫斷線不刪房
- **WHEN** Host 的 Socket 連線中斷但無人執行解散
- **THEN** 房間 SHALL 仍存在，且 Host 以相同 **`clientId`** 重連後可繼續擔任 Host

## Requirement: 明確離開與解散房間
**離開房間**與**解散房間** SHALL 僅能透過明確的客戶端事件／操作觸發；系統 **不得**僅因 Socket `disconnect` 而觸發等同離開或解散。

### Scenario: 參與者明確離開
- **WHEN** 非 Host 執行「離開房間」
- **THEN** 系統僅將該成員自房間移除，其餘成員仍留在房內，房間可繼續進行

### Scenario: Host 明確解散
- **WHEN** Host 執行「解散房間」
- **THEN** 房間結束，所有連線中之客戶端 SHALL 收到可區分之通知並回到未入房狀態（具體事件名稱由實作決定，語意須一致）

## Requirement: Host 不得「僅離開房間」（選項 A）
Host SHALL NOT 使用與一般參與者相同的「離開房間」路徑來脫離該房；Host SHALL 僅能選擇留在房內，或執行明確的「解散房間」以結束該房並通知／移除所有參與者。系統 SHALL 拒絕任何將 Host 視為僅移除自身、而房間仍由其他人繼續運作的「Host 離開」操作。

### Scenario: Host 嘗試僅離開房間
- **WHEN** Host 觸發僅移出自身之「離開房間」流程（若介面或 API 提供此類操作）
- **THEN** 系統不得接受；Host 須留在房內或改選「解散房間」

