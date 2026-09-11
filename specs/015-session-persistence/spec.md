# Feature Specification: Session Persistence

**Feature Branch**: `015-session-persistence`
**Created**: 2026-09-11
**Status**: Draft
**Input**: Signed-in users are logged out on page refresh and part-way through a working session,
including users who ticked "Remember me". Root-caused from production data before this spec was
written; see Context below.

## Context

This is a defect specification, not a new capability. The evidence, taken from the production
refresh-token records, is the reason the requirements below are shaped as they are:

| Observation | Count |
|---|---|
| Sign-ins recorded | 89 |
| Sign-ins whose session was **never once renewed** | **74 (83%)** |
| Longest-lived single session (renewals) | 29 |
| Sessions terminated by replay protection | 5 |
| Sign-ins that asked to be remembered | 23 |

A session that is never renewed is one where the browser never returned the credential that
renews it. For 83% of sign-ins, renewal was impossible from the first minute — so those people
were signed out the moment their short-lived working credential lapsed, and again on every page
reload. That one session reached 29 renewals shows the mechanism is sound where the browser
cooperates; the split between the two populations is why the fault presents as intermittent and
is often dismissed as "it only happens sometimes".

Three distinct faults produce the reported symptom. They are independent: fixing any one alone
leaves the symptom present for some users.

1. **The renewal credential is stored by the browser as third-party data.** The application and
   its backend are served from unrelated domains, and the browser is asked to keep the renewal
   credential against the backend's domain while the user is on the application's. Several
   browsers refuse to keep such data at all, and others are withdrawing support. Sign-in still
   *appears* to succeed, because the short-lived working credential is held in memory; the
   failure only becomes visible when that lapses. This accounts for the 83%.
2. **Simultaneous renewal attempts are treated as credential theft.** When several parts of a
   screen discover at the same moment that the working credential has lapsed, each asks for a
   renewal independently. Replay protection interprets the later arrivals as a stolen credential
   being re-presented and ends the entire session. This accounts for people whose browsers *do*
   cooperate being signed out part-way through work, and has already ended 5 sessions.
3. **Staying signed in is opt-in and the default is not to.** The choice is presented as an
   unexplained checkbox; 74 of 89 sign-ins left it unticked and were given a session that ends
   when the browser closes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staying signed in across a reload and a restart (Priority: P1)

A site administrator signs in, works for a while, reloads the page, closes the browser at the end
of the day, and opens the application again the next morning. They are still signed in throughout
and are never asked for their password again.

**Why this priority**: This is the reported defect and the whole purpose of the feature. Every
other story is subordinate to it. Without this, the product asks people to re-authenticate several
times a day, which is the single loudest complaint against it.

**Independent Test**: Sign in, reload the page, confirm the session survives. Close the browser
entirely, reopen it, navigate to the application, and confirm the session is still live. Repeat in
a browser that refuses third-party storage — the result must be identical.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they reload the page, **Then** they remain signed in and
   are returned to the same screen, with no visit to the sign-in page.
2. **Given** a signed-in user, **When** they close the browser completely and reopen the
   application the next day, **Then** they are still signed in.
3. **Given** a signed-in user in a browser that refuses third-party storage, **When** they do
   either of the above, **Then** the outcome is the same as in any other browser.
4. **Given** a user who has not opened the application for 89 days, **When** they return,
   **Then** they are still signed in.
5. **Given** a user who has not opened the application for more than 90 days, **When** they
   return, **Then** they are asked to sign in again, and told that their session expired rather
   than being shown a bare sign-in form.

---

### User Story 2 - Working without interruption mid-session (Priority: P1)

A user working through a screen that loads several panels at once is never interrupted. Renewal
happens silently and no combination of timing signs them out.

**Why this priority**: Equal-first with US1. It is the half of the defect that affects users whose
browsers *do* keep the credential, and it is worse than US1 in kind: it interrupts work already in
progress rather than work not yet started.

**Independent Test**: Open a screen that issues several requests at once at the moment the working
credential lapses, and confirm exactly one renewal occurs, every request completes, and the session
survives. Repeat against a deliberately slowed backend.

**Acceptance Scenarios**:

1. **Given** several requests that discover simultaneously that the working credential has lapsed,
   **When** they each need a renewal, **Then** exactly one renewal is performed and every request
   completes using its result.
2. **Given** a backend that is slow to respond, **When** simultaneous requests need a renewal,
   **Then** the session is **not** ended — slowness must never be read as credential theft.
3. **Given** a renewal that fails because the network is unavailable, **When** the failure is
   handled, **Then** the user is **not** signed out and the request reports a network problem.
4. **Given** a renewal refused because the session genuinely expired, **When** the refusal is
   handled, **Then** the user is signed out and returned to the sign-in page.

---

### User Story 3 - Signing in without an unexplained choice (Priority: P2)

A user signs in by entering their credentials. There is no checkbox asking whether they would like
to remain signed in, because the answer is always yes.

**Why this priority**: Lower than the two above because it is a simplification rather than a
defect in its own right — but it is what stops the defect returning for the next 74 people who
leave the box unticked.

**Independent Test**: Open the sign-in page and confirm no such checkbox exists; sign in and
confirm the resulting session behaves as US1 describes.

**Acceptance Scenarios**:

1. **Given** the sign-in page, **When** it is displayed, **Then** no "remember me" control is
   present.
2. **Given** any successful sign-in, **When** the session is established, **Then** it lasts as
   long as a session established under the old ticked-checkbox behaviour, or longer.
3. **Given** a user with an existing session created before this change, **When** they next use
   the application, **Then** their session continues uninterrupted and adopts the new duration.

---

### User Story 4 - Signing out still means signing out (Priority: P2)

A user on a shared machine signs out, and the session ends immediately and completely.

**Why this priority**: Making sessions long-lived raises the cost of failing to end one. This
story exists so the lengthening cannot quietly weaken the only control a user has over it.

**Independent Test**: Sign out, then attempt to reach an authenticated screen directly by URL and
confirm refusal. Confirm a browser reload does not restore the session.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they sign out, **Then** the session ends immediately and
   no reload, back-navigation or direct URL restores it.
2. **Given** a user who has signed out, **When** another person uses the same browser, **Then**
   none of the previous user's data is visible.

---

### Edge Cases

- A reload that happens *during* a renewal must not leave the session in a state where neither the
  old nor the new credential works.
- Two tabs open on the application at once, both discovering a lapsed credential, must not sign
  each other out.
- A session that has genuinely expired must present as "your session expired, please sign in", not
  as a generic failure, and not as a silent redirect that loses what the user was doing.
- Signing out in one tab should not leave another tab appearing signed in indefinitely.
- A user returning after an absence long enough for the backend to be redeployed or restarted must
  still be signed in — session survival cannot depend on backend process lifetime.
- The offline-capable field surfaces must continue to work: a queued punch submitted after a long
  offline period must still be attributable to the same session.
- Requests that carry a file back to the user — salary slips, document downloads, exports — must
  keep working, including for large files, and must not be held entirely in memory on the way.
- The sign-in, invitation and set-password screens are used by people who are *not* signed in;
  they must keep working under whatever routing change this feature introduces.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A signed-in user's session MUST survive a page reload without any re-authentication.
- **FR-002**: A signed-in user's session MUST survive the browser being closed and reopened.
- **FR-003**: Session survival MUST NOT depend on the browser's willingness to retain third-party
  data. The session credential MUST be stored by the browser as first-party data belonging to the
  site the user is visiting.
- **FR-004**: A session MUST remain valid for **90 days of inactivity**, and every use of the
  application MUST reset that period from that moment (a sliding window, not a fixed expiry from
  sign-in).
- **FR-005**: The application MUST NOT offer the user a choice about whether to stay signed in.
  Every session MUST receive the full duration described in FR-004.
- **FR-006**: Existing sessions created before this change MUST continue uninterrupted and MUST
  adopt the new duration at their next use. No user may be signed out by the deployment of this
  feature.
- **FR-007**: When several parts of the application discover simultaneously that the working
  credential has lapsed, the application MUST perform exactly **one** renewal, and every waiting
  request MUST proceed using its result.
- **FR-008**: A renewal that fails because the network is unavailable, or because the backend is
  unreachable or slow, MUST NOT sign the user out. Only a renewal explicitly refused by the
  backend may end the session.
- **FR-009**: Concurrent renewal attempts MUST NOT be treated as credential theft. Replay
  protection MUST continue to protect against genuine re-presentation of a stolen credential, but
  MUST tolerate the ordinary case of one client renewing more than once in quick succession,
  including when the backend is slow to respond.
- **FR-010**: Signing out MUST end the session immediately and completely; no reload,
  back-navigation or direct URL may restore it, and no data belonging to the previous user may
  remain visible to the next person using that browser.
- **FR-011**: A user whose session has genuinely expired MUST be told that it expired, rather than
  being shown an unexplained sign-in form or a generic error.
- **FR-012**: Every request the application makes to its backend MUST travel by a route that keeps
  the session credential first-party. No screen, download or unauthenticated flow may bypass it.
- **FR-013**: Requests that return a file MUST continue to work through that route, for files of
  any size the product already supports, without the file being accumulated in memory in its
  entirety before reaching the user.
- **FR-014**: Screens used by people who are not signed in — sign in, accept invitation, set
  password — MUST continue to function unchanged.
- **FR-015**: The routing change MUST NOT be cached by the application's offline support. A stale
  cached response to a session-bearing request must never be served.
- **FR-016**: Local development MUST continue to work with the application and backend running as
  separate local services, without requiring a deployed environment.
- **FR-017**: No new browser-readable storage of a session credential may be introduced. The
  credential that renews a session MUST remain unreadable to scripts running in the page.

### Key Entities

- **Session**: A user's continuous authenticated relationship with the application. Survives
  reloads, browser restarts and backend restarts. Ends only when the user signs out, when 90 days
  pass without use, or when the backend refuses to renew it.
- **Working credential**: The short-lived proof of identity attached to each request. Held only in
  memory, lost on reload, and replaced silently by renewal. Not a session.
- **Renewal credential**: The long-lived proof that a session is still the user's. Stored by the
  browser, never readable by page scripts, replaced on each use, and the thing whose third-party
  status is the root cause of this defect.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The proportion of sessions that are never renewed falls from 83% to **under 5%**,
  measured over sessions created after the change. This is the single number that proves the
  primary cause is fixed.
- **SC-002**: **Zero** sessions are ended by replay protection during ordinary use, measured over
  the same period. Any occurrence after this change indicates a genuine security event rather than
  a false positive.
- **SC-003**: A user who reloads the page remains signed in, in **every** browser the product
  supports, including those that refuse third-party storage.
- **SC-004**: A user who closes the browser and returns the next day remains signed in.
- **SC-005**: A screen issuing several simultaneous requests at the moment of credential lapse
  causes exactly one renewal, and no request fails.
- **SC-006**: With the backend artificially delayed to ten seconds, simultaneous requests still do
  not end the session.
- **SC-007**: No user is signed out as a consequence of deploying this feature.
- **SC-008**: Signing out remains immediate and complete.

## Assumptions

- 90 days of inactivity is the agreed balance between never asking a working user to sign in again
  and not leaving an abandoned device signed in indefinitely. Decided with the product owner
  before this spec was written.
- Removing the choice about staying signed in is acceptable for every user of this product, which
  is operated by staff on their own work machines rather than on public terminals. Where a shared
  machine is genuinely in use, signing out (US4) is the control, not a checkbox at sign-in.
- The short lifetime of the working credential is not changed by this feature. It is not the cause
  of the defect; renewal failing is. Leaving it short keeps the window in which a leaked working
  credential is useful small.
- The backend's existing replay protection is correct in intent and only mis-calibrated for the
  concurrent case; this feature adjusts its tolerance rather than removing it.
- Verification is by inspection and manual exercise. No automated test framework is installed in
  this application, which is a standing constraint recorded in the constitution, so this spec does
  not assume automated coverage.
- The companion backend changes — session duration, replay tolerance, and the cookie attributes
  that follow from first-party delivery — are specified separately for `buildcore-api` and are a
  dependency of this feature, not part of it.

## Out of Scope

- Any change to how passwords are chosen, reset, or enforced.
- Any change to what a user may see or do once signed in; permissions and roles are untouched.
- Multi-factor authentication, device registration, session listing, or "sign out everywhere".
- Changing the short lifetime of the working credential.
- Moving the application and backend onto a shared parent domain, which was considered and
  rejected in favour of the routing approach.
