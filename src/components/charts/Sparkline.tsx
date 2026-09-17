import { useId } from 'react';
import { cn } from '@/lib/cn';
import { useElementWidth } from '@/hooks/useElementWidth';

/**
 * A compact trend, for places where a full chart would be more furniture than
 * the space deserves. Drawn in real pixels against the measured width, so the
 * stroke weight matches every other line in the product.
 */
export const Sparkline = ({
  values,
  tone = 'primary',
  className,
  height = 44,
  filled = true,
}: {
  values: number[];
  tone?: 'primary' | 'success' | 'danger';
  className?: string;
  height?: number;
  filled?: boolean;
}) => {
  const gradientId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>(320);

  if (values.length < 2) return <div ref={ref} className={className} style={{ height }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stroke = {
    primary: 'rgb(var(--primary-strong))',
    success: 'rgb(var(--success))',
    danger: 'rgb(var(--danger))',
  }[tone];

  const pad = 3;
  const point = (v: number, i: number) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  };

  const line = values.map((v, i) => {
    const [x, y] = point(v, i);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = line.join(' ');
  const area = `${d} L ${width},${height} L 0,${height} Z`;
  const [lastX, lastY] = point(values[values.length - 1]!, values.length - 1);

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block max-w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {filled && <path d={area} fill={`url(#${gradientId})`} />}
        <path d={d} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r={2.75} fill={stroke} />
      </svg>
    </div>
  );
};
