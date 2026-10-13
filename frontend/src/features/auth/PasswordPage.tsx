import { useState, type FormEvent } from 'react';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwordChangeSchema } from '@gastos/shared';
import { api } from '../../shared/api/client';
import { firstProblem } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { Button, Card, Field, Notice, PageTitle, TextInput } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAuth } from './AuthContext';

/** A user changes their own password. It closes their sessions, so it ends at the login. */
export function PasswordPage() {
  const { logout } = useAuth();
  const { failure, setFailure, run } = useAction();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = passwordChangeSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setFailure(firstProblem(parsed.error.issues));
      return;
    }
    setSaving(true);
    const changed = await run(api<void>('/users/me/password', { method: 'POST', body: parsed.data }));
    setSaving(false);
    if (changed) logout();
  };

  return (
    <>
      <PageTitle>{es.password.title}</PageTitle>
      <Card>
        <p className="mb-3 text-sm text-muted">{es.password.text}</p>
        <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
          <Field label={es.password.current}>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              maxLength={MAX_PASSWORD_LENGTH}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <Field label={es.password.next} hint={es.password.hint(MIN_PASSWORD_LENGTH)}>
            <TextInput
              type="password"
              autoComplete="new-password"
              value={newPassword}
              maxLength={MAX_PASSWORD_LENGTH}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          {failure ? <Notice tone="error">{failure}</Notice> : null}
          <Button type="submit" disabled={saving || !currentPassword || !newPassword}>
            {saving ? es.common.saving : es.password.submit}
          </Button>
        </form>
      </Card>
    </>
  );
}
