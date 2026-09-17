import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDay, formatMediumDate } from '@/lib/date';
import { money, moneyAxis } from '@/lib/format';
import { useElementWidth } from '@/hooks/useElementWidth';
import type { ForecastDay } from '@/lib/types';

interface BalanceChartProps {
  days: ForecastDay[];
  /** The floor the user never wants to go below. Drawn as a reference line. */
  minimumBalance: number;
  height?: number;
  className?: string;
  /** Index at which confirmed history ends and projection begins. */
  projectedFrom?: number;
}

/**
 * Projected balance over time.
 *
 * Confirmed balance is a solid line; projected balance is dashed and lighter,
 * because forecast money must never look like money you already have. The
 * whole series is also exposed as a table to screen readers.
 *
 * The chart is drawn in real pixels against the measured container width, so
 * line weights and labels stay the same size on a phone and on a monitor.
 */
export const BalanceChart = ({
  days,
  minimumBalance,
  height,
  className,
  projectedFrom = 0,
}: BalanceChartProps) => {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useElementWidth<HTMLDivElement>(900);

  const compact = width < 560;
  const chartHeight = height ?? (compact ? 220 : 300);
  const pad = compact
    ? { top: 22, right: 10, bottom: 24, left: 44 }
    : { top: 26, right: 16, bottom: 28, left: 56 };

  const geometry = useMemo(() => {
    if (days.length === 0) return null;
    const values = days.map((d) => d.closing);
    const lo = Math.min(...values, minimumBalance);
    const hi = Math.max(...values, minimumBalance);

    // Pad the domain so the line never hugs the frame, but never invent a
    // negative axis when every balance in the series is positive.
    const span = Math.max(hi - lo, 1);
    const padded = lo - span * 0.18;
    const minV = lo >= 0 ? Math.max(0, padded) : padded;
    const maxV = hi + span * 0.14;

    const innerW = Math.max(width - pad.left - pad.right, 10);
    const innerH = Math.max(chartHeight - pad.top - pad.bottom, 10);
    const sx = (i: number) => pad.left + (days.length <= 1 ? 0 : (i / (days.length - 1)) * innerW);
    const sy = (v: number) => pad.top + innerH - ((v - minV) / (maxV - minV)) * innerH;

    const tickCount = compact ? 3 : 4;
    const ticks = Array.from({ length: tickCount }, (_, i) => minV + ((maxV - minV) / (tickCount - 1)) * i);

    return {
      points: days.map((d, i) => ({ x: sx(i), y: sy(d.closing), day: d })),
      sy,
      ticks,
      floorVisible: minimumBalance >= minV && minimumBalance <= maxV,
    };
  }, [days, minimumBalance, width, chartHeight, pad.left, pad.right, pad.top, pad.bottom, compact]);

  if (!geometry || days.length === 0) {
    return <div ref={ref} className={className} style={{ height: chartHeight }} />;
  }

  const { points, sy, ticks, floorVisible } = geometry;
  const splitAt = Math.min(Math.max(projectedFrom, 0), points.length - 1);

  const line = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

  const baseline = chartHeight - pad.bottom;
  const area = `${line(0, points.length - 1)} L ${points[points.length - 1]!.x.toFixed(1)},${baseline} L ${points[0]!.x.toFixed(1)},${baseline} Z`;

  const troughIndex = points.reduce((lo, p, i) => (p.day.closing < points[lo]!.day.closing ? i : lo), 0);
  const active = hover === null ? null : points[hover];
  const floorY = sy(minimumBalance);
  const labelStep = Math.max(1, Math.ceil(days.length / (compact ? 4 : 6)));
  const first = days[0]!;
  const last = days[days.length - 1]!;

  return (
    <figure ref={ref} className={cn('relative w-full', className)}>
      <svg
        width={width}
        height={chartHeight}
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="block max-w-full touch-none"
        role="img"
        aria-label={`Projected balance from ${formatMediumDate(first.date)} to ${formatMediumDate(last.date)}. Starting ${money(first.closing)}, lowest ${money(points[troughIndex]!.day.closing)} on ${formatMediumDate(points[troughIndex]!.day.date)}, ending ${money(last.closing)}.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = e.clientX - rect.left;
          const innerW = width - pad.left - pad.right;
          const idx = Math.round(((rel - pad.left) / innerW) * (days.length - 1));
          setHover(Math.min(days.length - 1, Math.max(0, idx)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--primary-strong))" stopOpacity="0.28" />
            <stop offset="70%" stopColor="rgb(var(--primary-strong))" stopOpacity="0.05" />
            <stop offset="100%" stopColor="rgb(var(--primary-strong))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={sy(t)}
              y2={sy(t)}
              stroke="rgb(var(--border))"
              strokeDasharray="4 5"
            />
            <text
              x={pad.left - 8}
              y={sy(t) + 4}
              textAnchor="end"
              className="tnum fill-[rgb(var(--faint))]"
              fontSize={11}
            >
              {moneyAxis(t)}
            </text>
          </g>
        ))}

        {floorVisible && (
          <>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={floorY}
              y2={floorY}
              stroke="rgb(var(--warning))"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.85}
            />
            <text x={pad.left + 4} y={floorY - 6} className="fill-[rgb(var(--warning))]" fontSize={11} fontWeight={500}>
              {compact ? `Min ${moneyAxis(minimumBalance)}` : `Minimum balance ${moneyAxis(minimumBalance)}`}
            </text>
          </>
        )}

        <path d={area} fill={`url(#${gradientId})`} />

        {/* Confirmed history: solid. */}
        {splitAt > 0 && (
          <path
            d={line(0, splitAt)}
            fill="none"
            stroke="rgb(var(--primary))"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Projection: dashed, so it never reads as confirmed money. */}
        <path
          d={line(splitAt, points.length - 1)}
          fill="none"
          stroke="rgb(var(--primary-strong))"
          strokeWidth={2.5}
          strokeDasharray="7 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle
          cx={points[troughIndex]!.x}
          cy={points[troughIndex]!.y}
          r={5.5}
          fill="rgb(var(--surface))"
          stroke="rgb(var(--warning))"
          strokeWidth={2.5}
        />
        <circle
          cx={points[0]!.x}
          cy={points[0]!.y}
          r={4.5}
          fill="rgb(var(--surface))"
          stroke="rgb(var(--primary))"
          strokeWidth={2.5}
        />

        {active && (
          <g pointerEvents="none">
            <line x1={active.x} x2={active.x} y1={pad.top} y2={baseline} stroke="rgb(var(--border-strong))" />
            <circle cx={active.x} cy={active.y} r={5} fill="rgb(var(--primary-strong))" />
          </g>
        )}

        {days.map((d, i) =>
          i % labelStep === 0 || i === days.length - 1 ? (
            <text
              key={d.date}
              x={points[i]!.x}
              y={chartHeight - 7}
              textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
              className="fill-[rgb(var(--faint))]"
              fontSize={11}
            >
              {formatDay(d.date)}
            </text>
          ) : null,
        )}
      </svg>

      {active && (
        <div
          className="plate pointer-events-none absolute top-1 z-10 max-w-[190px] -translate-x-1/2 px-3.5 py-2.5"
          style={{ left: `${Math.min(Math.max((active.x / width) * 100, 18), 82)}%` }}
        >
          <p className="text-label-sm uppercase tracking-wider text-faint">{formatMediumDate(active.day.date)}</p>
          <p className="tnum font-display text-metric-sm text-text">{money(active.day.closing)}</p>
          {(active.day.income > 0 || active.day.expenses > 0) && (
            <p className="tnum text-label-sm text-muted">
              {active.day.income > 0 && <span className="text-success">+{money(active.day.income)}</span>}
              {active.day.income > 0 && active.day.expenses > 0 && ' · '}
              {active.day.expenses > 0 && <span className="text-danger">-{money(active.day.expenses)}</span>}
            </p>
          )}
          {active.day.projected && <p className="text-label-sm text-faint">Projected</p>}
        </div>
      )}

      {/* The same data, reachable by screen readers. */}
      <figcaption className="sr-only">
        <table>
          <caption>Projected daily balance</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Money in</th>
              <th scope="col">Money out</th>
              <th scope="col">Balance</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{formatMediumDate(d.date)}</th>
                <td>{money(d.income)}</td>
                <td>{money(d.expenses)}</td>
                <td>{money(d.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
};
