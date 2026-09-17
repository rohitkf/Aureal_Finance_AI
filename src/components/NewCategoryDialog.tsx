import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { newId, useCategories, useStore } from '@/lib/store';
import type { Category } from '@/lib/types';
import { Button } from './ui/Button';
import { SelectField, TextField } from './ui/Field';
import { Icon, type IconName } from './ui/Icon';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

/** The icons offered when naming a category. */
const ICONS: IconName[] = [
  'shopping-basket',
  'coffee',
  'train',
  'home',
  'bolt',
  'repeat',
  'sparkles',
  'heart',
  'bag',
  'box',
  'card',
  'target',
  'bank',
  'briefcase',
  'trending-up',
  'plane',
  'savings',
  'wallet',
];

const ACCENTS: Array<{ value: Category['accent']; label: string; swatch: string }> = [
  { value: 'primary', label: 'Blue', swatch: 'bg-primary' },
  { value: 'success', label: 'Green', swatch: 'bg-success' },
  { value: 'secondary', label: 'Violet', swatch: 'bg-secondary' },
  { value: 'warning', label: 'Amber', swatch: 'bg-warning' },
  { value: 'danger', label: 'Red', swatch: 'bg-danger' },
  { value: 'neutral', label: 'Neutral', swatch: 'bg-[rgb(var(--faint))]' },
];

interface NewCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fixed when opened from a transaction form; choosable from Settings. */
  kind?: Category['kind'];
  /** Pass a category to edit it rather than create a new one. */
  editing?: Category | null;
  onCreated?: (category: Category) => void;
}

export const NewCategoryDialog = ({ open, onClose, kind, editing, onCreated }: NewCategoryDialogProps) => {
  const { dispatch } = useStore();
  const existing = useCategories();
  const toast = useToast();

  const [name, setName] = useState('');
  const [chosenKind, setChosenKind] = useState<Category['kind']>(kind ?? 'expense');
  const [icon, setIcon] = useState<IconName>('box');
  const [accent, setAccent] = useState<Category['accent']>('neutral');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setChosenKind(editing?.kind ?? kind ?? 'expense');
    setIcon(((editing?.icon ?? 'box') as IconName) ?? 'box');
    setAccent(editing?.accent ?? 'neutral');
  }, [open, editing, kind]);

  const trimmed = name.trim();
  const duplicate = useMemo(
    () =>
      existing.some(
        (c) =>
          c.id !== editing?.id &&
          c.kind === chosenKind &&
          c.name.trim().toLowerCase() === trimmed.toLowerCase(),
      ),
    [existing, trimmed, chosenKind, editing],
  );

  const valid = trimmed.length > 0 && !duplicate;

  const save = () => {
    if (!valid) return;
    const category: Category = {
      id: editing?.id ?? newId(),
      name: trimmed,
      kind: chosenKind,
      icon,
      accent,
    };
    dispatch(editing ? { type: 'update-category', category } : { type: 'add-category', category });
    toast({
      tone: 'success',
      title: editing ? 'Category updated' : 'Category added',
      description: category.name,
    });
    onCreated?.(category);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      description={editing ? 'Rename it or change how it looks.' : 'Add a heading of your own to file things under.'}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!valid}>
            {editing ? 'Save changes' : 'Add category'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <TextField
          label="Name"
          placeholder="e.g. Childcare"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          error={duplicate ? 'You already have a category with that name.' : undefined}
          maxLength={40}
        />

        {!kind && !editing && (
          <SelectField
            label="Kind"
            value={chosenKind}
            onChange={(e) => setChosenKind(e.target.value as Category['kind'])}
            hint="Expense and income categories are offered separately when adding a transaction."
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </SelectField>
        )}

        <div>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-faint">Icon</p>
          <div className="grid grid-cols-6 gap-2">
            {ICONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setIcon(option)}
                aria-label={`Use the ${option.replace('-', ' ')} icon`}
                aria-pressed={icon === option}
                className={cn(
                  'flex h-11 items-center justify-center rounded-xl transition-all duration-400 ease-fluid active:scale-95',
                  icon === option
                    ? 'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.35)]'
                    : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)]',
                )}
              >
                <Icon name={option} size={17} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-faint">Accent</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAccent(option.value)}
                aria-pressed={accent === option.value}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] transition-all duration-400 ease-fluid active:scale-[0.97]',
                  accent === option.value
                    ? 'text-text shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha-strong))]'
                    : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)]',
                )}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', option.swatch)} />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
