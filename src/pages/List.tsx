import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { listExpenses } from '../api';
import { useApp } from '../context';
import { dayLabel, getPeriod, money, sum } from '../format';
import type { Expense } from '../types';
import { ExpenseRow } from '../components/ExpenseRow';
import { EditExpenseSheet } from '../components/EditExpenseSheet';
import { Dot } from '../components/CategoryDot';

export function ListPage() {
  const { categories, toast } = useApp();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const period = useMemo(() => getPeriod('month', offset), [offset]);

  const load = useCallback(async () => {
    setRows(null);
    try { setRows(await listExpenses(period.start, period.end)); }
    catch (e) { toast(`載入失敗：${(e as Error).message}`); setRows([]); }
  }, [period, toast]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) =>
      (!filter || r.category_id === filter) && (!q || (r.note ?? '').toLowerCase().includes(q)));
  }, [rows, filter, query]);

  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const r of shown) {
      if (!m.has(r.spent_on)) m.set(r.spent_on, []);
      m.get(r.spent_on)!.push(r);
    }
    return [...m.entries()];
  }, [shown]);

  const usedCats = useMemo(() => {
    const ids = new Set((rows ?? []).map((r) => r.category_id));
    return categories.filter((c) => ids.has(c.id));
  }, [rows, categories]);

  return (
    <>
      <div class="period-nav">
        <button class="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="上個月">‹</button>
        <div class="period-label">
          <strong>{period.label}</strong>
          <span class="muted">{rows ? money(sum(shown)) : '…'}</span>
        </div>
        <button class="icon-btn" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="下個月">›</button>
      </div>

      <input class="input search" type="search" placeholder="搜尋備註" value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />

      {usedCats.length > 1 && (
        <div class="filter-row">
          <button class={'pill' + (!filter ? ' on' : '')} onClick={() => setFilter(null)}>全部</button>
          {usedCats.map((c) => (
            <button key={c.id} class={'pill' + (filter === c.id ? ' on' : '')}
              onClick={() => setFilter(filter === c.id ? null : c.id)}>
              <Dot color={c.color} />{c.name}
            </button>
          ))}
        </div>
      )}

      {rows === null ? (
        <p class="muted center-pad">載入中…</p>
      ) : groups.length === 0 ? (
        <p class="muted center-pad">這個月還沒有記錄</p>
      ) : (
        groups.map(([day, items]) => (
          <section class="section" key={day}>
            <div class="section-head">
              <h2>{dayLabel(day)}</h2>
              <span class="muted">{money(sum(items))}</span>
            </div>
            <div class="card list">
              {items.map((e) => <ExpenseRow key={e.id} e={e} onClick={() => setEditing(e)} />)}
            </div>
          </section>
        ))
      )}

      {editing && <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} onDone={load} />}
    </>
  );
}
