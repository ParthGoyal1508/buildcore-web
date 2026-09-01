import { z } from 'zod';
import { API_URL } from '@/app/lib/config';
import { authFetch } from '@/app/lib/session';

/**
 * The `/account-creation/*` client (contracts/account-creation-ui.md).
 *
 * Every response is parsed through a zod schema before it reaches a component, the
 * same posture `settings.ts` takes: the backend is trusted, but a shape change on
 * its side should fail loudly here rather than surface as `undefined` three
 * components deep.
 */

// ------------------------------------------------------------------ Schemas

export const unlinkedEmployeeSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),
});
export type UnlinkedEmployee = z.infer<typeof unlinkedEmployeeSchema>;

export const createdUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.enum(['pending', 'active', 'deactivated']),
  /** True when the account was created but its invite could not be delivered. The
   * account is fine; the admin needs to resend. */
  emailDispatchFailed: z.boolean(),
});
export type CreatedUser = z.infer<typeof createdUserSchema>;

export const inviteValidationSchema = z.union([
  z.object({ valid: z.literal(true), email: z.string() }),
  z.object({
    valid: z.literal(false),
    reason: z.enum(['expired', 'consumed', 'not_found']),
  }),
]);
export type InviteValidation = z.infer<typeof inviteValidationSchema>;

/**
 * The create-user form's shape.
 *
 * Two rules the backend also enforces are mirrored here so the user finds out
 * before a round trip: a company is required unless the role is cross-company, and
 * exactly one of employee / display name identifies the person. The backend remains
 * the authority — this is for feedback, not for security.
 */
export const createUserSchema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    roleId: z.string().min(1, 'Choose a role.'),
    companyId: z.string().optional(),
    employeeId: z.string().optional(),
    displayName: z.string().optional(),
    /**
     * Optional. Supplying one creates the account directly instead of emailing an
     * invite (backend FR-015): it opens immediately and the user must change this
     * password at first login.
     */
    password: z.string().optional(),
    /** Not sent to the API — drives the two conditional rules below. */
    roleIsCrossCompany: z.boolean(),
  })
  .refine(
    (v) => v.roleIsCrossCompany || Boolean(v.companyId),
    { path: ['companyId'], message: 'Choose a company for this role.' },
  )
  .refine(
    (v) => !(v.roleIsCrossCompany && v.companyId),
    {
      path: ['companyId'],
      message: 'A cross-company role is not scoped to one company.',
    },
  )
  .refine(
    // Only when one is actually supplied — an empty field means "send an invite",
    // not "an invalid password".
    (v) => !v.password || passwordRules.every((r) => r.test(v.password as string)),
    {
      path: ['password'],
      message:
        'Password must be at least 8 characters and include an uppercase letter and a number.',
    },
  )
  .refine(
    (v) => Boolean(v.employeeId) !== Boolean(v.displayName?.trim()),
    {
      path: ['displayName'],
      message: 'Link an employee or enter a name — one or the other.',
    },
  );
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Mirrors the backend's `PASSWORD_COMPLEXITY` constant. Kept as separate named
 * rules so the form can show which ones are still unmet rather than one flat
 * "invalid password". */
export const passwordRules = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v: string) => /\d/.test(v) },
] as const;

export const setPasswordSchema = z.object({
  password: z
    .string()
    .refine((v) => passwordRules.every((r) => r.test(v)), {
      message:
        'Password must be at least 8 characters and include an uppercase letter and a number.',
    }),
});

// ------------------------------------------------------------------ Calls

/** Employees in a company with no account yet, for the invite form's picker. */
export async function getUnlinkedEmployees(
  companyId: string,
  search?: string,
): Promise<UnlinkedEmployee[]> {
  const params = new URLSearchParams({ companyId });
  if (search?.trim()) {
    params.set('search', search.trim());
  }
  const raw = await authFetch<unknown>(
    `/account-creation/employees/unlinked?${params.toString()}`,
  );
  return z.array(unlinkedEmployeeSchema).parse(raw);
}

export async function createUser(
  input: CreateUserInput,
): Promise<CreatedUser> {
  // `roleIsCrossCompany` is form state, not part of the contract, and the backend
  // rejects unrecognised fields outright.
  const {
    // Destructured only to keep it out of the request: it is form state, and the
    // backend rejects unrecognised fields outright.
    roleIsCrossCompany: _roleIsCrossCompany,
    displayName,
    employeeId,
    companyId,
    password,
    ...rest
  } = input;
  const raw = await authFetch<unknown>('/account-creation/users', {
    method: 'POST',
    body: JSON.stringify({
      ...rest,
      ...(companyId ? { companyId } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
      // Omitted entirely when blank: an empty string would be a password the
      // backend then rejects, rather than the invite flow the admin asked for.
      ...(password ? { password } : {}),
    }),
  });
  return createdUserSchema.parse(raw);
}

export async function resendInvite(
  userId: string,
): Promise<{ emailDispatchFailed: boolean }> {
  const raw = await authFetch<unknown>(
    `/account-creation/users/${userId}/resend-invite`,
    { method: 'POST' },
  );
  return z.object({ emailDispatchFailed: z.boolean() }).parse(raw);
}

/**
 * Checks an invite token. Public — the recipient has no session yet, which is the
 * whole point, so this uses a bare fetch rather than `authFetch`.
 */
export async function validateInvite(
  token: string,
): Promise<InviteValidation> {
  const res = await fetch(
    `${API_URL}/account-creation/invites/${encodeURIComponent(token)}`,
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (!res.ok) {
    // A transport failure is not the same as a rejected token; treating it as
    // "not found" would tell someone their valid link is broken.
    throw new Error('Could not check this invite link. Please try again.');
  }
  return inviteValidationSchema.parse(await res.json());
}

/** Sets the password and activates the account. Public, like `validateInvite`. */
export async function setPassword(
  token: string,
  password: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/account-creation/invites/${encodeURIComponent(token)}/set-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
  );
  if (res.ok) {
    return;
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 410) {
    throw new Error(
      body.message ??
        'This invite link is no longer valid. Ask an administrator to resend it.',
    );
  }
  throw new Error(body.message ?? 'Could not set your password. Please try again.');
}
