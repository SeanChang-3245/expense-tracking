import { useEffect, useState } from 'preact/hooks';
import { countExpensesInCategory, createCategory, deleteCategory, listExpenses, saveDisplayName, updateCategory } from '../api';
import { useApp } from '../context';
import { supabase } from '../supabase';
import { today } from '../format';
import { geoEnabled, getPosition, setGeoEnabled } from '../geo';
import type { Category } from '../types';
import { Sheet } from '../components/Sheet';
import { Dot } from '../components/CategoryDot';

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];

export function SettingsPage() {
  const { me, email, categories, byId, reloadCategories, sharing, reloadSharing, toast } = useApp();
  const [name, setName] = useState(sharing.myName ?? '');
  useEffect(() => { setName(sharing.myName ?? ''); }, [sharing.myName]);
  const [savingName, setSavingName] = useState(false);

  const saveName = async (e: Event) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setSavingName(true);
    try { await saveDisplayName(me, n); await reloadSharing(); toast('已更新名稱'); }
    catch (err) { toast(`儲存失敗：${(err as Error).message}`); }
    setSavingName(false);
  };
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [geoOn, setGeoOn] = useState(geoEnabled);

  const toggleGeo = async () => {
    const next = !geoOn;
    setGeoEnabled(next);
    setGeoOn(next);
    // Turning it on asks for permission right away, so the first entry isn't delayed.
    if (next && !(await getPosition())) toast('無法取得位置，請確認已允許定位權限');
  };

  const move = async (i: number, dir: -1 | 1) => {
    const order = [...categories];
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    try {
      await Promise.all(order.map((c, j) => (c.sort_order !== j ? updateCategory(c.id, { sort_order: j }) : null)));
      await reloadCategories();
    } catch (e) { toast(`排序失敗：${(e as Error).message}`); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await listExpenses(me, '1900-01-01', '2999-12-31');
      const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
      const lines = [['日期', '分類', '金額', '備註'].join(',')];
      for (const r of [...rows].reverse()) {
        lines.push([r.spent_on, esc(byId.get(r.category_id)?.name ?? ''), String(r.amount), esc(r.note ?? '')].join(','));
      }
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `expenses-${today()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast(`匯出失敗：${(e as Error).message}`); }
    setExporting(false);
  };

  return (
    <>
      <section class="section">
        <div class="section-head">
          <h2>分類</h2>
          <button class="link" onClick={() => setEditing('new')}>＋ 新增</button>
        </div>
        <div class="card list">
          {categories.map((c, i) => (
            <div class={'row static' + (c.archived ? ' archived' : '')} key={c.id}>
              <button class="row-hit" onClick={() => setEditing(c)}>
                <span class="row-icon">{c.emoji || '•'}</span>
                <span class="row-main">
                  <span class="row-title"><Dot color={c.color} /> {c.name}</span>
                  {c.archived && <span class="row-sub">已隱藏</span>}
                </span>
              </button>
              <span class="reorder">
                <button class="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">↑</button>
                <button class="icon-btn sm" disabled={i === categories.length - 1} onClick={() => move(i, 1)} aria-label="下移">↓</button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>位置</h2></div>
        <div class="card list">
          <button class="row" role="switch" aria-checked={geoOn} onClick={toggleGeo}>
            <span class="row-main">
              <span class="row-title">依位置自動帶入備註</span>
              <span class="row-sub">記帳時儲存位置；在附近再記同一分類時，帶入該分類上次的備註</span>
            </span>
            <span class={'switch' + (geoOn ? ' on' : '')} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>資料</h2></div>
        <div class="card list">
          <button class="row" onClick={exportCsv} disabled={exporting}>
            <span class="row-main"><span class="row-title">{exporting ? '匯出中…' : '匯出 CSV'}</span></span>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>共享</h2></div>
        <div class="card list">
          <form class="row static name-row" onSubmit={saveName}>
            <span class="row-main">
              <span class="row-sub">你的名稱（對方看到的）</span>
              <input class="plain-input" placeholder="例如：小明" maxLength={20} value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            </span>
            {name.trim() && name.trim() !== (sharing.myName ?? '') && (
              <button class="link" disabled={savingName}>儲存</button>
            )}
          </form>
          {sharing.canView.length + sharing.viewers.length === 0 ? (
            <div class="row static"><span class="row-main"><span class="row-sub">
              還沒有和任何人共享。設定方式見 README 的「共享」說明。
            </span></span></div>
          ) : (
            <>
              <div class="row static"><span class="row-main">
                <span class="row-title">你看得到</span>
                <span class="row-sub">{sharing.canView.map((p) => p.name).join('、') || '沒有人'}的帳</span>
              </span></div>
              <div class="row static"><span class="row-main">
                <span class="row-title">看得到你的帳</span>
                <span class="row-sub">{sharing.viewers.map((p) => p.name).join('、') || '沒有人'} · 位置與標為 🔒 的記錄不會分享</span>
              </span></div>
            </>
          )}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>帳號</h2></div>
        <div class="card list">
          <div class="row static"><span class="row-main"><span class="row-title">{email}</span></span></div>
          <button class="row" onClick={() => supabase.auth.signOut()}>
            <span class="row-main"><span class="row-title danger">登出</span></span>
          </button>
        </div>
      </section>

      {editing && (
        <CategoryEditor
          cat={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await reloadCategories(); }}
          nextOrder={categories.length}
        />
      )}
    </>
  );
}

function CategoryEditor({ cat, onClose, onSaved, nextOrder }: {
  cat: Category | null; onClose: () => void; onSaved: () => Promise<void>; nextOrder: number;
}) {
  const { toast } = useApp();
  const [name, setName] = useState(cat?.name ?? '');
  const [emoji, setEmoji] = useState(cat?.emoji ?? '');
  const [color, setColor] = useState(cat?.color ?? 1);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); await onSaved(); }
    catch (e) {
      const m = (e as Error).message;
      toast(m.includes('duplicate') ? '已有同名分類' : `失敗：${m}`);
    }
    setBusy(false);
  };

  const save = (e: Event) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    run(
      () => (cat ? updateCategory(cat.id, { name: n, emoji: emoji.trim(), color })
        : createCategory({ name: n, emoji: emoji.trim(), color, sort_order: nextOrder })),
      cat ? '已更新分類' : '已新增分類',
    );
  };

  const remove = async () => {
    if (!cat) return;
    const n = await countExpensesInCategory(cat.id).catch(() => -1);
    if (n !== 0) {
      toast(n > 0 ? `這個分類有 ${n} 筆記錄，無法刪除，可以改為隱藏` : '無法確認是否有記錄');
      return;
    }
    if (!confirm(`刪除分類「${cat.name}」？`)) return;
    run(() => deleteCategory(cat.id), '已刪除分類');
  };

  return (
    <Sheet title={cat ? '編輯分類' : '新增分類'} onClose={onClose}>
      <form class="stack" onSubmit={save}>
        <div class="emoji-name">
          <input class="input emoji-input" placeholder="🙂" aria-label="圖示" value={emoji} maxLength={4}
            onInput={(e) => setEmoji((e.target as HTMLInputElement).value)} />
          <input class="input" placeholder="名稱" aria-label="名稱" value={name} maxLength={20} required
            autoFocus={!cat} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </div>
        <div class="swatches" role="radiogroup" aria-label="顏色">
          {SLOTS.map((s) => (
            <button type="button" key={s} role="radio" aria-checked={color === s} aria-label={`顏色 ${s}`}
              class={'swatch' + (color === s ? ' on' : '')} style={{ background: `var(--c${s})` }}
              onClick={() => setColor(s)} />
          ))}
        </div>
        <button class="btn primary big" disabled={busy || !name.trim()}>儲存</button>
        {cat && (
          <div class="split">
            <button type="button" class="btn" disabled={busy}
              onClick={() => run(() => updateCategory(cat.id, { archived: !cat.archived }), cat.archived ? '已顯示' : '已隱藏')}>
              {cat.archived ? '取消隱藏' : '隱藏'}
            </button>
            <button type="button" class="btn danger-text" disabled={busy} onClick={remove}>刪除</button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
