'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import CompanyLogo from '@/app/ui/company-logo';
import { Spinner } from '@/app/ui/spinner';

/**
 * One full-page loader while the session is confirmed, instead of the shell drawing itself in
 * pieces (2026-10-15). The client, on the deployed app: "Can we make the full page loader".
 *
 * Until `GET /users/me` answers, the shell has nothing true to show — the sidebar does not know
 * which modules to list (it drew grey bars, and an Approvals entry that may not be the reader's),
 * the top bar said "Checking session…", and the page said "Loading…". On a slow connection that
 * half-built screen stood for seconds. This holds the whole shell back until the answer is in,
 * then the shell appears complete.
 *
 * The same query key every guard reads, so nothing is fetched twice; an error falls through to
 * the shell, whose guards already explain a session that could not be read (and `authFetch`
 * sends an expired one to the login page).
 */
export default function ShellGate({ children }: { children: React.ReactNode }) {
  const { isPending } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  if (!isPending) return <>{children}</>;
  return <FullPageLoader />;
}

/** The loader itself, for a shell that waits on something of its own (the muster screen). */
export function FullPageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[1300] flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white"
    >
      <CompanyLogo knockout priority className="h-12 max-w-[16rem]" />
      <div className="flex items-center gap-3 text-sm text-brand-100">
        <Spinner className="h-5 w-5 text-white" />
        Loading your workspace…
      </div>
    </div>
  );
}
