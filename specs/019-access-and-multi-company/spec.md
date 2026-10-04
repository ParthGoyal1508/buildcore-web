# Feature Specification: Access Granularity and Multi-Company (Web)

**Feature Branch**: `019-access-and-multi-company`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Client requirements spreadsheet, Notes 17, 22 and 24. Backend counterpart:
`buildcore-api/specs/019-access-and-multi-company-backend`.

**Scope**: The company switcher, permission-aware navigation, and the cash visibility control.
Enforcement is the backend's; this specification covers what people see.

**Relationship to feature 014**: `014-role-based-navigation` already filters the sidebar by
permission and guards routes against direct access. This feature extends that mechanism to a finer
permission model and adds a company dimension to it. It does not replace it, and the existing
`NAV_MODULES` structure and module guard remain the mechanism.

## Clarifications

### Session 2026-10-01

Raised while planning this feature's web half, against the backend's **shipped** cash-visibility
code rather than against its specification. Both markers this spec carried under "Needing the
client's decision" were already answered in `buildcore-api`, and neither needed the client.

### Session 2026-10-02

- Q: The answer below — "entry is untouched" — was reached by reading shipped code, not by asking. Does the client agree? → A: **No. They want entry blocked.** Put to them on 2026-10-02 and answered the other way, so the reasoning below is superseded on its conclusion while remaining correct on its facts: the interceptor really does only shape responses, and that really is all that is built.
- Q: Does the company-wide setting therefore block entry? → A: **No — two controls.** The setting stays display-only and company-wide; entry is gated by a new `CASH_ENTRY` permission. One control cannot do both, because a company-wide entry block stops every cashier in the company from paying labour while it is on, which makes it a switch nobody can leave on.
- Q: And the screen list the marker below dismisses? → A: **Dismissal upheld, by the client this time.** The per-row rule stays and the product acquires no screen list. They accepted the one divergence from their own screen answer: a salary genuinely paid in cash stays hidden.
- Q: The denomination breakup? → A: **Visible to `CASH_ENTRY` holders, hidden from everyone else.** The one change hiding itself needs.

### Session 2026-10-01 *(superseded in part — see above)*

- Q: With cash hiding on, may cash still be entered? → A: **Yes, entry is untouched.**
  `CashVisibilityInterceptor` "shapes the response; never touches a query or a row" — hiding is a
  display control, as FR-017 of the backend spec requires. So this never becomes the permission
  feature the marker feared: no entry control disappears, and a cash payment recorded while hiding
  is on is stored normally and simply comes back hidden. FR-012 therefore governs **who may change
  the setting**, not who may enter cash.

- Q: Which screens count as "cash"? → A: **No screen does — it is decided per row.**
  The question assumed a screen list, and the backend does not hold one. A figure is hidden when
  its row's `paymentMode` is a cash mode, plus a named list of unconditionally-cash fields; the
  response then carries `amount: null` with `amountHidden: true` beside it, **never zero**, so a
  reader or a spreadsheet summing a column can tell a hidden amount from a real one. The list is
  kept honest by `cash-surfaces.spec.ts`, which parses `schema.prisma` and fails when an enum grows
  a `cash` value the constant does not name — the staleness this marker worried about is a failing
  test rather than a silent leak. Consequently the web holds no screen list either, which is why it
  cannot drift from the backend's.
  **What survives the question**: the marker's real worry — "hiding its amounts may leave a screen
  nobody can use" — is genuine, and is FR-014's job. It is a rendering requirement, not a client
  decision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Working in either company, and never in doubt which (Priority: P1)

A user with access to both companies picks one from a control at the top of the screen. Everything
they see and create afterwards belongs to it. The current company is on screen at all times, because
entering a purchase against the wrong company is expensive and silent.

**Why this priority**: Note 24. The client runs two companies and cannot currently reach the second
one at all — the data layer supports it, the interface offers no way in.

**Independent Test**: Switch companies and confirm every list, creation and report follows, and that
the choice survives a reload.

**Acceptance Scenarios**:

1. **Given** a user with two companies, **When** they sign in, **Then** the current company is shown
   and changeable from a control present on every screen.
2. **Given** a company is selected, **When** any list is opened, **Then** only that company's records
   appear.
3. **Given** a company is selected, **When** a record is created, **Then** it belongs to that company
   without the user restating it.
4. **Given** a user with one company, **When** they sign in, **Then** their company is shown and no
   switcher is offered.
5. **Given** a switch, **When** it completes, **Then** no data from the previous company remains on
   screen or in any cached view.
6. **Given** a company is selected, **When** the browser is closed and reopened, **Then** the same
   company is selected.
7. **Given** a switch occurs while a form has unsaved changes, **When** it is attempted, **Then** the
   user is warned before the change is lost.

---

### User Story 2 - A role that can do one thing sees one thing (Priority: P1)

A site operator with permission to record logbook entries and diesel sees exactly that and nothing
else of Plant and Machinery. Controls for actions they cannot take are absent rather than present
and refusing.

**Why this priority**: Note 22 is the client's own example, and it is currently inexpressible. It is
also the case that matters most in practice — these accounts are handed to site staff.

**Acceptance Scenarios**:

1. **Given** a role with write access to logbook only, **When** the holder opens the application,
   **Then** navigation offers logbook entry and not the rest of machinery.
2. **Given** that role, **When** the holder addresses a machinery route directly, **Then** they are
   refused and told why, consistent with the existing module guard.
3. **Given** a role with read but not write, **When** a list is opened, **Then** records are visible
   and create, edit and delete controls are absent.
4. **Given** a role gaining or losing a permission, **When** the holder next loads the application,
   **Then** navigation reflects it without a cache clear.
5. **Given** a role with no visible modules at all, **When** the holder signs in, **Then** they are
   told plainly rather than shown an empty shell.

---

### User Story 3 - Turning cash off (Priority: P2)

An authorised user turns on cash hiding. Screens that would show cash amounts show everything else
without them; reports and exports match. Turning it off restores the view.

**Acceptance Scenarios**:

1. **Given** cash hiding is on, **When** a screen with cash amounts is opened, **Then** those amounts
   are not shown and the rest of the screen is unaffected.
2. **Given** cash hiding is on, **When** an export is produced, **Then** it matches the screen.
3. **Given** cash hiding is on, **When** a user views a screen whose meaning depends on the hidden
   figures, **Then** the screen says why it is incomplete rather than appearing broken.
4. **Given** a user without authority, **When** they attempt to change the setting, **Then** the
   control is absent.
5. **Given** the setting is changed, **When** any open screen is showing cash, **Then** it reflects
   the change without a manual reload.

### Edge Cases

- A user's access to the selected company is revoked while they are working in it.
- A direct link to a record in the other company.
- A role edited to remove write access while a holder has a form open.
- Cash hiding turned on while a labour payment sheet — inherently cash — is open.
- The switcher on a narrow screen where the company name is long.
- A user with many companies rather than two.
- Navigation cached by the service worker from before a permission change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A company switcher MUST be present on every screen for users with access to more than
  one company, and MUST NOT appear for users with one.
- **FR-002**: The currently selected company MUST be visible at all times.
- **FR-003**: Selecting a company MUST scope every subsequent list, report and creation to it.
- **FR-004**: The selection MUST persist across reloads and browser restarts.
- **FR-005**: Switching MUST clear views and cached data belonging to the previous company.
- **FR-006**: Switching with unsaved changes present MUST warn before discarding them.
- **FR-007**: Navigation MUST reflect the finer read/write permission model, hiding rather than
  disabling what the role cannot do.
- **FR-008**: Route guarding MUST extend to the finer model, refusing direct access consistently with
  feature 014's existing guard.
- **FR-009**: Create, edit and delete controls MUST be absent for roles holding read access only.
- **FR-010**: A permission change MUST be reflected on the holder's next load without requiring a
  cache clear.
- **FR-011**: A user with no visible modules MUST be told so plainly.
- **FR-012**: A cash visibility control MUST be available to authorised users and absent for others.
- **FR-013**: Cash hiding MUST apply consistently to screens, reports and exports.
- **FR-014**: A screen whose meaning depends on hidden figures MUST say it is incomplete rather than
  appear broken or empty.
- **FR-015**: Changing the setting MUST update open screens without a manual reload.
- **FR-016**: `NAV_MODULES` and the module-guard mechanism from feature 014 MUST be extended rather
  than duplicated (Principle III).
- **FR-017**: All access MUST go through the typed API modules (Principle V); no inline styling
  (Principle II).

#### Amendment of 2026-10-03 — a read-only role must be creatable from the portal

Found while reviewing what shipped, not by a failing test: every requirement above is about
*honouring* the read/write distinction, and none of them is about *setting* it. The role screen
offers one checkbox per area, so every role it creates holds both levels — and the backend's rule
that a role naming no levels gets read **and** write, correct as a migration default, makes that
silent.

The consequence is that FR-007 to FR-009 are enforced against a distinction nobody can configure.
Note 22's own example — site staff who may enter logbook readings and see nothing else of
machinery — can be produced only by calling the API directly.

- **FR-018**: The role editor MUST let each granted area be set to read-only or to read and write.
- **FR-019**: A role's current levels MUST be shown when it is opened, not re-derived or assumed.
  A screen that cannot show an existing read-only grant will silently widen it to write the next
  time anybody saves that role.
- **FR-020**: Write MUST NOT be settable on an area that is not also readable. "May edit but may not
  see" is not a state any screen in this product can render, and the backend already refuses it.
- **FR-021**: The editor MUST say what the two levels mean in terms of what a holder can do, not in
  terms of the permission model. An administrator choosing between them is deciding whether somebody
  can change records, and "read" and "write" are the system's words for that, not theirs.

### Non-Functional Requirements

- **NFR-001** *(Note 25)*: The company switcher MUST be reachable and operable at 320px without
  obscuring page content. The switcher is part of the application shell, which is already present on
  mobile-critical surfaces, so it was within Principle VI's scope before v2.1.0 and remains so.
  **Not verified today.**
- **NFR-002**: Switching company MUST complete within 2 seconds including the clearing of cached
  views.

### Key Entities

- **Company Selection (view)**: Which company the user is working in, the companies available to
  them, and its persistence.
- **Visible Module**: A navigation entry the current role may reach, and at what level (read or
  write).
- **Cash Visibility State**: Whether cash figures are currently displayed, and whether the current
  user may change it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with cross-company access can work in either company, and 100% of records they
  create belong to the selected one.
- **SC-002**: Company selection survives browser restart, verified in Chrome and Safari.
- **SC-003**: The client's Note 22 example role sees logbook entry and no other part of machinery, in
  navigation and by direct access.
- **SC-004**: No create, edit or delete control is visible to a read-only role, across every module.
- **SC-005**: With cash hiding on, no cash figure appears on any screen or export, verified module by
  module.
- **SC-006**: No data from a previous company remains visible after a switch, verified by inspecting
  cached views.

## Assumptions

- The selected company is sent with every request and the backend enforces it; the switcher is a
  convenience over an enforced boundary, never the boundary itself.
- Company selection persists in a way that survives browser restart. It identifies a company, not a
  user, and carries no authority — the backend refuses a company the user may not access.
- Clearing cached views on switch uses the existing query cache mechanism rather than a full page
  reload, except where a reload is the only way to guarantee no stale data remains.
- Feature 014's `NAV_MODULES` gains a level dimension rather than being replaced.
- No test framework is installed (constitution `TODO(TESTING_STANDARD)`); verification is lint,
  type-check, build and manual passes. **No test-file tasks may be generated.**

### Needing the client's decision

None outstanding. Both markers previously recorded here were answered by the backend's shipped
behaviour and are resolved in the Clarifications session of 2026-10-01 above.
