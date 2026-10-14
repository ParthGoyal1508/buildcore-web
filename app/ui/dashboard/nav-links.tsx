'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import { visibleModules } from '@/app/lib/permissions';
import SideNavItem from '@/app/ui/dashboard/sidenav-item';
import { areaForPath } from '@/app/ui/module-theme';

/** A full-width row inside the wrapping nav, for the states that are a message. */
const NOTICE = 'basis-full rounded-lg bg-white px-3 py-2 text-xs';

/**
 * The sidebar's module links, filtered to what the signed-in user's role permits
 * (feature 014, FR-001).
 *
 * Reads the same `['currentUser']` query key the route guards use, so the menu and the
 * guard resolve from one fetch and can never be computed from different snapshots of the
 * user mid-flight. That shared key is also why filtering costs no extra request.
 *
 * Rendering is deliberately three-state. Showing the full menu while the answer is
 * pending would flash every module at a restricted user on every page load (FR-011), and
 * falling back to the full menu when the check *fails* would hand every module to a user
 * whose permissions could not be read at all (FR-010) — so the pending state is a
 * placeholder and the failed state shows nothing.
 */
export default function NavLinks() {
  const pathname = usePathname();
  const {
    data: user,
    isPending,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  if (isPending) {
    // Neither the whole menu nor an empty one — an honest "not known yet" (FR-011).
    return (
      <>
        {[0, 1, 2, 3].map((slot) => (
          <div
            key={slot}
            aria-hidden="true"
            className="h-[48px] flex-1 basis-[20%] animate-pulse rounded-lg bg-white/70 md:h-9 md:flex-none md:basis-auto"
          />
        ))}
        <p className="sr-only" role="status">
          Loading your modules…
        </p>
      </>
    );
  }

  if (isError || !user) {
    return (
      <p role="status" className={`${NOTICE} text-red-600`}>
        {MESSAGES.navLoadFailed}
      </p>
    );
  }

  const modules = visibleModules(user.permissions);

  if (modules.length === 0) {
    // Not an error — a role with no modules assigned yet. Sign Out stays reachable
    // because `sidenav.tsx` renders it outside this component (FR-004, FR-009).
    return (
      <div role="status" className={`${NOTICE} text-gray-600`}>
        <p className="font-medium text-gray-900">{MESSAGES.noModulesTitle}</p>
        <p className="mt-1">{MESSAGES.noModulesBody}</p>
      </div>
    );
  }

  // The module that owns this page, by the same longest-prefix rule the route guard uses —
  // so a detail page three levels down still lights its module (2026-10-14: the sidebar had
  // no active state at all until now).
  const current = areaForPath(pathname);

  return (
    <>
      {modules.map((navModule) => (
        <SideNavItem
          key={navModule.id}
          href={navModule.href}
          area={navModule.id}
          label={navModule.name}
          active={current === navModule.id}
        />
      ))}
    </>
  );
}
