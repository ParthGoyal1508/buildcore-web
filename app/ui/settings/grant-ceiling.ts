import type { Role, RoleGrant } from '@/app/lib/api/settings';
import type { CurrentUser } from '@/app/lib/api/users';

/**
 * The backend's grant ceiling (`src/settings/roles/grant-ceiling.ts`), mirrored so the screens can
 * say up front what the server would refuse after Save (036 C10).
 *
 * Nobody hands out more than they hold: a grant may be given only by someone holding it at the
 * same level or higher, write covering read. `MY_WORKSPACE` is open to everyone, so granting it
 * hands over nothing. An area with no grant rows falls back to the permissions array at both
 * levels — the guard's own fallback, so this never disables what the server would allow.
 *
 * The affordance only; the server still decides.
 */
const ALWAYS_GRANTABLE = new Set(['MY_WORKSPACE']);

export function mayGrant(
  me: Pick<CurrentUser, 'permissions' | 'grants'> | undefined,
  permission: string,
  level: RoleGrant['level'],
): boolean {
  if (!me) return true;
  if (ALWAYS_GRANTABLE.has(permission)) return true;
  const area = me.grants.filter((grant) => grant.permission === permission);
  if (area.length === 0) return me.permissions.includes(permission);
  return area.some(
    (grant) =>
      grant.level === level || (level === 'read' && grant.level === 'write'),
  );
}

/** Whether every grant of `role` is within the caller's own (assigning it, 036 C1). */
export function mayAssignRole(
  me: Pick<CurrentUser, 'permissions' | 'grants'> | undefined,
  role: Pick<Role, 'permissions' | 'grants'>,
): boolean {
  const grants: RoleGrant[] =
    role.grants.length > 0
      ? role.grants
      : role.permissions.flatMap((permission) => [
          { permission, level: 'read' as const },
          { permission, level: 'write' as const },
        ]);
  return grants.every((g) => mayGrant(me, g.permission, g.level));
}
