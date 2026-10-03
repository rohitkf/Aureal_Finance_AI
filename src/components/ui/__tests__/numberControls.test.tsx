import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyDial } from '../MoneyDial';
import { RangeField } from '../RangeField';
import { DigitsField } from '../DigitsField';

const value = () => screen.getByTestId('value').textContent;

const Money = ({ initial = '', max = 2_000, min, onCommit }: { initial?: string; max?: number; min?: number; onCommit?: () => void }) => {
  const [v, setV] = useState(initial);
  return (
    <>
      <MoneyDial label="Monthly limit" value={v} onChange={setV} max={max} min={min} onCommit={onCommit} />
      <output data-testid="value">{v}</output>
      <button type="button">Elsewhere</button>
    </>
  );
};

describe('setting an amount with the money dial', () => {
  it('only ever holds an amount, whatever is typed into the figure', async () => {
    const user = userEvent.setup();
    render(<Money />);
    await user.type(screen.getByLabelText('Monthly limit'), '£1.2.3abc');
    expect(value()).toBe('1.23');
  });

  it('stops at pennies', async () => {
    const user = userEvent.setup();
    render(<Money />);
    await user.type(screen.getByLabelText('Monthly limit'), '12.999');
    expect(value()).toBe('12.99');
  });

  it('slides through round figures', () => {
    render(<Money />);
    const slider = screen.getByRole('slider', { name: 'Monthly limit slider' });
    // Stop 20 of 0, 5, 10 … is £100; the next band moves in tens.
    fireEvent.change(slider, { target: { value: '20' } });
    expect(value()).toBe('100');
    fireEvent.change(slider, { target: { value: '21' } });
    expect(value()).toBe('110');
  });

  it('moves the slider to match a typed figure', async () => {
    const user = userEvent.setup();
    render(<Money />);
    await user.type(screen.getByLabelText('Monthly limit'), '250');
    expect(screen.getByRole('slider', { name: 'Monthly limit slider' })).toHaveAttribute('aria-valuetext', '£250.00');
  });

  it('keeps a typed figure above the end of the track, and says that figure', async () => {
    const user = userEvent.setup();
    render(<Money max={2_000} />);
    await user.type(screen.getByLabelText('Monthly limit'), '3500');
    expect(value()).toBe('3500');
    // The thumb waits at the end; a screen reader still hears the real amount.
    expect(screen.getByRole('slider', { name: 'Monthly limit slider' })).toHaveAttribute('aria-valuetext', '£3,500.00');
  });

  it('nudges by a round step, tidying a typed figure as it goes', async () => {
    const user = userEvent.setup();
    render(<Money initial="1237" />);
    await user.click(screen.getByRole('button', { name: 'More — Monthly limit' }));
    expect(value()).toBe('1250');
    await user.click(screen.getByRole('button', { name: 'Less — Monthly limit' }));
    expect(value()).toBe('1200');
  });

  it('steps down into the smaller band below a boundary', async () => {
    const user = userEvent.setup();
    render(<Money initial="1000" />);
    await user.click(screen.getByRole('button', { name: 'Less — Monthly limit' }));
    expect(value()).toBe('975');
  });

  it('starts an empty field at its first amount, not one step past it', async () => {
    const user = userEvent.setup();
    render(<Money min={5} />);
    await user.click(screen.getByRole('button', { name: 'More — Monthly limit' }));
    expect(value()).toBe('5');
  });

  it('will not nudge below where the field starts', () => {
    render(<Money initial="5" min={5} />);
    expect(screen.getByRole('button', { name: 'Less — Monthly limit' })).toBeDisabled();
  });

  it('saves once focus leaves the dial, not while it moves around inside it', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Money initial="100" onCommit={onCommit} />);

    await user.click(screen.getByLabelText('Monthly limit'));
    await user.click(screen.getByRole('button', { name: 'More — Monthly limit' }));
    expect(onCommit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

const Range = ({ initial = 1 as number | null, optional = false }) => {
  const [v, setV] = useState<number | null>(initial);
  return (
    <>
      <RangeField
        label="Repeat every"
        value={v}
        onChange={setV}
        min={1}
        max={99}
        sliderMax={24}
        optional={optional}
        describe={(n) => (n === 1 ? 'Every month' : `Every ${n} months`)}
      />
      <output data-testid="value">{v ?? 'none'}</output>
    </>
  );
};

describe('choosing a number from a range', () => {
  it('says the value as a phrase, to the eye and to a screen reader', () => {
    render(<Range initial={3} />);
    expect(screen.getByText('Every 3 months')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Repeat every' })).toHaveAttribute('aria-valuetext', 'Every 3 months');
  });

  it('cannot go below the bottom of its range', async () => {
    const user = userEvent.setup();
    render(<Range initial={1} />);
    expect(screen.getByRole('button', { name: 'Less — Repeat every' })).toBeDisabled();
    fireEvent.change(screen.getByRole('slider', { name: 'Repeat every' }), { target: { value: '0' } });
    expect(value()).toBe('1');
    await user.click(screen.getByRole('button', { name: 'More — Repeat every' }));
    expect(value()).toBe('2');
  });

  it('reaches past the end of the track with +, up to the real limit', async () => {
    const user = userEvent.setup();
    render(<Range initial={98} />);
    await user.click(screen.getByRole('button', { name: 'More — Repeat every' }));
    expect(value()).toBe('99');
    expect(screen.getByRole('button', { name: 'More — Repeat every' })).toBeDisabled();
  });

  it('can be left unset, and cleared again, when it is optional', async () => {
    const user = userEvent.setup();
    render(<Range initial={null} optional />);
    expect(screen.getByText('Not set')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More — Repeat every' }));
    expect(value()).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(value()).toBe('none');
  });

  it('offers no Clear when a value is required', () => {
    render(<Range initial={4} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });
});

const Digits = () => {
  const [v, setV] = useState('');
  return (
    <>
      <DigitsField label="Last 4 digits" value={v} onChange={setV} />
      <output data-testid="value">{v}</output>
    </>
  );
};

describe('the last four of a card', () => {
  it('takes digits and nothing else', async () => {
    const user = userEvent.setup();
    render(<Digits />);
    await user.type(screen.getByLabelText('Last 4 digits'), '8a2-9 1');
    expect(value()).toBe('8291');
  });

  it('stops at four, even when more are pasted', async () => {
    const user = userEvent.setup();
    render(<Digits />);
    await user.click(screen.getByLabelText('Last 4 digits'));
    await user.paste('4111 1111 1111 8291');
    expect(value()).toBe('4111');
  });
});
