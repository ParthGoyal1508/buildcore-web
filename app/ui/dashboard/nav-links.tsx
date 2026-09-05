'use client';

import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  HomeIcon,
  UsersIcon,
  BriefcaseIcon,
  TruckIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  UserPlusIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, type NavModuleId } from '@/app/lib/constants';
import { visibleModules } from '@/app/lib/permissions';

/**
 * Icons for the modules defined in `NAV_MODULES`.
 *
 * Kept here rather than in `constants.ts` so that file — imported by server components
 * across the app — does not pull nine icon components into every bundle that reads a
 * route or a message. Typing it as a `Record` over `NavModuleId` makes it exhaustive:
 * adding a module to `NAV_MODULES` without an icon fails to compile rather than
 * rendering a blank space.
 */
const ICONS: Record<NavModuleId, ComponentType<SVGProps<SVGSVGElement>>> = {
  dashboard: HomeIcon,
  hr: UsersIcon,
  projects: BriefcaseIcon,
  plant: TruckIcon,
  inventory: ArchiveBoxIcon,
  // A cube rather than another box: Inventory already owns the archive box, and the
  // two modules sitting next to each other with the same glyph is the confusion
  // 012's own spec asks the sidebar to avoid.
  assets: CubeIcon,
  partners: UserGroupIcon,
  labour: WrenchScrewdriverIcon,
  recruitment: UserPlusIcon,
  reports: ChartBarIcon,
  'my-workspace': ClockIcon,
  settings: Cog6ToothIcon,
};

/**
 * One nav target. `flex-1 basis-[20%]` on a wrapping row means the modules fill each
 * row evenly whatever their number — three modules become three wide buttons rather
 * than three narrow ones stranded in a five-column track — while ten still wrap into
 * two tidy rows inside a 320px viewport. `h-[48px]` holds the 44px minimum touch target
 * that Principle VI requires of this surface. Desktop reverts to the stacked column via
 * `md:flex-none md:basis-auto`.
 */
const ITEM =
  'flex h-[48px] flex-1 basis-[20%] items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:flex-none md:basis-auto md:justify-start md:p-2 md:px-3';

/** A full-width row inside the wrapping nav, for the states that are a message. */
const NOTICE = 'basis-full rounded-md bg-gray-50 px-3 py-2 text-xs';

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
            className="h-[48px] flex-1 basis-[20%] animate-pulse rounded-md bg-gray-100 md:flex-none md:basis-auto"
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

  return (
    <>
      {modules.map((navModule) => {
        const LinkIcon = ICONS[navModule.id];
        return (
          <Link key={navModule.id} href={navModule.href} className={ITEM}>
            <LinkIcon className="w-6" />
            <p className="hidden md:block">{navModule.name}</p>
          </Link>
        );
      })}
    </>
  );
}
