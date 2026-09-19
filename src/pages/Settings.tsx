import { useMemo, useRef, useState } from 'react';
import { describeError } from '@/lib/errors';
import { formatMediumDate } from '@/lib/date';
import {
  ACCENT_LABELS,
  ACCENT_NAMES,
  ACCENT_SWATCH,
  ACCENT_TEXT,
  DEFAULT_ACCENTS,
  KIND_HINTS,
  KIND_LABELS,
  LEDGER_KINDS,
} from '@/lib/accents';

/** The horizons worth offering. Anything beyond a fortnight stops helping. */
const DUE_HORIZONS = [
  { days: 0, label: 'Never' },
  { days: 1, label: 'Today only' },
  { days: 2, label: 'Today & tomorrow' },
  { days: 7, label: 'A week' },
  { days: 14, label: 'A fortnight' },
];
import {
  TABLE_LABELS,
  buildBackup,
  downloadBackup,
  parseBackup,
  summarise,
  type Backup,
} from '@/lib/backup';
import { useDevMode } from '@/lib/devMode';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { useAppState, useCategories, useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/hooks/useTheme';
import { CategoryIcon } from '@/components/CategoryIcon';
import { NewCategoryDialog } from '@/components/NewCategoryDialog';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader, Eyebrow, Label } from '@/components/ui/Card';
import { TextField, Toggle } from '@/components/ui/Field';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import type { Category } from '@/lib/types';

const THEMES: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: IconName }> = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

/** Friendly text, with the underlying error appended in development mode. */
const errorMessageWithDetail = (e: unknown): string => {
  const described = describeError(e, 'Please try again.');
  return described.detail ? `${described.message} — ${described.detail}` : described.message;
};

export const Settings = () => {
  const [devMode, setDevMode] = useDevMode();
  const state = useAppState();
  const { dispatch, clearAll, loadSampleData } = useStore();
  const { user, signOut } = useAuth();
  const { preference, setTheme } = useTheme();
  const categories = useCategories();
  const toast = useToast();
  const navigate = useNavigate();

  const [minimum, setMinimum] = useState(String(state.settings.minimumBalance));
  const [minimumError, setMinimumError] = useState<string | undefined>();
  const [name, setName] = useState(state.settings.userName);
  const [confirmClear, setConfirmClear] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing: Category | null }>({
    open: false,
    editing: null,
  });
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState<'sample' | 'clear' | 'backup' | null>(null);

  const grouped = useMemo(
    () => ({
      expense: categories.filter((c) => c.kind === 'expense'),
      income: categories.filter((c) => c.kind === 'income'),
    }),
    [categories],
  );

  const hasData =
    state.transactions.length + state.accounts.length + state.recurring.length + state.goals.length > 0;

  /** A chosen file that parsed, waiting on the confirm that replaces everything. */
  const [pendingRestore, setPendingRestore] = useState<Backup | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const downloadFullBackup = async () => {
    setBusy('backup');
    try {
      downloadBackup(await buildBackup());
      toast({
        tone: 'success',
        title: 'Backup downloaded',
        description: 'Everything in your account, in one file you can restore from.',
      });
    } catch (e) {
      toast({ tone: 'danger', title: 'Couldn’t make a backup', description: errorMessageWithDetail(e) });
    } finally {
      setBusy(null);
    }
  };

  /**
   * Reads the chosen file and checks it before anything is destroyed.
   *
   * Nothing is written here. A restore replaces everything, so the file has to
   * be understood in full first — and the person has to see what is in it and
   * say yes.
   */
  const onBackupChosen = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;

    const result = parseBackup(await file.text());
    if (!result.ok) {
      toast({ tone: 'danger', title: 'That isn’t a backup Aureal can read', description: result.reason });
      return;
    }
    setPendingRestore(result.backup);
  };

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
        <h1 className="mt-5 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-text">
          Preferences & security
        </h1>
      </header>

      {/* ---------------- Account ---------------- */}
      <Card className="space-y-6">
        <CardHeader title="Your account" description="How Aureal addresses you, and who is signed in." />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => dispatch({ type: 'update-settings', settings: { userName: name.trim() || 'You' } })}
          />
          <TextField label="Email" value={user?.email ?? ''} readOnly hint="Contact support to change this." />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[rgb(var(--hairline)/0.08)] pt-5">
          <p className="text-[13px] text-muted">Signed in as {user?.email}</p>
          <Button
            icon="logout"
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>

      {/* ---------------- Safe to spend ---------------- */}
      <Card className="space-y-6">
        <CardHeader
          title="Safe to Spend"
          description="The balance you never want to dip below. Everything above it is treated as spendable."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Minimum balance"
            inputMode="decimal"
            value={minimum}
            error={minimumError}
            onChange={(e) => {
              setMinimum(e.target.value.replace(/[^0-9.]/g, ''));
              setMinimumError(undefined);
            }}
            onBlur={() => {
              const value = Number.parseFloat(minimum);
              // It used to put the old figure back without a word, which looks
              // like the app losing what you typed. Say what was wrong and keep
              // it on screen so it can be corrected rather than retyped.
              if (!Number.isFinite(value)) {
                setMinimumError('Enter an amount, like 250.');
                return;
              }
              if (value < 0) {
                setMinimumError('This is held back, so it can’t be less than £0.');
                return;
              }
              if (value === state.settings.minimumBalance) return;
              dispatch({ type: 'update-settings', settings: { minimumBalance: value } });
              toast({ tone: 'success', title: 'Minimum balance updated', description: money(value) });
            }}
            hint="Held back from Safe to Spend and drawn on your forecast."
          />
          <div className="flex items-end">
            <p className="text-[13px] leading-relaxed text-muted">
              Aureal holds back{' '}
              <strong className="tnum font-medium text-text">{money(state.settings.minimumBalance)}</strong> before
              telling you what’s free to spend.
            </p>
          </div>
        </div>
      </Card>

      {/* ---------------- Categories ---------------- */}
      <Card className="space-y-6" id="categories">
        <CardHeader
          title="Categories"
          description="Your own headings for filing transactions. Add, rename or retire them at any time."
          action={
            <Button
              variant="primary"
              icon="plus"
              size="sm"
              onClick={() => setCategoryDialog({ open: true, editing: null })}
            >
              New category
            </Button>
          }
        />

        {categories.length === 0 ? (
          <EmptyState
            icon="box"
            title="No categories yet"
            description="Add one and it will be offered whenever you record a transaction."
            action={{ label: 'Add a category', onClick: () => setCategoryDialog({ open: true, editing: null }) }}
          />
        ) : (
          (['expense', 'income'] as const).map((kind) =>
            grouped[kind].length === 0 ? null : (
              <div key={kind} className="space-y-2">
                <Label>{kind === 'expense' ? 'Money out' : 'Money in'}</Label>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {grouped[kind].map((category) => {
                    const inUse = state.transactions.some((t) => t.categoryId === category.id);
                    return (
                      <li key={category.id} className="well flex items-center gap-3 p-3">
                        <CategoryIcon categoryId={category.id} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{category.name}</span>
                        {inUse && (
                          <span className="shrink-0 text-[11px] text-faint">
                            {state.transactions.filter((t) => t.categoryId === category.id).length}
                          </span>
                        )}
                        <IconButton
                          icon="edit"
                          label={`Edit ${category.name}`}
                          size={14}
                          className="h-8 w-8"
                          onClick={() => setCategoryDialog({ open: true, editing: category })}
                        />
                        <IconButton
                          icon="trash"
                          label={`Remove ${category.name}`}
                          size={14}
                          className="h-8 w-8"
                          onClick={() => setDeletingCategory(category)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )
        )}
      </Card>

      {/* ---------------- Appearance ---------------- */}
      <Card className="space-y-6">
        <CardHeader
          title="Appearance"
          description="Light and dark are designed separately — pick whichever reads better."
        />
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
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  preference === t.value
                    ? 'bg-primary/15 text-primary'
                    : 'bg-[rgb(var(--hairline)/0.06)] text-muted',
                )}
              >
                <Icon name={t.icon} size={17} />
              </span>
              <span className="text-[14px] font-medium text-text">{t.label}</span>
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

      {/* ---------------- Development mode ---------------- */}
      <Card className="space-y-6" id="developer">
        <CardHeader
          title="Developer"
          description="For diagnosing a problem on this device."
        />
        <Toggle
          checked={devMode}
          onChange={setDevMode}
          label="Development mode"
          description="Shows the underlying error whenever something fails, instead of the plain-English message. Applies to this device only, and stays on until you turn it off."
        />
      </Card>

      {/* ---------------- Bank connections ---------------- */}
      <Card className="space-y-6" id="connections">
        <CardHeader title="Bank connections" description="Where automatic transaction syncing will live." />
        <BankConnectionsUpcoming />
      </Card>

      {/* ---------------- Security ---------------- */}
      <Card className="space-y-6" id="security">
        <CardHeader title="Security & privacy" description="What Aureal stores, and how you stay in control." />
        <div className="space-y-2">
          <SecurityRow
            icon="lock"
            title="Row-level security"
            description="Every table is filtered by your user id in the database itself, not just in the app."
            action={<Badge tone="success">Enforced</Badge>}
          />
          <SecurityRow
            icon="shield"
            title="Password sign-in"
            description="Passwords are hashed by Supabase Auth and never stored by this app."
            action={<Badge tone="success">On</Badge>}
          />
          <SecurityRow
            icon="sync"
            title="Change your password"
            description="We’ll email you a link to set a new one."
            action={
              <Button size="sm" onClick={() => navigate('/forgot-password')}>
                Send link
              </Button>
            }
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

      {/* ---------------- Data ---------------- */}
      <Card className="space-y-6">
        <CardHeader
          title="Your data"
          description="Your account starts empty. Load a sample set if you'd like to see the app with numbers in it."
        />
        <div className="flex flex-wrap gap-2.5">
          <Button
            icon="sparkles"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('sample');
              try {
                await loadSampleData();
                toast({
                  tone: 'success',
                  title: 'Sample data loaded',
                  description: 'Clearly marked as samples — clear it whenever you like.',
                });
              } catch (e) {
                toast({
                  tone: 'danger',
                  title: 'Couldn’t load the sample data',
                  description: errorMessageWithDetail(e),
                });
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'sample' ? 'Loading…' : 'Load sample data'}
          </Button>
          <Button icon="trash" disabled={!hasData || busy !== null} onClick={() => setConfirmClear(true)}>
            Clear everything
          </Button>
        </div>
        <p className="text-[12.5px] leading-relaxed text-faint">
          Sample data is written to your account like anything else, so you can edit or delete it. It is never added
          on its own.
        </p>
      </Card>

      {/* ---------------- Colours ---------------- */}
      <Card className="space-y-6" id="colours">
        <CardHeader
          title="Colours"
          description="Which colour each kind of line is drawn in, on the register and everywhere else. Red for spending reads as an alarm to some people and as ordinary to others, so it is yours to set."
        />

        <div className="space-y-5">
          {LEDGER_KINDS.map((kind) => (
            <div key={kind} className="space-y-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13.5px] font-medium text-text">{KIND_LABELS[kind]}</p>
                {/* The actual thing, in the colour chosen, so the choice is
                    made against what it looks like rather than a word. */}
                <p className={cn('tnum text-body-md font-medium', ACCENT_TEXT[state.settings.accents[kind]])}>
                  {kind === 'expense' ? '−' : '+'}
                  {money(kind === 'opening' ? 58 : 20, { masked: false })}
                </p>
              </div>

              <p className="text-[12.5px] leading-snug text-faint">{KIND_HINTS[kind]}</p>

              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${KIND_LABELS[kind]} colour`}>
                {ACCENT_NAMES.map((accent) => {
                  const chosen = state.settings.accents[kind] === accent;
                  return (
                    <button
                      key={accent}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      aria-label={`${KIND_LABELS[kind]}: ${ACCENT_LABELS[accent]}`}
                      onClick={() =>
                        dispatch({
                          type: 'update-settings',
                          settings: { accents: { ...state.settings.accents, [kind]: accent } },
                        })
                      }
                      className={cn(
                        'flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]',
                        'transition-all duration-400 ease-fluid active:scale-[0.97]',
                        chosen
                          ? 'text-text shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))]'
                          : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)]',
                      )}
                    >
                      <span className={cn('h-2.5 w-2.5 rounded-full', ACCENT_SWATCH[accent])} />
                      {ACCENT_LABELS[accent]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button
          size="sm"
          icon="repeat"
          onClick={() => dispatch({ type: 'update-settings', settings: { accents: DEFAULT_ACCENTS } })}
        >
          Back to the defaults
        </Button>
      </Card>

      {/* ---------------- Reminders ---------------- */}
      <Card className="space-y-6" id="reminders">
        <CardHeader
          title="Reminders"
          description="How far ahead a reminder is described as a distance rather than a date."
        />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Say “due” within">
            {DUE_HORIZONS.map((option) => {
              const chosen = state.settings.dueHorizonDays === option.days;
              return (
                <button
                  key={option.days}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() =>
                    dispatch({ type: 'update-settings', settings: { dueHorizonDays: option.days } })
                  }
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-[12.5px] transition-all duration-400 ease-fluid active:scale-[0.97]',
                    chosen
                      ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)]'
                      : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)] hover:text-text',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <p className="text-[12.5px] leading-relaxed text-faint">
            {state.settings.dueHorizonDays === 0
              ? 'Every reminder shows its date and nothing else.'
              : `Anything due within ${state.settings.dueHorizonDays === 1 ? 'a day' : `${state.settings.dueHorizonDays} days`} says so — “Due today”, “Due tomorrow”, “Due in 4 days”. Further out, only the date, because “due in 143 days” is a number nobody converts back into March.`}
          </p>
        </div>
      </Card>

      {/* ---------------- Backup ---------------- */}
      <Card className="space-y-6" id="backup">
        <CardHeader
          title="Backup & restore"
          description="One file holding everything — accounts, transactions, schedules, budgets, goals, labels. Yours to keep somewhere else."
        />

        <div className="flex flex-wrap gap-2.5">
          <Button icon="download" disabled={busy !== null} onClick={downloadFullBackup}>
            {busy === 'backup' ? 'Making it…' : 'Download a backup'}
          </Button>

          {/* A file input styled as a button: the control has to be a real
              <input type="file"> for the browser to open a picker at all. */}
          <Button icon="upload" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
            Restore from a backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a backup file"
            onChange={(e) => void onBackupChosen(e.target.files?.[0])}
          />
        </div>

        <p className="text-[12.5px] leading-relaxed text-faint">
          A backup is a copy of your rows, not of the app — so it restores into whichever account you are signed into,
          and it carries no password, no email and no session. Account balances are rebuilt from the transactions in
          the file rather than copied, which is the same way they are maintained normally.
        </p>
      </Card>

      {/* ---------------- Danger zone ---------------- */}
      <Card className="space-y-5 shadow-[inset_0_0_0_1px_rgb(var(--danger)/0.3)]">
        <CardHeader
          title="Delete your account"
          description="Account deletion is handled by support while the app is in early access — email us and we'll remove everything within 30 days."
        />
        <Button variant="danger" icon="trash" disabled>
          Delete account
        </Button>
      </Card>

      <ConfirmDialog
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        onConfirm={() => {
          if (!pendingRestore) return;
          dispatch({ type: 'restore-backup', backup: pendingRestore });
          toast({
            tone: 'info',
            title: 'Restoring…',
            description: 'Everything is being replaced with the contents of that file.',
          });
          setPendingRestore(null);
        }}
        title="Replace everything with this backup?"
        subject={
          pendingRestore && (
            <div className="space-y-1">
              <p className="text-[14px] font-medium text-text">
                {pendingRestore.exportedAt
                  ? `Taken on ${formatMediumDate(pendingRestore.exportedAt.slice(0, 10))}`
                  : 'A backup file'}
              </p>
              <p className="text-[12.5px] leading-relaxed text-muted">
                {summarise(pendingRestore).length === 0
                  ? 'It is empty — restoring it would leave you with nothing.'
                  : summarise(pendingRestore)
                      .map((entry) => `${entry.count} ${TABLE_LABELS[entry.table]}`)
                      .join(' · ')}
              </p>
            </div>
          )
        }
        consequence="Everything currently in this account is deleted first, and cannot be recovered unless you have a backup of it too."
        preserved="Your sign-in, your email and your password are untouched — a backup holds none of them."
        confirmLabel="Replace everything"
      />

      <NewCategoryDialog
        open={categoryDialog.open}
        editing={categoryDialog.editing}
        onClose={() => setCategoryDialog({ open: false, editing: null })}
      />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        onConfirm={() => {
          if (!deletingCategory) return;
          dispatch({ type: 'delete-category', id: deletingCategory.id });
          toast({ tone: 'info', title: 'Category removed', description: deletingCategory.name });
        }}
        title="Remove this category?"
        subject={
          deletingCategory && (
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={deletingCategory.id} />
              <p className="text-[14px] font-medium text-text">{deletingCategory.name}</p>
            </div>
          )
        }
        consequence="It will stop being offered when you record a transaction or set a budget."
        preserved="Transactions already filed under it keep their history — nothing is recategorised or deleted."
        confirmLabel="Remove category"
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          setBusy('clear');
          try {
            await clearAll();
            toast({ tone: 'info', title: 'All data cleared', description: 'Your account is empty again.' });
          } catch (e) {
            toast({
              tone: 'danger',
              title: 'Couldn’t clear your data',
              description: errorMessageWithDetail(e),
            });
          } finally {
            setBusy(null);
          }
        }}
        title="Clear all data?"
        subject={
          <div>
            <p className="text-[14px] font-medium text-text">Everything in your account</p>
            <p className="text-[12.5px] text-muted">
              {state.transactions.length} transactions, {state.accounts.length} accounts,{' '}
              {state.recurring.length} recurring payments, {state.goals.length} goals
            </p>
          </div>
        }
        consequence="Every account, transaction, budget, goal and recurring payment will be permanently deleted."
        preserved="Your sign-in and your categories are kept, so you can start again straight away."
        confirmLabel="Clear everything"
      />
    </div>
  );
};

/**
 * Bank connections are not built yet. Rather than a flow that mimics one, this
 * says so plainly and points at what does work today.
 */
const BankConnectionsUpcoming = () => (
  <div className="well flex flex-col gap-5 p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--hairline)/0.06)] text-faint shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))]">
          <Icon name="bank" size={19} />
        </span>
        <div>
          <p className="text-[14.5px] font-medium tracking-[-0.01em] text-text">Open Banking sync</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            Connect an account so transactions arrive on their own.
          </p>
        </div>
      </div>
      <Badge tone="neutral">Coming soon</Badge>
    </div>

    <p className="text-[13px] leading-relaxed text-muted">
      This isn’t built yet, so Aureal doesn’t pretend otherwise: every account and transaction is entered by you, and
      every figure on screen comes from something you recorded. When bank connections arrive they’ll be read-only —
      Aureal will be able to see your transactions and never to move your money.
    </p>

    <Button disabled icon="bank" className="self-start">
      Connect a bank
    </Button>
  </div>
);

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
  <div className="well flex items-center gap-3.5 p-4">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success shadow-[inset_0_0_0_1px_rgb(var(--success)/0.2)]">
      <Icon name={icon} size={17} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[14px] font-medium tracking-[-0.01em] text-text">{title}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{description}</p>
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);
