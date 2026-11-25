import { supabase } from './supabase';
import type { Category, Expense, ExpenseInput } from './types';

const DEFAULT_CATEGORIES: Pick<Category, 'name' | 'emoji' | 'color'>[] = [
  { name: '飲食', emoji: '🍜', color: 2 },
  { name: '交通', emoji: '🚌', color: 1 },
  { name: '娛樂', emoji: '🎮', color: 7 },
  { name: '購物', emoji: '🛍️', color: 5 },
  { name: '居家', emoji: '🏠', color: 3 },
  { name: '醫療', emoji: '💊', color: 8 },
  { name: '其他', emoji: '📦', color: 4 },
];

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const toExpense = (r: Expense): Expense => ({ ...r, amount: Number(r.amount) });

export async function listCategories(): Promise<Category[]> {
  const rows = check(
    await supabase.from('categories').select('*').order('sort_order').order('created_at'),
  );
  if (rows.length > 0) return rows;
  // First login: seed defaults. ignoreDuplicates makes concurrent seeding harmless.
  check(
    await supabase.from('categories').upsert(
      DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort_order: i })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    ),
  );
  return check(
    await supabase.from('categories').select('*').order('sort_order').order('created_at'),
  );
}

export async function createCategory(c: Omit<Category, 'id' | 'archived'>) {
  check(await supabase.from('categories').insert(c));
}

export async function updateCategory(id: string, patch: Partial<Omit<Category, 'id'>>) {
  check(await supabase.from('categories').update(patch).eq('id', id));
}

export async function deleteCategory(id: string) {
  check(await supabase.from('categories').delete().eq('id', id));
}

export async function countExpensesInCategory(id: string): Promise<number> {
  const res = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

/** Expenses with spent_on in [from, to], newest first. Pages past PostgREST's row cap. */
export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  const PAGE = 1000;
  const out: Expense[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = check(
      await supabase
        .from('expenses')
        .select('*')
        .gte('spent_on', from)
        .lte('spent_on', to)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE - 1),
    ) as Expense[];
    out.push(...rows.map(toExpense));
    if (rows.length < PAGE) return out;
  }
}

export async function createExpense(e: ExpenseInput) {
  check(await supabase.from('expenses').insert(e));
}

export async function updateExpense(id: string, e: ExpenseInput) {
  check(await supabase.from('expenses').update(e).eq('id', id));
}

export async function deleteExpense(id: string) {
  check(await supabase.from('expenses').delete().eq('id', id));
}
