import { useId } from 'react';
import { cn } from '@/lib/cn';
import { formatShortMonth } from '@/lib/date';
import { money, moneyAxis } from '@/lib/format';
import { useElementWidth } from '@/hooks/useElementWidth';
import type { NetWorthPoint } from '@/lib/types';

/** Assets, liabilities and the net line between them. Drawn in real pixels. */
export const NetWorthChart = ({
  points,
  height,
  className,
}: {
  points: NetWorthPoint[];
  height?: number;
  className?: string;
}) => {
  const gradientId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>(800);

  const compact = width < 560;
  const chartHeight = height ?? (compact ? 210 : 270);
  const pad = compact
    ? { top: 16, right: 10, bottom: 24, left: 44 }
    : { top: 20, right: 16, bottom: 26, left: 56 };

  if (points.length === 0) return <div ref={ref} className={className} style={{ height: chartHeight }} />;

  const series = points.map((p) => ({ ...p, net: p.assets - p.liabilities }));
  const max = Math.max(...series.map((p) => p.assets)) * 1.12;
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = Math.max(chartHeight - pad.top - pad.bottom, 10);
  const sx = (i: number) => pad.left + (series.length <= 1 ? 0 : (i / (series.length - 1)) * innerW);
  const sy = (v: number) => pad.top + innerH - (v / max) * innerH;

  const path = (key: 'assets' | 'liabilities' | 'net') =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i).toFixed(1)},${sy(p[key]).toFixed(1)}`).join(' ');

  const ticks = (compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((f) => max * f);
  const last = series[series.length - 1]!;
  const labelStep = Math.max(1, Math.ceil(series.length / (compact ? 4 : 12)));

  return (
    <figure ref={ref} className={cn('w-full', className)}>
      <svg
        width={width}
        height={chartHeight}
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="block max-w-full"
        role="img"
        aria-label={`Net worth over ${series.length} months, currently ${money(last.net)}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--success))" stopOpacity="0.24" />
            <stop offset="100%" stopColor="rgb(var(--success))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={sy(t)} y2={sy(t)} stroke="rgb(var(--border))" strokeDasharray="4 5" />
            <text x={pad.left - 8} y={sy(t) + 4} textAnchor="end" className="tnum fill-[rgb(var(--faint))]" fontSize={11}>
              {moneyAxis(t)}
            </text>
          </g>
        ))}

        <path
          d={`${path('net')} L ${sx(series.length - 1).toFixed(1)},${chartHeight - pad.bottom} L ${sx(0).toFixed(1)},${chartHeight - pad.bottom} Z`}
          fill={`url(#${gradientId})`}
        />
        <path d={path('assets')} fill="none" stroke="rgb(var(--primary-strong))" strokeWidth={1.8} strokeDasharray="5 4" />
        <path d={path('liabilities')} fill="none" stroke="rgb(var(--danger))" strokeWidth={1.8} strokeDasharray="5 4" />
        <path d={path('net')} fill="none" stroke="rgb(var(--success))" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />

        {series.map((p, i) =>
          i % labelStep === 0 || i === series.length - 1 ? (
            <text
              key={p.month}
              x={sx(i)}
              y={chartHeight - 7}
              textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
              className="fill-[rgb(var(--faint))]"
              fontSize={11}
            >
              {formatShortMonth(`${p.month}-01`)}
            </text>
          ) : null,
        )}
        <circle cx={sx(series.length - 1)} cy={sy(last.net)} r={4.5} fill="rgb(var(--success))" />
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-label-sm text-muted">
          <span className="h-0.5 w-4 rounded bg-success" /> Net worth
        </span>
        <span className="flex items-center gap-1.5 text-label-sm text-muted">
          <span className="h-0.5 w-4 rounded bg-primary-strong" /> Assets
        </span>
        <span className="flex items-center gap-1.5 text-label-sm text-muted">
          <span className="h-0.5 w-4 rounded bg-danger" /> Liabilities
        </span>
      </div>

      <figcaption className="sr-only">
        <table>
          <caption>Net worth history</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Assets</th>
              <th scope="col">Liabilities</th>
              <th scope="col">Net worth</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.month}>
                <th scope="row">{p.month}</th>
                <td>{money(p.assets)}</td>
                <td>{money(p.liabilities)}</td>
                <td>{money(p.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
};
