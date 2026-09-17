import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DateField } from '../Field';

const Harness = ({ initial = '2026-03-15' }: { initial?: string }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField label="Date" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
};

const trigger = () => screen.getByLabelText('Date');
const value = () => screen.getByTestId('value').textContent;
const isOpen = () => screen.queryByRole('dialog', { name: 'Choose a date' }) !== null;
const grid = () => screen.getByRole('grid');

describe('DatePicker', () => {
  it('shows the date the way the rest of the app writes it', () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent('15 Mar 2026');
  });

  it('says so when there is no date yet', () => {
    render(<Harness initial="" />);
    expect(trigger()).toHaveTextContent('Choose a date');
  });

  it('opens on the month of the date it holds', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    expect(grid()).toHaveAttribute('aria-label', 'March 2026');
  });

  it('chooses a day with the pointer and closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    await user.click(screen.getByRole('gridcell', { name: '20 Mar 2026' }));

    expect(value()).toBe('2026-03-20');
    expect(isOpen()).toBe(false);
  });

  it('pages between months', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(grid()).toHaveAttribute('aria-label', 'April 2026');

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(grid()).toHaveAttribute('aria-label', 'February 2026');
  });

  it('crosses a year boundary', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-12-15" />);
    await user.click(trigger());

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(grid()).toHaveAttribute('aria-label', 'January 2027');
  });

  it('always draws six weeks, so the popup never changes height', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-02-10" />);
    await user.click(trigger());
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
  });

  it('starts its weeks on Monday, which is what en-GB means by a week', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    // 1 March 2026 is a Sunday, so the grid opens on Monday 23 February.
    expect(screen.getAllByRole('gridcell')[0]).toHaveAccessibleName('23 Feb 2026');
  });

  describe('by keyboard alone', () => {
    it('moves a day at a time and commits with Enter', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(trigger());
      await user.keyboard('{ArrowRight}{ArrowRight}{Enter}');

      expect(value()).toBe('2026-03-17');
      expect(isOpen()).toBe(false);
    });

    it('moves a week with up and down', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(trigger());
      await user.keyboard('{ArrowDown}{Enter}');
      expect(value()).toBe('2026-03-22');
    });

    it('moves a month with PageUp and PageDown', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(trigger());
      await user.keyboard('{PageDown}');
      expect(grid()).toHaveAttribute('aria-label', 'April 2026');
      await user.keyboard('{Enter}');
      expect(value()).toBe('2026-04-15');
    });

    it('jumps to the ends of the month with Home and End', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(trigger());
      await user.keyboard('{Home}{Enter}');
      expect(value()).toBe('2026-03-01');

      await user.click(trigger());
      await user.keyboard('{End}{Enter}');
      expect(value()).toBe('2026-03-31');
    });

    it('walks into the next month rather than stopping at the edge', async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-03-31" />);

      await user.click(trigger());
      await user.keyboard('{ArrowRight}{Enter}');
      expect(value()).toBe('2026-04-01');
    });

    it('leaves the date alone when dismissed with Escape', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(trigger());
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
      await user.keyboard('{Escape}');

      expect(isOpen()).toBe(false);
      expect(value()).toBe('2026-03-15');
      expect(trigger()).toHaveFocus();
    });
  });

  it('can only ever produce a real date', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());

    for (const cell of screen.getAllByRole('gridcell').slice(0, 10)) {
      const iso = cell.getAttribute('data-iso') ?? '';
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${iso}T00:00:00`).getTime())).toBe(false);
    }
  });

  it('closes when something else is clicked, keeping the date', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(isOpen()).toBe(false);
    expect(value()).toBe('2026-03-15');
  });
});
