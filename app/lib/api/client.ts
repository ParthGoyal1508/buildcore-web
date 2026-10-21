import { API_URL } from '@/app/lib/config';
import {
  COMPANY_CHANGED,
  currentBelief,
  noteCompanyChangedRefusal,
  noteServedCompany,
} from '@/app/lib/company-tab';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /**
     * The backend's machine-readable error code, when it sends one.
     *
     * Carried separately from `message` so callers branch on a stable identifier
     * rather than on prose — wording is allowed to change without breaking a
     * client. Used today by `PASSWORD_CHANGE_REQUIRED` (010 FR-017a).
     */
    public code?: string,
    /**
     * The refusal's whole body, for the structured half a message cannot carry.
     *
     * Added 2026-10-01 because it was being thrown away. 017's mandatory-document refusal names the
     * missing kinds twice — as labels for a person to read, and as type ids for a form to put each
     * message *on the control it refers to* — and the second was unreachable from here, which left
     * matching controls by display name as the only option. Two kinds may legitimately share a
     * name, and a rename breaks that silently.
     *
     * `unknown` rather than a typed shape: this is one class for every endpoint, and each refusal
     * carries what it carries. Callers narrow what they came for.
     */
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Fetch options, plus how long to wait before giving up. */
export type ApiInit = RequestInit & {
  /**
   * Milliseconds before the request is abandoned with a `TIMEOUT` error. `0` waits for ever.
   * Defaults to `DEFAULT_TIMEOUT_MS`, or `UPLOAD_TIMEOUT_MS` for a large body / a file download.
   */
  timeoutMs?: number;
};

/**
 * How long a request may take before the screen says so (036 A2).
 *
 * There was no limit at all. A connection that dropped mid-request — a lift, a site at the edge of
 * coverage — left the request pending until the browser gave up minutes later, and the screen sat on
 * "Loading…" or a spinning Save the whole time. Thirty seconds is far beyond any healthy response
 * here and short enough that somebody is still looking at the screen when it gives up.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * Uploads (JSON carrying base64 up to 10 MB) and file downloads get longer: at a site's 1 Mbit/s a
 * full-size upload takes over a minute, and cutting it off at thirty seconds would turn a slow
 * success into a guaranteed failure.
 */
export const UPLOAD_TIMEOUT_MS = 180_000;
const LARGE_BODY_CHARS = 256_000;

/** Codes for failures that never reached a server answer. Status 0 on the `ApiError`. */
export const NETWORK_ERROR = 'NETWORK';
export const TIMEOUT_ERROR = 'TIMEOUT';

const NETWORK_MESSAGE =
  'Couldn’t reach the server. Check your connection and try again.';
const TIMEOUT_MESSAGE =
  'The server is taking too long to respond. Check your connection and try again.';

function deadlineSignal(
  signal: AbortSignal | null | undefined,
  timeoutMs: number,
): AbortSignal | undefined {
  const caller = signal ?? undefined;
  if (!timeoutMs || typeof AbortSignal === 'undefined' || !AbortSignal.timeout)
    return caller;
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!caller) return timeout;
  // A caller's own signal (React Query cancelling a superseded query) still works alongside the
  // deadline. A browser without `AbortSignal.any` keeps the caller's and loses only the deadline.
  return typeof AbortSignal.any === 'function'
    ? AbortSignal.any([caller, timeout])
    : caller;
}

/**
 * Whether an error is worth trying again by itself: no answer at all, or the server's own fault.
 * A 4xx never is — the same request will be refused the same way.
 */
export function isTransientError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 0 || error.status >= 500)
  );
}

/** A cash write refused because the company hides cash — for every caller, Super Admin too (038). */
export const CASH_HIDDEN = 'CASH_HIDDEN';
const CASH_HIDDEN_MESSAGE = 'Cash transactions are turned off for this company.';

/** The text to show for any thrown value, never `[object Object]` or a stack-trace fragment. */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  // One sentence for the refusal wherever a write meets it, whatever the endpoint words it as.
  if (error instanceof ApiError && error.code === CASH_HIDDEN)
    return CASH_HIDDEN_MESSAGE;
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}

/**
 * One message out of whatever the server put in `message` (036 A3).
 *
 * Nest's validation pipe sends a `string[]`, which used to reach the screen comma-joined —
 * "amount must not be less than 0,property x should not exist". Each becomes a sentence instead.
 */
function readableMessage(message: unknown): string {
  if (Array.isArray(message)) {
    const parts = [
      ...new Set(
        message
          .filter((part): part is string => typeof part === 'string')
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    ].map((part) => {
      const sentence = part.charAt(0).toUpperCase() + part.slice(1);
      return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    });
    return parts.join(' ');
  }
  return typeof message === 'string' ? message.trim() : '';
}

/**
 * The `ApiError` for a non-2xx response, from whatever body it has.
 *
 * A proxy's 502 is an HTML page, not JSON, and used to produce an empty red box; the status is the
 * only honest thing to say then. `code` and the whole body (`details`) are kept for callers that
 * branch on them.
 */
async function errorFromResponse(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const body =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const message =
    readableMessage(body.message) ||
    (res.status >= 500
      ? `Server error (${res.status}). Please try again.`
      : res.statusText || `Request failed (${res.status}).`);
  const error = new ApiError(
    message,
    res.status,
    typeof body.code === 'string' ? body.code : undefined,
    body,
  );
  if (res.status === 409 && error.code === COMPANY_CHANGED) {
    noteCompanyChangedRefusal(body);
  }
  return error;
}

/**
 * Sends a request and hands back the response once it is known to be a success.
 *
 * The one place a dropped connection or a timeout becomes an `ApiError` with status 0 and a code a
 * screen can show and React Query can decide to retry on. A caller's own abort is rethrown
 * untouched: that is a cancellation, not a failure, and React Query relies on seeing it as one.
 * `read` runs inside the same guard, so a body that stalls half-way is a timeout too.
 */
async function send<T>(
  path: string,
  init: ApiInit | undefined,
  headers: HeadersInit,
  read: (res: Response) => Promise<T>,
  defaultTimeout = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const { timeoutMs, ...rest } = init ?? {};
  const large =
    typeof rest.body === 'string' && rest.body.length > LARGE_BODY_CHARS;
  const signal = deadlineSignal(
    rest.signal,
    timeoutMs ?? (large ? UPLOAD_TIMEOUT_MS : defaultTimeout),
  );
  const sentWith = currentBelief();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal,
      // Sends/receives the httpOnly refresh-token cookie, which is set on a
      // different origin than this app in both local dev and production
      // (research.md §2; requires the backend's CORS credentials: true).
      credentials: 'include',
      headers,
    });
    noteServedCompany(res, sentWith);
    if (!res.ok) throw await errorFromResponse(res);
    return await read(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (rest.signal?.aborted) throw err;
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(TIMEOUT_MESSAGE, 0, TIMEOUT_ERROR);
    }
    // `fetch` rejects with a TypeError for every network-level failure ("Failed to fetch", "Load
    // failed", "NetworkError when attempting to fetch resource" — each browser has its own words).
    if (err instanceof TypeError) {
      throw new ApiError(NETWORK_MESSAGE, 0, NETWORK_ERROR);
    }
    throw err;
  }
}

export async function apiFetch<T>(path: string, init?: ApiInit): Promise<T> {
  return send(
    path,
    init,
    { 'Content-Type': 'application/json', ...init?.headers },
    async (res) => {
      const text = await res.text();
      return text ? JSON.parse(text) : (undefined as T);
    },
  );
}

/** A JSON body and the response's headers, for what only a header carries (`X-Total-Count`). */
export interface WithMeta<T> {
  data: T;
  headers: Headers;
}

/** `apiFetch`, keeping the response headers alongside the parsed body. */
export async function apiFetchWithMeta<T>(
  path: string,
  init?: ApiInit,
): Promise<WithMeta<T>> {
  return send(
    path,
    init,
    { 'Content-Type': 'application/json', ...init?.headers },
    async (res) => {
      const text = await res.text();
      return {
        data: text ? JSON.parse(text) : (undefined as T),
        headers: res.headers,
      };
    },
  );
}

/**
 * The `X-Total-Count` a paged list sent, or null when absent or unreadable (a cross-origin response
 * whose header the server did not expose).
 */
export function totalCountOf(headers: Headers): number | null {
  const raw = headers.get('X-Total-Count');
  if (raw === null || raw.trim() === '') return null;
  const total = Number(raw);
  return Number.isFinite(total) && total >= 0 ? total : null;
}

/**
 * Same request handling as `apiFetch`, returning the raw bytes.
 *
 * Needed for the endpoints that serve a stored file. They cannot be a plain
 * `<a href>`: the access token lives in memory and never appears in a URL, so the
 * only way to reach an authenticated file is to fetch it and hand the browser an
 * object URL for what came back.
 */
export async function apiFetchBlob(
  path: string,
  init?: ApiInit,
): Promise<Blob> {
  return send(
    path,
    init,
    { ...init?.headers },
    (res) => res.blob(),
    UPLOAD_TIMEOUT_MS,
  );
}

/** A stored file and the name the server says it has. */
export interface StoredFile {
  blob: Blob;
  /** Null when the response carried no `Content-Disposition` the browser could read. */
  filename: string | null;
}

/**
 * The filename out of a `Content-Disposition` header.
 *
 * Handles both spellings a server may send: `filename*=UTF-8''…` (RFC 5987, percent-encoded,
 * which is how a name with an em dash or a Devanagari character survives) and the plain
 * `filename="…"`. The starred form wins where both are present, which is what the RFC says.
 */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const extended = /filename\*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[2].trim());
    } catch {
      // A malformed percent-escape must not lose the download; fall through to the plain form.
    }
  }

  const plain = /filename=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/**
 * `apiFetchBlob`, keeping the name the server gave the file.
 *
 * A blob URL has no name of its own — the browser invents one from the URL, which is why
 * downloaded documents arrived as `524169d0-0cbe-4c5f-85f3-464b4da3c673` with no extension and
 * opened in a text editor. The name is only in the header, and only if the server also sends
 * `Access-Control-Expose-Headers: Content-Disposition`, which both document routes now do.
 */
export async function apiFetchFile(
  path: string,
  init?: ApiInit,
): Promise<StoredFile> {
  return send(
    path,
    init,
    { ...init?.headers },
    async (res) => ({
      blob: await res.blob(),
      filename: filenameFromDisposition(res.headers.get('Content-Disposition')),
    }),
    UPLOAD_TIMEOUT_MS,
  );
}
