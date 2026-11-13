import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { IconBack, IconHome, IconPlus, IconSettings } from './Icons';
import { cx } from './ui';

/** Centered title header with optional round icon buttons either side. */
export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean | string;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-bg/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
      <div className="w-12">
        {back && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="card grid size-12 place-items-center"
          >
            <IconBack />
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1 text-center">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      <div className="flex w-12 justify-end">{right}</div>
    </header>
  );
}

function Tab({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cx('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs', isActive ? 'text-text' : 'text-muted')
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

/** Bottom navigation with the orange hexagon "New box" action in the middle. */
export function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-3xl bg-surface pb-safe shadow-[0_-12px_30px_-10px_rgb(0_0_0/0.6)]"
    >
      <div className="relative flex items-end px-4">
        <Tab to="/" label="Boxes" icon={<IconHome />} />
        <div className="flex flex-1 flex-col items-center">
          <button
            type="button"
            onClick={() => navigate('/boxes/new')}
            aria-label="New box"
            className="hex fab -mt-7 grid size-[4.5rem] place-items-center text-white shadow-lg active:scale-95"
          >
            <IconPlus width={30} height={30} strokeWidth={2.5} />
          </button>
          <span className="pb-2 text-xs text-muted">New box</span>
        </div>
        <Tab to="/settings" label="Settings" icon={<IconSettings />} />
      </div>
    </nav>
  );
}

/** Layout for top-level screens (with bottom nav). */
export function TabLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-28">
      <Outlet />
      <BottomNav />
    </div>
  );
}

/** Layout for sub-screens (no bottom nav). */
export function PlainLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <Outlet />
    </div>
  );
}
