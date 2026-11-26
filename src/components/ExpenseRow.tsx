import { useApp } from '../context';
import { money } from '../format';
import type { Category, Expense } from '../types';
import { Dot } from './CategoryDot';

export function ExpenseRow({ e, onClick, meta, cats }: {
  e: Expense;
  onClick?: () => void;
  meta?: string;
  /** Category lookup for someone else's expenses; defaults to my own. */
  cats?: Map<string, Category>;
}) {
  const { byId } = useApp();
  const c = (cats ?? byId).get(e.category_id);
  return (
    <button class="row" onClick={onClick} disabled={!onClick}>
      <span class="row-icon">{c?.emoji || '•'}</span>
      <span class="row-main">
        <span class="row-title">{e.note || c?.name || '未分類'}</span>
        <span class="row-sub">
          {c && <Dot color={c.color} />}
          {c?.name}{meta ? ` · ${meta}` : ''}
          {e.private && <span title="不分享" aria-label="不分享">🔒</span>}
        </span>
      </span>
      <span class="row-amount">{money(e.amount)}</span>
      {onClick && <span class="chevron" aria-hidden="true">›</span>}
    </button>
  );
}
