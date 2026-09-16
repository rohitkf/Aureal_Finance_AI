import { useEffect, useRef, useState } from 'react';

/**
 * Measures an element's width so SVG charts can be drawn in real pixels.
 *
 * Drawing a chart in an abstract viewBox and letting the browser scale it makes
 * stroke weights and axis labels shrink on a phone and bloat on a large
 * monitor. Measuring instead keeps a 2px line 2px wide everywhere.
 */
export const useElementWidth = <T extends HTMLElement>(fallback = 800) => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setWidth(el.clientWidth || fallback);
    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);

  return [ref, width] as const;
};
