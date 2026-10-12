import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';
import { Button, Notice, PageTitle } from '../../shared/ui/ui';
import { useAuth } from '../auth/AuthContext';

const LINKS = [
  { to: '/pendientes', label: es.more.pending },
  { to: '/mas/cuentas', label: es.more.accounts },
  { to: '/mas/tarjetas', label: es.more.cards },
  { to: '/mas/categorias', label: es.more.categories },
  { to: '/mas/bancos', label: es.more.institutions },
  { to: '/mas/etiquetas', label: es.more.tags },
  { to: '/mas/papelera', label: es.more.trash },
  { to: '/mas/datos', label: es.more.data },
] as const;

export function MorePage() {
  const { logout } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);

  const logoutEverywhere = async () => {
    if (!window.confirm(es.auth.logoutAllConfirm)) return;
    setFailure(null);
    try {
      await api<void>('/auth/logout-all', { method: 'POST' });
      logout();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };
  return (
    <>
      <PageTitle>{es.more.title}</PageTitle>
      <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="flex min-h-14 items-center justify-between px-4 font-medium">
              {link.label}
              <span aria-hidden="true" className="text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {failure ? (
        <div className="mb-4">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={logout}>
          {es.auth.logout}
        </Button>
        <Button variant="danger" onClick={() => void logoutEverywhere()}>
          {es.auth.logoutAll}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted">{es.auth.logoutAllHint}</p>
    </>
  );
}
