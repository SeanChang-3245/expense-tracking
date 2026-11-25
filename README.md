# 記帳

乾淨、無廣告的個人記帳 App。前端放在 GitHub Pages，資料存在 Supabase。

- **記帳**：輸入金額、選分類、加備註，日期預設今天
- **明細**：依月份瀏覽，可依分類篩選、搜尋備註，點一下即可編輯或刪除
- **分析**：週／月／年總支出、與上期同期比較、分類占比、每日（每月）趨勢、最大筆支出；點分類可聚焦
- **設定**：自訂分類（名稱、emoji、顏色、排序、隱藏）、匯出 CSV

技術：Vite + Preact + TypeScript，Supabase（Postgres + Auth + Row Level Security）。

## 第一次設定

### 1. Supabase

1. 到 [supabase.com](https://supabase.com) 建立專案。
2. **SQL Editor** → 貼上 [`supabase/schema.sql`](supabase/schema.sql) 全部內容並執行。
3. **Authentication → Users → Add user**：用你的 email + 密碼建立帳號，勾選 *Auto Confirm User*。
4. **Authentication → Sign In / Providers**：關閉 *Allow new users to sign up*，這樣只有你能登入。
5. **Project Settings → API**：記下 *Project URL* 與 *anon / publishable key*。
   （這把 key 本來就設計成可以公開放在前端；資料安全由 RLS 保護。）

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

## 之後的規劃

- **定位快速填備註**：`expenses` 表已預留 `latitude` / `longitude`。之後用瀏覽器 Geolocation API 取得位置，再查附近店家（例如 Google Places 或 OpenStreetMap），列出候選讓你一點就填入備註。
