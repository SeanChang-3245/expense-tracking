import { useCallback, useEffect, useState } from 'preact/hooks';
import { createExpense, findNotesNear, getStreak, isNoSpendDay, listExpenses, markNoSpend, unmarkNoSpend } from '../api';
import { geoEnabled, getPosition, type Position } from '../geo';
import { useApp } from '../context';
import { money, sum, today } from '../format';
import type { Expense, Person, Streak } from '../types';
import { ExpenseForm } from '../components/ExpenseForm';
import { ExpenseRow } from '../components/ExpenseRow';
import { EditExpenseSheet } from '../components/EditExpenseSheet';
import { StreakBar } from '../components/StreakBar';

export function AddPage() {
  const { me, byId, sharing, toast } = useApp();
  const [formKey, setFormKey] = useState(0);
  const [todays, setTodays] = useState<Expense[]>([]);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string> | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [others, setOthers] = useState<{ person: Person; streak: Streak }[]>([]);
  const [noSpendToday, setNoSpendToday] = useState(false);
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

  /** Reloads today's list and streaks; returns my new streak. */
  const refresh = useCallback(async (): Promise<Streak | null> => {
    const t = today();
    let mine: Streak | null = null;
    await Promise.all([
      listExpenses(me, t, t).then(setTodays).catch(() => {}),
      getStreak(me, t).then((s) => { mine = s; setStreak(s); }).catch(() => {}),
      isNoSpendDay(me, t).then(setNoSpendToday).catch(() => {}),
      Promise.all(sharing.canView.map(async (person) => {
        const s = await getStreak(person.id, t).catch(() => null);
        return s && { person, streak: s };
      })).then((r) => setOthers(r.filter((x): x is { person: Person; streak: Streak } => Boolean(x)))),
    ]);
    return mine;
  }, [me, sharing]);
  useEffect(() => { refresh(); }, [refresh]);

  const toggleNoSpend = async (on: boolean) => {
    const t = today();
    setMarking(true);
    try {
      if (on) await markNoSpend(t); else await unmarkNoSpend(me, t);
      const s = await refresh();
      if (on && s) toast(`已記下今天沒花錢 · 🔥 連續 ${s.current} 天`);
    } catch {
      toast('標記失敗：請確認已在 Supabase 執行最新的 schema.sql');
    }
    setMarking(false);
  };

  return (
    <>
      {streak && (
        <StreakBar
          streak={streak}
          others={others}
          hasExpenseToday={todays.length > 0}
          noSpendToday={noSpendToday}
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
            await createExpense(v, pos);
          } catch (e) {
            toast(`儲存失敗：${(e as Error).message}`);
            throw e;
          }
          setFormKey((k) => k + 1);
          const before = streak;
          const after = await refresh();
          let msg = `已記下 ${money(v.amount)} · ${byId.get(v.category_id)?.name ?? ''}`;
          if (before && after && after.current > before.current && after.loggedToday) msg += ` · 🔥 連續 ${after.current} 天`;
          toast(msg);
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
      {editing && <EditExpenseSheet expense={editing} onClose={() => setEditing(null)} onDone={refresh} />}
    </>
  );
}
