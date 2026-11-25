import { useApp } from '../context';
import { money } from '../format';
import type { Expense } from '../types';
import { Dot } from './CategoryDot';

export function ExpenseRow({ e, onClick, meta }: { e: Expense; onClick?: () => void; meta?: string }) {
  const { byId } = useApp();
  const c = byId.get(e.category_id);
  return (
    <button class="row" onClick={onClick} disabled={!onClick}>
      <span class="row-icon">{c?.emoji || '•'}</span>
      <span class="row-main">
        <span class="row-title">{e.note || c?.name || '未分類'}</span>
        <span class="row-sub">
          {c && <Dot color={c.color} />}
          {c?.name}{meta ? ` · ${meta}` : ''}
        </span>
      </span>
      <span class="row-amount">{money(e.amount)}</span>
    </button>
  );
}
