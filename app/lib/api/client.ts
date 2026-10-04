import { API_URL } from '@/app/lib/config';

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

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // Sends/receives the httpOnly refresh-token cookie, which is set on a
    // different origin than this app in both local dev and production
    // (research.md §2; requires the backend's CORS credentials: true).
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.message || res.statusText,
      res.status,
      body.code,
      body,
    );
  }

  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
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
  init?: RequestInit,
): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.message || res.statusText,
      res.status,
      body.code,
      body,
    );
  }

  return res.blob();
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
  init?: RequestInit,
): Promise<StoredFile> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.message || res.statusText,
      res.status,
      body.code,
      body,
    );
  }

  return {
    blob: await res.blob(),
    filename: filenameFromDisposition(res.headers.get('Content-Disposition')),
  };
}
