'use client';

import { useEffect } from 'react';

const SESSION_HINT_COOKIE = 'session_hint';

function hasSessionHint(): boolean {
  return document.cookie
    .split('; ')
    .some((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));
}

/**
 * Defense-in-depth against the browser back button after logout: proxy.ts
 * only runs when a request actually reaches the server, but the browser
 * (or Next's client Router Cache) can restore this page from a cached
 * render without one. Checks on mount, plus on `pageshow` — the one event
 * that also fires when a page is restored from the back/forward cache,
 * unlike DOMContentLoaded. A hard redirect (not router.replace) forces a
 * real server round-trip past any client-side cache.
 */
export default function SessionGuard() {
  useEffect(() => {
    function checkSession() {
      if (!hasSessionHint()) {
        window.location.replace('/login');
      }
    }
    checkSession();
    window.addEventListener('pageshow', checkSession);
    return () => window.removeEventListener('pageshow', checkSession);
  }, []);

  return null;
}
