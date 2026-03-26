# AgileTools

## Planning Poker（Web）

Monorepo：`apps/web`（Next.js 14）與 `apps/server`（NestJS 11 + Socket.IO）。

### 本機開發

1. 在 repo 根目錄安裝依賴：`npm install`
2. 複製環境變數範例：
   - `apps/server/.env.example` → `apps/server/.env`（可選）
   - `apps/web/.env.example` → `apps/web/.env.local`（可選；設定 `NEXT_PUBLIC_WS_ORIGIN` 指向後端）
3. 開發模式擇一：
   - **一鍵前後端**：`npm run dev` 或 `make dev`（並行啟動 server + web；後端在 **成功 listen** 時會由 Nest 印出「後端已就緒」與埠號；前端在 Next 就緒後會再印出一段「開發環境：前後端埠號」彙整）
   - **分開兩個終端機**：後端 `npm run dev:server`（預設 `http://localhost:4000`，namespace `/planning-poker`）、前端 `npm run dev:web`（預設 `http://localhost:3000`）
4. 瀏覽器開啟前端網址；由 Host 建立房間、分享房間代碼給其他人加入。

### 跨網域／不同埠

- 前端開發固定使用 **`next dev -p 3000`**（見 `apps/web/scripts/start-next-dev.cjs`）；若要改埠請一併修改該腳本與 `NEXT_PUBLIC_WS_ORIGIN`／`WEB_ORIGIN`。
- 後端埠由環境變數 **`PORT`** 控制（預設 4000，與 `apps/server/src/main.ts` 一致）；彙整區塊會用同一 `PORT` 顯示後端網址。
- 後端 `WEB_ORIGIN` 需與前端來源一致（見 `apps/server/.env.example`），以便 CORS 與 Socket.IO 連線。
- 前端 `NEXT_PUBLIC_WS_ORIGIN` 必須指向 Nest 的基底 URL（含埠號、無尾階 path）。

### 驗證多房間隔離

開啟兩組瀏覽器視窗（或一般 + 無痕），各自建立不同房間並投票：倒數、亮牌與結果應互不影響。

### 測試

```bash
npm run test:server
```

### 建置

```bash
npm run build
```
