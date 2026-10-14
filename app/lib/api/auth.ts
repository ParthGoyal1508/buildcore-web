import { z } from 'zod';
import { apiFetch, ApiError } from './client';
import { authFetch } from '@/app/lib/session';
import {
  setAccessToken,
  clearSession,
  setSessionHint,
  clearSessionHint,
  abandonRefresh,
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
): Promise<LoginResult> {
  try {
    // No `rememberMe`: every session lasts the same 90 days now, so there is nothing
    // to choose (015 FR-005). The API still accepts the field, so the two deployments
    // may land in either order.
    const raw = await apiFetch<unknown>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    const result = loginResponseSchema.parse(raw);
    setAccessToken(result.accessToken);
    setSessionHint();
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
    // A renewal already on its way would otherwise resolve after this and repopulate
    // the access token, quietly undoing the sign-out (015 FR-010).
    abandonRefresh();
  }
}

const passwordConfirmationSchema = z.object({
  confirmationToken: z.string(),
  expiresAt: z.string(),
});
export type PasswordConfirmation = z.infer<typeof passwordConfirmationSchema>;

/** The refusal codes `confirmPassword` and the act it unlocks can answer with. */
export const PASSWORD_INCORRECT = 'PASSWORD_INCORRECT';
export const PASSWORD_CONFIRMATION_REQUIRED = 'PASSWORD_CONFIRMATION_REQUIRED';

/**
 * Re-enters the signed-in user's own password before a sensitive act (2026-10-14).
 *
 * Returns a short-lived confirmation (ten minutes) for that one purpose, which the act's own
 * request then carries. Held in component state only — never stored — so it ends with the
 * screen. A wrong password is a 403 coded `PASSWORD_INCORRECT`, never a 401: `authFetch` treats
 * a 401 as an expired session and would sign the user out for a typo.
 */
export async function confirmPassword(
  password: string,
  purpose: 'cash-visibility',
): Promise<PasswordConfirmation> {
  return passwordConfirmationSchema.parse(
    await authFetch<unknown>('/auth/confirm-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, purpose }),
    }),
  );
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
