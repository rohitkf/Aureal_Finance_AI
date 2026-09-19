/**
 * The last thing before an account stops existing.
 *
 * Every other confirmation in this app is one press, because everything else
 * can be undone or entered again. This one cannot be either: the sign-in goes,
 * the email is freed, and every transaction, account, schedule, budget, goal
 * and label goes with it by a database cascade. There is no copy on a server
 * afterwards to ask for.
 *
 * So the tests here are about what stops it happening by accident, and about
 * never telling somebody their account is gone when it is not.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildBackup = vi.fn(async () => ({ format: 'aureal.backup' }));
const downloadBackup = vi.fn();

vi.mock('@/lib/backup', () => ({ buildBackup, downloadBackup }));

const { DeleteAccountDialog } = await import('../DeleteAccountDialog');
const { UserFacingError } = await import('@/lib/errors');

const EMAIL = 'someone@example.com';

const show = (onConfirm = vi.fn(async () => {})) => {
  render(<DeleteAccountDialog open onClose={vi.fn()} email={EMAIL} onConfirm={onConfirm} />);
  return onConfirm;
};

const deleteButton = () => screen.getByRole('button', { name: /delete my account/i });
const field = () => screen.getByLabelText(new RegExp(`type ${EMAIL}`, 'i'));

beforeEach(() => {
  buildBackup.mockClear();
  downloadBackup.mockClear();
});

describe('what stops it happening by accident', () => {
  it('refuses until the address is typed out', () => {
    show();
    expect(deleteButton()).toBeDisabled();
  });

  it('still refuses on a near miss', async () => {
    const user = userEvent.setup();
    show();
    await user.type(field(), 'someone@example.co');
    expect(deleteButton()).toBeDisabled();
  });

  it('allows it once the address matches', async () => {
    const user = userEvent.setup();
    show();
    await user.type(field(), EMAIL);
    expect(deleteButton()).toBeEnabled();
  });

  it('is not defeated by capitals or a stray space, which are not the point', async () => {
    const user = userEvent.setup();
    show();
    await user.type(field(), `  SOMEONE@Example.com `);
    expect(deleteButton()).toBeEnabled();
  });

  it('says what goes, including the sign-in', () => {
    show();
    expect(screen.getByText(/every account, transaction, schedule/i)).toBeInTheDocument();
    expect(screen.getByText(/the email is freed/i)).toBeInTheDocument();
  });
});

describe('the backup it offers first', () => {
  it('is offered, because wanting to leave is not wanting to lose everything', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: /download a backup first/i }));

    expect(buildBackup).toHaveBeenCalledTimes(1);
    expect(downloadBackup).toHaveBeenCalledTimes(1);
  });

  it('is an offer and not a requirement — the delete does not wait on it', async () => {
    const user = userEvent.setup();
    const onConfirm = show();
    await user.type(field(), EMAIL);
    await user.click(deleteButton());

    // Somebody deleting an account because they want the data gone must not be
    // made to download a copy of it first.
    expect(downloadBackup).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('when it fails', () => {
  it('says why, and does not claim the account is gone', async () => {
    const user = userEvent.setup();
    show(vi.fn(async () => {
      throw new UserFacingError('That session is no longer valid.');
    }));

    await user.type(field(), EMAIL);
    await user.click(deleteButton());

    expect(await screen.findByText(/that session is no longer valid/i)).toBeInTheDocument();
    // Still open, still on the same screen: closing on a failure would look
    // exactly like success.
    expect(screen.getByRole('dialog', { name: /delete your account/i })).toBeInTheDocument();
  });

  it('lets it be tried again rather than stranding the button', async () => {
    const user = userEvent.setup();
    show(vi.fn(async () => {
      throw new UserFacingError('Network is down.');
    }));

    await user.type(field(), EMAIL);
    await user.click(deleteButton());

    expect(await screen.findByText(/network is down/i)).toBeInTheDocument();
    expect(deleteButton()).toBeEnabled();
  });
});
