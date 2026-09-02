# Phase 0 Research: Role-Based Navigation

## §1 Where can the guard live?

**Decision**: At the layout boundary, as a `"use client"` component — `app/ui/dashboard/module-guard.tsx`
mounted by `app/dashboard/layout.tsx`, and an equivalent check inside `app/my/layout.tsx`.

**Rationale**: The obvious answer — Next.js `middleware.ts`, deciding at the edge before the page
renders — is not available to this codebase. Feature 001 deliberately keeps the access token **in
memory only** (`app/lib/session.ts`) so it never sits in a cookie; middleware can read cookies and
nothing else, so it never sees the token and cannot resolve who the caller is. Moving the token to
a cookie to enable an edge guard would reverse a deliberate security decision for a UX affordance.
Both existing guards (`app/dashboard/settings/layout.tsx`, `app/dashboard/hr/layout.tsx`) carry this
same reasoning in comments; this feature follows the precedent rather than re-litigating it.

**Alternatives considered**: Middleware (impossible, above). Per-page checks (rejected by the same
reasoning the two existing layout guards record — repetition across nine modules, with the failure
mode being a page someone forgets to guard). A server-side `layout.tsx` fetch (would need the token
server-side, same blocker).

**Consequence to accept**: This is a UX affordance, not the access control. `buildcore-api` guards
every endpoint with `@RequirePermissions`, and that is what actually enforces access. The guard
exists so a user is not shown a page whose every request would 403.

## §2 Avoiding a second fetch and the menu flash

**Decision**: The sidebar reads the **same** `useQuery({ queryKey: ['currentUser'] })` the guards
use, and renders a neutral placeholder while `isPending`.

**Rationale**: `['currentUser']` is already the shared key in both existing layout guards and in
`current-user.tsx`. React Query dedupes by key, so adding the sidebar as a third consumer costs no
extra request and — more importantly — means the menu and the guard can never be resolved from
different snapshots of the user. FR-011's "no flash of the full menu, no flash of an empty menu"
then reduces to rendering a third state while pending, rather than defaulting to either extreme.

**Alternatives considered**: Passing permissions down from a server layout (blocked by §1). A
separate fetch in the sidebar (extra request, and two sources that can disagree mid-flight).
Rendering the full menu optimistically and filtering on arrival (this is precisely the flash FR-011
forbids, and it briefly advertises modules the user cannot open).

## §3 One definition, used twice

**Decision**: A single `NAV_MODULES` constant in `app/lib/constants.ts` carries each module's label,
route, icon key and governing permissions. The sidebar maps over it; the guard looks up by route
prefix against the same array.

**Rationale**: This is FR-014, and Principle III independently requires it. The failure mode of two
definitions is specific and bad: the sidebar hides a module the guard still admits (reachable by
URL, so the restriction is fictional) or the sidebar shows one the guard refuses (a dead link, the
exact defect this feature exists to remove). Deriving both from one array makes that class of bug
unrepresentable rather than merely unlikely.

**Placement note**: `SETTINGS_PERMISSIONS` and `HR_PERMISSIONS` already live in this file and are the
tier below. `NAV_MODULES` sits with them; the three together are the complete permission-to-surface
map for the app.

## §4 Keeping `/my` reachable offline — and a spec amendment

**Decision**: The `/my` guard refuses **only** when `/users/me` resolves successfully and the
`MY_WORKSPACE` permission is absent. A *failed* load falls through to the shell rather than
refusing. Spec amended with **FR-010a** to record this.

**Rationale**: This is the one place where FR-010's blanket "if details cannot be loaded, show no
modules and state the failure" is actively harmful. `/my` is a serwist PWA whose entire point is a
field worker with intermittent signal: `app/my/layout.tsx` owns an `online` listener that drains a
queued-punch store. Treating a network failure as a refusal would lock a worker out of the punch
screen exactly when the offline queue was built to serve them — the failure is indistinguishable
from "no signal", which is the normal operating condition on a site.

Refusing only on a *successful, negative* answer preserves both properties: a user genuinely lacking
`MY_WORKSPACE` is refused (they will always be online enough to get an answer, since they reached
the app at all), and an offline user with a valid session is not. The backend still enforces on
drain, so nothing is actually exposed.

**Alternatives considered**: Applying FR-010 uniformly (breaks offline punching — rejected).
Caching the last known permission set in local storage to answer offline (rejected: a cached
permission set is a stale permission set, and it would survive a role revocation; it also
contradicts the Technical Context's no-client-persistence decision).

**FR-010a as added to the spec**: *"On the My Workspace shell, a failure to load the signed-in
user's details MUST NOT refuse access, because that shell is offline-capable by design and a failed
load is indistinguishable from absent network signal. Refusal there applies only when the details
load successfully and the governing permission is absent."*

## §5 The FR-008 landing redirect

**Decision**: Redirect to the first module in `NAV_MODULES` order that the user holds. If they hold
none, render the FR-009 empty state rather than redirecting anywhere.

**Rationale**: `NAV_MODULES` order is the sidebar's own order, so the landing target is the first
thing the user sees in their own menu — predictable, and it needs no second ordering to maintain.
Redirecting a zero-permission user is the trap to avoid: every candidate destination is refused, so
any redirect is a loop. The empty state terminates it.

**Alternatives considered**: A fixed fallback route such as `/my/punch` (wrong for an office user
who is not an employee, and `MY_WORKSPACE` is itself a permission that can be absent). A
"preferred landing" field per role (new configuration, and the user explicitly ruled out new
role-side configuration for this feature).

## §6 Reflowing the phone grid

**Decision**: Replace the fixed `grid-cols-5` with a wrapping grid whose column count is a Tailwind
class, sized so that any count from 0 to 9 modules (plus the always-present Sign Out) fills tidy
rows without the page scrolling sideways. Desktop keeps the existing stacked `md:flex-col` column
untouched.

**Rationale**: The current comment on `sidenav.tsx` explains `grid-cols-5` as fitting "ten 44px
targets in two tidy rows inside a 320px viewport". That reasoning was sound for a fixed ten and
becomes wrong the moment the count varies: three modules plus Sign Out would leave a ragged
single row of four in a five-column grid, and the assumption is invisible to anyone reading it
later. A wrapping grid keeps the 44px minimum target (Principle VI) at every count.

**Alternatives considered**: Computing the column count in JavaScript and emitting an inline
`style` (violates Principle II outright). Leaving `grid-cols-5` (fails FR-012 at most counts).
Switching the phone layout to a horizontal scroller (rejected: Principle VI forbids the page body
scrolling sideways on a mobile-critical surface, and a scroller hides items rather than showing
them).
