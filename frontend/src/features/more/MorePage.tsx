import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { es } from '../../shared/i18n/es';
import { Button, Notice, PageTitle } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAuth } from '../auth/AuthContext';
import { LegalLinks } from '../legal/LegalPage';

const LINKS = [
  { to: '/pendientes', label: es.more.pending },
  { to: '/mas/cuentas', label: es.more.accounts },
  { to: '/mas/tarjetas', label: es.more.cards },
  { to: '/mas/categorias', label: es.more.categories },
  { to: '/mas/bancos', label: es.more.institutions },
  { to: '/mas/etiquetas', label: es.more.tags },
  { to: '/mas/papelera', label: es.more.trash },
  { to: '/mas/datos', label: es.more.data },
  { to: '/mas/contrasena', label: es.more.password },
] as const;
/** Only an admin sees it; the server refuses the rest anyway. */
const ADMIN_LINKS = [{ to: '/mas/usuarios', label: es.more.users }] as const;

export function MorePage() {
  const { logout, session } = useAuth();
  const { failure, run } = useAction();
  const links = session?.role === 'admin' ? [...LINKS, ...ADMIN_LINKS] : LINKS;

  const logoutEverywhere = async () => {
    if (!window.confirm(es.auth.logoutAllConfirm)) return;
    if (await run(api<void>('/auth/logout-all', { method: 'POST' }))) logout();
  };
  return (
    <>
      <PageTitle>{es.more.title}</PageTitle>
      <ul className="mb-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {links.map((link) => (
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
      {session ? <p className="mb-2 text-sm text-muted">{es.auth.signedInAs(session.username)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={logout}>
          {es.auth.logout}
        </Button>
        <Button variant="danger" onClick={() => void logoutEverywhere()}>
          {es.auth.logoutAll}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted">{es.auth.logoutAllHint}</p>
      <div className="mt-6">
        <LegalLinks />
      </div>
    </>
  );
}
