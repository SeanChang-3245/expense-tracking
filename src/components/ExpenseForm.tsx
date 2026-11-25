import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp } from '../context';
import { addDays, today } from '../format';
import { load, save } from '../storage';
import type { ExpenseInput } from '../types';

const LAST_CAT = 'lastCategoryId';

export function ExpenseForm({ initial, submitLabel, onSubmit, onDelete, noteSuggestions }: {
  initial?: ExpenseInput;
  /** Per-category note to fill in, only while the user hasn't typed one. */
  noteSuggestions?: Record<string, string> | null;
  submitLabel: string;
  onSubmit: (v: ExpenseInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { categories, byId } = useApp();
  const visible = useMemo(
    () => categories.filter((c) => !c.archived || c.id === initial?.category_id),
    [categories, initial],
  );
  const defaultCat = () => {
    if (initial) return initial.category_id;
    const last = load(LAST_CAT);
    return last && byId.get(last) && !byId.get(last)!.archived ? last : visible[0]?.id ?? '';
  };

  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(defaultCat);
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.spent_on ?? today());
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const noteTouched = useRef(false);

  // Follow the selected category: swap in its nearby note, or drop an
  // auto-filled note that belonged to another category.
  useEffect(() => {
    if (noteTouched.current || !noteSuggestions) return;
    const s = noteSuggestions[categoryId];
    setNote(s ?? '');
    setSuggested(Boolean(s));
  }, [noteSuggestions, categoryId]);

  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0 && Boolean(byId.get(categoryId)) && Boolean(date);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        amount: Math.round(value * 100) / 100,
        category_id: categoryId,
        note: note.trim() || null,
        spent_on: date,
      });
      save(LAST_CAT, categoryId);
    } finally {
      setBusy(false);
    }
  };

  const t = today();
  const y = addDays(t, -1);

  return (
    <form class="expense-form" onSubmit={submit}>
      <label class="amount-field">
        <span class="currency">$</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          aria-label="金額"
          value={amount}
          autoFocus={!initial}
          onInput={(e) => setAmount((e.target as HTMLInputElement).value.replace(/[^\d.]/g, ''))}
        />
      </label>

      <div class="cat-grid" role="radiogroup" aria-label="分類">
        {visible.map((c) => (
          <button
            type="button"
            key={c.id}
            role="radio"
            aria-checked={c.id === categoryId}
            class={'cat-chip' + (c.id === categoryId ? ' selected' : '')}
            style={{ '--cat': `var(--c${c.color})` }}
            onClick={() => setCategoryId(c.id)}
          >
            <span class="cat-emoji">{c.emoji || '•'}</span>
            <span class="cat-name">{c.name}</span>
          </button>
        ))}
      </div>

      <div class="note-field">
        <input
          class="input"
          type="text"
          placeholder="備註（選填）"
          aria-label="備註"
          maxLength={100}
          value={note}
          onInput={(e) => {
            noteTouched.current = true;
            setSuggested(false);
            setNote((e.target as HTMLInputElement).value);
          }}
        />
        {suggested && (
          <span class="note-hint">
            📍 這附近上次記「{byId.get(categoryId)?.name}」的備註
            <button type="button" class="link" onClick={() => {
              noteTouched.current = true;
              setSuggested(false);
              setNote('');
            }}>清除</button>
          </span>
        )}
      </div>

      <div class="date-row">
        <button type="button" class={'pill' + (date === t ? ' on' : '')} onClick={() => setDate(t)}>今天</button>
        <button type="button" class={'pill' + (date === y ? ' on' : '')} onClick={() => setDate(y)}>昨天</button>
        <input
          class="input date-input"
          type="date"
          aria-label="日期"
          value={date}
          max={t}
          onInput={(e) => setDate((e.target as HTMLInputElement).value)}
        />
      </div>

      <button class="btn primary big" type="submit" disabled={!valid || busy}>
        {busy ? '儲存中…' : submitLabel}
      </button>
      {onDelete && (
        <button
          type="button"
          class="btn danger-text"
          disabled={busy}
          onClick={async () => {
            if (!confirm('確定刪除這筆記錄？')) return;
            setBusy(true);
            try { await onDelete(); } finally { setBusy(false); }
          }}
        >
          刪除這筆
        </button>
      )}
    </form>
  );
}
