import type { Streak } from '../streak';

export function StreakBar({ streak }: { streak: Streak }) {
  const { current, longest, loggedToday } = streak;
  return (
    <div class={'streak' + (loggedToday ? ' done' : '')}>
      <span class="streak-main">
        <span class="streak-flame" aria-hidden="true">{current > 0 ? '🔥' : '✏️'}</span>
        {current > 0 ? (
          <span><strong>連續 {current} 天</strong>{!loggedToday && <span class="muted"> · 今天記一筆就能延續</span>}</span>
        ) : (
          <span class="muted">今天記一筆，開始累積連續天數</span>
        )}
      </span>
      {longest > 1 && <span class="muted streak-best">最長 {longest} 天</span>}
    </div>
  );
}
