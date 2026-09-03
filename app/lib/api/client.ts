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
    throw new ApiError(body.message || res.statusText, res.status, body.code);
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
    throw new ApiError(body.message || res.statusText, res.status, body.code);
  }

  return res.blob();
}
