'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, displayName, type CurrentUser } from '@/app/lib/api/users';

/**
 * Shows who is *actually* authenticated, resolved from the backend
 * (`GET /users/me`) against the live session on every mount — not from a URL,
 * a cached render, or anything the browser's history can carry over from a
 * previous session. If this ever disagrees with what the rest of the page
 * claims, this one is the truth.
 */
export default function CurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-red-600">
        Session could not be verified
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">
        Checking session…
      </div>
    );
  }

  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <p className="truncate text-sm font-medium text-gray-900">
        {displayName(user)}
      </p>
      <p className="truncate text-xs text-gray-500">@{user.username}</p>
      <p className="truncate text-xs text-gray-500">
        {user.roleNames.length > 0 ? user.roleNames.join(', ') : 'No role assigned'}
      </p>
    </div>
  );
}
