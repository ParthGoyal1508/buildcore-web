# Tasks: Role-Based Navigation

**Input**: Design documents from `/specs/014-role-based-navigation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/navigation.md](./contracts/navigation.md),
[quickstart.md](./quickstart.md)

**Tests**: No test tasks. `buildcore-web` has no test framework installed — the constitution records
this as `TODO(TESTING_STANDARD)`. Verification is `npm run lint`, `npx tsc --noEmit`, `npm run build`
and the five manual passes in [quickstart.md](./quickstart.md). Writing test files here would
produce code nothing can run.

**Organization**: Grouped by the spec's four user stories so each is independently completable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1–US4, mapping to the user stories in spec.md
- All paths are relative to the `buildcore-web` repository root

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline. No project initialization is needed — this feature adds no
dependency, no route and no directory.

- [ ] T001 Create branch `014-role-based-navigation` from `main` in the `buildcore-web` repository
- [ ] T002 Confirm a clean baseline before changing anything: `npm run lint`, `npx tsc --noEmit` and `npm run build` all pass on the unmodified tree, so any later failure is attributable to this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single mapping definition (FR-014) and the pure functions derived from it.
Everything in Phases 3–6 reads these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `NAV_MODULES` to `app/lib/constants.ts` as a `readonly`/`as const` array of the nine modules — `id`, `name`, `href`, `guardPrefix`, `permissions` (any-of), `icon` — in the exact order and with the exact values given in [contracts/navigation.md](./contracts/navigation.md) (FR-003). Note `href` and `guardPrefix` are separate fields: they coincide for eight modules, but My Workspace links to `/my/punch` while guarding all of `/my`. Place it beside the existing `SETTINGS_PERMISSIONS` and `HR_PERMISSIONS`, which it is the tier above. Derive `NavModuleId` from the array rather than hand-writing a union
- [ ] T004 Add `NAV_GOVERNING_PERMISSIONS` to `app/lib/constants.ts` — the flattened set of the 13 permissions appearing in any module's `permissions`, used by US2 to tell nav-governing permissions from the other 9 (depends on T003, same file)
- [ ] T005 Add the new user-facing copy to `MESSAGES` in `app/lib/constants.ts`: the no-modules empty state (FR-009, naming the situation and directing the user to their administrator) and the session-load-failure state (FR-010). No literal copy may appear in JSX — Principle III (depends on T003, same file)
- [ ] T006 Create `app/lib/permissions.ts` with three pure functions reading `NAV_MODULES`: `visibleModules(permissions)` returning modules in array order (FR-001, FR-002), `hasModuleAccess(permissions, pathname)` resolving a pathname to its module by **longest `guardPrefix` match** — never by `href`, and never first-match, since `/dashboard` prefixes every other module route — and returning the decision, and `landingRoute(permissions)` returning the first held module's `href` or `null` when none is held (FR-008). No React, no side effects — Principle I keeps this out of component bodies (depends on T003)

**Checkpoint**: The mapping exists once and is queryable. User stories can begin.

---

## Phase 3: User Story 1 — A user sees only the modules their role permits (Priority: P1) 🎯 MVP

**Goal**: The sidebar renders exactly the modules the signed-in user's permissions allow.

**Independent Test**: Sign in as accounts with differing role permissions and compare the rendered
sidebar against [contracts/navigation.md](./contracts/navigation.md) — quickstart Pass 1.

- [ ] T007 [US1] Rewrite `app/ui/dashboard/nav-links.tsx` as a `"use client"` component that reads `useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })` and renders `visibleModules(user.permissions)`. Delete the hardcoded nine-item `links` array — it moves to `NAV_MODULES`, it is not duplicated (FR-001, FR-002, FR-014). Reuse the existing `['currentUser']` key so this adds no network request and cannot resolve from a different snapshot than the guards (research.md §2)
- [ ] T008 [US1] Render a neutral placeholder in `app/ui/dashboard/nav-links.tsx` while the query is pending — neither the full nine-module menu nor an empty list (FR-011). This belongs in US1, not US4, because US1 shipped without it would flash every module at a restricted user on every load (depends on T007, same file)
- [ ] T009 [US1] Replace the fixed `grid grid-cols-5` in `app/ui/dashboard/sidenav.tsx` with a wrapping grid that reflows for any module count from 0 to 9 plus the always-present Sign Out (FR-012). The existing comment explains `grid-cols-5` as fitting exactly ten 44px targets at 320px — that reasoning is now wrong and the comment must be replaced, not left to mislead. Keep the 44×44px minimum and the `md:flex-col` desktop column untouched. Tailwind classes only, `clsx` for anything conditional — Principle II
- [ ] T010 [US1] Verify quickstart Pass 1 (role matrix, SC-001, SC-002, SC-006) and Pass 3 (320px viewport and keyboard operability, FR-015, SC-008). The sidebar is a mobile-critical surface under Principle VI, so the 320px check is mandatory before merge, not optional

**Checkpoint**: The sidebar is honest. Every visible link works; nothing a user cannot open is shown.

---

## Phase 4: User Story 2 — An administrator changes what a role can see (Priority: P2)

**Goal**: An administrator can see, on the screen they already use, which permission controls which
sidebar module.

**Independent Test**: Open a role for editing on Settings > Roles and confirm each permission names
the module it governs, and that the nine governing none are distinguishable — quickstart Pass 5.

- [ ] T011 [US2] Add a permission→module label lookup to `app/lib/constants.ts`, derived from `NAV_MODULES` rather than written out a second time, so a module renamed in T003 cannot leave a stale label here (depends on T003, same file)
- [ ] T012 [US2] In `app/ui/settings/role-modal.tsx`, label each permission checkbox with the sidebar module it governs, and visually separate the 9 permissions governing no module — DWR, Project Financials, Challans, Loans, Logbook, Fuel, Daily Worker Registry, Data Export, Data Delete — from the 13 that do (FR-013). Without this an administrator clears one of the nine, expects the menu to change, and is silently misled. Keep sourcing the checkbox list from `PERMISSIONS`; do not fork it (depends on T011)
- [ ] T013 [US2] Verify quickstart Pass 5, and the Pass 1 round trip that clears a permission from a role and confirms an affected user's sidebar changes on their next load with no sign-out (FR-005, SC-004, SC-005)

**Checkpoint**: The control surface is legible. An administrator can predict what their edit will do.

---

## Phase 5: User Story 3 — A hidden module is genuinely unreachable (Priority: P3)

**Goal**: Omitting a link is presentation; the route itself refuses. Closes the gap that would
otherwise make this feature security theatre.

**Independent Test**: Sign in as a restricted account and navigate directly to each module URL —
quickstart Pass 2.

- [ ] T014 [US3] Create `app/ui/dashboard/module-guard.tsx` as a `"use client"` component following the pattern already established by `app/dashboard/settings/layout.tsx` and `app/dashboard/hr/layout.tsx`: read the shared `['currentUser']` query, resolve the current pathname through `hasModuleAccess()`, and render `<AccessDenied />` in place of children when the permission is absent (FR-006). Compute the decision from `permissions` alone, never from what the sidebar rendered (FR-007). Carry forward the comment explaining why this cannot live in `middleware.ts` — the access token is in memory only, so middleware never sees it (research.md §1)
- [ ] T015 [US3] Mount `<ModuleGuard>` in `app/dashboard/layout.tsx` beside the existing `<SessionGuard />`, wrapping `children`. `app/dashboard/layout.tsx` stays a Server Component — only the guard is a client component, keeping the boundary as low as the tree allows (Principle I) (depends on T014)
- [ ] T016 [US3] Implement the FR-008 landing redirect in `app/ui/dashboard/module-guard.tsx`: a user lacking `DASHBOARD` who lands on `/dashboard` goes to `landingRoute(permissions)`. When that returns `null`, render the US4 empty state instead of redirecting — every candidate destination would refuse them, so any redirect is a loop (research.md §5) (depends on T014)
- [ ] T017 [US3] Add a `MY_WORKSPACE` check to `app/my/layout.tsx` via the same `hasModuleAccess()` used by T014 — the `/my` guardPrefix is what makes one function serve both shells — implementing FR-010a: refuse **only** when `/users/me` resolves successfully and the permission is absent; a *failed* load falls through to the shell. This shell is an offline-capable PWA that owns the queued-punch drain, and a failed load there is indistinguishable from a site worker having no signal — refusing would lock them out of punching exactly when the offline queue exists to serve them (research.md §4)
- [ ] T018 [US3] Verify quickstart Pass 2 (direct-URL refusal) for the four modules whose routes exist: Dashboard, HR & Payroll, Settings, My Workspace
- [ ] T019 [US3] Record in the PR description that Projects, Plant & Machinery, Inventory, Partners and Reports have **no routes in `app/` at all** — they 404 today for every user. Their `NAV_MODULES` entries are correct and their guard entries are in place for whenever features 006–009 build those routes, but SC-003 can only be verified end-to-end for the four that exist. Verify only that the five are absent from the sidebar. Do not silently narrow SC-003 to match what is testable

**Checkpoint**: Hidden and unreachable now mean the same thing.

---

## Phase 6: User Story 4 — Degraded and empty states remain usable (Priority: P3)

**Goal**: A user with no modules, or whose session details fail to load, gets a comprehensible
screen and can still sign out.

**Independent Test**: Sign in as an account holding a permissionless role, and separately stop the
API and reload — quickstart Pass 4.

- [ ] T020 [US4] Render the FR-009 empty state in `app/ui/dashboard/sidenav.tsx` when `visibleModules()` is empty: the `MESSAGES` copy from T005, naming the situation and directing the user to their administrator (depends on T005, T009)
- [ ] T021 [US4] Render the FR-010 failure state in `app/ui/dashboard/nav-links.tsx` when the `['currentUser']` query errors: no modules, the failure stated plainly, and explicitly **not** a fallback to the full menu — failing open here would hand every module to a user whose permissions could not be read (depends on T005, T008)
- [ ] T022 [US4] Confirm the identity panel and the Sign Out control in `app/ui/dashboard/sidenav.tsx` render in every state above, including both failure states (FR-004, SC-007). A filtered-to-nothing sidebar with no Sign Out strands the user with no route back to sign-in (depends on T020)
- [ ] T023 [US4] Verify quickstart Pass 4, including the offline `/my` case, which must **not** refuse (FR-010a)

**Checkpoint**: Every state on the decision table in contracts/navigation.md is reachable and sane.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T024 Audit for FR-014 and FR-016 compliance: `grep` for any module label, route or permission list defined outside `NAV_MODULES`, and confirm the diff introduces no new settings screen, stored mapping or role-side configuration. A second definition is the defect this feature exists to prevent; a second *configuration surface* is the design the user explicitly rejected
- [ ] T025 [P] Run `npm run lint` — includes the React Compiler rules that previously caught `watch()`-in-render and `setState`-in-effect in this repo
- [ ] T026 [P] Run `npx tsc --noEmit`
- [ ] T027 Run `npm run build` (`next build` + `serwist build`) — the serwist step matters because `app/my/layout.tsx` changed in T017
- [ ] T028 Run [quickstart.md](./quickstart.md) end to end as a final pass, and record the results. Lint, tsc and build prove the feature compiles; only these passes prove it behaves

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: no dependencies
- **Phase 2 Foundational**: depends on Phase 1 — **blocks every user story**
- **Phase 3–6 User stories**: all depend on Phase 2. US1 → US2 → US3 → US4 in priority order, or in
  parallel across people once Phase 2 lands
- **Phase 7 Polish**: depends on every story being attempted

### Cross-story file contention

These files are touched by more than one story and must be edited sequentially, never in parallel:

| File | Touched by |
|---|---|
| `app/lib/constants.ts` | T003, T004, T005 (foundational), T011 (US2) |
| `app/ui/dashboard/nav-links.tsx` | T007, T008 (US1), T021 (US4) |
| `app/ui/dashboard/sidenav.tsx` | T009 (US1), T020, T022 (US4) |
| `app/ui/dashboard/module-guard.tsx` | T014, T016 (US3) |

### Genuine parallel opportunities

Narrow, because this is a small feature concentrated in few files:

- T025 and T026 (lint and type-check read the tree, write nothing)
- Across people after Phase 2: US2 (`role-modal.tsx`) is disjoint from US1 (`nav-links.tsx`,
  `sidenav.tsx`) and from US3 (`module-guard.tsx`, `my/layout.tsx`)

No `[P]` marker appears inside Phases 2–6, because within each story the tasks either share a file
or depend on the one before. Marking them parallel would be wrong rather than merely cautious.

---

## Implementation Strategy

### MVP — User Story 1 only

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1
2. **Stop and validate**: quickstart Pass 1 and Pass 3
3. This alone removes every dead link from the sidebar and is worth shipping on its own

### Incremental delivery

1. Foundation → US1 (**MVP**: the menu becomes honest)
2. → US2 (the mapping becomes legible to administrators)
3. → US3 (hiding becomes actual refusal — closes the security-theatre gap)
4. → US4 (the edge states stop stranding people)

US3 is worth stating plainly as the one that changes the security story: until it lands, the feature
is presentation only, and a restricted user can still reach any module by typing its URL.

---

## Notes

- 28 tasks: 2 setup, 4 foundational, 4 US1, 3 US2, 6 US3, 4 US4, 5 polish
- No test tasks — no framework is installed (constitution `TODO(TESTING_STANDARD)`). Do not add one
  as part of this feature
- No new dependency, no new route, no new directory. Two new files: `app/lib/permissions.ts` and
  `app/ui/dashboard/module-guard.tsx`
- The browser-side filtering and refusal are a UX affordance throughout. `buildcore-api` guards every
  endpoint with `@RequirePermissions`, and that is the enforcement — nothing here is load-bearing for
  security
