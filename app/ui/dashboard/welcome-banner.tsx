'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, displayName } from '@/app/lib/api/users';
import { consumeJustLoggedIn } from '@/app/lib/session';
import { MESSAGES } from '@/app/lib/constants';

/**
 * Shows "Welcome back, {name}!" once, on arrival from a fresh login
 * (spec FR-006). The name is fetched from the live session rather than
 * passed in, so it can never show a previous user's name after a
 * logout-and-switch — the browser-history bug this replaced.
 */
export default function WelcomeBanner() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!consumeJustLoggedIn()) return;
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setName(displayName(user));
      })
      // A failure here is already handled by authFetch (refresh, then
      // redirect to /login if that fails) — the banner just stays hidden.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!name) return null;

  return (
    <p className="mb-4 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
      {MESSAGES.welcomeBack(name)}
    </p>
  );
}
