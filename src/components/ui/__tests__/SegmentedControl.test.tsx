/**
 * A segmented control's `label` is only an aria-label.
 *
 * So a sighted person saw three unexplained words — "Money out", "Money in",
 * "Transfer" — with nothing saying what choosing one would do. The hint is
 * what makes the control readable, and it has to follow the selection: one
 * sentence describing all three at once is a paragraph nobody finishes.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from '../Field';

const OPTIONS = [
  { value: 'out', label: 'Money out' },
  { value: 'in', label: 'Money in' },
  { value: 'transfer', label: 'Transfer' },
];

const HINTS: Record<string, string> = {
  out: 'It leaves your account.',
  in: 'It arrives in your account.',
  transfer: 'It moves between your own accounts.',
};

const Harness = () => {
  const [value, setValue] = useState('out');
  return (
    <SegmentedControl label="Direction" value={value} onChange={setValue} options={OPTIONS} hint={HINTS[value]} />
  );
};

describe('SegmentedControl', () => {
  it('explains the option that is currently chosen', () => {
    render(<Harness />);
    expect(screen.getByText('It leaves your account.')).toBeInTheDocument();
  });

  it('changes the explanation with the selection', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('radio', { name: 'Transfer' }));

    expect(screen.getByText('It moves between your own accounts.')).toBeInTheDocument();
    expect(screen.queryByText('It leaves your account.')).not.toBeInTheDocument();
  });

  it('still works as a radiogroup, with the hint outside it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('radio', { name: 'Money in' }));

    expect(screen.getByRole('radio', { name: 'Money in' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Money out' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radiogroup', { name: 'Direction' })).toBeInTheDocument();
  });

  it('renders nothing extra when no hint is given', () => {
    const { container } = render(
      <SegmentedControl label="Range" value="3" onChange={() => {}} options={[{ value: '3', label: '3M' }]} />,
    );
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
