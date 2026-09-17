import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Scroll entry. Nothing appears statically: content settles in from below,
 * resolving out of a soft blur.
 *
 * Uses IntersectionObserver rather than a scroll listener, so there is no
 * work on the main thread between intersections, and animates only transform,
 * opacity and filter.
 */
/**
 * Turns the parked state on. Runs once, from the first Reveal to mount, so the
 * stylesheet only hides content when this code is definitely running.
 */
const enableRevealGate = () => {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.reveal !== 'on') {
    document.documentElement.dataset.reveal = 'on';
  }
};

export const Reveal = ({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds, for staggering siblings. */
  delay?: number;
  as?: ElementType;
}) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    enableRevealGate();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 },
    );
    observer.observe(el);

    // Backstop: if the element sits somewhere the observer never reports on,
    // show it anyway rather than leaving it invisible.
    const backstop = window.setTimeout(() => setVisible(true), 1600);

    return () => {
      observer.disconnect();
      window.clearTimeout(backstop);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn('reveal', className)}
      data-visible={visible ? 'true' : 'false'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};
