## Why
你們需要一個「計畫 poker（Planning Poker）」的網頁版本，讓行動端也能參與，同時支援多組團隊在同一段時間內平行進行、彼此不互相干擾。現行的做法需要線下同步與溝通，成本高且容易因資訊洩漏（例如投票未同時揭示）影響共識。

## What Changes
- 建立一套可用於行動端的 Planning Poker 網頁介面（投票隱藏、亮牌倒數、結果顯示）。
- 建立伺服器端的即時通訊與「房間(Room)」機制，支援多組團隊同時使用並隔離狀態。
- 實作 Planning Poker 流程：Round 1/2/3、投票隱藏揭示、成功/失敗判定、以及 Round 3 後的最高/最低移除收斂。
- （2026-03-26 補充）待估項目：**僅「成功平均」算得分**；任一輪得分則該項目立即結束；三輪皆無得分亦結束；**僅 Host 可開啟下一次投分**（無項目名稱欄位）。
- 實作你們指定的投票卡集合與規則（Fibonacci 數列值與 `?`、三連續 Fibonacci 範圍判定、平均計算、以及「?」時的無法估算行為）。

## Capabilities

### New Capabilities
- `planning-poker`: 提供房間隔離的 Planning Poker 即時投票、亮牌倒數、結果計算與顯示（含 Round 1/2/3 與你們指定的規則）。

### Modified Capabilities
- （無）

## Impact
- 新增 Web 前端頁面與狀態管理（前端 `Next.js`：Host/Participant 視圖）。
- 新增伺服器端即時通訊與 Room 狀態權威（後端 `Node.js + NestJS`：投票收集、亮牌廣播、倒數計時）。
- 新增規則引擎（Fibonacci 範圍判定、平均、最高/最低移除、`?` 對流程的影響）。
