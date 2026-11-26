import { useCallback, useEffect, useState } from 'preact/hooks';
import { createExpense, findNotesNear, listExpenseDays, listExpenses, listNoSpendDays, markNoSpend, unmarkNoSpend } from '../api';
import { computeStreak } from '../streak';
import { StreakBar } from '../components/StreakBar';
import { geoEnabled, getPosition, type Position } from '../geo';
import { useApp } from '../context';
import { money, sum, today } from '../format';
import type { Expense } from '../types';
import { ExpenseForm } from '../components/ExpenseForm';
import { ExpenseRow } from '../components/ExpenseRow';
import { EditExpenseSheet } from '../components/EditExpenseSheet';

export function AddPage() {
  const { byId, toast } = useApp();
  const [formKey, setFormKey] = useState(0);
  const [todays, setTodays] = useState<Expense[]>([]);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string> | null>(null);
  const [days, setDays] = useState<Set<string> | null>(null);
  const [noSpend, setNoSpend] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);

  // A fresh fix for every new entry (formKey changes after each save).
  useEffect(() => {
    if (!geoEnabled()) return;
    let alive = true;
    setPos(null);
    setSuggestions(null);
    getPosition().then(async (p) => {
      if (!alive || !p) return;
      setPos(p);
      try {
        const notes = await findNotesNear(p);
        if (alive) setSuggestions(notes);
      } catch { /* suggestion is optional */ }
    });
    return () => { alive = false; };
  }, [formKey]);

  const loadToday = useCallback(async () => {
    const t = today();
    try { setTodays(await listExpenses(t, t)); } catch { /* non-critical */ }
    try { setDays(await listExpenseDays()); } catch { /* non-critical */ }
    // Missing table (schema not updated yet) just means no marked days.
    try { setNoSpend(await listNoSpendDays()); } catch { /* non-critical */ }
  }, []);

  const loggedDays = days && new Set([...days, ...noSpend]);

  const toggleNoSpend = async (on: boolean) => {
    const t = today();
    setMarking(true);
    try {
      if (on) await markNoSpend(t); else await unmarkNoSpend(t);
      const next = new Set(noSpend);
      if (on) next.add(t); else next.delete(t);
      setNoSpend(next);
      if (on && days) toast(`已記下今天沒花錢 · 🔥 連續 ${computeStreak(new Set([...days, ...next]), t).current} 天`);
    } catch {
      toast('標記失敗：請確認已在 Supabase 執行最新的 schema.sql');
    }
    setMarking(false);
  };
  useEffect(() => { loadToday(); }, [loadToday]);

  return (
    <>
      {loggedDays && (
        <StreakBar
          streak={computeStreak(loggedDays, today())}
          hasExpenseToday={days!.has(today())}
          noSpendToday={noSpend.has(today())}
          busy={marking}
          onMarkNoSpend={() => toggleNoSpend(true)}
          onUnmarkNoSpend={() => toggleNoSpend(false)}
        />
      )}
      <ExpenseForm
        key={formKey}
        submitLabel="記一筆"
        noteSuggestions={suggestions}
        onSubmit={async (v) => {
          try {
            await createExpense(pos ? { ...v, latitude: pos.lat, longitude: pos.lng } : v);
          } catch (e) {
            toast(`儲存失敗：${(e as Error).message}`);
            throw e;
          }
          let msg = `已記下 ${money(v.amount)} · ${byId.get(v.category_id)?.name ?? ''}`;
          if (loggedDays) {
            const t = today();
            const before = computeStreak(loggedDays, t);
            const after = computeStreak(new Set(loggedDays).add(v.spent_on), t);
            if (after.current > before.current && after.loggedToday) msg += ` · 🔥 連續 ${after.current} 天`;
          }
          toast(msg);
          setFormKey((k) => k + 1);
          loadToday();
        }}
      />
      {todays.length > 0 && (
        <section class="section">
          <div class="section-head">
            <h2>今天</h2>
            <span class="muted">{money(sum(todays))}</span>
          </div>
          <div class="card list">
            {todays.map((e) => <ExpenseRow key={e.id} e={e} onClick={() => setEditing(e)} />)}
          </div>
        </section>
      )}
      {editing && <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} onDone={loadToday} />}
    </>
  );
}
