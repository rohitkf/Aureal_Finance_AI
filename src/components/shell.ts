import { useOutletContext } from 'react-router-dom';
import type { TransactionType } from '@/lib/types';

/**
 * What a screen can ask the shell to do: open the add-transaction sheet on a
 * given kind of entry, or the quick-add menu. The sheet lives in the shell
 * so it is one sheet wherever it is opened from — the hero's action pills,
 * the + in the tab bar, the bar's New entry.
 */
export interface ShellActions {
  openAdd: (type: TransactionType) => void;
  openQuickAdd: () => void;
}

const NOOP: ShellActions = { openAdd: () => {}, openQuickAdd: () => {} };

/** The shell's actions, or no-ops where a screen is rendered without the shell (tests). */
export const useShell = (): ShellActions => useOutletContext<ShellActions | undefined>() ?? NOOP;
