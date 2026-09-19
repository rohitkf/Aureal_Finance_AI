/**
 * A toast that offers a way back.
 *
 * Skipping a scheduled payment is one click on the row, and the row it was on
 * disappears — so if it was the wrong row there is nothing left to click to
 * find out. `unskip-occurrence` existed in the store from the day skipping
 * did, and nothing in the app ever sent it: a mis-click was permanent.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../ui/Toast';

const Raise = ({ action }: { action?: { label: string; onClick: () => void } }) => {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast({ tone: 'info', title: 'Payment skipped', action })}>
      raise
    </button>
  );
};

const show = (action?: { label: string; onClick: () => void }) =>
  render(
    <ToastProvider>
      <Raise action={action} />
    </ToastProvider>,
  );

describe('an undoable toast', () => {
  it('offers the action, and runs it when taken', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    show({ label: 'Undo', onClick });

    await user.click(screen.getByRole('button', { name: 'raise' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('takes itself away once taken, so it cannot undo the undo', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    show({ label: 'Undo', onClick });

    await user.click(screen.getByRole('button', { name: 'raise' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows no button at all when there is nothing to undo', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'raise' }));

    expect(screen.getByText('Payment skipped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});
