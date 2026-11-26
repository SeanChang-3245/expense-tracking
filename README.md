# 記帳

乾淨、無廣告的個人記帳 App。前端放在 GitHub Pages，資料存在 Supabase。

- **記帳**：輸入金額、選分類、加備註，日期預設今天
- **明細**：依月份瀏覽，可依分類篩選、搜尋備註，點一下即可編輯或刪除
- **分析**：週／月／年總支出、與上期同期比較、分類占比、每日（每月）趨勢、最大筆支出；點分類可聚焦
- **連續記帳天數**：記帳頁顯示目前與最長的連續天數；沒花錢的日子可以按「今天沒花錢」，不會中斷
- **位置帶入備註**：記帳時儲存 GPS 位置；之後在 100 公尺內記帳時，依所選分類帶入該分類在附近最近一次的備註（每個分類各自記憶）（可在設定關閉）
- **設定**：自訂分類（名稱、emoji、顏色、排序、隱藏）、匯出 CSV

技術：Vite + Preact + TypeScript，Supabase（Postgres + Auth + Row Level Security）。

## 第一次設定

### 1. Supabase

1. 到 [supabase.com](https://supabase.com) 建立專案。
2. **SQL Editor** → 貼上 [`supabase/schema.sql`](supabase/schema.sql) 全部內容並執行。之後更新版本時若 schema 有變動，再整份執行一次即可（不會影響既有資料）。
3. **Authentication → Users → Add user**：用你的 email + 密碼建立帳號，勾選 *Auto Confirm User*。
4. **Authentication → Sign In / Providers**：關閉 *Allow new users to sign up*，這樣只有你能登入。
5. 取得兩個值（也可以點專案首頁上方的 **Connect** 按鈕一次看到）：
   - **Project URL**：`https://<project-ref>.supabase.co`，`<project-ref>` 就是後台網址 `supabase.com/dashboard/project/<project-ref>` 最後那串
   - **Key**：**Project Settings → API Keys** 的 *publishable key*（`sb_publishable_…`），或 Legacy 分頁的 `anon` key
   （這把 key 本來就設計成可以公開放在前端；資料安全由 RLS 保護。不要用 `secret` / `service_role`。）

### 2. GitHub

1. Repo **Settings → Secrets and variables → Actions → Variables** 新增兩個 *Repository variables*：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. **Settings → Pages → Source** 選 *GitHub Actions*。
3. Push 到 `main` 就會自動部署到 `https://<帳號>.github.io/expense-tracking/`。

### 3. 手機

用 Safari（iPhone）或 Chrome（Android）打開網址 → 分享 →「加入主畫面」，就能像 App 一樣全螢幕使用。

## 本機開發

```bash
cp .env.example .env.local   # 填入 Supabase URL 與 key
npm install
npm run dev
```
