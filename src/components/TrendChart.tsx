import { useEffect, useRef, useState } from 'preact/hooks';
import { axisMoney, money } from '../format';

export type TrendBin = { label: string; title: string; value: number; showLabel: boolean };

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Single-series column chart with a per-column hover/tap tooltip. */
export function TrendChart({ bins, color, ariaLabel }: { bins: TrendBin[]; color: string; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 168, padT = 10, padB = 22, padL = 44, padR = 10;
  const plotH = H - padT - padB;
  const plotW = w - padL - padR;
  const maxV = Math.max(0, ...bins.map((b) => b.value));
  const step = maxV > 0 ? niceStep(maxV / 3) : 100;
  const top = Math.max(step, Math.ceil(maxV / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = plotW / bins.length;
  const bw = Math.max(2, Math.min(24, band - 2, band * 0.72));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const base = padT + plotH;

  const bar = (x: number, v: number) => {
    const yy = y(v);
    const h = base - yy;
    const r = Math.min(4, bw / 2, h);
    return `M${x},${base}V${yy + r}A${r},${r} 0 0 1 ${x + r},${yy}H${x + bw - r}A${r},${r} 0 0 1 ${x + bw},${yy + r}V${base}Z`;
  };

  const a = active !== null ? bins[active] : null;
  const tipX = active !== null ? padL + band * active + band / 2 : 0;

  return (
    <div class="chart" ref={ref} onPointerLeave={() => setActive(null)}>
      <svg width={w} height={H} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} class={t === 0 ? 'axis' : 'grid'} />
            <text x={padL - 8} y={y(t)} class="tick" text-anchor="end" dominant-baseline="middle">{axisMoney(t)}</text>
          </g>
        ))}
        {bins.map((b, i) => {
          const x = padL + band * i + (band - bw) / 2;
          return (
            <g key={i}>
              {b.value > 0 && (
                <path d={bar(x, b.value)} fill={color}
                  opacity={active === null || active === i ? 1 : 0.35} />
              )}
              {b.showLabel && (
                <text x={x + bw / 2} y={H - 6} class="tick" text-anchor="middle">{b.label}</text>
              )}
              <rect x={padL + band * i} y={padT} width={band} height={plotH + padB} fill="transparent"
                onPointerEnter={() => setActive(i)} onClick={() => setActive(i)} />
            </g>
          );
        })}
      </svg>
      {a && (
        <div class="tooltip" style={{ left: `${Math.min(Math.max(tipX, 60), w - 60)}px` }}>
          <span class="muted">{a.title}</span>
          <strong>{money(a.value)}</strong>
        </div>
      )}
    </div>
  );
}
