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

  // Already signed in and heading for the login page — send them on to the
  // dashboard instead of asking them to log in again.
  if (isLoginRoute) {
    return hasSession
      ? NextResponse.redirect(new URL('/dashboard', request.url))
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
  matcher: ['/dashboard/:path*', '/my/:path*', '/login'],
};
