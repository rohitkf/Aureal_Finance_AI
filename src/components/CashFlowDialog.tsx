import { groupOf, sortGroups } from '@/lib/accountGroups';
import { isSpendable, owesMoney } from '@/lib/finance';
import { money } from '@/lib/format';
import { useAppState, useStore } from '@/lib/store';
import { Button } from './ui/Button';
import { Toggle } from './ui/Field';
import { Modal } from './ui/Modal';

/**
 * Cash flow setup: which accounts are money you can spend.
 *
 * Available now, Safe to Spend and the forecast all start from these. It used
 * to be fixed by type — current, savings and cash counted, nothing else could
 * — so a "Joint" group you made yourself could never count, and a savings
 * account you never touch always did.
 *
 * Only accounts that hold money are listed. A card's balance is a debt, and no
 * switch should be able to add what you owe to what you can spend.
 */
export const CashFlowDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { accounts, accountGroups } = useAppState();
  const { dispatch } = useStore();

  const sections = sortGroups(accountGroups)
    .filter((g) => g.side === 'asset')
    .map((g) => ({
      group: g,
      accounts: accounts.filter((a) => !a.archived && !owesMoney(a) && groupOf(a, accountGroups)?.id === g.id),
    }))
    .filter((s) => s.accounts.length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cash flow setup"
      description="Choose the accounts that are money you can spend. Available now, Safe to Spend and your forecast are worked out from these."
      size="sm"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {sections.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted">
          No accounts that hold money yet. Add a bank account or cash, and it appears here.
        </p>
      ) : (
        <div className="space-y-6">
          {sections.map(({ group, accounts: inGroup }) => (
            <section key={group.id} aria-label={group.name} className="space-y-1">
              <h3 className="px-2 text-[12px] font-medium text-primary">{group.name}</h3>
              {inGroup.map((a) => (
                <Toggle
                  key={a.id}
                  checked={isSpendable(a)}
                  onChange={(on) => dispatch({ type: 'set-cash-flow', id: a.id, cashFlow: on })}
                  label={a.name}
                  description={money(a.balance)}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
};
