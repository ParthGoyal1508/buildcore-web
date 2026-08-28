# Research: Account Creation Frontend (Invite Flow)

## 1. Two routes, two very different layout contexts

**Decision**: `/dashboard/account-creation/new` (admin-facing, inside the standard dashboard shell,
protected by `middleware.ts`) and `/set-password/[token]/page.tsx` → `/set-password/:token`
(invitee-facing, top-level, outside `/dashboard/*`, outside the auth guard) — mirroring how `/login`
(001) is already a public top-level route.

**Rationale**: These two pages serve completely different audiences at completely different points
in the account lifecycle — an authenticated admin vs. an invitee with no session at all. Nesting
the set-password page under `/dashboard/*` would require carving out a middleware exception for one
specific sub-route, more fragile than keeping it top-level like `/login` already is.

**Alternatives considered**: A single `/dashboard/account-creation/*` route group with the
set-password page exempted from the guard via a middleware allowlist entry — rejected: `/login`
already establishes the top-level-public-route pattern for exactly this kind of no-session page;
reusing it is simpler than inventing a per-route exemption inside `middleware.ts`.

## 2. Closing `002-settings`'s "Add User" placeholder link

**Decision**: `002-settings`'s Users screen `<Link href="/dashboard/account-creation/new">Add
User</Link>` (FR-011 there) is updated from a vague "the separate Account Creation route" reference
to this concrete path, in that feature's own spec/contracts/tasks — a small amendment to 002, the
same cross-feature-amendment pattern used elsewhere in this session (e.g., `buildcore-api`'s
005 amendments for 008/010).

**Rationale**: 002 (web) explicitly deep-links to this feature by design (its own clarification
session decided this) — the link existing with no real destination was the frontend mirror of the
exact gap `buildcore-api`'s 001/002 also had. Now that a destination exists, 002's placeholder
reference should point at it concretely rather than staying vague.

**Alternatives considered**: Leaving 002's link text/href vague and letting this feature not touch
002 at all — rejected: a dead or wrong link is worse than a documented one-line contract update,
and 002's own contract already names the exact function signature this feature must not duplicate
(`listUsers`/`updateUser`/`deleteUser` stay in 002 — see spec FR-008).

## 3. No account list/detail screen in this feature

**Decision**: This feature has exactly two pages (create form, set-password). No account list, no
detail view, no edit UI — all of that already exists in `002-settings`'s Users screen.

**Rationale**: Mirrors the backend feature's own reconciliation (`010-account-creation-backend`
research.md §8) — a duplicate list/edit UI here would drift from 002's the moment either one
changes, and 002's Users screen already fully covers list/edit/delete/deactivate/reactivate against
the (now real) backend data.

**Alternatives considered**: A combined "Account Management" screen owned by this feature,
replacing 002's Users screen — rejected: 002 already shipped that screen; migrating its ownership
would be unnecessary churn with no functional benefit, and 002's own spec already frames its Users
screen as the account-administration surface with creation as the one deliberately-excluded piece.

## 4. Password complexity: client-side mirror of the backend rule

**Decision**: The set-password form's live complexity feedback (FR-006) re-implements the same
regex the backend enforces (min 8 chars, 1 uppercase, 1 number) directly in a `zod` schema shared
by the form's `react-hook-form` resolver — not fetched from the backend at runtime.

**Rationale**: A live, client-side check is standard UX for password fields and doesn't need to be
dynamically configurable; hardcoding the same fixed rule the backend spec names is simpler than an
API round-trip to fetch "the current password policy" for a rule that isn't expected to change
per-company or per-tenant.

**Alternatives considered**: Skipping client-side validation and relying solely on the backend's
`400` response — rejected: FR-006 explicitly wants live feedback to avoid a submit-then-fail round
trip; the backend remains authoritative regardless (a client bypass still gets rejected server-side).

## 5. Toast + redirect on create-user success, not a detail page

**Decision**: On successful `POST /account-creation/users`, the form shows a toast
(`emailDispatchFailed`-aware) and redirects to `/dashboard/settings/users`, invalidating that
screen's `['settings', 'users']` react-query key so the new `pending` row appears immediately.

**Rationale**: Since this feature has no detail/list screen of its own (research.md §3), the
natural "where do I land after creating something" answer is the screen that already shows the
result — 002's Users list. Direct react-query cache invalidation across the module boundary is
just a query-key convention, not a service call, so it doesn't violate this app's own module
boundaries.

**Alternatives considered**: Redirecting to a dedicated "invite sent" confirmation page — rejected:
adds a screen with no lasting value once the toast has been read; the Users list already shows the
`pending` state and offers "resend" from there if needed.
