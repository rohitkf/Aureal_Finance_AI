import { useEffect, useState } from 'react';
import { buildBackup, downloadBackup } from '@/lib/backup';
import { describeError } from '@/lib/errors';
import { Button } from './ui/Button';
import { TextField } from './ui/Field';
import { Icon } from './ui/Icon';
import { Modal } from './ui/Modal';

/**
 * The last thing before an account stops existing.
 *
 * Every other confirmation in this app is one press, because everything else
 * can be undone or entered again. This one cannot be either: the sign-in goes,
 * the email is freed, and every transaction, account, schedule, budget, goal
 * and label goes with it by a database cascade. There is no copy on a server
 * afterwards to ask for.
 *
 * So it asks for the one thing a mis-click cannot produce — the account's own
 * address, typed out — and it offers the backup first, because a person who
 * wanted their data gone is not the same as a person who wanted to start
 * again, and only one of those is served by leaving with nothing.
 */
export const DeleteAccountDialog = ({
  open,
  onClose,
  email,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** The address they signed in with, which is what they have to type. */
  email: string;
  onConfirm: () => Promise<void>;
}) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setError(undefined);
    setBusy(false);
    setSaving(false);
    setSaved(false);
  }, [open]);

  // Case and stray spaces are not the point; intent is.
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  const takeBackup = async () => {
    setSaving(true);
    setError(undefined);
    try {
      downloadBackup(await buildBackup());
      setSaved(true);
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm();
    } catch (e) {
      // Still here means it did not happen, so the dialog stays open and says
      // why rather than closing on a failure and looking like success.
      setError(describeError(e).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Delete your account?"
      size="sm"
      description="This removes the account itself, not just its contents. It cannot be undone."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" icon="trash" onClick={confirm} disabled={!matches || busy}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="well space-y-2 p-4">
          <p className="text-[13px] font-medium text-text">What goes, exactly</p>
          <ul className="space-y-1 text-[12.5px] leading-relaxed text-muted">
            <li>Every account, transaction, schedule, budget, goal and label.</li>
            <li>Your sign-in — the email is freed, and the password stops working.</li>
            <li>Any backup file you have already downloaded is yours and is untouched.</li>
          </ul>
        </div>

        {/* Offered rather than insisted on. Someone deleting an account
            because they want the data gone should not be handed a copy of it. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={saved ? 'check' : 'download'} onClick={takeBackup} disabled={busy || saving}>
            {saving ? 'Preparing…' : saved ? 'Backup downloaded' : 'Download a backup first'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-[12.5px] text-success">
              <Icon name="check-circle" size={14} />
              Saved to your device
            </span>
          )}
        </div>

        <TextField
          label={`Type ${email} to confirm`}
          placeholder={email}
          value={typed}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setTyped(e.target.value)}
          error={error}
          hint={matches ? undefined : 'Typed out in full, so this cannot happen by accident.'}
        />
      </div>
    </Modal>
  );
};
