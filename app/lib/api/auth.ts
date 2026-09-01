import { z } from 'zod';
import { apiFetch, ApiError } from './client';
import { authFetch } from '@/app/lib/session';
import {
  setAccessToken,
  clearSession,
  setSessionHint,
  clearSessionHint,
} from '@/app/lib/session';
import { MESSAGES, formatLockoutMessage } from '@/app/lib/constants';

const loginResponseSchema = z.object({
  accessToken: z.string(),
  name: z.string(),
  mustChangePassword: z.boolean(),
});

const refreshResponseSchema = z.object({
  accessToken: z.string(),
});

export type LoginResult = z.infer<typeof loginResponseSchema>;

/**
 * Maps every failure to this app's own copy regardless of the backend's
 * exact wording (contracts/auth-api.md already returns a generic message for
 * 401, but the frontend shouldn't rely on that staying true — spec FR-004).
 */
export async function login(
  identifier: string,
  password: string,
  rememberMe: boolean,
): Promise<LoginResult> {
  try {
    const raw = await apiFetch<unknown>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, rememberMe }),
    });
    const result = loginResponseSchema.parse(raw);
    setAccessToken(result.accessToken);
    setSessionHint(rememberMe);
    return result;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        throw new ApiError(MESSAGES.invalidCredentials, err.status);
      }
      if (err.status === 423) {
        throw new ApiError(formatLockoutMessage(err.message), err.status);
      }
      if (err.status === 429) {
        // Without this the raw "ThrottlerException: Too Many Requests" from
        // the backend reaches the user (contracts/auth-api.md's rate-limit
        // section specifies this copy instead).
        throw new ApiError(MESSAGES.rateLimited, err.status);
      }
    }
    throw err;
  }
}

export async function refreshToken(): Promise<string> {
  const raw = await apiFetch<unknown>('/auth/refresh-token', { method: 'POST' });
  const result = refreshResponseSchema.parse(raw);
  setAccessToken(result.accessToken);
  return result.accessToken;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
    clearSessionHint();
  }
}

/**
 * Changes the signed-in user's own password.
 *
 * Also the way out of the forced-change state: the backend clears
 * `mustChangePassword` in the same write, and the refusal it drives stops
 * immediately — the current session keeps working, with no re-login
 * (`010` FR-017a, FR-017b).
 */
export async function changePassword(input: {
  oldPassword: string;
  newPassword: string;
}): Promise<void> {
  await authFetch('/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
