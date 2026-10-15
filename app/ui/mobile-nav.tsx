'use client';

import {
  Bars3Icon,
  CheckCircleIcon,
  HomeIcon,
  RectangleStackIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { landingRoute } from '@/app/lib/permissions';
import ApprovalBadge, {
  useApprovalTotal,
} from '@/app/ui/dashboard/approval-badge';
import NavLinks from '@/app/ui/dashboard/nav-links';
import ReminderBadge from '@/app/ui/dashboard/reminder-badge';

/**
 * The phone navigation, the same in every shell (2026-10-15).
 *
 * The client's words: "Can we make the consistent UI for mobile. The home page itself doesn't
 * make sense (how can I understand from the icons). For mobile the second screenshot looks
 * better, where we have options in the bottom for each sub module items." The first screenshot
 * was the dashboard shell, which on a phone stacked the sidebar above every page as a grid of
 * fourteen unlabelled icons; the second was My Workspace and its labelled bottom bar.
 *
 * So below `md` every shell now has My Workspace's shape:
 *
 * - **The bottom bar** carries the current module's own sections — Register, Logbook, Fuel… in
 *   Plant; Punch, Leave, Holidays… in My Workspace — each with its icon *and* its name.
 * - **Menu**, the bar's last slot, opens a sheet with the rest of this module's sections, every
 *   module by name, and Approvals and Reminders with their counts. It replaces the icon grid,
 *   and the "Admin" entry My Workspace used to carry.
 *
 * The sections reach the bar through context rather than a second list per module: a module's
 * existing `SectionTabs` (the desktop strip) registers its tabs here when given `mobile`, so the
 * bar can never offer a section the strip filtered out for this user's permissions.
 *
 * Desktop is unchanged — the sidebar and the tab strip.
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface MobileSection {
  name: string;
  href: string;
  icon?: Icon;
}

interface Registered {
  label: string;
  tabs: readonly MobileSection[];
}

const MobileNavContext = createContext<{
  register: (sections: Registered) => () => void;
} | null>(null);

/** Four sections, then Menu: five targets of about 75px on a 375px phone. */
const BAR_SECTIONS = 4;

/**
 * Registers a module's sections with the bar for as long as the caller is mounted. A no-op
 * outside a shell that renders the bar.
 */
export function useMobileSections(
  label: string,
  tabs: readonly MobileSection[],
  enabled: boolean,
) {
  const register = useContext(MobileNavContext)?.register;
  // The latest tabs, read when the hrefs change — icons are component references and the array
  // is rebuilt on every render, so neither can be the effect's dependency.
  const latest = useRef(tabs);
  // Declared before the registering effect, so it has run by the time that one reads it.
  useEffect(() => {
    latest.current = tabs;
  });
  const key = tabs.map((tab) => tab.href).join('|');

  useEffect(() => {
    if (!enabled || !register || key === '') return;
    return register({ label, tabs: latest.current });
  }, [enabled, register, label, key]);
}

/** The longest tab href the path is on or under — the rule `SectionTabs` uses. */
export function activeTabHref(
  pathname: string,
  tabs: readonly { href: string }[],
): string {
  return tabs
    .map((tab) => tab.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .reduce((best, href) => (href.length > best.length ? href : best), '');
}

/**
 * The bar and its sheet, and the context modules register their sections in. Wraps a shell's
 * whole body; renders nothing at `md` and up.
 */
export function MobileNavShell({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState<Registered | null>(null);

  const register = useCallback((next: Registered) => {
    setSections(next);
    // Cleared only if it is still this registration: navigating between two modules mounts the
    // new strip before the old one's cleanup would otherwise wipe it.
    return () => setSections((current) => (current === next ? null : current));
  }, []);

  return (
    <MobileNavContext.Provider value={{ register }}>
      {children}
      <MobileBottomBar sections={sections} />
    </MobileNavContext.Provider>
  );
}

function MobileBottomBar({ sections }: { sections: Registered | null }) {
  const pathname = usePathname();
  // The path the sheet was opened on: any navigation — including one made from inside the sheet —
  // closes it, without an effect resetting state.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const approvals = useApprovalTotal();

  const tabs = sections?.tabs ?? [];
  const active = activeTabHref(pathname, tabs);

  let shown: MobileSection[];
  if (tabs.length > 0) {
    shown = tabs.slice(0, BAR_SECTIONS);
    // The section you are on is always in the bar: past the fourth, it takes the last slot.
    const current = tabs.find((tab) => tab.href === active);
    if (current && !shown.includes(current)) {
      shown = [...shown.slice(0, BAR_SECTIONS - 1), current];
    }
  } else {
    // A page outside any module's sections (Approvals, Account Creation): home and the queue.
    const home = user ? landingRoute(user.permissions) : null;
    shown = [
      ...(home ? [{ name: 'Home', href: home, icon: HomeIcon }] : []),
      { name: 'Approvals', href: ROUTES.approvals, icon: CheckCircleIcon },
    ];
  }
  const fallbackActive = activeTabHref(pathname, shown);

  return (
    <>
      <nav
        aria-label={sections?.label ?? 'Main'}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(15,23,42,0.06)] md:hidden"
      >
        <ul className="flex">
          {shown.map((tab) => {
            const Icon = tab.icon ?? RectangleStackIcon;
            const isActive =
              tab.href === (tabs.length > 0 ? active : fallbackActive);
            return (
              <li key={tab.href} className="min-w-0 flex-1">
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={clsx(
                    'flex h-full min-h-[56px] flex-col items-center gap-1 px-1 pb-1.5 pt-2 text-center text-[11px] font-medium leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500',
                    isActive
                      ? 'text-brand-700'
                      : 'text-gray-500 hover:text-brand-700',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-7 w-12 items-center justify-center rounded-full',
                      isActive && 'bg-accent-50',
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="line-clamp-2 break-words">{tab.name}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={() => setOpenOn(pathname)}
              className="relative flex h-full min-h-[56px] w-full flex-col items-center gap-1 px-1 pb-1.5 pt-2 text-[11px] font-medium leading-tight text-gray-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500"
            >
              <span className="relative flex h-7 w-12 items-center justify-center">
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                {approvals > 0 && (
                  <span className="absolute -top-1 right-0 min-w-[18px] rounded-full bg-green-600 px-1 text-[10px] font-semibold leading-[18px] text-white tabular-nums">
                    <span aria-hidden="true">{approvals}</span>
                    <span className="sr-only">
                      , {approvals} awaiting your approval
                    </span>
                  </span>
                )}
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>

      {menuOpen && (
        <MenuSheet
          sections={sections}
          active={active}
          onClose={() => setOpenOn(null)}
        />
      )}
    </>
  );
}

/** The sheet behind Menu: this module's sections, then every module, then the workflow queues. */
function MenuSheet({
  sections,
  active,
  onClose,
}: {
  sections: Registered | null;
  active: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // The page underneath stays where it was while the sheet scrolls.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Menu</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-3 py-4">
          {sections && sections.tabs.length > 0 && (
            <SheetGroup title={sections.label.replace(/ sections$/, '')}>
              <div className="grid grid-cols-2 gap-2">
                {sections.tabs.map((tab) => {
                  const Icon = tab.icon ?? RectangleStackIcon;
                  const isActive = tab.href === active;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={clsx(
                        'flex min-h-[48px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
                        isActive
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-brand-300',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 leading-tight">{tab.name}</span>
                    </Link>
                  );
                })}
              </div>
            </SheetGroup>
          )}

          <SheetGroup title="Modules">
            <nav aria-label="Modules" className="flex flex-col gap-0.5">
              <NavLinks labelled />
            </nav>
          </SheetGroup>

          <SheetGroup title="Workflow">
            <div className="flex flex-col gap-0.5">
              <ApprovalBadge labelled />
              <ReminderBadge labelled />
            </div>
          </SheetGroup>
        </div>
      </div>
    </div>
  );
}

function SheetGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      {children}
    </section>
  );
}
