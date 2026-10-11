import { Link } from 'react-router-dom';
import { es } from '../../shared/i18n/es';
import { Button, PageTitle } from '../../shared/ui/ui';
import { useAuth } from '../auth/AuthContext';

const LINKS = [
  { to: '/mas/cuentas', label: es.more.accounts },
  { to: '/mas/categorias', label: es.more.categories },
  { to: '/mas/datos', label: es.more.data },
] as const;

export function MorePage() {
  const { logout } = useAuth();
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
      <Button variant="secondary" onClick={logout}>
        {es.auth.logout}
      </Button>
    </>
  );
}
