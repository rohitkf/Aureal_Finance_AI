import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import type { Label as LabelType } from '@/lib/types';
import { Button } from './ui/Button';
import { TextField } from './ui/Field';
import { Label } from './ui/Card';
import { Modal } from './ui/Modal';
import { LabelChip } from './LabelPicker';
import { ACCENT_CLASS, ACCENTS } from './labelAccents';

/**
 * Renaming a label, and changing the colour it was given.
 *
 * Labels are made in the moment, inside the transaction sheet, from whatever
 * was typed — which is the right way to make one and the wrong way to be stuck
 * with one. A typo, a plural you later regret, a colour the cycle happened to
 * land on: all of it was permanent, because nothing in the app ever sent the
 * `update-label` the store has always had.
 */
export const LabelDialog = ({
  open,
  onClose,
  editing,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  editing: LabelType | null;
  onDelete?: () => void;
}) => {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [accent, setAccent] = useState<LabelType['accent']>('primary');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setAccent(editing?.accent ?? 'primary');
  }, [open, editing]);

  const trimmed = name.trim();
  const valid = trimmed.length > 0;

  const save = () => {
    if (!valid || !editing) return;
    dispatch({ type: 'update-label', label: { ...editing, name: trimmed.slice(0, 40), accent } });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit label"
      size="sm"
      description="The name and the colour. Everything carrying it updates at once."
      footer={
        <>
          {onDelete && (
            <Button variant="danger" icon="trash" onClick={onDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!valid}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <TextField
          label="Name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="space-y-2">
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={accent === option}
                onClick={() => setAccent(option)}
                className={cn(
                  'h-9 w-9 rounded-full transition-transform duration-300 ease-fluid',
                  ACCENT_CLASS[option],
                  // The chosen one is bigger rather than ticked: a tick drawn
                  // over a colour swatch hides the colour being chosen.
                  accent === option && 'scale-110 ring-2 ring-[rgb(var(--primary-strong)/0.5)]',
                )}
              />
            ))}
          </div>
        </div>

        {/* What it will look like, since that is the whole question. */}
        {valid && <LabelChip label={{ id: 'preview', name: trimmed, accent }} />}
      </div>
    </Modal>
  );
};
