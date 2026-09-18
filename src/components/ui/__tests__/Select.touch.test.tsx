/**
 * Scrolling a long dropdown with a finger.
 *
 * Two things stopped it, and either alone was enough:
 *
 *   1. Every option prevented the default on `pointerdown`. On a mouse that is
 *      what keeps focus on the trigger, so there is no blur-then-click race.
 *      On a touchscreen it cancels the browser's own scrolling gesture before
 *      it can start, so the list simply does not move.
 *   2. Sliding a finger down the list fired `pointerenter` on each option,
 *      which set the highlight, which scrolled that option back into view. The
 *      list hauled itself back under the finger.
 *
 * jsdom has no scrolling, so these assert the mechanisms rather than the
 * pixels: what is prevented, what is highlighted, and when the list is told to
 * scroll itself.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from '../Select';

const OPTIONS = Array.from({ length: 30 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

const onChange = vi.fn();
let scrolled: string[] = [];

const renderSelect = () =>
  render(
    <Select value="v0" onChange={onChange}>
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>,
  );

const openList = async (user: ReturnType<typeof userEvent.setup>) => {
  renderSelect();
  await user.click(screen.getByRole('combobox'));
  return screen.getByRole('listbox');
};

/**
 * A pointer event of a given kind. jsdom has no PointerEvent, and React
 * derives `onPointerEnter` from `pointerover`, so both are spelled out here.
 */
const pointer = (node: Element, type: string, pointerType: string) => {
  const event = new MouseEvent(type === 'pointerenter' ? 'pointerover' : type, {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'pointerType', { get: () => pointerType });
  Object.defineProperty(event, 'relatedTarget', { get: () => null });
  fireEvent(node, event);
  return event;
};

beforeEach(() => {
  onChange.mockClear();
  scrolled = [];
  // `HTMLElement.prototype` and not `Element.prototype`: the test setup already
  // defines it on the more specific one, which would shadow a stub put here.
  HTMLElement.prototype.scrollIntoView = function scrollIntoView(this: HTMLElement) {
    scrolled.push(this.textContent ?? '');
  };
});

describe('a finger on the list', () => {
  it('is left alone, so the browser can scroll', async () => {
    const user = userEvent.setup();
    await openList(user);
    const option = screen.getByRole('option', { name: 'Option 12' });

    const event = pointer(option, 'pointerdown', 'touch');

    expect(event.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not move the highlight as it slides past options', async () => {
    const user = userEvent.setup();
    await openList(user);

    const before = screen.getByRole('combobox').getAttribute('aria-activedescendant');

    pointer(screen.getByRole('option', { name: 'Option 12' }), 'pointerenter', 'touch');
    pointer(screen.getByRole('option', { name: 'Option 20' }), 'pointerenter', 'touch');

    // The highlight stays where it was, rather than following the finger.
    expect(screen.getByRole('combobox').getAttribute('aria-activedescendant')).toBe(before);
    expect(before).toMatch(/-0$/);
    expect(scrolled).toEqual([]);
  });

  it('still chooses an option when it is a tap rather than a drag', async () => {
    const user = userEvent.setup();
    await openList(user);
    const option = screen.getByRole('option', { name: 'Option 12' });

    pointer(option, 'pointerdown', 'touch');
    fireEvent.click(option, { detail: 1 });

    expect(onChange).toHaveBeenCalledWith('v12');
  });

  it('chooses nothing when the drag scrolled instead of tapping', async () => {
    const user = userEvent.setup();
    await openList(user);

    // A scroll gesture: pointer down, movement, and no click at the end.
    pointer(screen.getByRole('option', { name: 'Option 12' }), 'pointerdown', 'touch');
    pointer(screen.getByRole('option', { name: 'Option 20' }), 'pointerenter', 'touch');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('a mouse on the list', () => {
  it('still commits on pointer-down, keeping focus on the trigger', async () => {
    const user = userEvent.setup();
    await openList(user);
    const option = screen.getByRole('option', { name: 'Option 12' });

    const event = pointer(option, 'pointerdown', 'mouse');

    expect(event.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledWith('v12');
  });

  it('still highlights on hover', async () => {
    const user = userEvent.setup();
    await openList(user);

    pointer(screen.getByRole('option', { name: 'Option 7' }), 'pointerenter', 'mouse');

    expect(screen.getByRole('combobox').getAttribute('aria-activedescendant')).toMatch(/-7$/);
  });

  it('does not scroll the list out from under the cursor', async () => {
    const user = userEvent.setup();
    await openList(user);
    scrolled = [];

    pointer(screen.getByRole('option', { name: 'Option 7' }), 'pointerenter', 'mouse');

    expect(scrolled).toEqual([]);
  });
});

describe('the keyboard', () => {
  it('still scrolls the highlighted option into view', async () => {
    const user = userEvent.setup();
    await openList(user);
    scrolled = [];

    await user.keyboard('{ArrowDown}');

    expect(scrolled).toEqual(['Option 1']);
  });

  it('keeps arrowing through the whole list', async () => {
    const user = userEvent.setup();
    await openList(user);
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('v2');
  });
});
