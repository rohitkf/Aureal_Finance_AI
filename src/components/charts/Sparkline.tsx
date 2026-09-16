import { cn } from '@/lib/cn';

/** A compact trend line for cards, where a full chart would be too much. */
export const Sparkline = ({
  values,
  tone = 'primary',
  className,
  height = 40,
}: {
  values: number[];
  tone?: 'primary' | 'success' | 'danger';
  className?: string;
  height?: number;
}) => {
  if (values.length < 2) return null;
  const width = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stroke = {
    primary: 'rgb(var(--primary-strong))',
    success: 'rgb(var(--success))',
    danger: 'rgb(var(--danger))',
  }[tone];

  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('w-full', className)} style={{ height }} aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
