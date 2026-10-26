'use client';

import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import WorkspaceLoadError from '@/app/ui/workspace-load-error';
import SideNav from '@/app/ui/dashboard/sidenav';
import { FullPageLoader } from '@/app/ui/shell-gate';
import ShellHeader from '@/app/ui/shell-header';

/**
 * The field shell for recording a delivery at the site (043), shaped like `app/labour/layout.tsx`
 * and for the same reasons: outside `/dashboard`, so the module guard does not reach it; a single
 * narrow column on a phone; `/dashboard`'s sidebar from `md` up.
 *
 * `INVENTORY_SITE_ENTRY` stands in for the module guard — the permission the API's
 * `inventory/site-entries` endpoints require, and nothing of the Inventory module besides.
 */
export default function InventoryFieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    data: user,
    isPending,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  if (isPending) {
    return <FullPageLoader />;
  }
  if (isError || !user) {
    return <WorkspaceLoadError />;
  }
  if (!user.permissions.includes('INVENTORY_SITE_ENTRY')) {
    return (
      <AccessDenied detail="Recording a delivery from the site needs the Inventory Site Delivery Entry permission." />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 md:h-screen md:overflow-hidden md:bg-transparent">
      <ShellHeader />
      <div className="flex min-h-0 min-w-0 flex-grow flex-col md:flex-row md:overflow-hidden">
        <div className="hidden flex-none md:block">
          <SideNav />
        </div>
        <div className="flex min-w-0 flex-grow flex-col md:overflow-hidden">
          <div className="flex-grow p-4 md:overflow-y-auto md:p-12">
            <Link
              href={ROUTES.home}
              className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 md:hidden"
            >
              <ArrowLeftIcon className="w-4" aria-hidden="true" />
              Home
            </Link>
            <div className="mx-auto max-w-xl md:mx-0">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
