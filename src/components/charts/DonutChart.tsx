import { useState } from 'react';
import { cn } from '@/lib/cn';
import { money, percent } from '@/lib/format';

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
}

/**
 * Spending by category. Limited to a six-step ramp of one hue plus a neutral
 * "everything else" — a rainbow would make the numbers harder to read, not easier.
 */
const RAMP = [
  'rgb(var(--primary-strong))',
  'rgb(var(--secondary))',
  'rgb(var(--success))',
  'rgb(var(--warning))',
  'rgb(var(--info))',
  'rgb(var(--danger))',
];

export const DonutChart = ({
  slices,
  total,
  centerLabel = 'Total spent',
  className,
}: {
  slices: DonutSlice[];
  total: number;
  centerLabel?: string;
  className?: string;
}) => {
  const [active, setActive] = useState<string | null>(null);
  const size = 200;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;

  const arcs = slices.reduce<Array<DonutSlice & { fraction: number; dash: number; offset: number; color: string }>>(
    (acc, slice, i) => {
      const fraction = slice.value / sum;
      const previous = acc[acc.length - 1];
      const offset = previous ? previous.offset + previous.dash : 0;
      acc.push({ ...slice, fraction, dash: fraction * circumference, offset, color: RAMP[i % RAMP.length]! });
      return acc;
    },
    [],
  );

  const highlighted = arcs.find((a) => a.id === active);

  return (
    <div className={cn('flex flex-col items-center gap-6 sm:flex-row sm:items-center', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${centerLabel}: ${money(total)}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgb(var(--surface-highest))"
              strokeWidth={stroke}
            />
            {arcs.map((a) => (
              <circle
                key={a.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={a.color}
                strokeWidth={active && active !== a.id ? stroke - 6 : stroke}
                strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                strokeDashoffset={-a.offset}
                className="cursor-pointer transition-all duration-200 ease-fluid"
                opacity={active && active !== a.id ? 0.35 : 1}
                onMouseEnter={() => setActive(a.id)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-label-sm uppercase tracking-wider text-faint">
            {highlighted ? highlighted.label : centerLabel}
          </span>
          <span className="tnum font-display text-metric-md text-text">
            {money(highlighted ? highlighted.value : total, { compact: true })}
          </span>
          {highlighted && (
            <span className="tnum text-label-sm text-muted">{percent(highlighted.fraction * 100, 1)}</span>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {arcs.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onMouseEnter={() => setActive(a.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(a.id)}
              onBlur={() => setActive(null)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-400 ease-fluid hover:bg-surface-high"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: a.color }} />
              <span className="min-w-0 flex-1 truncate text-body-sm text-text">{a.label}</span>
              <span className="tnum shrink-0 text-body-sm font-semibold text-text">{money(a.value)}</span>
              <span className="tnum w-12 shrink-0 text-right text-label-sm text-faint">
                {percent(a.fraction * 100)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
