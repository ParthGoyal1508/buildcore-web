import { NAV_MODULES, type NavModule } from '@/app/lib/constants';

/**
 * Navigation and module-access decisions, derived from the signed-in user's effective
 * permissions (feature 014).
 *
 * Pure functions in `lib`, not logic inside component bodies (Principle I), and all
 * three read the same `NAV_MODULES` array so the sidebar and the route guard cannot
 * disagree about what a user may reach (FR-014).
 *
 * None of this is access control. `buildcore-api` guards every endpoint with
 * `@RequirePermissions` and that is the enforcement; these functions exist so a user is
 * not shown a menu entry, or a whole page, whose every request would come back 403.
 */

/** True when the user holds at least one of a module's governing permissions (FR-002). */
function permits(
  permissions: readonly string[],
  navModule: NavModule,
): boolean {
  return navModule.permissions.some((required) => permissions.includes(required));
}

/**
 * Whether `pathname` is covered by a module's guard.
 *
 * Matching is on whole path segments. `startsWith` alone would let `/dashboard/hrms`
 * match the `/dashboard/hr` prefix and inherit HR's permissions — a module gated by a
 * neighbour's rules purely because their names share an opening substring.
 *
 * A module with `guardsSubtree: false` covers only its exact path. Dashboard is the one
 * such module, and the distinction matters: `/dashboard` prefixes every route in the
 * shell, so treating it as a subtree would gate `/dashboard/account-creation` — and any
 * future route no module claims — behind the DASHBOARD permission.
 */
function isWithin(pathname: string, navModule: NavModule): boolean {
  if (pathname === navModule.guardPrefix) return true;
  return navModule.guardsSubtree && pathname.startsWith(`${navModule.guardPrefix}/`);
}

/** The modules to render in the sidebar, in `NAV_MODULES` order (FR-001). */
export function visibleModules(permissions: readonly string[]): NavModule[] {
  return NAV_MODULES.filter((navModule) => permits(permissions, navModule));
}

export type ModuleAccess = 'granted' | 'refused' | 'unknown-route';

/**
 * Whether the user may open `pathname`.
 *
 * Resolution takes the **longest** matching `guardPrefix`, never the first: `/dashboard`
 * is a prefix of every other module route, so first-match would resolve `/dashboard/hr`
 * to Dashboard and gate HR behind the `DASHBOARD` permission.
 *
 * `'unknown-route'` means no module claims this path — it is not this feature's concern,
 * and the caller renders it normally. The section guards in `app/dashboard/hr/layout.tsx`
 * and `app/dashboard/settings/layout.tsx` still apply below.
 *
 * Computed from `permissions` alone. It never consults what the sidebar rendered, so
 * omitting a link is presentation and never the thing preventing access (FR-007).
 */
export function hasModuleAccess(
  permissions: readonly string[],
  pathname: string,
): ModuleAccess {
  let matched: NavModule | null = null;
  for (const navModule of NAV_MODULES) {
    if (!isWithin(pathname, navModule)) continue;
    if (!matched || navModule.guardPrefix.length > matched.guardPrefix.length) {
      matched = navModule;
    }
  }
  if (!matched) return 'unknown-route';
  return permits(permissions, matched) ? 'granted' : 'refused';
}

/**
 * Where to send a user who has landed somewhere they cannot open — the first module they
 * do hold, in sidebar order, so the destination is the first thing in their own menu
 * (FR-008).
 *
 * `null` when they hold nothing. The caller MUST render the empty state rather than
 * redirect: every candidate destination would refuse them, so any redirect is a loop.
 */
export function landingRoute(permissions: readonly string[]): string | null {
  return visibleModules(permissions)[0]?.href ?? null;
}
