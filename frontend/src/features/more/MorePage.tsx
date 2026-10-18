import {
  Brain,
  ChevronRight,
  Coins,
  CreditCard,
  DatabaseBackup,
  FolderTree,
  Inbox,
  KeyRound,
  Landmark,
  Repeat,
  Tags,
  Trash,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { es } from '../../shared/i18n/es';
import { Button, Notice, PageTitle } from '../../shared/ui/ui';
import { LookBadge, type Tone } from '../../shared/ui/categoryLook';
import { useAction } from '../../shared/ui/useAction';
import { useAuth } from '../auth/AuthContext';
import { LegalLinks } from '../legal/LegalPage';
import { ICON_SIZE } from '../../shared/ui/icons';

interface MoreLink {
  to: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  /** Only an admin sees it; the server refuses the rest anyway. */
  adminOnly?: boolean;
}

/** Everything in Más, in groups, so a dozen options can be found at a glance. */
const GROUPS: readonly { title: string; links: readonly MoreLink[] }[] = [
  {
    title: es.more.groups.money,
    links: [
      { to: '/pendientes', label: es.more.pending, icon: Inbox, tone: 'violet' },
      { to: '/mas/cuentas', label: es.more.accounts, icon: Wallet, tone: 'green' },
      { to: '/mas/tarjetas', label: es.more.cards, icon: CreditCard, tone: 'blue' },
      { to: '/mas/fijos', label: es.more.recurrings, icon: Repeat, tone: 'violet' },
      { to: '/mas/tasas', label: es.more.rates, icon: Coins, tone: 'amber' },
    ],
  },
  {
    title: es.more.groups.organize,
    links: [
      { to: '/mas/categorias', label: es.more.categories, icon: FolderTree, tone: 'peach' },
      { to: '/mas/etiquetas', label: es.more.tags, icon: Tags, tone: 'pink' },
      { to: '/mas/bancos', label: es.more.institutions, icon: Landmark, tone: 'blue' },
      { to: '/mas/recuerda', label: es.more.remembered, icon: Brain, tone: 'violet' },
    ],
  },
  {
    title: es.more.groups.data,
    links: [
      { to: '/mas/datos', label: es.more.data, icon: DatabaseBackup, tone: 'green' },
      { to: '/mas/papelera', label: es.more.trash, icon: Trash, tone: 'gray' },
    ],
  },
  {
    title: es.more.groups.user,
    links: [
      { to: '/mas/contrasena', label: es.more.password, icon: KeyRound, tone: 'amber' },
      { to: '/mas/usuarios', label: es.more.users, icon: Users, tone: 'blue', adminOnly: true },
    ],
  },
];

export function MorePage() {
  const { logout, session } = useAuth();
  const { failure, run } = useAction();
  const isAdmin = session?.role === 'admin';

  const logoutEverywhere = async () => {
    if (!window.confirm(es.auth.logoutAllConfirm)) return;
    if (await run(api<void>('/auth/logout-all', { method: 'POST' }))) logout();
  };
  return (
    <>
      <PageTitle>{es.more.title}</PageTitle>
      <div className="mb-6 space-y-5">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{group.title}</h2>
            <ul className="divide-y divide-line rounded-2xl bg-surface shadow-card">
              {group.links
                .filter((link) => !link.adminOnly || isAdmin)
                .map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="flex min-h-14 items-center gap-3 px-3 py-2 font-medium">
                      <LookBadge look={{ icon: link.icon, tone: link.tone }} />
                      <span className="flex-1">{link.label}</span>
                      <ChevronRight size={ICON_SIZE.chevron} className="text-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
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
