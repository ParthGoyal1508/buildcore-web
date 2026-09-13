# Phase 1 Data Model — Session Persistence

This application stores no data of its own. What follows is the session state it holds, and where.

| State | Where it lives | Lifetime | Readable by page scripts |
|---|---|---|---|
| **Working credential** (access token) | Module memory in `app/lib/session.ts` | Until the tab closes or the page reloads | Yes, by design — it is attached to each request |
| **Renewal credential** (refresh cookie) | Browser cookie jar, `HttpOnly` | 90 days, sliding | **No** — and FR-017 requires this stays true |
| **Session hint** | Browser cookie, readable | **90 days** (was: browser-session when "remember me" was unticked) | Yes — it carries no identity, only the fact that a session exists |
| **Just-signed-in marker** | Module memory | One read | Yes |

## Changes

**Renewal credential** — unchanged in this application; it becomes first-party by virtue of the
route it arrives over, not by anything stored differently.

**Session hint** — the only real change. It stops being a browser-session cookie and is always
written with a 90-day `max-age`.

This is load-bearing. `app/ui/dashboard/session-guard.tsx` redirects to `/login` whenever the hint
is absent, so a hint that dies with the browser would evict a user whose 90-day session is
perfectly valid — the reported bug, reappearing one layer above where it was fixed. The hint's
lifetime must therefore track the session's, not the browser window's.

The hint remains identity-free: it says *that* a session exists, never *whose*. Enforcement is the
backend re-validating every request; this is a UX signal only, and its value to an attacker is
nil.

## What is deliberately not stored

No credential is written to `localStorage` or `sessionStorage`, before or after this feature
(FR-017). The renewal credential stays unreadable to scripts, which is what makes an XSS bug cost
one short-lived working credential rather than a 90-day session.
