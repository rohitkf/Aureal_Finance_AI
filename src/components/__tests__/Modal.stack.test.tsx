/**
 * Two dialogs at once.
 *
 * A confirmation opens over the form that raised it, and both are `Modal`s
 * listening on `document`. Nothing said which of them was on top, so one
 * Escape ran both handlers and dismissed the pair, and the confirmation's
 * cleanup handed the page back its scrollbar while the form was still
 * covering it.
 *
 * Deleting a transaction from the edit sheet is exactly that shape, which is
 * how this surfaced.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../ui/Modal';

/** A form with a confirmation that opens over it — the shape under test. */
const Stacked = ({ onOuterClose = vi.fn(), onInnerClose = vi.fn() }) => {
  const [inner, setInner] = useState(false);
  return (
    <Modal open onClose={onOuterClose} title="Edit transaction">
      <button type="button" onClick={() => setInner(true)}>
        Delete
      </button>
      <Modal open={inner} onClose={() => { setInner(false); onInnerClose(); }} title="Delete transaction?">
        <p>Are you sure</p>
      </Modal>
    </Modal>
  );
};

describe('a dialog opened over another', () => {
  it('gives Escape to the one on top, and only to that one', async () => {
    const user = userEvent.setup();
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(<Stacked onOuterClose={onOuterClose} onInnerClose={onInnerClose} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete transaction?' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    // The form behind it must still be there. Cancelling a confirmation means
    // "not that", not "and throw away everything I typed".
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit transaction' })).toBeInTheDocument();
  });

  it('keeps the page locked while the one underneath is still open', async () => {
    const user = userEvent.setup();
    render(<Stacked />);
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.keyboard('{Escape}');

    // Only the last dialog out gives the scrollbar back.
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('gives the page back its scroll once the last one closes', () => {
    const { unmount } = render(<Modal open onClose={vi.fn()} title="Only one" children={<p>hi</p>} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
