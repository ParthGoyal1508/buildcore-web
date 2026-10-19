'use client';

import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
 *
 * **A menu, not a row (2026-10-15).** The client: "Super Admin as a dropdown and logout in that
 * dropdown or hover." The avatar, name and role are now one button; Sign out and Change password
 * live in the panel it opens. It opens on hover where there is a mouse — with a short delay on
 * leaving, so a diagonal move towards the panel does not close it — and on click or Enter
 * everywhere, which is what a touch screen and a keyboard have. A user whose session could not be
 * read still reaches Sign out: the button renders whether or not the query has answered.
 */
export default function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: user, isError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // Hover only for a real mouse: a tap fires pointerenter too, and would open the panel only for
  // the click that follows to close it again.
  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

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

  const avatar = (size: string) => (
    <span
      aria-hidden="true"
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-emerald-400 text-xs font-semibold text-brand-700 ring-2 ring-white/20`}
    >
      {initials}
    </span>
  );

  const item =
    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none';

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 border-l border-white/15 pl-2"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-11 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 sm:h-10 ${open ? 'bg-white/10' : ''}`}
      >
        {avatar('h-8 w-8')}
        <span className="hidden min-w-0 max-w-[12rem] text-left leading-tight lg:block">
          <span className="block truncate text-sm font-medium text-white">
            {name ?? 'Checking session…'}
          </span>
          {role && (
            <span
              className={`block truncate text-xs ${isError ? 'text-red-200' : 'text-brand-100'}`}
            >
              {role}
            </span>
          )}
        </span>
        {/* Below `lg` the name is hidden, so a screen reader still needs to hear who and what. */}
        <span className="sr-only lg:hidden">
          {name ? `Signed in as ${name}${role ? `, ${role}` : ''}` : 'Account'}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={`h-4 w-4 text-white/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        role="menu"
        aria-label="Account"
        className={`absolute right-0 top-full z-50 w-64 origin-top-right pt-2 transition duration-150 ease-out ${
          open
            ? 'visible translate-y-0 scale-100 opacity-100'
            : 'invisible -translate-y-1 scale-95 opacity-0'
        }`}
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-xl ring-1 ring-black/5">
          <div className="flex items-center gap-3 bg-gradient-to-br from-brand-50 to-white px-4 py-3">
            {avatar('h-10 w-10')}
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">
                {name ?? 'Checking session…'}
              </p>
              {user && (
                <p className="truncate text-xs text-gray-500">
                  @{user.username}
                </p>
              )}
              {role && (
                <span
                  className={`mt-1 inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium ${isError ? 'bg-red-50 text-red-700' : 'bg-brand-100 text-brand-700'}`}
                >
                  {role}
                </span>
              )}
            </div>
          </div>
          <div className="border-t border-gray-100 p-1.5">
            <Link
              role="menuitem"
              tabIndex={open ? 0 : -1}
              href={ROUTES.changePassword}
              onClick={() => setOpen(false)}
              className={`${item} text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50`}
            >
              <KeyIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
              Change password
            </Link>
            <button
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              onClick={handleSignOut}
              disabled={signingOut}
              className={`${item} text-red-600 hover:bg-red-50 focus-visible:bg-red-50 disabled:opacity-50`}
            >
              <ArrowRightStartOnRectangleIcon
                className="h-4 w-4"
                aria-hidden="true"
              />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
