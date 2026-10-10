/**
 * The profile button: who is signed in, their settings, and Sign out.
 *
 * Sign out was only at the top of Settings. It is now behind the initials on
 * every screen, as a menu button that behaves like one — focus goes into the
 * menu, the arrows move through it, and Escape gives focus back.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProfileMenu } from '../ProfileMenu';

const open = (onSignOut = vi.fn(async () => {})) => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={<ProfileMenu name="Rohit Kumar" email="rohit@example.test" onSignOut={onSignOut} />}
        />
        <Route path="/settings" element={<h1>Settings page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onSignOut, button: screen.getByRole('button', { name: 'Account: Rohit Kumar' }) };
};

describe('ProfileMenu', () => {
  it('is closed until asked, and says it opens a menu', () => {
    const { button } = open();
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows who is signed in, Settings and Sign out', async () => {
    const user = userEvent.setup();
    const { button } = open();
    await user.click(button);

    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(menu).toHaveTextContent('rohit@example.test');
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Settings', 'Sign out']);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('signs out from the menu', async () => {
    const user = userEvent.setup();
    const { button, onSignOut } = open();
    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('cannot be signed out of twice while the first is on its way', async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onSignOut = vi.fn(() => new Promise<void>((done) => (finish = done)));
    const { button } = open(onSignOut);
    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(screen.getByRole('menuitem', { name: 'Signing out…' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeEnabled());
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('goes to Settings and closes behind itself', async () => {
    const user = userEvent.setup();
    const { button } = open();
    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument();
  });

  it('moves focus in, round with the arrows, and back to the button on Escape', async () => {
    const user = userEvent.setup();
    const { button } = open();
    button.focus();
    await user.keyboard('{Enter}');

    const [settings, signOut] = screen.getAllByRole('menuitem');
    expect(settings).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(signOut).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(settings).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(signOut).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes on a click anywhere else', async () => {
    const user = userEvent.setup();
    const { button } = open();
    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
