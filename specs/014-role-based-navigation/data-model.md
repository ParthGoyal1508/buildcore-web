# Phase 1 Data Model: Role-Based Navigation

This feature introduces **no persisted entity**. Everything below is a client-side shape derived
from data the API already returns.

## NavModule

The single definition required by FR-014, in `app/lib/constants.ts` as `NAV_MODULES`, declared
`as const` so the module ids and route strings are literal types rather than `string`.

| Field | Type | Meaning |
|---|---|---|
| `id` | literal string | Stable key for the module (`'dashboard'`, `'hr'`, …). Used as the React key and in the guard's route lookup. |
| `name` | string | The label shown in the sidebar. Sourced here, not inline in JSX (Principle III). |
| `href` | route string | Where the sidebar link points. For eight modules a `/dashboard/*` path; for My Workspace, `ROUTES.myPunch`, which leaves the shell. |
| `guardPrefix` | route string | The subtree the guard protects — **not** always equal to `href`. My Workspace links to `/my/punch` but guards all of `/my`; without this distinction `/my/leave` fails to match `/my/punch` and is admitted unguarded. For the other eight, `guardPrefix` equals `href`. |
| `permissions` | readonly Permission[] | The governing permissions. **Any-of**: the module is visible when the user holds at least one. Never empty. |
| `guardsSubtree` | boolean | Whether `guardPrefix` covers everything beneath it. True for eight modules; **false for Dashboard**, whose `/dashboard` prefix would otherwise capture every route in the shell that no other module claims — putting `/dashboard/account-creation`, and any future unclaimed route, behind the `DASHBOARD` permission. Discovered during implementation. |

The `icon` is deliberately **not** a field here. It lives in a `Record<NavModuleId, …>` in
`app/ui/dashboard/nav-links.tsx`, because `constants.ts` is imported by server components
throughout the app and adding nine icon components to it would pull them into every one of
those bundles. Typing that record over `NavModuleId` keeps it exhaustive, so a module added
without an icon fails to compile rather than rendering a blank space.

Derived types:

- `type NavModuleId = (typeof NAV_MODULES)[number]['id']`
- `NAV_GOVERNING_PERMISSIONS` — the flattened set of every permission appearing in any module's
  `permissions`, used by the roles screen (FR-013) to tell nav-governing permissions apart from the
  rest.

## Permission partition

Of the 22 assignable permissions in the existing `PERMISSIONS` constant, **13 govern a sidebar
module** and **9 govern nothing in the sidebar**. FR-013 requires the roles screen to make this
visible, because an administrator who clears a permission from the second group and expects the
menu to change is silently misled.

| Governs a sidebar module (13) | Governs no sidebar module (9) |
|---|---|
| DASHBOARD, EMPLOYEES, ATTENDANCE, PAYROLL, PROJECTS, MACHINERY, INVENTORY, PARTNERS, REPORTS, MY_WORKSPACE, SETTINGS, USER_MANAGEMENT, COMPANY_SETTINGS | DWR, PROJECT_FINANCIALS, CHALLANS, LOANS, LOGBOOK, FUEL, DAILY_WORKER_REGISTRY, DATA_EXPORT, DATA_DELETE |

The nine on the right gate content *below* module level — a tab, a report, an action — and are
already enforced by the API and, where relevant, by the existing `HR_PERMISSIONS` guard.

## Session view of the user

Unchanged and already validated. `getCurrentUser()` in `app/lib/api/users.ts` parses `/users/me`
with a zod schema producing:

| Field | Type | Use here |
|---|---|---|
| `permissions` | string[] | The union of every role the account holds. The only input to every decision in this feature. |
| `roleNames` | string[] | Displayed in the identity panel; also used by the existing Users-administration check. Not used for navigation. |
| `id`, `email`, `username`, `firstname`, `lastname` | — | Identity panel only. |

No field is added, and no new schema is written.

## Derived state (not stored)

Three pure functions in the new `app/lib/permissions.ts`, taking the permission array and returning
values with no side effects:

| Function | Returns | Used by |
|---|---|---|
| `visibleModules(permissions)` | `NavModule[]` in `NAV_MODULES` order | The sidebar (FR-001, FR-002) |
| `hasModuleAccess(permissions, pathname)` | `'granted' \| 'refused' \| 'unknown-route'` | The module guard (FR-006, FR-007). Resolves `pathname` by **longest** `guardPrefix` match among modules whose guard covers it, matching whole path segments only so `/dashboard/hrms` cannot inherit HR's permissions |
| `landingRoute(permissions)` | route string, or `null` when no module is held | The FR-008 redirect; `null` triggers the FR-009 empty state |

Keeping these in `lib` rather than in component bodies is Principle I; all three read from
`NAV_MODULES`, which is what makes the sidebar and the guard structurally incapable of disagreeing.

## Lifecycle

There is no state machine and nothing to migrate. The permission array is re-resolved by the shared
`['currentUser']` query on each session load; a role edit by an administrator is reflected the next
time that query resolves, because `buildcore-api` re-derives permissions from the database on every
request rather than trusting the token's claims.
