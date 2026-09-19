import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { newId, useLabels, useStore } from '@/lib/store';
import type { Label } from '@/lib/types';
import { Icon } from './ui/Icon';
import { TextField } from './ui/Field';
import { ACCENT_CLASS, ACCENTS } from './labelAccents';

/** A label as it appears on a transaction: small, tinted, unmistakably a tag. */
export const LabelChip = ({ label, className }: { label: Label; className?: string }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-[1.4]',
      ACCENT_CLASS[label.accent],
      className,
    )}
  >
    {label.name}
  </span>
);


interface LabelPickerProps {
  /** The ids currently on the transaction. */
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Labels on a transaction, created where they are used.
 *
 * A separate "manage labels" screen visited before tagging anything is how a
 * tag system goes unused: the moment you want a label is the moment you are
 * looking at the receipt, and anything that interrupts that gets skipped.
 */
export const LabelPicker = ({ value, onChange }: LabelPickerProps) => {
  const labels = useLabels();
  const { dispatch } = useStore();
  const [typed, setTyped] = useState('');

  const wanted = typed.trim();
  const matches = useMemo(() => {
    if (!wanted) return labels;
    const needle = wanted.toLowerCase();
    return labels.filter((l) => l.name.toLowerCase().includes(needle));
  }, [labels, wanted]);

  /** Whether what has been typed is a label that does not exist yet. */
  const isNew =
    wanted.length > 0 && !labels.some((l) => l.name.trim().toLowerCase() === wanted.toLowerCase());

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const create = () => {
    if (!isNew) return;
    const label: Label = {
      id: newId(),
      name: wanted.slice(0, 40),
      accent: ACCENTS[labels.length % ACCENTS.length]!,
    };
    dispatch({ type: 'add-label', label });
    onChange([...value, label.id]);
    setTyped('');
  };

  return (
    <div className="space-y-3">
      <TextField
        label="Labels"
        placeholder="Find a label, or type a new one"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          // Enter in a text field inside a form would otherwise submit it,
          // and saving the transaction is not what pressing Enter on a
          // half-typed label name means.
          e.preventDefault();
          /**
           * Enter takes the safe path, the button takes the explicit one.
           *
           * With exactly one label matching what has been typed, Enter picks
           * it — even when the text is not the whole name. Typing "Portugal"
           * and pressing Enter beside an existing "Portugal 2027" should not
           * quietly create a second, near-identical label; that is precisely
           * how a set of tags rots into uselessness. Making one anyway is a
           * deliberate press of the button that says so.
           */
          if (matches.length === 1) toggle(matches[0]!.id);
          else if (isNew) create();
        }}
        hint="A label cuts across categories — which holiday, which flat, which client. A transaction can carry several."
      />

      {(matches.length > 0 || isNew) && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((label) => {
            const on = value.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(label.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]',
                  'transition-all duration-400 ease-fluid active:scale-[0.97]',
                  on
                    ? ACCENT_CLASS[label.accent]
                    : 'text-muted shadow-[inset_0_0_0_1px_rgb(var(--hairline)/var(--hairline-alpha))] hover:bg-[rgb(var(--hairline)/0.05)] hover:text-text',
                )}
              >
                {on && <Icon name="check" size={12} className="shrink-0" />}
                {label.name}
              </button>
            );
          })}

          {isNew && (
            <button
              type="button"
              onClick={create}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-primary shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.3)] transition-all duration-400 ease-fluid hover:bg-primary/10 active:scale-[0.97]"
            >
              <Icon name="plus" size={12} className="shrink-0" />
              Make “{wanted}” a label
            </button>
          )}
        </div>
      )}
    </div>
  );
};
