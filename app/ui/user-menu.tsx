'use client';

import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logout } from '@/app/lib/api/auth';
import { displayName, getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';

/**
 * Who is signed in, in what role, and the way out — in the top bar (2026-10-14).
 *
 * The client: "Move Sign Out and the user's Role to the top navigation bar." Both lived at the
 * foot of the sidebar, where on a short screen they covered the last entries in the list, and
 * where on `/my` — whose sidebar is desktop-only — a phone had no Sign Out at all.
 *
 * Mounted by `ShellHeader`, so every shell gets it, in every state: FR-004 of feature 014
 * requires the identity panel and a way out even for a user whose permissions filtered to
 * nothing or could not be read, and this renders Sign Out regardless of whether the user query
 * has answered.
 *
 * The identity shown is resolved from the backend (`GET /users/me`) through the same
 * `['currentUser']` query every guard reads, never from anything a URL or the history could
 * carry over — the property the old sidebar panel was built to have.
 */
export default function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const { data: user, isError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      // Nothing fetched for this user should outlive their session in this tab.
      queryClient.clear();
      router.push(ROUTES.login);
    }
  }

  const name = user ? displayName(user) : null;
  const role = user
    ? user.roleNames.length > 0
      ? user.roleNames.join(', ')
      : 'No role assigned'
    : isError
      ? 'Session could not be verified'
      : null;
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex shrink-0 items-center gap-2 border-l border-gray-200 pl-3">
      <div
        className="flex min-w-0 items-center gap-2"
        title={[name, user ? `@${user.username}` : null, role]
          .filter(Boolean)
          .join(' · ')}
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-semibold text-white"
        >
          {initials}
        </span>
        <div className="hidden min-w-0 max-w-[12rem] leading-tight lg:block">
          <p className="truncate text-sm font-medium text-gray-900">
            {name ?? 'Checking session…'}
          </p>
          {role && (
            <p
              className={`truncate text-xs ${isError ? 'text-red-600' : 'text-gray-500'}`}
            >
              {role}
            </p>
          )}
        </div>
        {/* Below `lg` the name is hidden, so a screen reader still needs to hear who and what. */}
        <span className="sr-only lg:hidden">
          {name ? `Signed in as ${name}${role ? `, ${role}` : ''}` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        aria-label="Sign out"
        className="flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-50 sm:h-9"
      >
        <ArrowRightStartOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
        <span className="hidden xl:inline">Sign out</span>
      </button>
    </div>
  );
}
