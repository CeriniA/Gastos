import { ChartPie, Ellipsis, House, List, Plus, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { es } from '../i18n/es';
import { ServerWaking } from './ServerWaking';
import { ICON_SIZE, BOLD_STROKE } from '../ui/icons';

const TABS = [
  { to: '/', label: es.nav.home, icon: House, end: true },
  { to: '/movimientos', label: es.nav.transactions, icon: List, end: false },
  { to: '/informes', label: es.nav.reports, icon: ChartPie, end: false },
  { to: '/mas', label: es.nav.more, icon: Ellipsis, end: false },
] as const;

/** A tab of the bottom bar: its icon over its name, violet while it is the screen shown. */
function Tab({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? 'text-primary' : 'text-muted'}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={ICON_SIZE.nav} strokeWidth={isActive ? BOLD_STROKE : undefined} aria-hidden="true" />
          {label}
        </>
      )}
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
        className="fixed inset-x-0 bottom-0 bg-surface pb-[env(safe-area-inset-bottom)] shadow-card"
      >
        <div className="mx-auto flex max-w-xl items-center px-2">
          <Tab {...home} />
          <Tab {...transactions} />
          <NavLink
            to="/agregar"
            aria-label={es.nav.add}
            className="mx-2 -mt-5 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-card"
          >
            <Plus size={ICON_SIZE.add} strokeWidth={BOLD_STROKE} aria-hidden="true" />
          </NavLink>
          <Tab {...reports} />
          <Tab {...more} />
        </div>
      </nav>
    </div>
  );
}
