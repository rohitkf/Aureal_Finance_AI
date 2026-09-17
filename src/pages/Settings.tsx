import { useState } from 'react';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { useAppState, useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow } from '@/components/ui/Card';
import { TextField, Toggle } from '@/components/ui/Field';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const THEMES: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: IconName }> = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

export const Settings = () => {
  const state = useAppState();
  const { dispatch, resetToDemo, clearAll } = useStore();
  const { preference, setTheme } = useTheme();
  const toast = useToast();

  const [minimum, setMinimum] = useState(String(state.settings.minimumBalance));
  const [name, setName] = useState(state.settings.userName);
  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const connected = state.accounts.filter((a) => a.syncStatus === 'live');

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aureal-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ tone: 'success', title: 'Export downloaded', description: 'Your full financial data, in JSON.' });
  };

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">Preferences & security</h1>
      </header>

      {/* ---------------- Profile ---------------- */}
      <Card className="space-y-4">
        <CardHeader title="Profile" description="How Aureal addresses you and formats your money." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => dispatch({ type: 'update-settings', settings: { userName: name.trim() || 'You' } })}
          />
          <TextField label="Currency" value="GBP (£)" readOnly hint="More currencies are coming." />
        </div>
      </Card>

      {/* ---------------- Safe to spend ---------------- */}
      <Card className="space-y-4">
        <CardHeader
          title="Safe to Spend"
          description="The balance you never want to dip below. Everything above it is treated as spendable."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Minimum balance"
            inputMode="decimal"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={() => {
              const value = Number.parseFloat(minimum);
              if (!Number.isFinite(value) || value < 0) {
                setMinimum(String(state.settings.minimumBalance));
                return;
              }
              dispatch({ type: 'update-settings', settings: { minimumBalance: value } });
              toast({ tone: 'success', title: 'Minimum balance updated', description: money(value) });
            }}
            hint="Held back from Safe to Spend and drawn on your forecast."
          />
          <div className="flex items-end">
            <p className="text-body-sm text-muted">
              Right now Aureal holds back{' '}
              <strong className="tnum text-text">{money(state.settings.minimumBalance)}</strong> before telling you
              what’s free to spend.
            </p>
          </div>
        </div>
      </Card>

      {/* ---------------- Appearance ---------------- */}
      <Card className="space-y-4">
        <CardHeader title="Appearance" description="Light and dark are designed separately — pick whichever reads better." />
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              aria-pressed={preference === t.value}
              className={cn(
                'flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-500 ease-fluid',
                preference === t.value
                  ? 'bg-primary/10 shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.35)]'
                  : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)]',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  preference === t.value ? 'bg-primary/15 text-primary' : 'bg-surface-high text-muted',
                )}
              >
                <Icon name={t.icon} size={17} />
              </span>
              <span className="text-body-md font-medium text-text">{t.label}</span>
              {preference === t.value && <Icon name="check" size={16} className="ml-auto text-primary" />}
            </button>
          ))}
        </div>
        <Toggle
          checked={state.settings.maskBalances}
          onChange={(maskBalances) => dispatch({ type: 'update-settings', settings: { maskBalances } })}
          label="Hide balances by default"
          description="Masks every figure until you choose to reveal it — useful on a shared screen."
        />
      </Card>

      {/* ---------------- Connections ---------------- */}
      <Card className="space-y-4" id="connections">
        <CardHeader
          title="Connected accounts"
          description="Aureal connects read-only. It can see transactions; it can never move money."
          action={
            <Button variant="primary" icon="plus" size="sm" onClick={() => setConnectOpen(true)}>
              Connect a bank
            </Button>
          }
        />
        <ul className="space-y-1.5">
          {state.accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-3 well p-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-high text-primary">
                <Icon name={account.type === 'credit' ? 'card' : 'bank'} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-medium text-text">{account.name}</p>
                <p className="tnum truncate text-body-sm text-muted">
                  {account.institution} · {account.maskedNumber}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <StatusDot
                  tone={account.syncStatus === 'live' ? 'success' : 'neutral'}
                  label={
                    account.syncStatus === 'live'
                      ? `Synced ${account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}`
                      : 'Manual account'
                  }
                  pulse={account.syncStatus === 'live'}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-body-sm text-faint">
          {connected.length} of {state.accounts.length} accounts sync automatically.
        </p>
      </Card>

      {/* ---------------- Security ---------------- */}
      <Card className="space-y-4" id="security">
        <CardHeader title="Security & privacy" description="What Aureal stores, and how you stay in control." />
        <div className="space-y-2">
          <SecurityRow icon="lock" title="Biometric unlock" description="Require Face ID or a passcode each time the app opens." action={<Badge tone="success">On</Badge>} />
          <SecurityRow icon="shield" title="Two-factor authentication" description="A second step when signing in on a new device." action={<Badge tone="success">On</Badge>} />
          <SecurityRow
            icon="eye-off"
            title="Masked account numbers"
            description="Only the last four digits are ever displayed or stored."
            action={<Badge tone="success">Always on</Badge>}
          />
          <SecurityRow
            icon="download"
            title="Export your data"
            description="Download everything Aureal holds about you, in a portable format."
            action={
              <Button size="sm" onClick={exportData}>
                Export
              </Button>
            }
          />
        </div>
      </Card>

      {/* ---------------- Demo data ---------------- */}
      <Card className="space-y-4">
        <CardHeader title="Demo data" description="This build ships with a worked example so every screen has something to show." />
        <div className="flex flex-wrap gap-2">
          <Button
            icon="sync"
            onClick={() => {
              resetToDemo();
              toast({ tone: 'success', title: 'Demo data restored' });
            }}
          >
            Reset to demo data
          </Button>
          <Button icon="trash" onClick={() => setConfirmClear(true)}>
            Clear everything
          </Button>
        </div>
        <p className="text-body-sm text-faint">
          Clearing empties every screen, which is a good way to see the empty states.
        </p>
      </Card>

      {/* ---------------- Danger zone ---------------- */}
      <Card className="space-y-4 border-danger/30">
        <CardHeader title="Delete your account" description="This removes your profile and every record Aureal holds." />
        <Button variant="danger" icon="trash">
          Delete account
        </Button>
      </Card>

      <ConnectBankModal open={connectOpen} onClose={() => setConnectOpen(false)} />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAll();
          toast({ tone: 'info', title: 'All data cleared', description: 'Every screen is now in its empty state.' });
        }}
        title="Clear all data?"
        subject={
          <div>
            <p className="text-body-md font-semibold text-text">Everything in this browser</p>
            <p className="text-body-sm text-muted">
              {state.transactions.length} transactions, {state.recurring.length} recurring payments,{' '}
              {state.goals.length} goals
            </p>
          </div>
        }
        consequence="Every transaction, budget, goal and recurring payment will be removed and your balances set to zero."
        preserved="You can restore the demo dataset at any time from this screen."
        confirmLabel="Clear everything"
      />
    </div>
  );
};

const SecurityRow = ({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 well p-3.5">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
      <Icon name={icon} size={18} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-body-md font-medium text-text">{title}</p>
      <p className="text-body-sm text-muted">{description}</p>
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);

const BANKS = ['Monzo', 'Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Starling', 'Santander', 'Nationwide'];

/** The bank-connection flow: choose, authorise, confirm. */
const ConnectBankModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [step, setStep] = useState<'choose' | 'connecting' | 'done'>('choose');
  const [bank, setBank] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const toast = useToast();

  const reset = () => {
    setStep('choose');
    setBank(null);
    setQuery('');
    onClose();
  };

  const connect = (name: string) => {
    setBank(name);
    setStep('connecting');
    window.setTimeout(() => setStep('done'), 1400);
  };

  return (
    <Modal
      open={open}
      onClose={reset}
      title={step === 'choose' ? 'Connect an account' : bank ? `${bank}` : 'Connect'}
      description={step === 'choose' ? 'Choose your bank to begin.' : undefined}
      size="sm"
      footer={
        step === 'done' ? (
          <Button
            variant="primary"
            onClick={() => {
              toast({ tone: 'success', title: `${bank} connected`, description: 'Transactions will sync every few hours.' });
              reset();
            }}
          >
            Continue
          </Button>
        ) : undefined
      }
    >
      {step === 'choose' && (
        <div className="space-y-3">
          <TextField
            label="Search banks"
            hideLabel
            placeholder="Search banks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="space-y-1.5">
            {BANKS.filter((b) => b.toLowerCase().includes(query.toLowerCase())).map((b) => (
              <li key={b}>
                <button
                  type="button"
                  onClick={() => connect(b)}
                  className="flex w-full items-center gap-3 well p-3.5 text-left transition-colors duration-400 ease-fluid hover:bg-surface-high"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-high text-body-sm font-bold text-primary">
                    {b[0]}
                  </span>
                  <span className="text-body-md text-text">{b}</span>
                  <Icon name="chevron-right" size={16} className="ml-auto text-faint" />
                </button>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 text-body-sm text-faint">
            <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
            You’ll authorise the connection on your bank’s own site. Aureal never sees your login details.
          </p>
        </div>
      )}

      {step === 'connecting' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Icon name="sync" size={26} />
          </span>
          <div>
            <p className="font-display text-headline-sm text-text">Connecting to {bank}…</p>
            <p className="text-body-sm text-muted">Securely checking which accounts are available.</p>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3 py-4">
          {['Account found', 'Transaction history available', 'Read-only access granted'].map((line) => (
            <p key={line} className="flex items-center gap-2 text-body-md text-text">
              <Icon name="check-circle" size={18} className="shrink-0 text-success" />
              {line}
            </p>
          ))}
        </div>
      )}
    </Modal>
  );
};
