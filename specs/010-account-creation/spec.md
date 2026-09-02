# Feature Specification: Account Creation Frontend (Invite Flow)

**Feature Branch**: `010-account-creation`

**Created**: 2026-08-28

**Status**: Draft

**Input**: Added during a master-PRD alignment audit sweep across `buildcore-web`. Both
`001-user-login` and `002-settings` explicitly deferred account creation to "the separate Account
Creation flow" — `001`'s spec lists it as out of scope, and `002`'s Users screen already has an
"Add User" entry point (FR-011) that deep-links to it, but the route it links to was never
specced or built. This feature implements master PRD §7.1's Invite Flow UI: an admin fills a
short create-user form (the target of 002's "Add User" link), and a separate, unauthenticated
"Set your password" page (reached from the emailed invite link) lets the invitee activate their
account. Consumes the backend contract in
`buildcore-api/specs/010-account-creation-backend/contracts/account-creation-api.md`.

## Clarifications

### Session 2026-08-28 (self-resolved during the alignment audit — see research.md for rationale)

- Q: What route does 002's "Add User" link point to? → A: `/dashboard/account-creation/new` — a
  standard authenticated `/dashboard/*` route (matching every other admin form in this app), owned
  by this feature. `002-settings-backend`'s (web) contract is updated to name this route
  concretely rather than "the separate Account Creation route."
- Q: Where does the "Set your password" page live, given the invitee has no session? → A: A
  top-level public route, `/set-password/[token]/page.tsx` → `/set-password/:token`, outside
  `/dashboard/*` and outside `middleware.ts`'s auth guard — mirroring how `/login` (001) is
  already a public top-level route, not nested under the dashboard shell.
- Q: Does this feature build its own account list/edit screen? → A: No.
  `002-settings`'s Users screen (`/dashboard/settings/users`) already lists, edits (role/status),
  and deletes existing accounts, consuming `buildcore-api`'s `002-settings-backend` contract
  (itself now backed by `010-account-creation-backend`'s exported `UsersService` — see that
  feature's research.md §8). This feature only builds the create form and the set-password page.
- Q: After a successful invite creation, where does the admin land? → A: Back on
  `002-settings`'s Users list (`/dashboard/settings/users`), with the new `pending` row visible
  immediately (react-query invalidation of that screen's user-list query) — not a dedicated detail
  page of this feature's own, since this feature has no list/detail screen to return to.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates a user (Priority: P1)

An admin clicks "Add User" from the Settings Users screen, fills a short form (email, role,
company, and either a linked employee or a display name), and submits it — the invite email goes
out and the admin is returned to the Users list showing the new `pending` row.

**Why this priority**: This is the entire unblocking value of the feature on the frontend side —
`002-settings`'s "Add User" link has pointed nowhere real since that feature shipped.

**Independent Test**: Can be fully tested by navigating directly to
`/dashboard/account-creation/new`, filling the form with a seeded role/company and an unlinked
employee, submitting, and confirming redirect to the Users list with the new row visible.

**Acceptance Scenarios**:

1. **Given** `/dashboard/account-creation/new`, **When** loaded, **Then** it shows Email, Role
   (searchable dropdown from `settings.Role`), Company (dropdown, hidden/disabled when the
   selected role is Super Admin), and an Employee-or-Name section: a searchable "Link an existing
   employee" dropdown (from the unlinked-employees endpoint) OR a "Display Name" text field, mutually
   exclusive via a toggle.
2. **Given** the form filled out validly, **When** submitted, **Then** the backend's `POST
   /account-creation/users` is called, and on success the admin is redirected to
   `/dashboard/settings/users` with a toast confirming the invite was sent (or a distinct toast if
   `emailDispatchFailed: true` came back, prompting a manual resend from the Users screen).
3. **Given** a `409` response (email already active, email deactivated-but-exists, or employee
   already linked), **When** returned, **Then** the exact backend message is shown as a form-level
   error — no generic "something went wrong."
4. **Given** the Super Admin role is selected, **When** selected, **Then** the Company field is
   hidden/disabled and excluded from the submitted payload entirely (not sent as `null`).
5. **Given** a non-Super-Admin/HO-User role attempting to reach `/dashboard/account-creation/new`
   directly, **When** the route is requested, **Then** `middleware.ts` redirects to the standard
   access-denied state — matching `002-settings`'s own Users-screen guard (`USER_MANAGEMENT` +
   Super Admin/HO User only).

---

### User Story 2 - Invitee sets their password (Priority: P1)

The invitee clicks the link in their invite email, lands on a public page that validates the
token, sets a password meeting the complexity rule, and is redirected to `/login` with a success
message.

**Why this priority**: Without this half of the flow, User Story 1 only ever produces accounts
nobody can activate — the two stories together are the minimum shippable unit, mirroring the
backend feature's own US1+US2 pairing.

**Independent Test**: Can be fully tested by navigating directly to `/set-password/:token` with a
valid token (from a test-seeded invite), setting a password, and confirming redirect to `/login`
with the new credentials working.

**Acceptance Scenarios**:

1. **Given** `/set-password/:token`, **When** loaded, **Then** it calls `GET
   /account-creation/invites/:token` and shows a password-set form (with the invitee's email
   displayed, read-only) if valid, or an "This invite link is no longer valid" state (distinguishing
   expired vs. already-used, per the backend's `reason` field) with no form if not.
2. **Given** the password-set form, **When** a password is entered, **Then** live client-side
   complexity feedback shows against the same rule the backend enforces (min 8 chars, 1 uppercase,
   1 number) before submission is even attempted.
3. **Given** a valid password submitted, **When** `POST
   /account-creation/invites/:token/set-password` succeeds, **Then** the page shows a brief
   success state and redirects to `/login` with a query param the login page reads to show
   "Account activated — log in with your new password."
4. **Given** a `410 Gone` response mid-submission (token expired/consumed between page load and
   submit — a race), **When** returned, **Then** the same "no longer valid" state from AC1 is shown
   instead of a generic error.
5. **Given** this page, **When** viewed by someone already logged in (an existing session cookie
   present), **Then** it still renders normally — this route is deliberately outside
   `middleware.ts`'s auth guard and does not redirect an authenticated user away.

---

### Edge Cases

- What happens if the create-user form's employee dropdown has no unlinked employees for the
  selected company? → Shows "No unlinked employees found" and the Display Name field remains
  available as the alternative — never a blocking empty state.
- What if the invitee's browser has no JavaScript/is an old email-client in-app browser? → Out of
  scope; this app has no documented no-JS fallback anywhere else either (consistent baseline).
- What if the admin submits the create form, gets `emailDispatchFailed: true`, and never sees the
  resend option? → The Users list (`002-settings`) shows a "resend" action on any `pending` row
  regardless of why it's pending — this feature does not need its own separate
  emailDispatchFailed-specific UI path beyond the initial toast.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The create-user form at `/dashboard/account-creation/new` MUST be reachable from
  `002-settings`'s "Add User" link and MUST redirect to `/dashboard/settings/users` on success.
- **FR-002**: The Company field MUST be hidden and excluded from the submit payload when the
  selected Role resolves to Super Admin, and MUST be a required, validated field otherwise.
- **FR-003**: The Employee-or-DisplayName choice MUST be mutually exclusive in the UI (a toggle or
  radio, not two simultaneously-visible required fields) and MUST validate that exactly one is
  provided before enabling submit.
- **FR-004**: `/set-password/:token` MUST be a route outside `/dashboard/*` and outside
  `middleware.ts`'s authentication guard — the invitee has no session.
- **FR-005**: The set-password page MUST distinguish an expired token from an already-consumed one
  in its invalid-state messaging, using the backend's `reason` field verbatim (not collapsed to one
  generic message).
- **FR-006**: Password complexity feedback on the set-password form MUST be live (client-side, as
  the user types) using the same rule the backend enforces, to avoid a submit-then-fail round trip
  for an obviously-invalid password.
- **FR-007**: `002-settings`'s "Add User" link (FR-011 there) MUST point to this feature's concrete
  route, `/dashboard/account-creation/new` — closing that feature's own placeholder reference.
- **FR-008**: This feature MUST NOT build a duplicate account list, role/status edit, or delete UI
  — `002-settings`'s Users screen already owns that surface.
- **FR-009**: Every form/control in this feature MUST be keyboard-operable with semantic HTML, per
  this app's established accessibility baseline (matching `002-settings`'s own FR on this).

### Key Entities

- **Create User form state**: email, roleId, companyId (conditional), employeeId (mutually
  exclusive with displayName), displayName.
- **Set Password page state**: token (from URL), validation result (valid/expired/consumed),
  password (with live complexity check).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `002-settings`'s "Add User" link resolves to a real, functional form — no more
  dead/placeholder link, closing the gap both `001` and `002` (web) explicitly deferred.
- **SC-002**: An admin can create a user and the invitee can activate it using only this feature's
  two pages plus `001`'s existing `/login` — zero manual intervention.
- **SC-003**: The set-password page never shows a generic error for an expired or consumed token —
  always the specific, actionable state.

## Assumptions

- `002-settings`'s Users screen (list/edit/delete) is the only place an admin manages accounts
  after creation — this feature has no navigation entry of its own beyond the "Add User" link
  002 already provides.
- The backend's `GET /account-creation/employees/unlinked` endpoint powers the employee picker;
  this feature adds no client-side filtering logic of its own beyond passing through the search
  query param.
- Password complexity validation logic (regex) is duplicated client-side for live feedback (FR-006)
  but the backend remains the authoritative enforcement point — a client-side pass never skips the
  server-side check.

## Amendment 2026-09-02 — Desktop-First Responsiveness (constitution v2.0.0)

Constitution Principle VI was redefined from blanket mobile-first to **desktop-first with a closed
list of mobile-critical surfaces** (punch in/out, attendance including supervisor muster, leave,
and sign-in). Account creation is a **desktop surface** — it is an administrative onboarding flow, distinct from sign-in, which is mobile-critical.

**What changes for this feature:**

- Screens are designed at **desktop width first**. Base Tailwind classes target the desktop layout;
  smaller-viewport variants exist to keep the screen unbroken, not to produce a phone-optimised one.
- Every screen MUST still remain **usable and unbroken down to 768px** (tablet): nothing clipped, no
  control unreachable, and the page body MUST NOT scroll horizontally. Wide content — tables,
  boards, wide forms — scrolls inside its own `overflow-x: auto` container.
- The `ResponsiveList` card-layout fallback is now **OPTIONAL**, not mandatory. Use it where the data
  genuinely reads better as cards; for a dense back-office grid, a horizontally-scrolling table in
  its own container is an acceptable and often better answer. Any earlier requirement in this spec
  that mandates `ResponsiveList` on *every* list is relaxed to this standard.
- **Keyboard operability is unchanged and still applies everywhere** — every interactive control on
  every screen MUST be reachable and operable by keyboard. Nothing in this amendment relaxes that.
- 44×44px touch targets and the "no hover-gated action" rule are no longer mandatory on this
  feature's screens, but remain good practice; hover MUST still not be the *only* way to discover a
  control's existence.

**Review gate:** these screens are verified at desktop, then re-checked at 768px for breakage only.
