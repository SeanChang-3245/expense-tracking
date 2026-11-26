import { useEffect, useMemo, useState } from 'preact/hooks';
import { listExpenses } from '../api';
import { useApp } from '../context';
import { addDays, daysBetween, getPeriod, money, parseYmd, sum, today, type PeriodKind } from '../format';
import type { Expense } from '../types';
import { TrendChart } from '../components/TrendChart';
import { ExpenseRow } from '../components/ExpenseRow';
import { PersonSwitch, usePersonCategories } from '../components/PersonSwitch';
import { EditExpenseSheet } from '../components/EditExpenseSheet';
import { Dot } from '../components/CategoryDot';

const KINDS: { id: PeriodKind; label: string; unit: string }[] = [
  { id: 'week', label: '週', unit: '週' },
  { id: 'month', label: '月', unit: '月' },
  { id: 'year', label: '年', unit: '年' },
];

export function StatsPage() {
  const { me, toast } = useApp();
  const [person, setPerson] = useState(me);
  const cats = usePersonCategories(person);
  const byId = cats?.byId ?? new Map();
  const isMe = person === me;
  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const period = useMemo(() => getPeriod(kind, offset), [kind, offset]);
  const prev = useMemo(() => getPeriod(kind, offset - 1), [kind, offset]);

  useEffect(() => {
    let alive = true;
    setRows(null);
    listExpenses(person, prev.start, period.end)
      .then((r) => alive && setRows(r))
      .catch((e) => { toast(`載入失敗：${(e as Error).message}`); alive && setRows([]); });
    return () => { alive = false; };
  }, [person, period, prev, toast, reloadKey]);

  const t = today();
  const totalDays = daysBetween(period.start, period.end) + 1;
  const isCurrent = period.start <= t && t <= period.end;
  const elapsed = isCurrent ? daysBetween(period.start, t) + 1 : totalDays;

  const stats = useMemo(() => {
    const all = rows ?? [];
    const cur = all.filter((r) => r.spent_on >= period.start && r.spent_on <= period.end);
    // For the running period, compare to the same number of days into the previous one.
    const prevEnd = isCurrent ? addDays(prev.start, elapsed - 1) : prev.end;
    const prevRows = all.filter((r) => r.spent_on >= prev.start && r.spent_on <= (prevEnd < prev.end ? prevEnd : prev.end));

    const byCat = new Map<string, number>();
    for (const r of cur) byCat.set(r.category_id, (byCat.get(r.category_id) ?? 0) + r.amount);
    const catRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

    const focused = focus ? cur.filter((r) => r.category_id === focus) : cur;
    const binSums = new Map<string, number>();
    for (const r of focused) {
      const k = period.binKey(r.spent_on);
      binSums.set(k, (binSums.get(k) ?? 0) + r.amount);
    }
    const bins = period.bins.map((b, i) => ({
      label: b.label,
      title: b.title,
      value: binSums.get(b.key) ?? 0,
      showLabel: kind !== 'month' || i === 0 || (i + 1) % 5 === 0,
    }));
    const top = [...focused].sort((a, b) => b.amount - a.amount).slice(0, 5);
    return { total: sum(cur), prevTotal: sum(prevRows), catRows, bins, top, focusedTotal: sum(focused), count: cur.length };
  }, [rows, period, prev, focus, isCurrent, elapsed, kind]);

  const unit = KINDS.find((k) => k.id === kind)!.unit;
  const delta = stats.prevTotal > 0 ? (stats.total - stats.prevTotal) / stats.prevTotal : null;
  const maxCat = stats.catRows[0]?.[1] ?? 0;
  const focusCat = focus ? byId.get(focus) : undefined;
  const future = period.start > t;

  return (
    <>
      <PersonSwitch value={person} onChange={(id) => { setPerson(id); setFocus(null); }} />
      <div class="segmented" role="tablist">
        {KINDS.map((k) => (
          <button key={k.id} role="tab" aria-selected={kind === k.id} class={kind === k.id ? 'on' : ''}
            onClick={() => { setKind(k.id); setOffset(0); }}>{k.label}</button>
        ))}
      </div>

      <div class="period-nav">
        <button class="icon-btn" onClick={() => setOffset(offset - 1)} aria-label={`上一${unit}`}>‹</button>
        <div class="period-label"><strong>{period.label}</strong></div>
        <button class="icon-btn" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label={`下一${unit}`}>›</button>
      </div>

      {rows === null || !cats ? (
        <p class="muted center-pad">載入中…</p>
      ) : future ? null : (
        <>
          <div class="card hero">
            <span class="muted">總支出</span>
            <span class="hero-num">{money(stats.total)}</span>
            <div class="hero-sub">
              <span>日均 {money(Math.round(stats.total / Math.max(1, elapsed)))}</span>
              <span>{stats.count} 筆</span>
              {delta !== null && (
                <span>
                  比上{unit}{isCurrent ? '同期' : ''}{delta >= 0 ? '多' : '少'} {Math.abs(Math.round(delta * 100))}%
                  {delta >= 0 ? ' ▲' : ' ▼'}
                </span>
              )}
            </div>
          </div>

          {stats.catRows.length > 0 && (
            <section class="section">
              <div class="section-head">
                <h2>分類</h2>
                {focus && <button class="link" onClick={() => setFocus(null)}>顯示全部</button>}
              </div>
              <div class="card list">
                {stats.catRows.map(([id, v]) => {
                  const c = byId.get(id);
                  const color = c?.color ?? 4;
                  return (
                    <button key={id} class={'cat-bar' + (focus && focus !== id ? ' dim' : '') + (focus === id ? ' on' : '')}
                      onClick={() => setFocus(focus === id ? null : id)} aria-pressed={focus === id}>
                      <span class="cat-bar-top">
                        <span class="cat-bar-name"><Dot color={color} />{c?.emoji} {c?.name ?? '已刪除'}</span>
                        <span class="cat-bar-val">
                          {money(v)}<span class="muted pct">{Math.round((v / stats.total) * 100)}%</span>
                        </span>
                      </span>
                      <span class="track">
                        <span class="fill" style={{ width: `${(v / maxCat) * 100}%`, background: `var(--c${color})` }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section class="section">
            <div class="section-head">
              <h2>{kind === 'year' ? '每月' : '每日'}支出{focusCat ? ` · ${focusCat.name}` : ''}</h2>
              {focusCat && <span class="muted">{money(stats.focusedTotal)}</span>}
            </div>
            <div class="card">
              <TrendChart
                bins={stats.bins}
                color={focusCat ? `var(--c${focusCat.color})` : 'var(--bar-neutral)'}
                ariaLabel={`${period.label}${kind === 'year' ? '每月' : '每日'}支出`}
              />
            </div>
          </section>

          {stats.top.length > 0 && (
            <section class="section">
              <div class="section-head"><h2>最大筆{focusCat ? ` · ${focusCat.name}` : ''}</h2></div>
              <div class="card list">
                {stats.top.map((e) => {
                  const d = parseYmd(e.spent_on);
                  return <ExpenseRow key={e.id} e={e} meta={`${d.getMonth() + 1}/${d.getDate()}`} cats={byId} onClick={isMe ? () => setEditing(e) : undefined} />;
                })}
              </div>
            </section>
          )}

          {stats.count === 0 && <p class="muted center-pad">這段期間沒有記錄</p>}
        </>
      )}
      {editing && (
        <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} onDone={() => setReloadKey((k) => k + 1)} />
      )}
    </>
  );
}
