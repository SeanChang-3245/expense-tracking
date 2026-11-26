import type { Person, Streak } from '../types';

export function StreakBar({ streak, others, hasExpenseToday, noSpendToday, busy, onMarkNoSpend, onUnmarkNoSpend }: {
  streak: Streak;
  /** People who share with me, with their streaks. */
  others: { person: Person; streak: Streak }[];
  hasExpenseToday: boolean;
  noSpendToday: boolean;
  busy: boolean;
  onMarkNoSpend: () => void;
  onUnmarkNoSpend: () => void;
}) {
  const { current, longest, loggedToday } = streak;
  return (
    <div class={'streak' + (loggedToday ? ' done' : '')}>
      <div class="streak-top">
        <span class="streak-main">
          <span class="streak-flame" aria-hidden="true">{current > 0 ? '🔥' : '✏️'}</span>
          {current > 0
            ? <strong>連續 {current} 天</strong>
            : <span class="muted">開始累積連續記帳天數</span>}
        </span>
        {longest > 1 && <span class="muted streak-best">最長 {longest} 天</span>}
      </div>
      {!loggedToday && (
        <div class="streak-sub">
          <span class="muted">{current > 0 ? '今天記一筆就能延續' : '今天記一筆就能開始'}</span>
          <button class="pill" disabled={busy} onClick={onMarkNoSpend}>今天沒花錢</button>
        </div>
      )}
      {noSpendToday && !hasExpenseToday && (
        <div class="streak-sub">
          <span class="muted">今天標記為沒有花費</span>
          <button class="link" disabled={busy} onClick={onUnmarkNoSpend}>取消</button>
        </div>
      )}
      {others.length > 0 && (
        <div class="streak-others">
          {others.map(({ person, streak: o }) => (
            <span key={person.id} class={'streak-other' + (o.loggedToday ? '' : ' pending')}>
              <span>{person.name}</span>
              <span class="streak-flame-sm" aria-hidden="true">🔥</span>
              <strong>{o.current} 天</strong>
              <span class="muted">{o.loggedToday ? '· 今天記了' : '· 今天還沒記'}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
