/**
 * Labels, created where they are used.
 *
 * The thing being defended here is that tagging never sends you somewhere
 * else. A separate "manage labels" screen visited before you can tag anything
 * is how a tag system goes unused: the moment you want a label is the moment
 * you are looking at the receipt.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Label } from '@/lib/types';

const dispatch = vi.fn();
let labels: Label[] = [];
let ids = 0;

vi.mock('@/lib/store', () => ({
  useLabels: () => labels,
  useStore: () => ({ dispatch }),
  newId: () => `label-${++ids}`,
}));

const { LabelPicker } = await import('../LabelPicker');

const onChange = vi.fn();
const show = (value: string[] = []) => render(<LabelPicker value={value} onChange={onChange} />);

const box = () => screen.getByLabelText('Labels');

beforeEach(() => {
  dispatch.mockClear();
  onChange.mockClear();
  ids = 0;
  labels = [
    { id: 'l-pt', name: 'Portugal 2027', accent: 'warning' },
    { id: 'l-flat', name: 'Flat', accent: 'primary' },
  ];
});

describe('finding one that exists', () => {
  it('offers them all before anything is typed', () => {
    show();
    expect(screen.getByRole('button', { name: /Portugal 2027/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Flat/ })).toBeInTheDocument();
  });

  it('narrows as you type, without caring about capitals', async () => {
    const user = userEvent.setup();
    show();
    await user.type(box(), 'portu');

    expect(screen.getByRole('button', { name: /Portugal 2027/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Flat$/ })).not.toBeInTheDocument();
  });

  it('adds one to the transaction when it is chosen', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /Flat/ }));

    expect(onChange).toHaveBeenCalledWith(['l-flat']);
  });

  it('takes one off again, rather than adding it twice', async () => {
    const user = userEvent.setup();
    show(['l-flat']);
    await user.click(screen.getByRole('button', { name: /Flat/ }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('marks the ones already on it', () => {
    show(['l-flat']);
    expect(screen.getByRole('button', { name: /Flat/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Portugal 2027/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('making one that does not exist', () => {
  it('offers to, as soon as what is typed matches nothing', async () => {
    const user = userEvent.setup();
    show();
    await user.type(box(), 'Wedding');

    expect(screen.getByRole('button', { name: /Make .Wedding. a label/ })).toBeInTheDocument();
  });

  it('does not offer to make one that is already there, in any capitalisation', async () => {
    const user = userEvent.setup();
    show();
    await user.type(box(), 'flat');

    expect(screen.queryByRole('button', { name: /Make .* a label/ })).not.toBeInTheDocument();
  });

  it('saves it and puts it straight on the transaction', async () => {
    const user = userEvent.setup();
    show(['l-flat']);
    await user.type(box(), 'Wedding');
    await user.click(screen.getByRole('button', { name: /Make .Wedding. a label/ }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'add-label',
      label: { id: 'label-1', name: 'Wedding', accent: expect.any(String) },
    });
    // Already on the transaction, without a second trip to find it.
    expect(onChange).toHaveBeenCalledWith(['l-flat', 'label-1']);
  });

  it('makes it on Enter, so the keyboard alone is enough', async () => {
    const user = userEvent.setup();
    show();
    await user.type(box(), 'Wedding{Enter}');

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'add-label' }));
  });

  it('chooses the single match on Enter rather than making a duplicate', async () => {
    const user = userEvent.setup();
    show();
    await user.type(box(), 'Portugal{Enter}');

    expect(dispatch).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(['l-pt']);
  });

  it('tints each new one differently rather than making a wall of grey', async () => {
    // Nobody wants to choose a colour at the moment they are tagging a
    // receipt, and six identical grey chips are no use either. So the accent
    // is cycled — which is only worth anything if consecutive labels actually
    // come out different.
    const accents: string[] = [];

    for (let n = 0; n < 6; n += 1) {
      labels = Array.from({ length: n }, (_, i) => ({
        id: `l-${i}`,
        name: `Existing ${i}`,
        accent: 'neutral' as const,
      }));
      dispatch.mockClear();

      const user = userEvent.setup();
      const { unmount } = show();
      await user.type(box(), `New ${n}`);
      await user.click(screen.getByRole('button', { name: /Make .* a label/ }));
      accents.push(dispatch.mock.calls[0]![0].label.accent);
      unmount();
    }

    expect(new Set(accents).size).toBe(6);
  });
});
