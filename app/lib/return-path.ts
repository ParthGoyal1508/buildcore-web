/**
 * Where to go after signing in, when the session ended part-way through something (036 A24).
 *
 * A session that ended sent everybody to `/login` and from there to their home page, so whoever was
 * three screens into a bill or a payroll run started again from the top. The refused-renewal
 * redirect now carries `next=` and the sign-in form honours it.
 *
 * Same-origin paths only: `next` arrives in a URL anyone can craft, and an open redirect to another
 * site from the sign-in page is a phishing kit. Anything that is not a plain `/path` — a scheme,
 * a protocol-relative `//host`, a backslash some browsers treat as a slash — is ignored.
 */
export const RETURN_PATH_PARAM = 'next';

/** Pages that are no place to return to: the sign-in flow itself. */
const NOT_A_DESTINATION = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/set-password',
  '/change-password',
];

export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return null;
  }
  // Control characters (a tab or newline inside "/\t/evil.com") are refused outright.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, 'https://same-origin.invalid');
    if (url.origin !== 'https://same-origin.invalid') return null;
    if (NOT_A_DESTINATION.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** `next=<this page>` for a redirect to sign-in, or '' when this page is not worth returning to. */
export function returnPathQuery(): string {
  if (typeof window === 'undefined') return '';
  const path = safeReturnPath(`${window.location.pathname}${window.location.search}`);
  return path ? `${RETURN_PATH_PARAM}=${encodeURIComponent(path)}` : '';
}
