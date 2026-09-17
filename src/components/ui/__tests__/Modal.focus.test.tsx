import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Modal } from '../Modal';
import { TextField } from '../Field';

/**
 * A harness shaped like every real caller: the dialog's open state lives in the
 * parent and `onClose` is written inline, so it is a fresh function on each of
 * the parent's renders.
 */
const Harness = ({ lift = false }: { lift?: boolean }) => {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('');
  // `lift` puts the form state in the parent, which is what the Quick-add and
  // Budget dialogs do — there, typing re-renders the owner of `onClose` too.
  const [outer, setOuter] = useState('');
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Add transaction">
      <TextField
        label="Amount"
        autoFocus
        value={lift ? outer : value}
        onChange={(e) => (lift ? setOuter(e.target.value) : setValue(e.target.value))}
      />
      <TextField label="Merchant" />
    </Modal>
  );
};

describe('Modal focus behaviour', () => {
  it('opens with the first form control focused, not the close button', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Amount')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Close' })).not.toHaveFocus();
  });

  it('keeps focus in the field while typing', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const amount = screen.getByLabelText('Amount');
    amount.focus();

    await user.keyboard('12');
    expect(amount).toHaveFocus();
    await user.keyboard('.50');

    expect(amount).toHaveFocus();
    expect(amount).toHaveValue('12.50');
  });

  it('keeps focus in the field when typing re-renders the dialog owner', async () => {
    const user = userEvent.setup();
    render(<Harness lift />);
    const amount = screen.getByLabelText('Amount');
    amount.focus();

    await user.keyboard('42');

    expect(amount).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Close' })).not.toHaveFocus();
    expect(amount).toHaveValue('42');
  });
});
