import { cn } from '@/lib/cn';
import { region } from '@/lib/intl';

/** The character the active locale writes between whole and fraction. */
const decimalSeparator = (): string =>
  new Intl.NumberFormat(region().locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';

/**
 * A figure set the way the brand sets one: the number in a light weight, the
 * currency symbol (or the % sign) small and raised beside it, the pence small
 * on the baseline — "£ 8,766 .22", as the reference sets "860,513 $". All
 * three in the figure's own colour, so a green figure stays green throughout.
 *
 * It takes the string `money()` or `percent()` already wrote, rather than a
 * number, so every figure on screen is still the one formatter's output and
 * nothing here does arithmetic. The symbol lands on whichever side the locale
 * put it. Anything that is not a figure — the dots of a masked balance —
 * passes through as it came.
 *
 * The whole string is kept, once, for screen readers and for anything that
 * searches the page; the split version is for the eye only.
 */
export const FigureText = ({ text, className }: { text: string; className?: string }) => {
  const match = /^([+\-\u2212]?)(\D*?)(\d[\d\s.,'\u00a0\u202f]*)(\D*)$/.exec(text.trim());
  if (!match) return <span className={className}>{text}</span>;

  const [, sign = '', before = '', digits = '', after = ''] = match;
  const at = digits.lastIndexOf(decimalSeparator());
  const whole = at === -1 ? digits : digits.slice(0, at);
  const fraction = at === -1 ? '' : digits.slice(at);
  const lead = before.trim();
  const trail = after.trim();

  return (
    <span className={cn('inline-flex items-baseline whitespace-nowrap', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        {sign && <span className="mr-[0.03em]">{sign === '-' ? '\u2212' : sign}</span>}
        {lead && <Mark>{lead}</Mark>}
        <span>{whole.trim()}</span>
        {fraction && <span className="text-[0.46em] tracking-[-0.01em]">{fraction}</span>}
        {trail && <Mark trailing>{trail}</Mark>}
      </span>
    </span>
  );
};

/**
 * The raised symbol: small, regular weight, hung from the top of the figure.
 * Size alone sets it apart. It is not faded as well: at 0.4em a faded symbol
 * fell to 2.4:1 against paper, and a figure's symbol is part of the figure.
 */
const Mark = ({ children, trailing }: { children: string; trailing?: boolean }) => (
  <span
    className={cn(
      'mt-[0.14em] self-start text-[0.4em] font-normal leading-none tracking-normal',
      trailing ? 'ml-[0.12em]' : 'mr-[0.08em]',
    )}
  >
    {children}
  </span>
);
