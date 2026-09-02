# Feature Specification: Role-Based Navigation

**Feature Branch**: `014-role-based-navigation`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "For the Navbar, we do not want to show the same navbar to all the users; instead the Navbar items should be role based. Admin can map the navbar items with role from the settings."

## Context

Every signed-in user currently sees the same nine-module sidebar — Dashboard, HR & Payroll,
Projects, Plant & Machinery, Inventory, Partners, Reports, My Workspace, Settings — regardless of
what their role actually permits. A site supervisor whose role grants only attendance and workspace
access is still shown Payroll, Inventory and Settings. Clicking any of them produces a page whose
every request is refused by the API, so the menu advertises capabilities the product will not
honour.

This feature makes the sidebar reflect the signed-in user's role, and gives administrators control
of that mapping through the role permissions they already edit in Settings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A user sees only the modules their role permits (Priority: P1)

A site supervisor signs in. Their role grants attendance and personal-workspace access and nothing
else. The sidebar shows them HR & Payroll and My Workspace, and nothing else — no Payroll, no
Inventory, no Settings. Every link they can see leads to a page that works.

**Why this priority**: This is the feature. Delivered alone it removes every dead link from the
product and makes the menu an honest description of what each user can do.

**Independent Test**: Sign in as accounts holding different role permission sets and compare the
rendered sidebar against each role's permissions. Fully testable with existing seeded roles, with
no other story implemented.

**Acceptance Scenarios**:

1. **Given** a user whose role holds only ATTENDANCE and MY_WORKSPACE, **When** they sign in,
   **Then** the sidebar shows exactly HR & Payroll and My Workspace, plus the always-present
   identity panel and Sign Out control.
2. **Given** a user whose role holds every assignable permission, **When** they sign in, **Then**
   the sidebar shows all nine modules, exactly as it does today.
3. **Given** a user whose role holds PAYROLL but neither EMPLOYEES nor ATTENDANCE, **When** they
   sign in, **Then** HR & Payroll is shown — a module governed by several permissions appears when
   the user holds at least one of them.
4. **Given** any signed-in user, **When** they move between pages, **Then** the same filtered
   sidebar is shown on every page of the application.

---

### User Story 2 - An administrator changes what a role can see (Priority: P2)

An administrator decides site supervisors should no longer reach Reports. They open Settings >
Roles, edit the Site Supervisor role, and clear the Reports permission. Every user holding that
role stops seeing Reports in their sidebar, and stops being able to open it.

**Why this priority**: This is the control surface the request asks for. It depends on Story 1
being in place to have any visible effect, but it is what makes the behaviour administrable rather
than hardcoded.

**Independent Test**: Edit a role's permissions in Settings, then load the application as a user
holding that role and confirm the sidebar changed accordingly. Testable end-to-end using only
existing screens.

**Acceptance Scenarios**:

1. **Given** an administrator on Settings > Roles, **When** they view a role's permission list,
   **Then** each permission that controls a sidebar module is labelled with the module it controls,
   and permissions that control no sidebar module are distinguishable from those that do.
2. **Given** a role that holds REPORTS, **When** an administrator clears that permission and saves,
   **Then** users holding that role no longer see Reports in their sidebar the next time the
   application loads for them, without any of them signing out and back in.
3. **Given** an administrator editing a role they themselves hold, **When** they save the change,
   **Then** their own sidebar reflects it without a manual page reload.
4. **Given** an administrator, **When** they look for a separate screen to map menu items to roles,
   **Then** none exists — role permissions are the only place this is configured.

---

### User Story 3 - A hidden module is genuinely unreachable (Priority: P3)

A user whose role does not grant Inventory types the Inventory URL directly, or follows a stale
bookmark. They are shown a refusal, not the module.

**Why this priority**: Hiding a link is presentation, not access control. Without this, the feature
would be security theatre — the menu would imply a restriction the application does not apply.
Lower priority only because the API already refuses the underlying data requests, so this closes a
presentation gap rather than a data-exposure one.

**Independent Test**: Sign in as a restricted user and navigate directly to each module URL,
confirming a refusal panel in place of module content.

**Acceptance Scenarios**:

1. **Given** a user without INVENTORY, **When** they navigate directly to the Inventory URL,
   **Then** they are shown an access-refused panel and none of the module's content.
2. **Given** a user without any of SETTINGS, USER_MANAGEMENT or COMPANY_SETTINGS, **When** they
   navigate directly to any Settings URL, **Then** they are refused.
3. **Given** a user whose role permits a module, **When** they navigate to it directly, **Then**
   the module opens normally.

---

### User Story 4 - Degraded and empty states remain usable (Priority: P3)

A user whose role grants no modules at all, or whose session details cannot be loaded, still gets a
comprehensible screen that tells them what to do, and can still sign out.

**Why this priority**: These states are rare but strand the user completely when unhandled — a
sidebar filtered to nothing, with no Sign Out, is an unusable application with no way back to the
sign-in screen.

**Independent Test**: Sign in as an account holding a role with no permissions, and separately
simulate a failure to load session details; confirm both render an explanatory state with a working
Sign Out.

**Acceptance Scenarios**:

1. **Given** a user whose roles grant no sidebar module, **When** they sign in, **Then** they see a
   message explaining that no modules have been assigned and directing them to their administrator,
   with the Sign Out control still available.
2. **Given** the application cannot load the signed-in user's details, **When** the shell renders,
   **Then** no modules are shown, the failure is stated plainly, and Sign Out still works.
3. **Given** the application is still loading the signed-in user's details, **When** the shell
   renders, **Then** neither the full nine-module menu nor an empty menu is shown — a neutral
   placeholder occupies the navigation area until the answer is known.

---

### Edge Cases

- **A user holds multiple roles.** Their visible modules are the union of every role's permissions,
  consistent with how the rest of the application already resolves multi-role accounts.
- **A user's permissions change mid-session.** The sidebar reflects the change the next time the
  application resolves the session, without requiring sign-out; a change never leaves a user
  looking at a module they may no longer open.
- **A permission is removed while the user is sitting on that module's page.** Their next
  interaction with that page is refused; they are not silently left on a page they can no longer
  use.
- **A user lacks DASHBOARD but holds other modules.** They must not be dropped onto a page they
  cannot see; they land on the first module they do hold.
- **A user holds exactly one module.** The sidebar must not look broken with a single entry, at
  either desktop or phone width.
- **All nine modules are visible on a 320px screen.** The navigation must still fit without the
  page scrolling sideways — the current fixed five-column phone grid is sized for exactly ten
  targets and must instead reflow for any count from zero to nine.
- **A field worker opens My Workspace with no network.** Their session details cannot be loaded,
  but that shell exists precisely to queue punches offline. They must not be refused entry; see
  FR-010a.
- **A permission exists that governs no sidebar module.** Nine of the twenty-two assignable
  permissions gate content below the module level rather than a sidebar entry; clearing one of them
  legitimately changes nothing about the sidebar, and the roles screen must not imply otherwise.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sidebar MUST render only those modules whose governing permission the signed-in
  user holds, and MUST omit all others entirely rather than showing them disabled.
- **FR-002**: A module governed by more than one permission MUST be shown when the user holds at
  least one of them (any-of), not only when they hold all of them.
- **FR-003**: The module-to-permission mapping MUST be exactly:

  | Sidebar module | Governing permission(s) |
  |---|---|
  | Dashboard | DASHBOARD |
  | HR & Payroll | EMPLOYEES, ATTENDANCE, PAYROLL |
  | Projects | PROJECTS |
  | Plant & Machinery | MACHINERY |
  | Inventory | INVENTORY |
  | Partners | PARTNERS |
  | Reports | REPORTS |
  | My Workspace | MY_WORKSPACE |
  | Settings | SETTINGS, USER_MANAGEMENT, COMPANY_SETTINGS |

- **FR-004**: The signed-in user's identity panel and the Sign Out control MUST always render,
  irrespective of which permissions the user holds or whether their details could be loaded.
- **FR-005**: Navigation MUST be derived from the permissions of the current session each time the
  application resolves that session. A change an administrator makes to a role MUST take effect for
  affected users without them signing out and back in.
- **FR-006**: Navigating directly to a module's URL without the governing permission MUST show an
  access-refused panel in place of that module's content.
- **FR-007**: The refusal in FR-006 MUST be evaluated from the user's permissions independently of
  what the sidebar rendered — omitting a link MUST NOT be the only thing preventing access.
- **FR-008**: A user who lacks DASHBOARD MUST be taken to the first module they do hold, in the
  order given in FR-003, rather than to a page they cannot open.
- **FR-009**: A user who holds none of the permissions in FR-003 MUST be shown a state that names
  the situation and directs them to their administrator, rather than an empty shell.
- **FR-010**: If the signed-in user's details cannot be loaded, the application MUST show no
  modules and state the failure, rather than falling back to showing every module.
- **FR-010a**: FR-010 does NOT apply to the My Workspace shell. That shell is offline-capable by
  design, and a failure to load the signed-in user's details there is indistinguishable from absent
  network signal — the normal condition for a worker punching in on site. Refusal there MUST apply
  only when the details load successfully and the governing permission is absent. Added
  2026-09-02 during planning; see plan research.md §4.
- **FR-011**: While the signed-in user's details are being loaded, the navigation area MUST show
  neither the complete module list nor an empty list.
- **FR-012**: The navigation MUST lay out correctly at phone width for any number of visible
  modules from zero to nine, without the page scrolling horizontally, and MUST preserve minimum
  touch-target sizing.
- **FR-013**: On Settings > Roles, each permission that governs a sidebar module MUST be labelled
  with the module it governs, and permissions that govern no sidebar module MUST be visually
  distinguishable from those that do.
- **FR-014**: The module-to-permission mapping MUST have a single definition used by both the
  sidebar and the route refusal, so that the two cannot disagree about what a user may reach.
- **FR-015**: Every navigation control that remains visible MUST stay operable by keyboard, at every
  viewport width.
- **FR-016**: No new administrative screen, stored mapping, or per-role menu configuration is
  introduced; role permissions remain the only place navigation visibility is configured.

### Key Entities

- **Navigation Module**: One top-level sidebar entry — its label, its destination, and the set of
  permissions that govern its visibility. Nine exist; the set is fixed by this feature and changes
  only when a module is added to the product.
- **Permission**: An existing named capability assignable to a role. Twenty-two are assignable;
  thirteen govern a navigation module, the other nine govern content below module level.
- **Role**: An existing named set of permissions, edited by administrators in Settings. A user may
  hold more than one.
- **Session view of the user**: The signed-in user's identity, role names and the union of their
  roles' permissions, resolved from the server rather than from anything the browser stores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every seeded role, the set of modules shown in the sidebar matches the set
  computed from that role's permissions under FR-003 — verified for all nine modules across all
  roles, with zero mismatches.
- **SC-002**: Zero dead links: no user is shown a module link that refuses them when clicked.
- **SC-003**: All nine modules refuse direct URL access when the governing permission is absent —
  verified individually for each of the nine.
- **SC-004**: An administrator can change which modules a role sees using only the existing
  Settings > Roles screen, in under one minute, with no other screen involved.
- **SC-005**: A permission change made by an administrator is reflected in an affected user's
  sidebar on that user's next application load, with no sign-out required.
- **SC-006**: At no point in the page lifecycle — including while session details are loading — does
  the sidebar display a module the user is not permitted to open.
- **SC-007**: A user holding no module permissions can still identify themselves and sign out.
- **SC-008**: The navigation fits a 320px-wide screen without horizontal page scrolling for every
  module count from zero to nine.

## Assumptions

- **Existing permissions are the mapping.** Administrators already assign permissions to roles in
  Settings > Roles; this feature reuses that as the navigation mapping rather than introducing a
  second one. A separate role-to-menu table was explicitly rejected: two mappings can drift, and
  the drift shows up as either visible dead links or hidden-but-reachable pages.
- **Top-level modules only.** Sub-navigation within a module — HR's ten areas, Settings' four
  sections — is out of scope. Those sections already have their own permission checks, and the
  current permission vocabulary is too coarse to filter them further (a single PAYROLL permission
  spans payroll, challans and TDS). Finer-grained sub-navigation would require new permissions and
  is a separate feature.
- **No server-side change is needed.** The signed-in user's effective permissions are already
  returned when the application resolves the session, and the server already re-derives them from
  the database on every request rather than trusting anything the browser holds. This is why FR-005
  needs no cache-invalidation mechanism and no forced sign-out.
- **Browser-side filtering is a usability measure, not the access control.** The server already
  refuses every request the user is not entitled to make; FR-006's refusal panel exists so a user
  is not shown a page whose every request would fail. This matches the reasoning already recorded
  for the existing Settings and HR section guards.
- **Order is the sidebar's existing order.** FR-008's "first module they hold" uses the order in
  FR-003, which is the order modules already appear in the sidebar, so the landing choice is
  predictable and matches what the user sees.
- **A zero-permission user stays signed in.** They are shown an explanatory state rather than being
  signed out, since being ejected at the sign-in screen with no explanation is the worse outcome and
  the situation is usually an incomplete role assignment.
- **Roles are global, not per-company.** Role definitions are not scoped to a company today, so a
  role's navigation is the same in every tenant. This feature does not change that.

## Out of Scope

- Sub-navigation filtering inside HR & Payroll, Settings, or any other module.
- Any new permission values, and therefore any server-side migration.
- A dedicated navigation-configuration screen, or any stored role-to-menu mapping.
- Per-company or per-site variation of a role's navigation.
- Reordering or renaming modules per role.
