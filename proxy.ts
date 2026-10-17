import { NextRequest, NextResponse } from 'next/server';

// Coarse, presence-only gate. The real refresh-token cookie is set on
// buildcore-api's own origin (httpOnly, cross-origin from this app) and is
// never visible here — this checks a separate same-origin marker cookie
// the frontend sets itself on login (app/lib/session.ts) instead. Real
// enforcement happens server-side on every request (spec FR-010); this just
// avoids flashing the dashboard shell at an obviously signed-out visitor.
const SESSION_HINT_COOKIE = 'session_hint';

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_HINT_COOKIE);
  const isLoginRoute = request.nextUrl.pathname === '/login';

  // Already signed in and heading for the login page — send them on to their
  // home instead of asking them to log in again. `/home` works out where that is
  // from their roles (029 FR-021); this is also the path every launch of the
  // installed app takes (`/` → `/login` → here).
  if (isLoginRoute) {
    return hasSession
      ? NextResponse.redirect(new URL('/home', request.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  const response = NextResponse.next();
  // Discourages the browser from serving this authenticated page back out of
  // its cache after the session ends (belt-and-suspenders alongside
  // session-guard.tsx's pageshow check, which is what actually catches it).
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  // `/my/:path*` is a separate top-level tree from `/dashboard/*` (the My Workspace
  // shell, feature 003), so it needs its own matcher entry — the existing pattern
  // does not cover it, and without this the shell would render to a signed-out
  // visitor before any request failed (spec FR-016, SC-007).
  // `/change-password` needs a session too: without one, its form can only fail.
  // `/labour/:path*` is the supervisor's field tree (013, 031) — outside `/dashboard` for the same
  // reason `/my` is, and it was missing here, so a signed-out phone saw the shell and then a
  // "could not load" instead of the sign-in page. It also sends `no-store` on a screen of photos.
  matcher: [
    '/dashboard/:path*',
    '/my/:path*',
    '/labour/:path*',
    '/login',
    '/home',
    '/change-password',
  ],
};
