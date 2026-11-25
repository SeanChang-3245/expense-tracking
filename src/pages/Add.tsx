import { useCallback, useEffect, useState } from 'preact/hooks';
import { createExpense, findNotesNear, listExpenses } from '../api';
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
  }, []);
  useEffect(() => { loadToday(); }, [loadToday]);

  return (
    <>
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
          toast(`已記下 ${money(v.amount)} · ${byId.get(v.category_id)?.name ?? ''}`);
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
