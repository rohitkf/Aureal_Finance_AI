import type { TransactionType } from './types';

/**
 * A new transaction that has not been saved yet, kept in the browser as it is
 * typed.
 *
 * A phone discards a backgrounded web app whenever it wants the memory, and
 * the update prompt reloads the page; either way, a half-entered transaction
 * was gone when the person came back. It now waits here until it is saved or
 * deliberately closed. It is only what was typed — nothing in it is money
 * until it is saved — and it never leaves the device.
 */
export interface TransactionDraft {
  type: TransactionType;
  amount: string;
  merchant: string;
  notes: string;
  categoryChosen: boolean;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  date: string;
  time: string;
  dateMode: 'custom' | 'today' | 'monthEnd';
  labelIds: string[];
}

const KEY = 'aureal.draft.transaction';

const isDraft = (value: unknown): value is TransactionDraft => {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return (
    ['expense', 'income', 'transfer'].includes(d.type as string) &&
    typeof d.amount === 'string' &&
    typeof d.merchant === 'string' &&
    typeof d.date === 'string' &&
    Array.isArray(d.labelIds)
  );
};

export const readDraft = (): TransactionDraft | null => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeDraft = (draft: TransactionDraft): void => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the entry still works, it just is not kept.
  }
};

export const clearDraft = (): void => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
};

export const hasDraft = (): boolean => readDraft() !== null;
