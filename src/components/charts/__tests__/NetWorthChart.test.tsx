/**
 * A chart of nothing must still be a chart.
 *
 * The vertical scale was `max(assets) * 1.12`. With every snapshot at zero —
 * which is exactly where a brand new account starts — that is zero, every
 * `value / max` is `0 / 0`, and every coordinate becomes NaN. The browser
 * silently discards a path of `M NaN,NaN`, so the chart renders as an empty
 * box with no error anywhere to explain it.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetWorthChart } from '../NetWorthChart';
import type { NetWorthPoint } from '@/lib/types';

const attributeValues = (container: HTMLElement) =>
  [...container.querySelectorAll('path, polyline, circle, line')].flatMap((node) =>
    [...node.attributes].map((a) => a.value),
  );

const hasNaN = (container: HTMLElement) => attributeValues(container).some((v) => v.includes('NaN'));

describe('NetWorthChart', () => {
  it('draws nothing at all rather than crashing on an empty series', () => {
    const { container } = render(<NetWorthChart points={[]} />);
    expect(hasNaN(container)).toBe(false);
  });

  it('survives a series where everything is zero', () => {
    const points: NetWorthPoint[] = [
      { month: '2026-07', assets: 0, liabilities: 0 },
      { month: '2026-08', assets: 0, liabilities: 0 },
      { month: '2026-09', assets: 0, liabilities: 0 },
    ];
    const { container } = render(<NetWorthChart points={points} />);
    expect(hasNaN(container)).toBe(false);
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('survives a single point', () => {
    const { container } = render(
      <NetWorthChart points={[{ month: '2026-09', assets: 0, liabilities: 0 }]} />,
    );
    expect(hasNaN(container)).toBe(false);
  });

  it('still scales a real series', () => {
    const points: NetWorthPoint[] = [
      { month: '2026-08', assets: 1000, liabilities: 200 },
      { month: '2026-09', assets: 2000, liabilities: 100 },
    ];
    const { container } = render(<NetWorthChart points={points} />);
    expect(hasNaN(container)).toBe(false);
    // Two different figures must land on two different heights — a scale that
    // collapsed everything onto one line would pass the NaN check and still be
    // useless.
    const coordinates = [...container.querySelectorAll('path')]
      .flatMap((node) => [...(node.getAttribute('d') ?? '').matchAll(/,(-?\d+(?:\.\d+)?)/g)])
      .map((m) => Number(m[1]));
    expect(coordinates.length).toBeGreaterThan(1);
    expect(coordinates.every(Number.isFinite)).toBe(true);
    expect(new Set(coordinates).size).toBeGreaterThan(1);
  });
});
