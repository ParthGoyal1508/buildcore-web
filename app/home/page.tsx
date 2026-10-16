'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { homeRoute } from '@/app/lib/permissions';
import { LoadingText } from '@/app/ui/spinner';

/**
 * Sends a signed-in user to their home (029 FR-021).
 *
 * The installed app opens at `/`, which goes to `/login`, which proxy.ts sends here when a
 * session exists — so every launch of the PWA lands where this person's role says, not on
 * Dashboard first. A page rather than a redirect in proxy.ts because the destination depends on
 * the user's roles, which only the API knows.
 *
 * `replace`, so Back from the home page leaves the app instead of bouncing through here.
 */
export default function HomePage() {
  const router = useRouter();
  const { data: user, isError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  useEffect(() => {
    if (user) router.replace(homeRoute(user) ?? ROUTES.dashboard);
    // The dashboard shell owns every failure state — signed out, offline, no modules — so a
    // failure here hands over to it rather than growing a second copy of each.
    else if (isError) router.replace(ROUTES.dashboard);
  }, [user, isError, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <p role="status" className="text-sm text-gray-500">
        <LoadingText />
      </p>
    </main>
  );
}
