'use client';

import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser, hasWrite, type CurrentUser } from './api/users';
import {
  ASSETS_PERMISSIONS,
  HR_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  LABOUR_PERMISSIONS,
  NAV_MODULES,
  PARTNERS_PERMISSIONS,
  PLANT_PERMISSIONS,
  PROJECTS_PERMISSIONS,
  RECRUITMENT_PERMISSIONS,
  ROUTES,
  SETTINGS_PERMISSIONS,
} from './constants';

/**
 * Which area the screen you are looking at writes to, and whether you may write there
 * (019 FR-009, tasks T006 to T008 and T012 to T022).
 *
 * **Resolved from the route, not passed in by each component.** This is what makes FR-009
 * affordable: there are roughly a hundred components carrying a write control, and a
 * `canWrite(user, 'MACHINERY')` call in each would be a hundred chances to name the wrong
 * permission — silently, because naming a permission the caller happens to hold looks exactly
 * like naming the right one. The route already determines the area; every module has published
 * that mapping since it was built, to gate its own sections.
 *
 * **Section before module, longest prefix wins.** Plant is why: `MACHINERY`, `LOGBOOK`, `FUEL`,
 * `MAINTENANCE` and `HIRE_BILLS` are five different permissions inside one module, and the
 * client's own example of what they want — site staff who may enter logbook and diesel readings
 * and touch nothing else in machinery — is exactly this distinction. A module-level answer would
 * get that case wrong in both directions.
 *
 * **A route under no module is ungated, deliberately.** The approvals surfaces are the reason
 * (task T023): authority to approve comes from the chain's slot mapping, not from a permission
 * value, so `app/dashboard/approvals/*` must keep its controls for anyone who has a queue. The
 * same applies to account creation and the reminders page. Those routes sit outside every
 * `guardPrefix`, so "no match" and "deliberately ungated" are the same condition rather than two
 * that have to be kept in step.
 *
 * The server is the real boundary either way. This decides what is *shown*, and `hasWrite` fails
 * closed, so the recoverable mistake is the one this makes.
 */

/** One route prefix and the permissions that let a holder write under it. Any-of. */
interface WriteScope {
  prefix: string;
  permissions: readonly string[];
}

/**
 * Sections, built from each module's own published map so the values are not restated here.
 *
 * Plant and Labour are spelled out against `ROUTES` rather than derived from their maps' keys:
 * `spareParts` is not the URL segment `spare-parts`, and a camelCase-to-kebab rule inferred here
 * would break the day a section's key and its path diverge for any other reason.
 */
const SECTION_SCOPES: readonly WriteScope[] = [
  // Plant & Machinery — the module whose sections genuinely differ.
  { prefix: ROUTES.plantEquipment, permissions: [PLANT_PERMISSIONS.equipment] },
  { prefix: ROUTES.plantLogbook, permissions: [PLANT_PERMISSIONS.logbook] },
  { prefix: ROUTES.plantFuel, permissions: [PLANT_PERMISSIONS.fuel] },
  { prefix: ROUTES.plantServices, permissions: [PLANT_PERMISSIONS.services] },
  {
    prefix: ROUTES.plantMaintenance,
    permissions: [PLANT_PERMISSIONS.maintenance],
  },
  {
    prefix: ROUTES.plantSpareParts,
    permissions: [PLANT_PERMISSIONS.spareParts],
  },
  { prefix: ROUTES.plantHireBills, permissions: [PLANT_PERMISSIONS.hireBills] },
  { prefix: ROUTES.plantMasters, permissions: [PLANT_PERMISSIONS.masters] },

  // The modules whose section keys are their URL segments.
  ...segmentScopes(ROUTES.hr, HR_PERMISSIONS),
  ...segmentScopes(ROUTES.projects, PROJECTS_PERMISSIONS),
  ...segmentScopes(ROUTES.partners, PARTNERS_PERMISSIONS),
  ...segmentScopes(ROUTES.inventory, INVENTORY_PERMISSIONS),
  ...segmentScopes(ROUTES.labour, LABOUR_PERMISSIONS),
  ...segmentScopes(ROUTES.recruitment, RECRUITMENT_PERMISSIONS),
  ...segmentScopes(ROUTES.assets, ASSETS_PERMISSIONS),
  ...segmentScopes(ROUTES.settings, SETTINGS_PERMISSIONS),
];

function segmentScopes(
  base: string,
  map: Readonly<Record<string, string>>,
): WriteScope[] {
  return Object.entries(map).map(([segment, permission]) => ({
    prefix: `${base}/${segment}`,
    permissions: [permission],
  }));
}

/**
 * Modules, as the fallback for a route its module has not sectioned.
 *
 * **My Workspace is excluded, deliberately.** An employee punching in or applying for leave is
 * writing, and those surfaces carry no permission at all on the server — they are `@SelfService()`,
 * answerable to who the caller *is* rather than what their role may do. Gating them on
 * `MY_WORKSPACE` at write level would take the punch button away from the employees the module
 * exists for. Same category of exception as the approvals queue (task T023), and for the same
 * reason: the permission model is not what authorises these.
 */
const UNGATED_MODULE_IDS: readonly string[] = ['my-workspace'];

const MODULE_SCOPES: readonly WriteScope[] = NAV_MODULES.filter(
  (module) =>
    module.guardsSubtree && !UNGATED_MODULE_IDS.includes(module.id),
).map((module) => ({
  prefix: module.guardPrefix,
  permissions: module.permissions,
}));

const ALL_SCOPES: readonly WriteScope[] = [...SECTION_SCOPES, ...MODULE_SCOPES];

/**
 * The permissions that let a holder write on this path, or `null` for a path no module claims.
 *
 * `null` and `[]` are different answers and the distinction matters: `null` is "outside every
 * module, so not this mechanism's business" and keeps controls visible; `[]` would mean "claimed
 * and writable by nobody", which no scope produces.
 */
export function writePermissionsFor(pathname: string): readonly string[] | null {
  let best: WriteScope | null = null;
  for (const scope of ALL_SCOPES) {
    const matches =
      pathname === scope.prefix || pathname.startsWith(`${scope.prefix}/`);
    if (!matches) continue;
    if (best === null || scope.prefix.length > best.prefix.length) best = scope;
  }
  return best?.permissions ?? null;
}

/** Whether a user may write on this path. See `writePermissionsFor` for the `null` case. */
export function canWriteAt(
  user: CurrentUser | undefined,
  pathname: string,
): boolean {
  const permissions = writePermissionsFor(pathname);
  if (permissions === null) return true;
  return permissions.some((permission) => hasWrite(user, permission));
}

/**
 * Whether the signed-in user may write on the screen they are on.
 *
 * Shares the `['currentUser']` query key every screen already uses, so this adds no request.
 *
 * Returns `false` while the answer is loading. A control that appears a moment late is a smaller
 * problem than one that appears, invites a click, and then 403s — and on a warm cache, which is
 * the ordinary case once past the first screen, there is no such moment.
 */
export function useCanWrite(): boolean {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  return canWriteAt(data, pathname ?? '');
}

/**
 * Renders its children only for a user who may write here (FR-007: removed, never disabled).
 *
 * A disabled button still advertises an action the person cannot take, and invites the support
 * call that asks why it does nothing.
 */
export function WriteOnly({ children }: { children: React.ReactNode }) {
  return useCanWrite() ? <>{children}</> : null;
}

/**
 * Routes that exist only to create something (019 FR-008, tasks T025 and T026).
 *
 * A screen whose entire purpose is a write should refuse a reader **on arrival**, rather than
 * render a form they can fill in and then watch fail on save. Everywhere else in this app creation
 * happens in a modal reached from a gated control, so this list is short by construction rather
 * than by having been trimmed.
 *
 * **Not derived from HTTP verbs**, and the backend's own audit of this is why: its equivalent task
 * found two routes that are writes by verb and reads by meaning — validating an attendance import
 * file imports nothing, and exporting a report is seeing it. Judgement, mirrored, not re-derived.
 *
 * `/dashboard/account-creation/new` is deliberately absent: it sits under no module (it is how an
 * account comes to exist at all) and is governed by role, not by a permission level.
 */
export const WRITE_BY_NATURE_ROUTES: readonly string[] = [
  `${ROUTES.projects}/portfolio/new`,
  `${ROUTES.hr}/employees/new`,
];

/** Whether this path exists only to create something. Exact match: `/new/[id]` is not one. */
export function isWriteByNature(pathname: string): boolean {
  return WRITE_BY_NATURE_ROUTES.includes(pathname);
}
