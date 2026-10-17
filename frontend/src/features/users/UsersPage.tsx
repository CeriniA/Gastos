import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  USER_ROLES,
  userCreateSchema,
  userUpdateSchema,
  type User,
  type UserRole,
} from '@gastos/shared';
import { firstProblem } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Field, Notice, PageTitle, Select, TextInput } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAuth } from '../auth/AuthContext';
import { useUserMutations, useUsers } from './api';

function PasswordInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <TextInput
      type="password"
      autoComplete="new-password"
      value={value}
      maxLength={MAX_PASSWORD_LENGTH}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Name, type and daily AI limit of a user, as the admin edits them. */
function EditUserForm({
  user,
  isSelf,
  busy,
  onSave,
  onCancel,
}: {
  user: User;
  isSelf: boolean;
  busy: boolean;
  onSave: (changes: { username: string; role: UserRole; aiDailyLimit: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<UserRole>(user.role);
  const [aiDailyLimit, setAiDailyLimit] = useState(
    user.aiDailyLimit === null ? '' : String(user.aiDailyLimit),
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (await onSave({ username, role, aiDailyLimit })) onCancel();
  };

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-2" noValidate>
      <Field label={es.users.username}>
        <TextInput
          autoCapitalize="none"
          autoComplete="off"
          value={username}
          maxLength={MAX_USERNAME_LENGTH}
          onChange={(event) => setUsername(event.target.value)}
        />
      </Field>
      <Field label={es.users.role} hint={isSelf ? es.users.ownRole : undefined}>
        <RoleSelect value={role} disabled={isSelf} onChange={setRole} />
      </Field>
      <Field label={es.users.aiLimit} hint={es.users.aiLimitHint}>
        <TextInput
          inputMode="numeric"
          value={aiDailyLimit}
          onChange={(event) => setAiDailyLimit(event.target.value.replace(/D/g, ''))}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !username.trim()}>
          {es.common.save}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {es.common.cancel}
        </Button>
      </div>
    </form>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: UserRole;
  disabled?: boolean;
  onChange: (role: UserRole) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as UserRole)}>
      {USER_ROLES.map((option) => (
        <option key={option} value={option}>
          {es.users.roles[option]}
        </option>
      ))}
    </Select>
  );
}

type Opened = 'none' | 'edit' | 'password';

function UserRow({
  user,
  isSelf,
  busy,
  onEdit,
  onPassword,
  onActive,
}: {
  user: User;
  isSelf: boolean;
  busy: boolean;
  onEdit: (changes: { username: string; role: UserRole; aiDailyLimit: string }) => Promise<boolean>;
  onPassword: (password: string) => Promise<boolean>;
  onActive: (active: boolean) => void;
}) {
  const [opened, setOpened] = useState<Opened>('none');
  const [password, setPassword] = useState('');
  const toggle = (what: Opened) => setOpened(opened === what ? 'none' : what);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (await onPassword(password)) {
      setPassword('');
      setOpened('none');
    }
  };

  return (
    <li className="space-y-2 p-3">
      <div className="space-y-1">
        <span className="block">
          <span className="block break-words font-medium">
            {user.username}
            {isSelf ? <span className="text-muted"> ({es.users.you})</span> : null}
          </span>
          <span className="block text-sm text-muted">
            {[es.users.roles[user.role], user.active ? null : es.users.inactive].filter(Boolean).join(', ')}
          </span>
          <span className="block text-sm text-muted">
            {es.users.aiUsage(user.aiReadingsToday, user.aiLimit)}
          </span>
        </span>
        <span className="-ml-4 flex flex-wrap gap-1">
          <Button variant="quiet" disabled={busy} onClick={() => toggle('edit')}>
            {es.users.edit}
          </Button>
          {/* Their own password and sessions are changed from Más, like anybody's. */}
          {isSelf ? null : (
            <>
              <Button variant="quiet" disabled={busy} onClick={() => toggle('password')}>
                {es.users.resetPassword}
              </Button>
              <Button
                variant={user.active ? 'quietDanger' : 'quiet'}
                disabled={busy}
                onClick={() => onActive(!user.active)}
              >
                {user.active ? es.users.deactivate : es.users.activate}
              </Button>
            </>
          )}
        </span>
      </div>
      {opened === 'edit' ? (
        <EditUserForm
          user={user}
          isSelf={isSelf}
          busy={busy}
          onSave={onEdit}
          onCancel={() => setOpened('none')}
        />
      ) : null}
      {opened === 'password' ? (
        <form onSubmit={(event) => void save(event)} className="space-y-2" noValidate>
          <Field label={es.users.newPassword(user.username)} hint={es.password.hint(MIN_PASSWORD_LENGTH)}>
            <PasswordInput value={password} onChange={setPassword} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !password}>
              {es.common.save}
            </Button>
            <Button variant="secondary" onClick={() => setOpened('none')}>
              {es.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** The admin's screen: who can use the app. Nobody's data is seen from here. */
export function UsersPage() {
  const { session } = useAuth();
  const users = useUsers();
  const { create, update } = useUserMutations();
  const { failure, setFailure, run } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const busy = create.isPending || update.isPending;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setDone(null);
    const parsed = userCreateSchema.safeParse({ username, password, role });
    if (!parsed.success) {
      setFailure(firstProblem(parsed.error.issues));
      return;
    }
    if (await run(() => create.mutateAsync(parsed.data))) {
      setUsername('');
      setPassword('');
      setRole('user');
    }
  };

  const resetPassword = async (user: User, newPassword: string) => {
    setDone(null);
    const parsed = userUpdateSchema.safeParse({ password: newPassword });
    if (!parsed.success) {
      setFailure(firstProblem(parsed.error.issues));
      return false;
    }
    const changed = await run(() => update.mutateAsync({ id: user.id, changes: parsed.data }));
    if (changed) setDone(es.users.resetDone(user.username));
    return changed;
  };

  const edit = async (user: User, changes: { username: string; role: UserRole; aiDailyLimit: string }) => {
    setDone(null);
    const parsed = userUpdateSchema.safeParse({
      username: changes.username,
      // Their own type is not theirs to change; the server refuses it too.
      ...(user.id === session?.userId ? {} : { role: changes.role }),
      aiDailyLimit: changes.aiDailyLimit === '' ? null : Number(changes.aiDailyLimit),
    });
    if (!parsed.success) {
      setFailure(firstProblem(parsed.error.issues));
      return false;
    }
    const changed = await run(() => update.mutateAsync({ id: user.id, changes: parsed.data }));
    if (changed) setDone(es.users.saved(parsed.data.username ?? user.username));
    return changed;
  };

  const setActive = (user: User, active: boolean) => {
    setDone(null);
    if (!active && !window.confirm(es.users.deactivateConfirm(user.username))) return;
    void run(() => update.mutateAsync({ id: user.id, changes: { active } }));
  };

  // Somebody else typed the address: there is nothing here for them (the server says the same).
  if (session && session.role !== 'admin') return <Navigate to="/mas" replace />;

  return (
    <>
      <PageTitle>{es.users.title}</PageTitle>
      <p className="mb-4 text-sm text-muted">{es.users.text}</p>

      {failure || done ? (
        <div className="mb-4">
          <Notice tone={failure ? 'error' : 'success'}>{failure ?? done}</Notice>
        </div>
      ) : null}

      <QueryState query={users}>
        {(items) => (
          <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === session?.userId}
                busy={busy}
                onEdit={(changes) => edit(user, changes)}
                onPassword={(newPassword) => resetPassword(user, newPassword)}
                onActive={(active) => setActive(user, active)}
              />
            ))}
          </ul>
        )}
      </QueryState>

      <Card>
        <h2 className="text-lg font-semibold">{es.users.newTitle}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{es.users.newText}</p>
        <form onSubmit={(event) => void add(event)} className="space-y-3" noValidate>
          <Field label={es.users.username}>
            <TextInput
              autoCapitalize="none"
              autoComplete="off"
              value={username}
              maxLength={MAX_USERNAME_LENGTH}
              onChange={(event) => setUsername(event.target.value)}
            />
          </Field>
          <Field label={es.users.password} hint={es.password.hint(MIN_PASSWORD_LENGTH)}>
            <PasswordInput value={password} onChange={setPassword} />
          </Field>
          <Field label={es.users.role}>
            <RoleSelect value={role} onChange={setRole} />
          </Field>
          <Button type="submit" disabled={busy || !username.trim() || !password}>
            {create.isPending ? es.common.saving : es.common.add}
          </Button>
        </form>
      </Card>
    </>
  );
}
