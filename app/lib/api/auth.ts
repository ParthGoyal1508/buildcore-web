import { z } from "zod";
import { apiFetch, ApiError } from "./client";
import { authFetch } from "@/app/lib/session";
import {
  setAccessToken,
  clearSession,
  setSessionHint,
  clearSessionHint,
  abandonRefresh,
  purgeRuntimeCaches,
} from "@/app/lib/session";
import { MESSAGES, formatLockoutMessage } from "@/app/lib/constants";
import { clearLocalUserData } from "@/app/lib/local-data";
import { announceSessionChange } from "@/app/lib/session-tab";

const loginResponseSchema = z.object({
  accessToken: z.string(),
  name: z.string(),
  mustChangePassword: z.boolean(),
  /** Where this user lands (029 FR-021). Optional so this client can deploy before the API
   * that sends it; absent means the same as null — the first module they can open. */
  homeModule: z.string().nullable().optional(),
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
    const raw = await apiFetch<unknown>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    const result = loginResponseSchema.parse(raw);
    setAccessToken(result.accessToken);
    setSessionHint();
    // Every other tab is now this person too (one cookie per browser); they reload onto it.
    announceSessionChange("signed-in");
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
  const raw = await apiFetch<unknown>("/auth/refresh-token", {
    method: "POST",
  });
  const result = refreshResponseSchema.parse(raw);
  setAccessToken(result.accessToken);
  return result.accessToken;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
    clearSessionHint();
    // A renewal already on its way would otherwise resolve after this and repopulate
    // the access token, quietly undoing the sign-out (015 FR-010).
    abandonRefresh();
    // Awaited here, unlike on an expired session: this is a sign-out the user asked for, and
    // the page it lands on must not be served anything of theirs (029).
    await purgeRuntimeCaches();
    // Bill drafts, the legacy punch queue and remembered choices go with the person (036 A26).
    await clearLocalUserData();
    announceSessionChange("signed-out");
  }
}

const passwordConfirmationSchema = z.object({
  confirmationToken: z.string(),
  expiresAt: z.string(),
});
export type PasswordConfirmation = z.infer<typeof passwordConfirmationSchema>;

/** The refusal codes `confirmPassword` and the act it unlocks can answer with. */
export const PASSWORD_INCORRECT = "PASSWORD_INCORRECT";
export const PASSWORD_CONFIRMATION_REQUIRED = "PASSWORD_CONFIRMATION_REQUIRED";

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
  purpose: "cash-visibility",
): Promise<PasswordConfirmation> {
  return passwordConfirmationSchema.parse(
    await authFetch<unknown>("/auth/confirm-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  await authFetch("/users/me/password", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ------------------------------------------------------------ Password reset (029)

/**
 * Forgot Password. The API answers the same way whether or not the address has an account,
 * so this resolves on any 202 and the screen must not suggest otherwise.
 *
 * Public — the person has no session — so `apiFetch`, never `authFetch`.
 */
export async function requestPasswordReset(identifier: string): Promise<void> {
  try {
    await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      throw new ApiError(MESSAGES.rateLimited, err.status);
    }
    throw err;
  }
}

export const resetLinkValidationSchema = z.union([
  z.object({ valid: z.literal(true) }),
  z.object({
    valid: z.literal(false),
    reason: z.enum(["expired", "consumed", "not_found"]),
  }),
]);
export type ResetLinkValidation = z.infer<typeof resetLinkValidationSchema>;

/**
 * Whether a reset link still works. The token goes in the body, not the URL: a request path
 * lands in proxy and access logs, and this token is a working credential until it is used.
 */
export async function validateResetLink(
  token: string,
): Promise<ResetLinkValidation> {
  try {
    const raw = await apiFetch<unknown>("/auth/reset-password/validate", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    return resetLinkValidationSchema.parse(raw);
  } catch (err) {
    // A token that is not even the right shape is refused by validation (400) before any
    // lookup — to the person holding it, that is a link that does not work.
    if (err instanceof ApiError && err.status === 400) {
      return { valid: false, reason: "not_found" };
    }
    throw err;
  }
}

/**
 * Sets the new password. Every session for the account ends server-side — this browser's
 * included — so any local session state is cleared too, or the next screen would try to
 * renew a session that no longer exists.
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  await apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
  clearSession();
  clearSessionHint();
  // Every session for the account has just ended, this one included.
  void purgeRuntimeCaches();
}

export type AdminResetMethod = "link" | "temporary_password";

const adminResetResultSchema = z.object({
  method: z.enum(["link", "temporary_password"]),
  /** Present only when the server generated it. Shown once; never stored client-side. */
  temporaryPassword: z.string().optional(),
  emailDispatchFailed: z.boolean(),
});
export type AdminResetResult = z.infer<typeof adminResetResultSchema>;

/** An administrator gets someone back into their account (029 FR-014). */
export async function adminResetPassword(
  targetAccountId: string,
  method: AdminResetMethod,
): Promise<AdminResetResult> {
  const raw = await authFetch<unknown>("/auth/admin/reset-password", {
    method: "POST",
    body: JSON.stringify({ targetAccountId, method }),
  });
  return adminResetResultSchema.parse(raw);
}
