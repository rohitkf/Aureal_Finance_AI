/**
 * How checked a line is, as a mark.
 *
 * The four statuses differ only in how thoroughly a payment has been verified,
 * and the progression — nothing, then an outline, then a solid — is the whole
 * design. It is legible before any of it is learned, and only while the three
 * stay distinguishable.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusMark } from '../StatusMark';

const show = (status: Parameters<typeof StatusMark>[0]['status']) =>
  render(<StatusMark status={status} />);

describe('what each status shows', () => {
  it('marks a cleared line, so you can see you checked it', () => {
    show('cleared');
    expect(screen.getByRole('img', { name: 'Cleared' })).toBeInTheDocument();
  });

  it('marks a reconciled line differently, because it means something else', () => {
    show('reconciled');
    expect(screen.getByRole('img', { name: 'Reconciled' })).toBeInTheDocument();
  });

  it('tells the two apart by more than a label', () => {
    // An outline for checked, a fill for reconciled. Identical marks with
    // different tooltips would be no marks at all.
    const { container: cleared } = render(<StatusMark status="cleared" />);
    const { container: reconciled } = render(<StatusMark status="reconciled" />);

    const clearedClass = cleared.firstElementChild?.className ?? '';
    const reconciledClass = reconciled.firstElementChild?.className ?? '';

    expect(clearedClass).not.toBe(reconciledClass);
    expect(clearedClass).toContain('shadow-'); // an outlined ring
    expect(reconciledClass).toContain('bg-success'); // a filled disc
  });

  it('draws the reconciled tick in the colour meant to sit on that fill', () => {
    // A filled disc says nothing if the tick on it is the same colour. The
    // page background used to stand in for this and was only right by
    // coincidence — `--on-success` is the token designed for it, and is a
    // near-black green in dark mode and white in light, where the success
    // colour itself is dark.
    const { container } = render(<StatusMark status="reconciled" />);
    const className = container.firstElementChild?.className ?? '';

    expect(className).toContain('on-success');
    expect(className).not.toContain('text-success');
  });

  it.each(['none', 'void', 'scheduled'] as const)('shows nothing for %s', (status) => {
    const { container } = show(status);
    // None has nothing to say and is most rows; void is already struck
    // through; a scheduled line sits on a page where everything is waiting.
    expect(container).toBeEmptyDOMElement();
  });
});
