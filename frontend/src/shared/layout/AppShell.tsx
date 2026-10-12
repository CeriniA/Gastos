import { NavLink, Outlet } from 'react-router-dom';
import { es } from '../i18n/es';
import { ServerWaking } from './ServerWaking';

const TABS = [
  { to: '/', label: es.nav.home, end: true },
  { to: '/movimientos', label: es.nav.transactions, end: false },
  { to: '/informes', label: es.nav.reports, end: false },
  { to: '/mas', label: es.nav.more, end: false },
] as const;

function Tab({ to, label, end }: { to: string; label: string; end: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-14 flex-1 items-center justify-center text-sm font-medium ${isActive ? 'text-income' : 'text-muted'}`
      }
    >
      {label}
    </NavLink>
  );
}

/** Phone-first frame: content above, bottom bar with the add button in the middle. */
export function AppShell() {
  const [home, transactions, reports, more] = TABS;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">
        <ServerWaking />
        <Outlet />
      </main>
      <nav
        aria-label={es.nav.main}
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-xl items-center px-2">
          <Tab {...home} />
          <Tab {...transactions} />
          <NavLink
            to="/agregar"
            aria-label={es.nav.add}
            className="mx-2 -mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-income text-3xl leading-none text-surface shadow-lg"
          >
            +
          </NavLink>
          <Tab {...reports} />
          <Tab {...more} />
        </div>
      </nav>
    </div>
  );
}
