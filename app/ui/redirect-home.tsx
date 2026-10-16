'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { homeRoute } from '@/app/lib/permissions';

/**
 * Where a page this user may not open sends them: their own home (2026-10-16 access-control
 * audit, M1).
 *
 * A direct URL to a module or section outside someone's role used to render "Access denied" in
 * place — which confirms the page exists, and leaves them on a dead end. The menu already hides
 * these links; typing the URL now lands on the same home the sign-in does. `replace`, so Back does
 * not return to the refused URL and bounce again.
 *
 * Never used for a *failed* permissions load: that is not a refusal, and redirecting on it would
 * throw a user with a flaky connection out of the page they were on.
 */
export default function RedirectHome() {
  const router = useRouter();
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  // The role's chosen home first (029 FR-021), then the first module held.
  const home = user ? (homeRoute(user) ?? ROUTES.myWorkspace) : null;

  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);

  return (
    <p className="p-4 text-sm text-gray-500" role="status">
      {MESSAGES.navRedirecting}
    </p>
  );
}
