import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@gastos/shared';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { ServerWaking } from '../../shared/layout/ServerWaking';
import { Button, Field, Notice, TextInput } from '../../shared/ui/ui';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<LoginInput>({ defaultValues: { username: '', password: '' } });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setFailure(es.fieldMessages.required ?? null);
      return;
    }
    try {
      await login(parsed.data);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{es.appName}</h1>
      <ServerWaking />
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <Field label={es.auth.username}>
          <TextInput autoComplete="username" autoCapitalize="none" {...form.register('username')} />
        </Field>
        <Field label={es.auth.password}>
          <TextInput type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        {failure ? <Notice tone="error">{failure}</Notice> : null}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? es.auth.submitting : es.auth.submit}
        </Button>
      </form>
    </main>
  );
}
