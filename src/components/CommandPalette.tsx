import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMediumDate } from '@/lib/date';
import { money } from '@/lib/format';
import { monthlyEquivalent } from '@/lib/recurrence';
import { useAppState, useCategoryLookup } from '@/lib/store';
import { cn } from '@/lib/cn';
import { MORE_NAV, PRIMARY_NAV } from './nav';
import { CategoryIcon } from './CategoryIcon';
import { Icon } from './ui/Icon';

interface Result {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  amount?: number;
  to: string;
  categoryId?: string;
}

/**
 * Global search (⌘K / Ctrl-K). Searches transactions, subscriptions, recurring
 * payments, accounts, goals and screens at once, and also understands a few
 * natural-language phrasings like "spent on food last month".
 */
export const CommandPalette = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const state = useAppState();
  const lookupCategory = useCategoryLookup();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // A light natural-language layer: pick out a category name from a sentence
    // like "show me everything I spent on food last month".
    const matchedCategory = state.categories.find(
      (c) => q.includes(c.name.toLowerCase()) || (c.id === 'groceries' && q.includes('food')),
    );
    const isSpendQuestion = /spent|spend|spending|how much/.test(q);

    const out: Result[] = [];

    if (isSpendQuestion && matchedCategory) {
      const lastMonth = /last month/.test(q);
      const month = lastMonth ? '2026-08' : '2026-09';
      const total = state.transactions
        .filter((t) => t.type === 'expense' && t.categoryId === matchedCategory.id && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount, 0);
      out.push({
        id: 'answer',
        group: 'Answer',
        title: `${money(total)} on ${matchedCategory.name}`,
        subtitle: `${lastMonth ? 'Last month' : 'This month'} · tap to see the transactions`,
        to: `/transactions?category=${matchedCategory.id}&month=${month}`,
        categoryId: matchedCategory.id,
      });
    }

    for (const t of state.transactions) {
      if (out.length > 40) break;
      if (!t.merchant.toLowerCase().includes(q) && !lookupCategory(t.categoryId).name.toLowerCase().includes(q)) continue;
      out.push({
        id: `t-${t.id}`,
        group: 'Transactions',
        title: t.merchant,
        subtitle: `${lookupCategory(t.categoryId).name} · ${formatMediumDate(t.date)}`,
        amount: t.type === 'income' ? t.amount : -t.amount,
        to: `/transactions?q=${encodeURIComponent(t.merchant)}`,
        categoryId: t.categoryId,
      });
    }

    for (const r of state.recurring) {
      if (!r.name.toLowerCase().includes(q)) continue;
      out.push({
        id: `r-${r.id}`,
        group: r.isSubscription ? 'Subscriptions' : 'Recurring payments',
        title: r.name,
        subtitle: `${money(monthlyEquivalent(r))} per month · ${r.status}`,
        amount: -r.amount,
        to: r.isSubscription ? '/recurring?filter=subscriptions' : '/recurring',
        categoryId: r.categoryId,
      });
    }

    for (const a of state.accounts) {
      if (!a.name.toLowerCase().includes(q) && !a.institution.toLowerCase().includes(q)) continue;
      out.push({
        id: `a-${a.id}`,
        group: 'Accounts',
        title: a.name,
        subtitle: `${a.institution} · ${a.maskedNumber}`,
        amount: a.type === 'credit' ? -a.balance : a.balance,
        to: `/accounts/${a.id}`,
      });
    }

    for (const g of state.goals) {
      if (!g.name.toLowerCase().includes(q)) continue;
      out.push({
        id: `g-${g.id}`,
        group: 'Goals',
        title: g.name,
        subtitle: `${money(g.saved, { compact: true })} of ${money(g.target, { compact: true })}`,
        to: '/goals',
      });
    }

    for (const item of [...PRIMARY_NAV, ...MORE_NAV]) {
      if (!item.label.toLowerCase().includes(q)) continue;
      out.push({ id: `nav-${item.to}`, group: 'Go to', title: item.label, subtitle: item.to, to: item.to });
    }

    // Collapse duplicate transactions for the same merchant into one row.
    const seen = new Set<string>();
    return out.filter((r) => {
      const key = `${r.group}|${r.title}`;
      if (r.group === 'Transactions' && seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [query, state, lookupCategory]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(results.length - 1, c + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === 'Enter' && results[cursor]) {
        e.preventDefault();
        navigate(results[cursor]!.to);
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, cursor, navigate, onClose]);

  if (!open) return null;

  const groups = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.group] ??= []).push(r);
    return acc;
  }, {});

  let index = -1;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-xl" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[70vh] w-full max-w-xl animate-slide-up flex-col overflow-hidden rounded-[1.75rem] bg-[rgb(var(--surface-base))] shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong)),inset_0_1px_0_0_rgb(255_255_255/0.06),0_32px_80px_-24px_rgb(var(--ambient)/0.8)]"
      >
        <div className="flex items-center gap-3 border-b border-[rgb(var(--hairline)/0.08)] px-4">
          <Icon name="search" size={18} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions, accounts, subscriptions…"
            aria-label="Search everything"
            className="h-14 w-full border-0 bg-transparent text-body-lg text-text placeholder:text-faint focus:outline-none focus:ring-0"
          />
          <kbd className="hidden shrink-0 rounded shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] px-1.5 py-0.5 text-label-sm text-faint sm:block">
            Esc
          </kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!query && (
            <div className="px-3 py-6 text-center">
              <p className="text-body-md text-muted">Search anything in your finances.</p>
              <p className="mt-1 text-body-sm text-faint">
                Try “Netflix”, “groceries”, or “how much did I spend on food last month”.
              </p>
            </div>
          )}
          {query && results.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-body-md text-text">No matches for “{query}”</p>
              <p className="mt-1 text-body-sm text-muted">Check the spelling, or search for a merchant or account.</p>
            </div>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-1">
              <p className="px-3 py-1.5 text-label-sm uppercase tracking-wider text-faint">
                {group} · {items.length}
              </p>
              {items.map((r) => {
                index += 1;
                const active = index === cursor;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onMouseEnter={() => setCursor(results.indexOf(r))}
                    onClick={() => {
                      navigate(r.to);
                      onClose();
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-400 ease-fluid',
                      active ? 'bg-surface-high' : 'hover:bg-[rgb(var(--hairline)/0.045)]',
                    )}
                  >
                    {r.categoryId ? (
                      <CategoryIcon categoryId={r.categoryId} size="sm" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--hairline)/0.08)] text-muted">
                        <Icon name="arrow-right" size={14} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-md text-text">{r.title}</span>
                      <span className="block truncate text-body-sm text-muted">{r.subtitle}</span>
                    </span>
                    {r.amount !== undefined && (
                      <span
                        className={cn(
                          'tnum shrink-0 text-body-sm font-semibold',
                          r.amount >= 0 ? 'text-success' : 'text-text',
                        )}
                      >
                        {money(r.amount, { signed: r.amount > 0 })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
