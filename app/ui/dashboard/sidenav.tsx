'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavLinks from '@/app/ui/dashboard/nav-links';
import { PowerIcon } from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';
import { logout } from '@/app/lib/api/auth';
import CurrentUser from '@/app/ui/dashboard/current-user';

export default function SideNav() {
  const router = useRouter();

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-2">
      <Link
        className="mb-2 flex h-20 items-end justify-start rounded-md bg-blue-600 p-4 md:h-40"
        href="/dashboard"
      >
        <div className={`${lusitana.className} text-xl text-white md:text-2xl`}>
          BuildCore
        </div>
      </Link>
      {/* Mobile: a wrapping row whose items are `flex-1 basis-[20%]`, so the targets
          fill each row evenly at *any* count (feature 014 made the count variable —
          it was fixed at ten before, and a five-column grid sized for exactly that
          left three modules stranded in five narrow tracks). Ten still wrap into two
          tidy rows inside a 320px viewport, without the shell scrolling sideways, and
          every target keeps the 44px minimum Principle VI requires of this surface.
          Desktop keeps the stacked column via `md:flex-col md:flex-nowrap`. */}
      <div className="flex flex-wrap gap-2 md:grow md:flex-col md:flex-nowrap md:gap-2">
        <NavLinks />
        {/* Spacer, desktop only. Below it the identity panel and Sign Out render in
            every state — including both failure states — so a user whose permissions
            filtered to nothing, or could not be read at all, still knows who they are
            signed in as and still has a way out (FR-004). */}
        <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block"></div>
        <div className="hidden md:block">
          <CurrentUser />
        </div>
        <button
          onClick={handleSignOut}
          className="flex h-[48px] flex-1 basis-[20%] items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:w-full md:flex-none md:basis-auto md:justify-start md:p-2 md:px-3"
        >
          <PowerIcon className="w-6" />
          <div className="hidden md:block">Sign Out</div>
        </button>
      </div>
    </div>
  );
}
