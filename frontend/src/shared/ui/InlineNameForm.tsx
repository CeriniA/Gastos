import { useState, type FormEvent } from 'react';
import { TEXT_LIMITS } from '@gastos/shared';
import { es } from '../i18n/es';
import { Button, TextInput } from './ui';

/** Renames something in place: a text box with save and cancel, as a list row. */
export function InlineNameForm({
  initial,
  label,
  busy,
  onSave,
  onCancel,
}: {
  initial: string;
  label: string;
  busy: boolean;
  /** Resolves true when the name was saved, so the form can close. */
  onSave: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSave(name)) onCancel();
  };
  return (
    <li className="p-3">
      <form onSubmit={(event) => void save(event)} className="flex gap-2">
        <TextInput
          aria-label={label}
          value={name}
          maxLength={TEXT_LIMITS.name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          {es.common.save}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {es.common.cancel}
        </Button>
      </form>
    </li>
  );
}
