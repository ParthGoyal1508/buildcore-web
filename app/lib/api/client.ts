import { API_URL } from '@/app/lib/config';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
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
    throw new ApiError(body.message || res.statusText, res.status);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}
