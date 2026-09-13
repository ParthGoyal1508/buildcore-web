'use client';

import { useEffect } from 'react';

const SESSION_HINT_COOKIE = 'session_hint';

function hasSessionHint(): boolean {
  return document.cookie
    .split('; ')
    .some((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));
}

/**
 * Defence-in-depth against the browser back button after a sign-out.
 *
 * Nothing server-side can cover this: the browser (or Next's client Router Cache) can
 * restore an already-rendered dashboard from the back/forward cache without any
 * request reaching a server at all. So this checks a readable marker instead — on
 * mount, and on `pageshow`, the one event that also fires for a bfcache restore where
 * DOMContentLoaded does not. A hard redirect rather than `router.replace` forces a real
 * round-trip past every client-side cache.
 *
 * The marker's lifetime matters as much as its presence. It is written with the same
 * 90-day life as the session it stands for (`setSessionHint`); when it was a
 * browser-session cookie, this guard would evict a perfectly valid session the first
 * time someone reopened their browser (015 FR-002).
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
