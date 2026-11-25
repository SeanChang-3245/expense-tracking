export const pad = (n: number) => String(n).padStart(2, '0');
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => toYmd(new Date());
export const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return toYmd(d);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function dayLabel(s: string) {
  const t = today();
  const d = parseYmd(s);
  const base = `${d.getMonth() + 1}月${d.getDate()}日 週${WEEKDAYS[d.getDay()]}`;
  if (s === t) return `今天 · ${base}`;
  if (s === addDays(t, -1)) return `昨天 · ${base}`;
  return base;
}

export const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Axis tick: full under 10,000, compact (萬) at or above. */
export const axisMoney = (n: number) =>
  n >= 10000 ? `${+(n / 10000).toFixed(1)}萬` : n.toLocaleString('en-US');

export const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

// ── Periods for the analysis page ────────────────────────────
export type PeriodKind = 'week' | 'month' | 'year';
export type Bin = { key: string; label: string; title: string };
export type Period = {
  kind: PeriodKind;
  start: string;
  end: string;
  label: string;
  bins: Bin[];
  binKey: (spentOn: string) => string;
};

export function getPeriod(kind: PeriodKind, offset: number): Period {
  const now = new Date();
  if (kind === 'week') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayShift = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - mondayShift + offset * 7);
    const start = toYmd(d);
    const end = addDays(start, 6);
    const bins = Array.from({ length: 7 }, (_, i) => {
      const k = addDays(start, i);
      const dd = parseYmd(k);
      return { key: k, label: WEEKDAYS[dd.getDay()], title: `${dd.getMonth() + 1}/${dd.getDate()} 週${WEEKDAYS[dd.getDay()]}` };
    });
    const s = parseYmd(start), e = parseYmd(end);
    return {
      kind, start, end, bins, binKey: (x) => x,
      label: `${s.getMonth() + 1}/${s.getDate()} – ${e.getMonth() + 1}/${e.getDate()}`,
    };
  }
  if (kind === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const start = toYmd(first);
    const m = first.getMonth() + 1;
    const bins = Array.from({ length: last.getDate() }, (_, i) => {
      const k = addDays(start, i);
      return { key: k, label: String(i + 1), title: `${m}/${i + 1} 週${WEEKDAYS[parseYmd(k).getDay()]}` };
    });
    return {
      kind, start, end: toYmd(last), bins, binKey: (x) => x,
      label: `${first.getFullYear()}年${m}月`,
    };
  }
  const y = now.getFullYear() + offset;
  const bins = Array.from({ length: 12 }, (_, i) => ({
    key: `${y}-${pad(i + 1)}`, label: String(i + 1), title: `${y}年${i + 1}月`,
  }));
  return {
    kind, start: `${y}-01-01`, end: `${y}-12-31`, bins, binKey: (x) => x.slice(0, 7),
    label: `${y}年`,
  };
}
