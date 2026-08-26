import { apiFetch } from './client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_KEY = 'buildcore_access_token';

// NOTE: localStorage is a placeholder for this boilerplate. docs/HLD.md §9.1
// specifies an in-memory access token + an HTTP-only refresh-token cookie
// set by the API — that requires the backend to set cookies on login, which
// isn't wired yet (see buildcore-api's README). Swap this out when it is.
export function storeAccessToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearTokens() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const tokens = await apiFetch<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  storeAccessToken(tokens.accessToken);
  return tokens;
}
