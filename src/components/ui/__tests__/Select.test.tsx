import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from '../Field';

const FRUIT = [
  ['apple', 'Apple'],
  ['banana', 'Banana'],
  ['cherry', 'Cherry'],
  ['damson', 'Damson'],
];

const Harness = ({ initial = 'apple' }: { initial?: string }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SelectField label="Fruit" value={value} onChange={setValue}>
        {FRUIT.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </SelectField>
      <output data-testid="value">{value}</output>
    </>
  );
};

const trigger = () => screen.getByRole('combobox', { name: 'Fruit' });
const value = () => screen.getByTestId('value').textContent;
const isOpen = () => screen.queryByRole('listbox') !== null;

describe('Select', () => {
  it('shows the chosen option, not its value', () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent('Apple');
  });

  it('is labelled by its field, so it has an accessible name', () => {
    render(<Harness />);
    expect(trigger()).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(isOpen()).toBe(false);

    await user.click(trigger());
    expect(isOpen()).toBe(true);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');

    await user.click(trigger());
    expect(isOpen()).toBe(false);
  });

  it('chooses with the pointer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: 'Cherry' }));

    expect(value()).toBe('cherry');
    expect(trigger()).toHaveTextContent('Cherry');
    expect(isOpen()).toBe(false);
  });

  it('marks the current option as selected, and only that one', async () => {
    const user = userEvent.setup();
    render(<Harness initial="banana" />);
    await user.click(trigger());

    const selected = screen
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected.map((o) => o.textContent)).toEqual(['Banana']);
  });

  describe('by keyboard alone', () => {
    it('opens with the arrow, moves, and commits with Enter', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.tab();
      expect(trigger()).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(isOpen()).toBe(true);

      await user.keyboard('{ArrowDown}{Enter}');
      expect(value()).toBe('banana');
      expect(isOpen()).toBe(false);
      // Focus comes back, so the next Tab goes where it should.
      expect(trigger()).toHaveFocus();
    });

    it('opens with Enter and with the space bar', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.tab();
      await user.keyboard('{Enter}');
      expect(isOpen()).toBe(true);
      await user.keyboard('{Escape}');

      await user.keyboard(' ');
      expect(isOpen()).toBe(true);
    });

    it('leaves the value alone when dismissed with Escape', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.tab();
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      await user.keyboard('{Escape}');

      expect(isOpen()).toBe(false);
      expect(value()).toBe('apple');
    });

    it('jumps to the first and last with Home and End', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.tab();
      await user.keyboard('{ArrowDown}{End}{Enter}');
      expect(value()).toBe('damson');

      await user.keyboard('{ArrowDown}{Home}{Enter}');
      expect(value()).toBe('apple');
    });

    it('stops at both ends rather than wrapping past them', async () => {
      const user = userEvent.setup();
      render(<Harness initial="apple" />);

      await user.tab();
      await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}');
      expect(value()).toBe('apple');

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
      expect(value()).toBe('damson');
    });

    it('jumps to an option by typing its first letters', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.tab();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('da');
      await user.keyboard('{Enter}');

      expect(value()).toBe('damson');
    });

    it('opens on the option that is already chosen', async () => {
      const user = userEvent.setup();
      render(<Harness initial="cherry" />);

      await user.tab();
      // Opening and committing immediately must not change anything.
      await user.keyboard('{ArrowDown}{Enter}');
      expect(value()).toBe('cherry');
    });
  });

  it('closes when something else is clicked, keeping the value', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.click(trigger());
    expect(isOpen()).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(isOpen()).toBe(false);
    expect(value()).toBe('apple');
  });

  it('can only ever produce one of its own options', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const allowed = FRUIT.map(([v]) => v);

    for (const [, label] of FRUIT) {
      await user.click(trigger());
      await user.click(screen.getByRole('option', { name: label }));
      expect(allowed).toContain(value());
    }
  });

  it('falls back to a placeholder when the value matches nothing', () => {
    render(
      <SelectField label="Fruit" value="elderberry" onChange={() => {}} placeholder="Pick one">
        {FRUIT.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </SelectField>,
    );
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveTextContent('Pick one');
  });
});

/**
 * Where the list is drawn.
 *
 * It was `absolute`, next to the trigger — which put it inside whatever the
 * trigger was inside, and inside a dialog that is a box with `overflow-y-auto`.
 * An absolutely positioned popup cannot escape a scrolling ancestor, so on a
 * short sheet (Add a budget, on a phone) the options were clipped to the few
 * pixels left below the field, and reaching them meant scrolling the dialog
 * and the list, one inside the other.
 */
describe('a list inside something that scrolls', () => {
  const Clipped = () => (
    <div data-testid="scroller" style={{ maxHeight: 80, overflowY: 'auto' }}>
      <SelectField label="Letter" value="a" onChange={vi.fn()}>
        <option value="a">Alpha</option>
        <option value="b">Bravo</option>
        <option value="c">Charlie</option>
      </SelectField>
    </div>
  );

  it('is drawn outside the box that would clip it', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Clipped />);

    await user.click(screen.getByRole('combobox'));

    const list = screen.getByRole('listbox');
    expect(list).toBeInTheDocument();
    // The whole point: not a descendant of the scroll container.
    expect(getByTestId('scroller')).not.toContainElement(list);
    expect(document.body).toContainElement(list);
  });

  it('is positioned against the viewport, not the box', async () => {
    const user = userEvent.setup();
    render(<Clipped />);

    await user.click(screen.getByRole('combobox'));

    // `fixed` is what makes a scrolling ancestor irrelevant; `absolute` is
    // what made it decisive.
    expect(screen.getByRole('listbox').className).toContain('fixed');
    expect(screen.getByRole('listbox').className).not.toContain('absolute');
  });

  it('still chooses an option, now that the list is somewhere else', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div style={{ maxHeight: 80, overflowY: 'auto' }}>
        <SelectField label="Letter" value="a" onChange={onChange}>
          <option value="a">Alpha</option>
          <option value="b">Bravo</option>
        </SelectField>
      </div>,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /bravo/i }));

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not treat a press on its own list as a press outside itself', async () => {
    const user = userEvent.setup();
    render(<Clipped />);

    await user.click(screen.getByRole('combobox'));
    // Portalled out of the trigger's tree, so "inside" had to learn to mean
    // two places rather than one — otherwise the first press closed it.
    await user.pointer({ target: screen.getByRole('listbox'), keys: '[MouseLeft>]' });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
