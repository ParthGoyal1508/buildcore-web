import { z } from 'zod';
import { authFetch } from '@/app/lib/session';

/**
 * One area the caller holds, at one level (019 FR-001).
 *
 * Mirrors the backend's `Grant`. `level` is a closed union rather than a string so a
 * comparison against `'wrte'` is a type error instead of a control that silently never
 * appears.
 */
const grantSchema = z.object({
  permission: z.string(),
  level: z.enum(['read', 'write']),
});

export type Grant = z.infer<typeof grantSchema>;
export type AccessLevel = Grant['level'];

const currentUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  firstname: z.string().nullable().optional(),
  lastname: z.string().nullable().optional(),
  roleNames: z.array(z.string()),
  /**
   * The areas this caller holds **at some level**.
   *
   * That is the backend's own definition and it is deliberate: keeping this field's
   * meaning unchanged is why the backend's level model could be added without touching
   * 116 permission declarations. It answers *visibility* — may this person reach the
   * module at all — and it cannot answer capability. For that, read `grants`.
   */
  permissions: z.array(z.string()),
  /**
   * The same areas, each with its level.
   *
   * **The backend has always sent this and this client discarded it.**
   * `user-response.dto.ts` declares it and `users.service.ts` returns it; a zod object
   * strips unknown keys, so it was dropped on arrival and nothing anywhere indicated a
   * field was being thrown away. Until this line existed, feature 019's FR-009 — write
   * controls absent for read-only roles — was unimplementable, and it looked like the
   * backend's gap.
   *
   * That is the third time this cycle the server sent something this client silently
   * filtered out, after `ApiError.details` and the project-document `missingTypeIds`.
   * Worth the paragraph: when a field seems missing from the API, read the raw response
   * before concluding anything, because these schemas are a filter and a field nobody
   * parsed looks exactly like a field nobody sent.
   *
   * `.default([])` so a login response cached from before this change parses rather than
   * signing the user out at the door.
   */
  grants: z.array(grantSchema).default([]),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

/**
 * Permissions whose *level* carries no meaning, so `hasWrite` must not consult it.
 *
 * The backend's migration doubled every array entry, so each of these appears in
 * `grants` at **both** levels. Asking whether `DATA_EXPORT` is "write" is meaningless
 * rather than false — there is no read-only way to export — and a caller holding one of
 * these holds it outright. `permissions` is the right field for them.
 *
 * Listed rather than derived: the backend decides which values are level-shaped, and a
 * rule inferred here ("anything ending `_APPROVE`") would quietly disagree the day it
 * adds one that does not fit the pattern.
 */
export const LEVEL_AGNOSTIC_PERMISSIONS: readonly string[] = [
  'CROSS_COMPANY_ACCESS',
  'DATA_EXPORT',
  'LABOUR_APPROVE',
  'INVENTORY_APPROVE',
  'RECRUITMENT_APPROVE',
  'ASSETS_APPROVE',
];

/**
 * Whether the caller may **write** in one area (019 FR-009).
 *
 * Fails closed: an area absent from `grants` is not writable, which matters for the
 * `.default([])` above — a user whose cached session predates this field is offered no
 * write control rather than every one of them. The server refuses either way; this only
 * decides what is shown, and of the two possible mistakes, hiding a control somebody
 * holds is the recoverable one.
 */
export function hasWrite(user: CurrentUser | undefined, permission: string): boolean {
  if (!user) return false;
  if (LEVEL_AGNOSTIC_PERMISSIONS.includes(permission)) {
    return user.permissions.includes(permission);
  }
  return user.grants.some(
    (grant) => grant.permission === permission && grant.level === 'write',
  );
}

/**
 * The authoritative answer to "who is signed in right now" — resolved from
 * the session itself on every call, never from a URL or cached copy that
 * could outlive the session that produced it.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const raw = await authFetch<unknown>('/users/me');
  return currentUserSchema.parse(raw);
}

/** Mirrors the backend's own display-name rule (auth.service.ts). */
export function displayName(user: CurrentUser): string {
  const full = [user.firstname, user.lastname].filter(Boolean).join(' ').trim();
  return full || user.username;
}
