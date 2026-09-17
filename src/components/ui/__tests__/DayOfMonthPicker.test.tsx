import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DayOfMonthPicker, LAST_DAY } from '../DayOfMonthPicker';

const Harness = ({ initial = 1 }: { initial?: number }) => {
  const [day, setDay] = useState(initial);
  return (
    <>
      <DayOfMonthPicker label="Payment day of month" value={day} onChange={setDay} />
      <output data-testid="value">{day}</output>
    </>
  );
};

const value = () => screen.getByTestId('value').textContent;
const group = () => screen.getByRole('radiogroup', { name: /payment day of month/i });

describe('DayOfMonthPicker', () => {
  it('offers every day a month can have, and no day it cannot', () => {
    render(<Harness />);
    const options = within(group()).getAllByRole('radio');
    expect(options).toHaveLength(31);

    const labels = options.map((o) => o.textContent);
    expect(labels.slice(0, 30)).toEqual(Array.from({ length: 30 }, (_, i) => String(i + 1)));
    // 31 is offered as what it does, not as a number it is not eleven months a year.
    expect(labels[30]).toBe('Last day');
    expect(labels).not.toContain('0');
    expect(labels).not.toContain('32');
  });

  it('cannot express an invalid day, whatever is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const option of within(group()).getAllByRole('radio')) {
      await user.click(option);
      const day = Number(value());
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
      expect(Number.isInteger(day)).toBe(true);
    }
  });

  it('reports the day that was chosen', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(within(group()).getByRole('radio', { name: '17' }));
    expect(value()).toBe('17');

    await user.click(within(group()).getByRole('radio', { name: 'Last day' }));
    expect(value()).toBe(String(LAST_DAY));
  });

  it('marks exactly one day as chosen', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);

    const checked = () =>
      within(group())
        .getAllByRole('radio')
        .filter((o) => o.getAttribute('aria-checked') === 'true');

    expect(checked().map((o) => o.textContent)).toEqual(['5']);
    await user.click(within(group()).getByRole('radio', { name: '12' }));
    expect(checked().map((o) => o.textContent)).toEqual(['12']);
  });

  it('is one tab stop, not thirty-one', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);

    const inTabOrder = within(group())
      .getAllByRole('radio')
      .filter((o) => o.getAttribute('tabindex') === '0');
    expect(inTabOrder).toHaveLength(1);
    expect(inTabOrder[0]).toHaveTextContent('5');

    await user.tab();
    expect(within(group()).getByRole('radio', { name: '5' })).toHaveFocus();
  });

  it('moves a day at a time with left and right', async () => {
    const user = userEvent.setup();
    render(<Harness initial={10} />);
    await user.tab();

    await user.keyboard('{ArrowRight}');
    expect(value()).toBe('11');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(value()).toBe('9');
  });

  it('moves a week at a time with up and down', async () => {
    const user = userEvent.setup();
    render(<Harness initial={10} />);
    await user.tab();

    await user.keyboard('{ArrowDown}');
    expect(value()).toBe('17');
    await user.keyboard('{ArrowUp}');
    expect(value()).toBe('10');
  });

  it('will not walk off either end of the month', async () => {
    const user = userEvent.setup();
    render(<Harness initial={1} />);
    await user.tab();

    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(value()).toBe('1');

    await user.click(within(group()).getByRole('radio', { name: 'Last day' }));
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(value()).toBe('31');
  });
});
