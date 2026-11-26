import { addDays } from './format';

export type Streak = { current: number; longest: number; loggedToday: boolean };

/**
 * current: consecutive days with an expense, ending today — or yesterday,
 * so a streak isn't shown as broken before today is over.
 */
export function computeStreak(days: Set<string>, today: string): Streak {
  const loggedToday = days.has(today);
  let current = 0;
  for (let d = loggedToday ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;

  let longest = 0, run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest, loggedToday };
}
