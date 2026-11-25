import { useCallback, useEffect, useState } from 'preact/hooks';
import { createExpense, listExpenses } from '../api';
import { useApp } from '../context';
import { money, sum, today } from '../format';
import type { Expense } from '../types';
import { ExpenseForm } from '../components/ExpenseForm';
import { ExpenseRow } from '../components/ExpenseRow';

export function AddPage() {
  const { byId, toast } = useApp();
  const [formKey, setFormKey] = useState(0);
  const [todays, setTodays] = useState<Expense[]>([]);

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
        onSubmit={async (v) => {
          try {
            await createExpense(v);
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
            {todays.map((e) => <ExpenseRow key={e.id} e={e} />)}
          </div>
        </section>
      )}
    </>
  );
}
