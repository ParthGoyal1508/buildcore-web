# Feature Specification: User Login

**Feature Branch**: `001-user-login`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "Build the Login flow for BuildCore ERP (buildcore-web), per section '1. Login (/login)' of the PRD at /Users/parthgoyal/Projects/ERP-Demo/docs/prd/09-auth.prd.md. Scope: ONLY the Login screen/flow — email+password form with show/hide toggle, Remember Me, inline validation, generic invalid-credentials error, redirect-to-dashboard with welcome message, session persistence via refresh token, logout, and brute-force lockout (5 failed attempts -> 15 min lock + email notice). Forgot Password, Account Creation, and Password Change are explicitly out of scope — separate features for later."

## Clarifications

### Session 2026-08-26

- Q: When someone tries to log in to an account that is currently locked out (after 5 failed attempts, within the 15-minute lock window), what should the login screen show them? → A: Distinct lockout message (states the account is temporarily locked and approximately when it unlocks), rather than the generic invalid-credentials message.
- Q: Should this Login feature include per-company configurable lockout settings (threshold/duration), or ship with the PRD's fixed default (5 attempts, 15-minute lock) and leave configurability for a later admin-settings feature? → A: Fixed default only — per-company configurability is out of scope for this feature.
- Q: What should the exact "Remember Me" session duration be, so success criteria and tests can target a concrete value? → A: 30 days.

### Session 2026-08-28

- Q: Should the login field accept only an email, or also a username? → A: Both — the field
  accepts either a registered email or a registered username (backend: `001-user-login-backend`'s
  2026-08-28 clarification). Username is admin-assigned at account creation, never self-chosen, so
  this feature only needs to accept it as an alternate identifier — no new account-management UI is
  added here.
- Q: Does this screen need any UI for an admin resetting another user's password? → A: No — that's
  backend-only scope on `001-user-login-backend` (a new admin-only API endpoint). This feature
  stays scoped to the login form itself; the admin-facing UI for it belongs to a future user-
  management screen, not this one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with valid credentials (Priority: P1)

A registered, active user visits the login page, enters their email-or-username and password, and
is signed in and taken to their dashboard.

**Why this priority**: This is the core purpose of the feature — without it, no user can access
the system at all. Nothing else in this feature has value without this working first.

**Independent Test**: Can be fully tested by entering a known-valid email/password combination for
an active account and confirming the user lands on the Dashboard with a "Welcome back, {name}!"
confirmation; repeat with that same account's username in place of its email to confirm both
identifiers work.

**Acceptance Scenarios**:

1. **Given** a user with an active account and a correct email-or-username/password, **When** they
   submit the login form, **Then** they are redirected to the Dashboard and shown "Welcome back,
   {name}!".
2. **Given** a user typing their password, **When** they toggle the show/hide password control,
   **Then** the password field's content becomes readable/hidden accordingly without clearing what
   they typed.
3. **Given** a user on the login page, **When** they select the "Forgot Password?" link, **Then**
   they are taken to the forgot-password entry point (that flow itself is a separate feature).

---

### User Story 2 - Rejected on invalid credentials (Priority: P1)

A user enters an email and/or password that doesn't match any active account, or leaves a
required field empty, and is told clearly (but without leaking whether the email is registered)
that the attempt failed.

**Why this priority**: Equally critical to successful login — a system that cannot safely reject
bad credentials is not a functioning authentication system, and is the PRD's primary security
concern (enumeration resistance) alongside brute-force protection.

**Independent Test**: Can be fully tested by submitting a wrong password for a real email, a
well-formed email that isn't registered, and an empty field, and confirming each produces the
correct error without ever indicating which of "email" or "password" was wrong.

**Acceptance Scenarios**:

1. **Given** the login form, **When** a user submits with the Email or Password field empty,
   **Then** an inline validation error is shown next to the empty field(s) and no login attempt is
   sent.
2. **Given** an email that is not registered in the system, **When** a user submits any password
   for it, **Then** the system shows the same "Invalid email or password" message it would show
   for a registered email with a wrong password — never revealing whether the email exists.
3. **Given** a registered, active account, **When** a user submits the correct email with the
   wrong password, **Then** the system shows "Invalid email or password" and does not sign the
   user in.

---

### User Story 3 - Stay signed in with "Remember Me" (Priority: P2)

A user who checks "Remember Me" at login stays signed in across browser restarts until they
explicitly log out, instead of having to sign in again every time they return.

**Why this priority**: Directly named in the PRD as a first-class login control; important for
daily usability (site staff/office staff returning to the app repeatedly) but the system is still
usable without it (P1 stories cover the essential path).

**Independent Test**: Can be fully tested by logging in with "Remember Me" checked, closing and
reopening the browser, and confirming the user is still signed in without re-entering credentials
— versus logging in with it unchecked and confirming the session does not survive a browser
restart.

**Acceptance Scenarios**:

1. **Given** a user logs in with "Remember Me" checked, **When** they refresh the page or restart
   their browser within 30 days of login, **Then** they remain signed in without re-entering
   credentials.
2. **Given** a user logs in with "Remember Me" unchecked, **When** they close and reopen their
   browser, **Then** they are required to sign in again.
3. **Given** a signed-in user (with or without "Remember Me"), **When** their account role or
   status changes (e.g., an admin deactivates the account) while they are still signed in,
   **Then** their next action in the app is rejected and they are required to sign in again.

---

### User Story 4 - Log out (Priority: P2)

A signed-in user explicitly ends their session and is returned to the login page.

**Why this priority**: A basic, expected control for any authenticated system, and the mechanism
that makes "Remember Me" and account deactivation meaningfully reversible — but it depends on P1
(you must be able to log in before logging out matters).

**Independent Test**: Can be fully tested by signing in, triggering logout, and confirming the
user lands back on the login page and can no longer access authenticated pages or perform actions
using their prior session.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they choose to log out, **Then** their session is ended,
   they are redirected to the login page, and any further attempt to use their prior session to
   access the app fails.

---

### User Story 5 - Brute-force lockout after repeated failures (Priority: P2)

An account that receives 5 consecutive failed login attempts is temporarily locked, the
account owner is notified by email, and further login attempts against that account are blocked
until the lock expires.

**Why this priority**: A named security requirement in the PRD (credential-stuffing/guessing
protection) and directly tied to the PRD's "zero successful logins with deactivated/locked
accounts" success metric — important, but the account can still function normally (P1/P2 above)
without an attacker ever triggering it.

**Independent Test**: Can be fully tested by submitting 5 consecutive wrong passwords for one
account and confirming: the 6th attempt (even with the correct password) is rejected with a
lockout-specific message, an email notification is sent, and after the lock window elapses the
correct password succeeds again.

**Acceptance Scenarios**:

1. **Given** an account with 4 prior consecutive failed login attempts, **When** a 5th consecutive
   attempt also fails, **Then** the account becomes locked for 15 minutes and the account owner is
   notified by email of the lockout.
2. **Given** an account that is currently locked, **When** any login attempt is made against it
   (including with the correct password), **Then** the system rejects the attempt and shows a
   lockout-specific message stating the account is temporarily locked and approximately when it
   will unlock, rather than the generic invalid-credentials message.
3. **Given** an account that was locked, **When** the 15-minute lock window elapses, **Then** a
   subsequent attempt with the correct password succeeds normally and the failed-attempt count
   resets.
4. **Given** an account with some consecutive failed attempts (fewer than 5), **When** the next
   attempt for that account succeeds, **Then** the failed-attempt count resets to zero without
   triggering a lock.
5. **Given** a high volume of failed login attempts arriving from a single source address across
   one or many accounts, **When** that volume exceeds the system's rate limit, **Then** further
   attempts from that source are throttled independently of any single account's lock state.

---

### Edge Cases

- What happens when a user submits the login form with leading/trailing whitespace in the email,
  or mixed letter case (e.g., `User@Example.com`)? The system must not treat this as a different
  account than the canonical registered email.
- How does the system respond if a user's account is deactivated (see the separate Account
  Creation/Management feature) at the moment they attempt to log in? Login must be rejected with
  the same generic "Invalid email or password" message — a deactivated account must not be
  distinguishable from a wrong password or an unregistered email.
- How does the system respond if a user's account is flagged as requiring a mandatory password
  change (`mustChangePassword`, set by the separate Account Creation feature) at login? Credential
  validation still succeeds, but the user must be routed to change their password before reaching
  the Dashboard (the password-change screen itself is a separate feature; this flow only needs to
  recognize the flag and redirect instead of completing the normal login).
- What happens if a user's short-lived access token expires mid-session while "Remember Me" is
  active and the refresh token is still valid? The session should be renewed transparently without
  interrupting the user's current action.
- What happens if a user's refresh token is no longer valid (expired, revoked by logout elsewhere,
  or revoked by an admin deactivating the account) when the app tries to renew it? The user is
  signed out and returned to the login page.
- What happens if a user double-submits the login form (e.g., double-clicks "Sign In")? Only one
  login attempt should be evaluated/counted toward the brute-force limit.
- What happens if a user is signed in on multiple devices/browsers simultaneously? Each is treated
  as an independent session; logging out on one device does not require signing out the others
  unless the underlying account is deactivated or all sessions are explicitly revoked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a login page with a single "Email or Username" identifier
  field and a Password field, a control to reveal/hide the entered password, a "Remember Me"
  checkbox, a "Sign In" action, and a link to the forgot-password flow.
- **FR-002**: The system MUST validate that the identifier and Password are both provided before
  attempting to sign in, showing an inline error next to any empty required field without
  submitting the attempt.
- **FR-003**: The system MUST treat the identifier (whether an email or a username) as
  case-insensitive and trim leading/trailing whitespace before evaluating a login attempt. Unlike
  before this clarification, the field MUST NOT be validated as email-shaped (no `type="email"` /
  email-format check) — a valid username won't pass that check.
- **FR-004**: The system MUST reject a login attempt whenever the identifier is not registered, the
  password does not match the registered account, or the account is deactivated, and in every one
  of these cases MUST show the identical generic message "Invalid email or password" — never
  revealing which of these reasons applied, and never revealing whether the identifier is
  registered at all.
- **FR-005**: The system MUST accept a login attempt only when the identifier (email or username)
  is registered, the password matches, and the account is active (not deactivated and not
  currently locked out).
- **FR-006**: On a successful login, the system MUST redirect the user to the Dashboard and show a
  confirmation message "Welcome back, {name}!" using the account holder's name.
- **FR-007**: On a successful login where the account is flagged as requiring a mandatory password
  change, the system MUST route the user to the password-change step instead of the Dashboard,
  without granting normal app access until that step is completed.
- **FR-008**: The system MUST keep a signed-in user's session valid across page refreshes and
  ongoing use, independent of whether "Remember Me" was checked.
- **FR-009**: The system MUST end a signed-in user's session when their browser is closed and
  later reopened, UNLESS "Remember Me" was checked at login, in which case the session MUST persist
  across browser restarts for up to 30 days from login, until it is explicitly logged out, revoked,
  or that 30-day window elapses.
- **FR-010**: The system MUST re-validate a signed-in user's role and account status on every
  subsequent authenticated action, and MUST reject the action (ending the session) if the account
  has since been deactivated or the role/status has changed in a way that no longer permits it.
- **FR-011**: The system MUST provide a logout action that ends the current session immediately
  (server-side, not just locally) and returns the user to the login page; any further use of that
  ended session MUST be rejected.
- **FR-012**: The system MUST count consecutive failed login attempts per account, and MUST lock
  the account for 15 minutes after the 5th consecutive failed attempt.
- **FR-013**: The system MUST reset an account's consecutive-failed-attempt count to zero
  immediately upon that account's next successful login.
- **FR-014**: While an account is locked, the system MUST reject every login attempt against it
  (including one with the correct password) and MUST show a lockout-specific message stating the
  account is temporarily locked and indicating when it will unlock, distinct from the generic
  invalid-credentials message.
- **FR-015**: When an account becomes locked, the system MUST send an email notification to the
  account's registered email address informing them of the lockout.
- **FR-016**: The system MUST also rate-limit login attempts by originating source (e.g., IP
  address), independent of any single account's lock state, to slow high-volume attempts spread
  across many accounts.
- **FR-017**: The system MUST record every login attempt (success or failure), every account
  lockout, and every logout in the Activity Log, capturing the acting account, timestamp, and
  originating IP address.
- **FR-018**: The system MUST NOT include a password (correct or attempted) in any log, error
  response, or the Activity Log record.
- **FR-019**: The system MUST serve the login page and process every login-related request only
  over an encrypted (TLS) connection.
- **FR-020**: When the login page is loaded with an `?activated=1` query parameter, the system
  MUST show a one-time "Account activated — log in with your new password" banner above the form.
  `010-account-creation`'s set-password page redirects here with this param on successful
  activation; this is a one-line addition, not a new flow — added when that feature was specced,
  closing this feature's own "Account Creation... separate feature" deferral for the one point
  where the two flows actually meet (the login page itself).

### Key Entities

- **User Account**: A registered person who can sign in — holds the credentials needed to
  authenticate, an active/deactivated status, a role, and a flag for whether a password change is
  mandatory before normal access. Owned/managed by `010-account-creation` (built via the Invite
  Flow); login only reads and enforces this state.
- **Session**: Represents one signed-in period for a user on one device/browser — has a validity
  window that is short by default and extended when "Remember Me" is selected, and can be ended
  early by logout, admin deactivation, or role/status change.
- **Login Attempt Record**: Tracks an individual account's consecutive login failures and, once
  that count reaches 5, the resulting 15-minute locked-out window (a temporary state that blocks
  all login attempts against that account regardless of credential correctness until it expires);
  resets on that account's next successful login. IP-based volume throttling (FR-016) is a
  separate, coarser mechanism that is not tied to any one account's record.
- **Activity Log Entry**: An audit record of a login-related event (success, failure, lockout,
  logout) with the acting account, timestamp, and IP address.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid, active credentials can complete sign-in and reach their Dashboard
  in under 5 seconds under normal conditions.
- **SC-002**: More than 99% of login attempts using valid credentials for active accounts succeed.
- **SC-003**: Zero login attempts succeed against a deactivated account or an account currently in
  its lockout window, across all testing.
- **SC-004**: In testing, no login or lockout response allows an observer to distinguish "email
  not registered" from "email registered, wrong password" from "account deactivated" — all three
  produce an identical message.
- **SC-005**: A user who selects "Remember Me" remains signed in after closing and reopening their
  browser at any point within 30 days of login, and a renewal attempt is rejected once that 30-day
  window has elapsed.
- **SC-006**: 100% of accounts that reach 5 consecutive failed login attempts are locked for 15
  minutes and their owner receives a lockout email notification.
- **SC-007**: Every login success, login failure, lockout, and logout event is retrievable from the
  Activity Log with the correct actor, timestamp, and IP address.

## Assumptions

- The Dashboard, forgot-password flow, account creation/deactivation, and password-change screens
  referenced here already exist or are being built as separate features; this feature only needs
  to redirect to or read state from them, not implement them.
- The default (non-"Remember Me") session is expected to last for a single browser sitting (ends
  on browser close) per the PRD's explicit wording; the underlying access-token lifetime (e.g.
  15–60 minutes, per the PRD's non-functional requirements) is refreshed transparently in the
  background while the browser remains open, and is a planning-level detail.
- Multiple concurrent sessions per user (e.g., signed in on phone and laptop at once) are
  permitted; nothing in the PRD restricts this, and logging out on one device only ends that one
  session unless all sessions are explicitly revoked (e.g., via account deactivation or a password
  change elsewhere, which are handled by other features).
- Per-company configurability of the exact lockout threshold/duration (mentioned generally in the
  PRD's non-functional requirements alongside password policy) is out of scope for this feature,
  per the clarification above; this spec fixes the values stated in the PRD's Login section itself
  (5 attempts, 15 minutes, 30-day "Remember Me" window) as the behavior to build against.
- IP-based rate limiting (FR-016) is a secondary, coarser defense against distributed attempts and
  does not need its own user-facing message distinct from the generic invalid-credentials message;
  only the per-account lockout (FR-014) gets a distinct, lockout-specific message, per the user's
  explicit choice during specification.

## Amendment 2026-09-02 — Desktop-First Responsiveness (constitution v2.0.0)

Constitution Principle VI was redefined from blanket mobile-first to **desktop-first with a closed
list of mobile-critical surfaces**. Sign-in is **on** that list. It is not field work in itself, but a site user cannot punch without passing through it, so a desktop-only login would make the rest of the mobile-critical list unreachable.

**What changes for this feature:** nothing is relaxed. The sign-in screen stays **mobile-first**, built base-up from a 320px viewport, with 44×44px touch targets and no hover-gated action, and is verified at 320px before merge. It must also render correctly at desktop, where most sign-ins actually happen.
