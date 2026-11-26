import { supabase } from './supabase';
import { distanceM, NEARBY_RADIUS_M, SAME_PLACE_M, type Position } from './geo';
import type { Category, Expense, ExpenseInput, Person, Streak } from './types';

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

const selectCategories = async (userId: string) =>
  check(
    await supabase.from('categories').select('*').eq('user_id', userId).order('sort_order').order('created_at'),
  ) as Category[];

/** A user's categories. For the signed-in user, seeds defaults on first use. */
export async function listCategories(userId: string, seed = false): Promise<Category[]> {
  const rows = await selectCategories(userId);
  if (rows.length > 0 || !seed) return rows;
  // First login: seed defaults. ignoreDuplicates makes concurrent seeding harmless.
  check(
    await supabase.from('categories').upsert(
      DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort_order: i })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    ),
  );
  return selectCategories(userId);
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
export async function listExpenses(userId: string, from: string, to: string): Promise<Expense[]> {
  const PAGE = 1000;
  const out: Expense[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = check(
      await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
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

/** Insert an expense; its location (if any) goes to the private locations table. */
export async function createExpense(e: ExpenseInput, pos?: Position | null) {
  const row = check(await supabase.from('expenses').insert(e).select('id').single()) as { id: string };
  if (pos) {
    // The expense is saved either way; a lost location only affects note suggestions.
    await supabase.from('expense_locations').insert({ expense_id: row.id, latitude: pos.lat, longitude: pos.lng });
  }
}

export async function updateExpense(id: string, e: ExpenseInput) {
  check(await supabase.from('expenses').update(e).eq('id', id));
}

export async function deleteExpense(id: string) {
  check(await supabase.from('expenses').delete().eq('id', id));
}

/**
 * For each category: among its expenses within NEARBY_RADIUS_M of `pos`, find
 * the closest place, then return the newest note recorded at that place
 * (records within SAME_PLACE_M of the closest one).
 * Bounding-box query in the database, exact distance check here.
 */
export async function findNotesNear(pos: Position): Promise<Record<string, string>> {
  const dLat = NEARBY_RADIUS_M / 111320;
  const dLng = NEARBY_RADIUS_M / (111320 * Math.cos((pos.lat * Math.PI) / 180));
  // expense_locations is readable only by its owner, so these are always our own.
  const res = check(
    await supabase
      .from('expense_locations')
      .select('latitude, longitude, expenses!inner(note, category_id)')
      .not('expenses.note', 'is', null)
      .neq('expenses.note', '')
      .gte('latitude', pos.lat - dLat)
      .lte('latitude', pos.lat + dLat)
      .gte('longitude', pos.lng - dLng)
      .lte('longitude', pos.lng + dLng)
      .order('created_at', { ascending: false })
      .limit(500),
  ) as unknown as { latitude: number; longitude: number; expenses: { note: string; category_id: string } }[];
  const rows = res.map((r) => ({ ...r.expenses, latitude: r.latitude, longitude: r.longitude }));

  type Hit = { note: string; lat: number; lng: number; d: number };
  const byCat = new Map<string, Hit[]>(); // each list stays newest first
  for (const r of rows) {
    const d = distanceM(pos.lat, pos.lng, r.latitude, r.longitude);
    if (d > NEARBY_RADIUS_M) continue;
    if (!byCat.has(r.category_id)) byCat.set(r.category_id, []);
    byCat.get(r.category_id)!.push({ note: r.note, lat: r.latitude, lng: r.longitude, d });
  }

  const out: Record<string, string> = {};
  for (const [cat, hits] of byCat) {
    const nearest = hits.reduce((a, b) => (b.d < a.d ? b : a));
    const newestThere = hits.find((h) => distanceM(h.lat, h.lng, nearest.lat, nearest.lng) <= SAME_PLACE_M)!;
    out[cat] = newestThere.note;
  }
  return out;
}

/** Streak computed in the database, so private expenses count without being revealed. */
export async function getStreak(userId: string, today: string): Promise<Streak | null> {
  const rows = check(await supabase.rpc('streak_stats', { target: userId, today })) as
    { current_streak: number; longest_streak: number; logged_today: boolean }[];
  const r = rows[0];
  return r ? { current: r.current_streak, longest: r.longest_streak, loggedToday: r.logged_today } : null;
}

export async function isNoSpendDay(userId: string, day: string): Promise<boolean> {
  const rows = check(
    await supabase.from('no_spend_days').select('day').eq('user_id', userId).eq('day', day),
  ) as unknown[];
  return rows.length > 0;
}

export async function markNoSpend(day: string) {
  check(await supabase.from('no_spend_days').upsert({ day }, { onConflict: 'user_id,day', ignoreDuplicates: true }));
}

export async function unmarkNoSpend(userId: string, day: string) {
  check(await supabase.from('no_spend_days').delete().eq('user_id', userId).eq('day', day));
}

// ── Sharing ─────────────────────────────────────────────────
export type Sharing = { canView: Person[]; viewers: Person[]; myName: string | null };

/** Who shares with me, who I share with, and display names for all of them. */
export async function loadSharing(me: string): Promise<Sharing> {
  const shares = check(await supabase.from('shares').select('owner_id, viewer_id')) as
    { owner_id: string; viewer_id: string }[];
  const canViewIds = shares.filter((s) => s.viewer_id === me).map((s) => s.owner_id);
  const viewerIds = shares.filter((s) => s.owner_id === me).map((s) => s.viewer_id);
  const ids = [...new Set([me, ...canViewIds, ...viewerIds])];
  const profiles = check(await supabase.from('profiles').select('id, display_name').in('id', ids)) as
    { id: string; display_name: string }[];
  const names = new Map(profiles.map((p) => [p.id, p.display_name]));
  const person = (id: string): Person => ({ id, name: names.get(id) ?? '對方' });
  return { canView: canViewIds.map(person), viewers: viewerIds.map(person), myName: names.get(me) ?? null };
}

export async function saveDisplayName(me: string, name: string) {
  check(await supabase.from('profiles').upsert({ id: me, display_name: name }, { onConflict: 'id' }));
}
