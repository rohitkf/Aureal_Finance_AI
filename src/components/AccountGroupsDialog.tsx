import { useMemo, useState } from 'react';
import { groupOf, missingStandardGroups, sortGroups } from '@/lib/accountGroups';
import { useAppState, useStore } from '@/lib/store';
import type { AccountGroup, BalanceSide } from '@/lib/types';
import { Button, IconButton } from './ui/Button';
import { ConfirmDialog, Modal } from './ui/Modal';
import { AccountGroupDialog } from './AccountGroupDialog';

/**
 * Account group setup: every group, under Assets or Liabilities, with a way to
 * add, rename and remove them.
 *
 * Groups used to be made from inside the account form and edited from the
 * headings on the Accounts page, so there was no one place that showed them
 * all — including the empty ones, which are exactly the ones worth tidying.
 */
export const AccountGroupsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { accountGroups, accounts } = useAppState();
  const { dispatch } = useStore();
  const [editing, setEditing] = useState<AccountGroup | null>(null);
  const [adding, setAdding] = useState<BalanceSide | null>(null);
  const [deleting, setDeleting] = useState<AccountGroup | null>(null);

  // Open and closed apart, so the count matches the page: closed accounts are
  // listed in a section of their own there, not under their group.
  const counts = useMemo(() => {
    const out = new Map<string, { open: number; closed: number }>();
    for (const a of accounts) {
      const g = groupOf(a, accountGroups);
      if (!g) continue;
      const c = out.get(g.id) ?? { open: 0, closed: 0 };
      if (a.archived || a.excluded) c.closed += 1;
      else c.open += 1;
      out.set(g.id, c);
    }
    return out;
  }, [accounts, accountGroups]);

  const missing = missingStandardGroups(accountGroups);
  const total = (id: string) => (counts.get(id)?.open ?? 0) + (counts.get(id)?.closed ?? 0);
  const inDeleting = deleting ? total(deleting.id) : 0;
  const describe = (id: string) => {
    const { open: n = 0, closed = 0 } = counts.get(id) ?? {};
    const live = n === 0 ? (closed ? '' : 'No accounts') : n === 1 ? '1 account' : `${n} accounts`;
    return [live, closed ? `${closed} closed` : ''].filter(Boolean).join(' · ');
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Account group setup"
        description="The headings on your Accounts page. Every account sits in one, under Assets or Liabilities."
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <div className="space-y-7">
          {(['asset', 'liability'] as const).map((side) => (
            <section key={side} aria-labelledby={`groups-${side}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--hairline)/0.12)] pb-2">
                <h3 id={`groups-${side}`} className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
                  {side === 'asset' ? 'Assets' : 'Liabilities'}
                </h3>
                <Button size="sm" icon="plus" onClick={() => setAdding(side)}>
                  {side === 'asset' ? 'New asset group' : 'New liability group'}
                </Button>
              </div>
              <ul>
                {sortGroups(accountGroups)
                  .filter((g) => g.side === side)
                  .map((g) => {
                    return (
                      <li key={g.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[rgb(var(--hairline)/0.04)]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] text-text">{g.name}</span>
                          <span className="block text-[12px] text-faint">
                            {describe(g.id)}
                          </span>
                        </span>
                        <IconButton type="button" icon="edit" label={`Rename ${g.name}`} size={14} onClick={() => setEditing(g)} />
                        <IconButton type="button" icon="trash" label={`Delete ${g.name}`} size={14} onClick={() => setDeleting(g)} />
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}

          {/* After restoring an old backup, or deleting one by mistake. */}
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[rgb(var(--hairline)/0.04)] p-4">
              <p className="text-[12.5px] leading-snug text-muted">
                {missing.length === 1
                  ? `The standard group ${missing[0]!.name} is missing.`
                  : `${missing.length} of the standard groups are missing.`}
              </p>
              <Button size="sm" icon="plus" onClick={() => dispatch({ type: 'add-standard-groups' })}>
                Put {missing.length === 1 ? 'it' : 'them'} back
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <AccountGroupDialog
        open={editing !== null || adding !== null}
        onClose={() => {
          setEditing(null);
          setAdding(null);
        }}
        editing={editing}
        initialSide={adding ?? 'asset'}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this group?"
        subject={deleting?.name ?? ''}
        consequence={
          inDeleting === 0
            ? 'The heading goes. Nothing is in it.'
            : `The heading goes. Its ${inDeleting === 1 ? 'account moves' : `${inDeleting} accounts move`} to the standard group for ${inDeleting === 1 ? 'its' : 'their'} kind — a current account to Bank, a card to Credit Card.`
        }
        preserved="Every account keeps its balance and its whole history. Only the heading it is listed under changes."
        confirmLabel="Delete group"
        onConfirm={() => {
          if (deleting) dispatch({ type: 'delete-account-group', id: deleting.id });
          setDeleting(null);
        }}
      />
    </>
  );
};
