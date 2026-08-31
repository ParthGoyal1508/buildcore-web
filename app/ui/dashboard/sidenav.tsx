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
      {/* Mobile: a wrapping 5-column grid, so ten 44px-minimum targets (nine
          modules plus Sign Out) fit two tidy rows inside a 320px viewport instead
          of overflowing one row and scrolling the whole shell sideways
          (Principle VI). Desktop keeps the stacked column. */}
      <div className="grid grid-cols-5 gap-2 md:flex md:grow md:flex-col md:gap-2">
        <NavLinks />
        <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block"></div>
        <div className="hidden md:block">
          <CurrentUser />
        </div>
        <button
          onClick={handleSignOut}
          className="flex h-[48px] w-full items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
        >
          <PowerIcon className="w-6" />
          <div className="hidden md:block">Sign Out</div>
        </button>
      </div>
    </div>
  );
}
