---

description: "Task list for feature implementation"
---

# Tasks: Settings Module Frontend (Companies, Users, Roles & Employee Setup)

**Input**: Design documents from `/specs/002-settings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-ui.md,
quickstart.md

**Tests**: Not included — no automated test framework is installed in `buildcore-web` yet
(constitution's documented gap); verification is manual via `quickstart.md`, including the
mobile-viewport and keyboard-operability checks this feature's own principle (VI) and clarification
(FR-024) require.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. All paths are in this repo (`buildcore-web`) — the
backend this feature consumes is a separate, already-fully-specced feature in the sibling
`buildcore-api` repo (`specs/002-settings-backend`) and is not re-tasked here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `@tanstack/react-query` to `package.json` and register a `QueryClientProvider` in
      `app/layout.tsx` (or a new `app/providers.tsx` client wrapper) — research.md §3
- [X] T002 [P] Add Settings routes, user-facing copy (validation/confirmation messages), and the
      `PERMISSIONS` constant (20 fixed values mirroring `buildcore-api`'s `Permission` enum) to
      `app/lib/constants.ts` — research.md §4, Constitution Principle III
- [X] T003 [P] Create `app/ui/access-denied.tsx` (shared component rendered when a route's required
      permission is missing) — contracts/settings-ui.md
- [X] T004 [P] Create `app/lib/settings-utils.ts` with the pure `computeDocumentTypeFlag(isMandatory,
      hasExpiry, needsNumber)` function (data-model.md "DocumentType") — used by both the live-preview
      UI (US5) and any local recomputation

**Checkpoint**: Query client, constants, shared access-denied UI, and the derived-flag utility
ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Extend `middleware.ts` (introduced by feature 001) to decode the access token's
      permission claims and match required permissions per `/dashboard/settings/*` path segment
      (`companies` → `COMPANY_SETTINGS`, `roles`/`users` → `USER_MANAGEMENT`, `employee-setup` →
      `EMPLOYEES`), rendering `app/ui/access-denied.tsx` (T003) when the check fails — research.md
      §2, spec FR-020
- [X] T006 Add a further check in `middleware.ts` restricting `/dashboard/settings/users`
      specifically to the Super Admin or HO User role (spec FR-010), on top of the
      `USER_MANAGEMENT` permission check from T005
- [X] T007 [P] Create `zod` schemas for `Company`, `Role`, `UserSummary`, `Department`,
      `Designation`, `DocumentType`, `Shift`, `CodeSeriesView` in `app/lib/api/settings.ts` (schema
      definitions only, functions come per-story) — data-model.md, Constitution Principle IV
- [X] T008 [P] Create `app/ui/settings/company-context.tsx`: `CompanyContext` +
      `useCompanyContext()` hook, defaulting to the signed-in user's own `companyId` with a
      selector shown only for a cross-company Super Admin — research.md §6
- [X] T009 [P] Create a shared `ResponsiveList` pattern/component (table `hidden md:table` +
      card list `md:hidden`, reading one column/data definition) in
      `app/ui/settings/responsive-list.tsx` — research.md §7, spec FR-021

**Checkpoint**: Route guard, response schemas, company context, and the responsive-list pattern
ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Configure a company and its statutory/payroll settings (Priority: P1) 🎯 MVP

**Goal**: Super Admin can list, create, and edit companies via a five-tab modal.

**Independent Test**: Add a company across all five tabs, confirm it's listed; edit its payroll
rates and confirm persistence.

### Implementation for User Story 1

- [X] T010 [P] [US1] Add `listCompanies()`, `createCompany()`, `updateCompany()` to
      `app/lib/api/settings.ts` (zod-validated, per contracts/settings-ui.md)
- [X] T011 [US1] Create `app/ui/settings/company-list.tsx`: react-query-backed list using
      `ResponsiveList` (T009), Edit action per row, Status badge (depends on T001, T009, T010)
- [X] T012 [US1] Create `app/ui/settings/company-modal.tsx`: one `react-hook-form` instance across
      five presentational tabs (Basic Info, Registration, Address, Statutory, Payroll Settings),
      inline validation per field, single Save (research.md §5) — native `<label htmlFor>`/`<button>`
      elements throughout and a focus-trapped dialog, per research.md §8/spec FR-024
- [X] T013 [US1] Create `app/dashboard/settings/companies/page.tsx` (Server Component, initial
      fetch, renders `CompanyList`) (depends on T011)
- [X] T014 [US1] Wire `company-modal.tsx`'s duplicate-short-code and malformed-GSTIN/PAN error
      responses to inline, tab-specific error display without clearing other tabs' entered data —
      spec Acceptance Scenario 2/4
- [X] T015 [US1] Wire the Inactive-company exclusion: any other component's company-selector
      (starting with `company-context.tsx`, T008) calls `listCompanies()` filtered to
      `status: 'active'` — spec FR-005

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Manage roles and their permissions (Priority: P1)

**Goal**: View/create/edit/delete roles (except protected Super Admin) via a permission
multi-select.

**Independent Test**: List default roles, create a custom role with a permission subset, assign it
to a user, confirm access matches exactly.

### Implementation for User Story 2

- [X] T016 [P] [US2] Add `listRoles()`, `createRole()`, `updateRole()`, `deleteRole()` to
      `app/lib/api/settings.ts`
- [X] T017 [US2] Create `app/ui/settings/role-list.tsx`: `ResponsiveList`-based list with
      permissions summary and user count per row; Super Admin row's Edit/Delete disabled
      (`isProtected`) — spec Acceptance Scenario 3, 5
- [X] T018 [US2] Create `app/ui/settings/role-modal.tsx`: permission multi-select sourced from the
      `PERMISSIONS` constant (T002) — no free-text input — spec FR-007; native checkbox/`<label>`
      elements and a focus-trapped dialog, per research.md §8/spec FR-024
- [X] T019 [US2] Create `app/dashboard/settings/roles/page.tsx` (depends on T017)
- [X] T020 [US2] Wire the delete-role confirmation dialog to warn about cascading role-clear on
      affected users before calling `deleteRole()` — spec FR-009

**Checkpoint**: User Stories 1 AND 2 both independently functional.

---

## Phase 5: User Story 3 - Administer existing user accounts (Priority: P2)

**Goal**: Super Admin/HO User can list, edit (role/status), and delete existing accounts; an "Add
User" link deep-links to Account Creation.

**Independent Test**: List users, edit one's role/status, delete another; confirm the last active
Super Admin account can't be deactivated/deleted/reassigned.

### Implementation for User Story 3

- [X] T021 [P] [US3] Add `listUsers()`, `updateUser()`, `deleteUser()` to
      `app/lib/api/settings.ts`
- [X] T022 [US3] Create `app/ui/settings/user-list.tsx`: `ResponsiveList`-based list (Name, Email,
      Role, Status, Last Login — "Never" when `lastLoginAt` is null), Edit/Delete actions, an "Add
      User" `<Link>` to the Account Creation route (no function call) — spec FR-010, FR-011
- [X] T023 [US3] Create `app/dashboard/settings/users/page.tsx` (depends on T022)
- [X] T024 [US3] Surface the backend's 409 (last-active-Super-Admin protection) verbatim as the
      edit/delete action's error message — spec FR-013

**Checkpoint**: User Stories 1–3 independently functional.

---

## Phase 6: User Story 4 - Maintain Departments and Designations masters (Priority: P2)

**Goal**: Per-company CRUD for Departments and Designations within Employee Setup.

**Independent Test**: Add a department under one company, confirm company-scoped visibility, edit
and delete it.

### Implementation for User Story 4

- [X] T025 [P] [US4] Add `listDepartments()`, `createDepartment()`, `updateDepartment()`,
      `deleteDepartment()` and the Designation equivalents to `app/lib/api/settings.ts`
- [X] T026 [P] [US4] Create `app/ui/settings/department-tab.tsx`: `ResponsiveList`-based (T009) list
      + add/edit/delete modal (native `<label>`/`<button>` elements, focus-trapped, per research.md
      §7/§8), scoped to `useCompanyContext()` (T008), 409 (duplicate name / still-referenced) shown
      inline — spec FR-015, FR-021, FR-024
- [X] T027 [P] [US4] Create `app/ui/settings/designation-tab.tsx`: same pattern as T026
- [X] T028 [US4] Create `app/dashboard/settings/employee-setup/page.tsx`: wraps its five tab
      components in `CompanyContext` (T008), renders tab navigation (depends on T026, T027)

**Checkpoint**: User Stories 1–4 independently functional.

---

## Phase 7: User Story 5 - Maintain Document Types with mandatory/expiry/number flags (Priority: P3)

**Goal**: Per-company Document Types with a live derived-flag preview and default-seeded list per
new company.

**Independent Test**: Toggle Mandatory + Needs Document Number in the Add modal, confirm the
preview shows "MandatoryNumber" before saving; open a new company's tab and see the 16 defaults.

### Implementation for User Story 5

- [X] T029 [US5] Add `listDocumentTypes()`, `createDocumentType()`, `updateDocumentType()` to
      `app/lib/api/settings.ts` (no delete function — `isActive` toggle only)
- [X] T030 [US5] Create `app/ui/settings/document-type-tab.tsx`: `ResponsiveList`-based (T009) list
      (Type, Code, Flags, Sort Order, Active) + Add/Edit modal (native toggle/`<label>`/`<button>`
      elements, focus-trapped, per research.md §7/§8) with the three toggles wired to
      `computeDocumentTypeFlag()` (T004) for a live, pre-save preview — spec FR-016, FR-021, FR-024,
      Acceptance Scenario 1
- [X] T031 [US5] Register `document-type-tab.tsx` in `employee-setup/page.tsx` (T028)

**Checkpoint**: User Stories 1–5 independently functional.

---

## Phase 8: User Story 6 - Maintain Shifts (Priority: P3)

**Goal**: Per-company Shift CRUD within Employee Setup.

**Independent Test**: Add a shift with in/out time and grace period, confirm it's listed; confirm
deletion is blocked while referenced.

### Implementation for User Story 6

- [X] T032 [P] [US6] Add `listShifts()`, `createShift()`, `updateShift()`, `deleteShift()` to
      `app/lib/api/settings.ts`
- [X] T033 [US6] Create `app/ui/settings/shift-tab.tsx`: `ResponsiveList`-based (T009) list +
      add/edit/delete modal (native `<label>`/`<button>` elements, focus-trapped, per research.md
      §7/§8), 409 (still-referenced) shown inline — spec FR-018, FR-021, FR-024
- [X] T034 [US6] Register `shift-tab.tsx` in `employee-setup/page.tsx` (T028)

**Checkpoint**: User Stories 1–6 independently functional.

---

## Phase 9: User Story 7 - View a company's employee code series (Priority: P3)

**Goal**: Read-only Code Series tab showing short code + next employee code.

**Independent Test**: Open the tab, confirm short code + next code display; change the company's
short code (US1) and reopen — prefix updates, sequence unaffected.

### Implementation for User Story 7

- [X] T035 [US7] Add `getCodeSeries()` to `app/lib/api/settings.ts`
- [X] T036 [US7] Create `app/ui/settings/code-series-tab.tsx`: read-only display of short code +
      next code, no editable sequence field — spec FR-019
- [X] T037 [US7] Register `code-series-tab.tsx` in `employee-setup/page.tsx` (T028)

**Checkpoint**: All seven user stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T038 [P] Run `npm run lint` and `next build`/`tsc --noEmit` across all new/modified files and
      fix any violations
- [X] T039 [P] Manually verify every screen at a mobile viewport (≤428px) shows the card layout,
      not a horizontally-scrolling table — spec FR-021/SC-005
- [X] T040 [P] Manually verify every interactive control across all screens is keyboard-operable
      with a visible focus indicator — spec FR-024/SC-008
- [X] T041 Run the full `quickstart.md` validation scenarios end-to-end against a local environment
      (with `buildcore-api`'s Settings module running) and record results
- [X] T042 Confirm every failed-save case (client validation and simulated server rejection) leaves
      the form/modal open with entered data intact — spec FR-022/SC-007

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–9)**: All depend on Foundational phase completion
  - US1 (Companies) and US2 (Roles) are both P1 and mutually independent
  - US3 (Users) needs at least one role to exist (US2's seed data, not its CRUD UI) to display a
    role name per user, but doesn't depend on US2's own screen being built
  - US4/US6 (Departments/Designations/Shifts) are independent of each other beyond a Company (US1)
    existing and `employee-setup/page.tsx`'s shell (T028) — implement T028 once, then each tab
    registers into it
  - US5 (Document Types) and US7 (Code Series) are likewise independent, registering into the same
    shell
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Within Foundational, T007–T009 can run in parallel; T005/T006 (same file, `middleware.ts`) are
  sequential with each other
- Once Foundational completes, US1 and US2 can proceed in parallel; US4/US5/US6/US7 all extend the
  same `employee-setup/page.tsx` shell (T028), so that one task should land before its four tabs are
  registered, though each tab's own list/modal component (T026, T027, T030, T033, T036) can be built
  in parallel

---

## Parallel Example: User Story 1

```bash
# Launch independent pieces of User Story 1 together:
Task: "Add listCompanies/createCompany/updateCompany to app/lib/api/settings.ts"
Task: "Create app/ui/settings/company-list.tsx"
Task: "Create app/ui/settings/company-modal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Companies)
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready (route guard, schemas, company context, responsive-list
   pattern)
2. US1 (Companies) → test independently → MVP
3. US2 (Roles) → US3 (Users) → test independently → full RBAC administration UI
4. US4 (Departments/Designations) → US5 (Document Types) → US6 (Shifts) → US7 (Code Series) → each
   tested independently → complete Employee Setup


---

## Implementation notes (2026-08-29)

All 42 tasks are complete. Five diverged from the task text; each was confirmed with the user
before being acted on rather than decided unilaterally.

### T005 / T006 — the route guard could not live where the plan put it

research.md §2 and T005 place permission gating in `middleware.ts`, "decoding the access token's
permission claims". That is unreachable in the codebase feature 001 actually shipped:

- there is no `middleware.ts` — Next 16 renames the concept, and 001 shipped `proxy.ts`;
- more fundamentally, the **access token is held in memory only** (`app/lib/session.ts`),
  deliberately, so it is never in a cookie. Middleware can read cookies and nothing else, so it can
  never see the token. Only a same-origin marker cookie (`session_hint`) is visible to it.

Putting the token in a cookie to satisfy the original design would reverse a deliberate security
decision of feature 001. The guard is instead `app/dashboard/settings/layout.tsx` — still one
chokepoint covering all four sections rather than the per-page repetition §2 rejected, just at the
layout boundary rather than the edge. It remains a UX affordance either way: `buildcore-api` guards
every one of these endpoints itself, which is what actually enforces access.

### T002 — 22 assignable permissions, not 20

T002 specifies "20 fixed values". The backend enum has since grown to 23 (feature 008 split out
`DWR` and `PROJECT_FINANCIALS`; 001 added `CROSS_COMPANY_ACCESS`). `PERMISSIONS` mirrors the
backend's `ASSIGNABLE_PERMISSIONS` — all 23 except `CROSS_COMPANY_ACCESS`, which only the protected
Super Admin role carries and which role CRUD rejects with a 400. Offering it would be a checkbox
that always fails.

### T022 — "Add User" is disabled, not linked

The deep-link target belongs to feature 010 (Account Creation), which has no route. The control is
rendered in place but disabled, with a note saying why, so the screen matches its spec'd layout
without dead-linking.

### Backend change required to make T008 work

`CompanyContext` lets a cross-company Super Admin choose a company, but the backend's reference-data
list endpoints scoped only by caller — a cross-company caller received *every* company's rows with
no way to narrow. An optional `?companyId=` query parameter was added to the four list endpoints in
`buildcore-api`, honoured only for a caller holding `CROSS_COMPANY_ACCESS` and ignored for everyone
else, so it can only ever narrow an already-unrestricted scope, never widen a restricted one. Two
e2e tests in `buildcore-api` cover both halves of that rule.

### Users list shows `roles`, plural

`UserSummary.roles` is an array, not the contract's singular `role`: an account can hold several
roles at once and its permissions are their union. The edit form still offers one Role dropdown,
which replaces the whole set — that is what the API's `roleId` field means.

### T038's lint half — fixed after the fact

`npm run lint` called `next lint`, removed in Next 16, with no ESLint installed. Reported first
(pre-existing and project-wide), then repaired: `eslint` + `eslint-config-next` installed,
`eslint.config.mjs` added applying the same rule sets, script changed to `eslint .`. It now passes
clean; the three findings it raised were all in pre-existing files and are detailed in
`quickstart-results.md`.

---

## Phase 11: Convergence

Appended by `/speckit-converge` on 2026-08-29, after the Phase 1–10 implementation pass. The
user-approved deviations recorded under "Implementation notes" above are deliberately not re-raised
here.

- [X] T043 **CRITICAL** Stop hardcoding the statutory contribution rates in
      `app/ui/settings/company-modal.tsx` (`pfEmployerRate: 12`, `esicEmployerRate: 3.25`,
      `gratuityRate: 4.81`, `bonusRate: 8.33`, `payrollLockDay: 7`). Constitution Principle III
      forbids inline magic numbers, and these duplicate values `buildcore-api` exposes as
      env-overridable config (`SETTINGS_DEFAULT_*`) — a legislated rate change on the server would
      leave this form showing stale defaults. Leave the rate fields empty on create and let the API
      apply its own defaults (which it already does, and which the file's own comment on line 135
      already claims is what happens), showing the returned values after save; or read the defaults
      from an endpoint. Either way the literals must go — per Constitution III, FR-003
      (contradicts)
- [X] T044 Add a per-row Deactivate/Activate action to `app/ui/settings/company-list.tsx`, calling
      `updateCompany(id, { status })` and invalidating the `companies` query. FR-001 requires "Edit
      and Delete-equivalent (deactivate) actions per row"; only Edit exists today, so deactivating
      a company means opening the modal and changing a dropdown — per FR-001, FR-005 (partial)

### Convergence pass outcome (2026-08-29)

Both appended tasks are complete.

- **T043** removed the four statutory rates and the payroll lock day from
  `company-modal.tsx`'s defaults. The fields now start empty on create, carry a "Uses the
  configured default" placeholder, and are omitted from the request body entirely when left
  blank — so `buildcore-api`'s env-overridable `SETTINGS_DEFAULT_*` values stay the single
  definition of what those rates are. An empty numeric field is dropped rather than coerced,
  because `z.coerce.number()` turns `''` into `0`, which would have quietly saved a 0% rate
  instead of deferring to the default.
- **T044** added a per-row Deactivate/Activate action to the company list, invalidating both the
  admin list and the active-only list a company selector reads.
