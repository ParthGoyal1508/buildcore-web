'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  ClockIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  FaceSmileIcon,
  ReceiptPercentIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { SerwistProvider } from '@serwist/next/react';
import { useQuery } from '@tanstack/react-query';
import { submitPunch } from '@/app/lib/api/my-workspace';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { drainQueue, getQueuedCount } from '@/app/lib/offline-queue';
import { hasModuleAccess } from '@/app/lib/permissions';
import AccessDenied from '@/app/ui/access-denied';

const TABS = [
  { name: 'Punch', href: ROUTES.myPunch, icon: ClockIcon },
  { name: 'Leave', href: ROUTES.myLeave, icon: CalendarDaysIcon },
  { name: 'Salary', href: ROUTES.mySalary, icon: BanknotesIcon },
  // "Claims", not "Reimbursements": six tabs share the width of a phone, and the
  // full word would either wrap or force the label smaller than the others.
  { name: 'Claims', href: ROUTES.myReimbursements, icon: ReceiptPercentIcon },
  { name: 'Face', href: ROUTES.myFaceEnrol, icon: FaceSmileIcon },
];

/**
 * The My Workspace shell (research.md §1).
 *
 * A bottom tab bar rather than `/dashboard`'s sidenav: this shell's users are site
 * employees holding a phone one-handed, where the reachable part of the screen is
 * the bottom.
 *
 * It also owns the single `online` listener that drains the offline punch queue
 * (research.md §5). Here, not on the Punch screen, because a worker who regains
 * signal while looking at their leave balance should still have their queued
 * punches sync — the layout is the one thing mounted for the whole visit.
 */
export default function MyWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [queued, setQueued] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  // Shares the `['currentUser']` key with the dashboard shell's guards, so moving
  // between the two shells costs no extra request.
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  useEffect(() => {
    let active = true;

    const refreshCount = async () => {
      const count = await getQueuedCount();
      if (active) setQueued(count);
    };

    const onOnline = async () => {
      const result = await drainQueue((entry) =>
        submitPunch({
          type: entry.type,
          photo: entry.photo,
          latitude: entry.latitude,
          longitude: entry.longitude,
          capturedAt: entry.capturedAt,
        }),
      );
      if (!active) return;

      // A rejected punch is surfaced once rather than dropped silently — the
      // employee needs to know that a punch they believed was captured will not
      // be counted, because only they can do anything about it.
      if (result.failures.length > 0) {
        setSyncNotice(MESSAGES.punchSyncFailed(result.failures[0].reason));
      } else if (result.synced > 0) {
        setSyncNotice(
          `${result.synced} queued punch${result.synced === 1 ? '' : 'es'} synced.`,
        );
      }
      await refreshCount();
    };

    refreshCount();
    window.addEventListener('online', onOnline);
    // Covers the case where the app is opened already back online, with punches
    // still sitting in the queue from a previous session — no `online` event ever
    // fires for that, so waiting for one would strand them.
    if (navigator.onLine) onOnline();

    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // FR-010a. Deliberately `user &&`, so this refuses ONLY on a successful load that
  // lacks the permission. A *failed* load falls through to the shell, because this one
  // is an offline-capable PWA whose whole point is a site worker with no signal: there,
  // a failed `/users/me` is indistinguishable from having no network, and treating it
  // as a refusal would lock a worker out of punching at exactly the moment the offline
  // queue below exists to serve them. `buildcore-api` still refuses the punch on drain
  // if they genuinely lack access, so nothing is exposed by letting them in.
  if (user && hasModuleAccess(user.permissions, pathname) === 'refused') {
    return <AccessDenied />;
  }

  return (
    // Registered here rather than in the root layout: the app shell worth caching
    // is this one — a site worker with no signal needs the Punch screen to open,
    // not the admin dashboard. Disabled in development, where a caching worker
    // serves stale assets across edits and reads as "my change did nothing".
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === 'development'}
    >
      <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-grow p-4 pb-24">
        {queued > 0 && (
          <p
            role="status"
            className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            {MESSAGES.punchQueuedCount(queued)}
          </p>
        )}
        {syncNotice && (
          <p
            role="status"
            className="mb-4 flex items-start justify-between gap-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
          >
            <span>{syncNotice}</span>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-xs font-medium underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Dismiss
            </button>
          </p>
        )}
        {children}
      </main>

      <nav
        aria-label="My Workspace"
        className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white"
      >
        <ul className="flex">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname.startsWith(tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={clsx(
                    'flex flex-col items-center gap-1 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500',
                    isActive
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-blue-600',
                  )}
                >
                  <Icon className="w-6" />
                  {tab.name}
                </Link>
              </li>
            );
          })}
          {/* The cross-shell link for a dual-role user (research.md §2, FR-017).
              A plain link, not a merged layout: the two shells are deliberately
              different shapes and collapsing them would compromise both. */}
          <li className="flex-1">
            <Link
              href={ROUTES.dashboard}
              className="flex flex-col items-center gap-1 py-2 text-xs font-medium text-gray-500 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
            >
              <Squares2X2Icon className="w-6" />
              Admin
            </Link>
          </li>
        </ul>
      </nav>
      </div>
    </SerwistProvider>
  );
}
