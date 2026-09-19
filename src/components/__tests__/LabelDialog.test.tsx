/**
 * Renaming a label, and changing the colour it was dealt.
 *
 * Labels are made inside the transaction sheet, from whatever was typed, and
 * given a colour by rotating through six. The comment on that rotation said
 * the colour "can be changed later from Settings" — and there was no such
 * screen: `update-label` and `delete-label` had existed in the store since the
 * day labels shipped, and nothing in the app ever sent either. A label typed
 * wrong was permanent, on every transaction carrying it.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Label } from '@/lib/types';

const dispatch = vi.fn();

vi.mock('@/lib/store', () => ({
  useStore: () => ({ dispatch }),
  useLabels: () => [],
  newId: () => 'generated-id',
}));

const { LabelDialog } = await import('../LabelDialog');

const LABEL: Label = { id: 'l-1', name: 'Portgual 2027', accent: 'warning' };

const open = (props: Record<string, unknown> = {}) =>
  render(<LabelDialog open onClose={vi.fn()} editing={LABEL} {...props} />);

const sent = () => dispatch.mock.calls.at(-1)?.[0];

beforeEach(() => dispatch.mockClear());

describe('editing a label', () => {
  it('opens on the name it has, so a typo can be corrected', async () => {
    const user = userEvent.setup();
    open();

    expect(screen.getByLabelText('Name')).toHaveValue('Portgual 2027');
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Portugal 2027');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent()).toEqual({
      type: 'update-label',
      label: { id: 'l-1', name: 'Portugal 2027', accent: 'warning' },
    });
  });

  it('keeps the id, so every transaction carrying it keeps carrying it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent().label.id).toBe('l-1');
  });

  it('changes the colour without touching the name', async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole('button', { name: 'success' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(sent().label).toMatchObject({ name: 'Portgual 2027', accent: 'success' });
  });

  it('refuses to save a label with no name', async () => {
    const user = userEvent.setup();
    open();

    await user.clear(screen.getByLabelText('Name'));

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('leaves the deleting to the page, which says what it costs', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    open({ onDelete });

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
