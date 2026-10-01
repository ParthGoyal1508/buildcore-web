---

description: "Task list for 019 Access Granularity and Multi-Company (web)"
---

# Tasks: Access Granularity and Multi-Company (web)

**Input**: Design documents from `specs/019-access-and-multi-company/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (clarified 2026-10-01),
[contracts/access-and-company.md](./contracts/access-and-company.md), [quickstart.md](./quickstart.md)

**Tests**: **NONE.** No test framework is installed in this repository (constitution
`TODO(TESTING_STANDARD)`). No task below creates a test file. Verification is `npx tsc --noEmit`,
`npm run lint`, `npm run build`, plus the manual passes in quickstart.md — which is why those passes
are tasks here rather than an afterthought.

**The API is already built.** Feature 019's backend Phases 1–5 are committed (records dated
2026-09-30). Every endpoint and every field this feature consumes exists today, so nothing here is
blocked on the backend. One field is already on the wire and merely unparsed — see T004.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Read the levels

**⚠️ Blocks Phases 2 and 3.** Inert by design: nothing changes on screen. The point is to make the
level visible to the code before anything acts on it.

- [ ] T001 [P] Add `COMPANY_COPY`, `ACCESS_COPY` and `CASH_COPY` blocks to `app/lib/constants.ts`
      (Principle III). Company **names** are not copy — they come from the server
- [ ] T002 [P] Add `ROUTES.cashVisibility` to `app/lib/constants.ts`
- [ ] T003 Add `AccessLevel` as a closed union (`'read' | 'write'`) to `app/lib/permissions.ts`.
      A string would make every comparison below a typo waiting to happen (Principle IV)
- [ ] T004 Parse `grants` in `currentUserSchema` in `app/lib/api/users.ts`, as
      `z.array(z.object({ permission: z.string(), level: z.enum(['read','write']) })).default([])`.
      **The server already sends this field** — `user-response.dto.ts` declares it and
      `users.service.ts` returns it. A zod object strips unknown keys, so it is currently discarded
      on arrival. Use `.default([])` so a login response cached from before this change parses
      instead of signing the user out
- [ ] T005 Note beside T004's schema that this is the third instance of *the server sends it, the
      client discards it* this cycle — after `ApiError.details` and the project-document
      `missingTypeIds`. The web's zod schemas are a silent filter, and a field nobody parsed is
      indistinguishable from a field nobody sent. This is the comment that tells the next person to
      check the raw response before concluding the API lacks something
- [ ] T006 Add `writePermissions?: readonly string[]` to the `NavModule` type in
      `app/lib/constants.ts`. **Optional**, so every existing entry keeps its current meaning and
      `visibleModules` is untouched — FR-016 is extension, not replacement
- [ ] T007 Populate `writePermissions` on the `NAV_MODULES` entries whose modules have write
      controls. An entry that omits it is treated as writable by anyone who can see it, which is
      today's behaviour and therefore the safe default for a module nobody has reviewed yet
- [ ] T008 Add `canWrite(grants, permissions, navModule): boolean` to `app/lib/permissions.ts`,
      beside `visibleModules` and `moduleAccess` so the three cannot disagree (Principle I)
- [ ] T009 **The level-meaningless values.** `canWrite` MUST answer from `permissions` for
      `CROSS_COMPANY_ACCESS`, `DATA_EXPORT` and the four `_APPROVE` permissions: the API's migration
      doubled every array entry, so these appear in `grants` at **both** levels and asking their
      level is meaningless rather than false. Name them in one exported constant and explain why
      beside it
- [ ] T010 Add `hasWrite(grants, permission): boolean` for the per-permission case Phase 5's
      settings control needs (`COMPANY_SETTINGS` at write), separate from the per-module `canWrite`
- [ ] T011 Verification: `npx tsc --noEmit && npm run lint && npm run build`, then confirm via
      React Query Devtools that `['currentUser']` now carries `grants` — quickstart Scenario 1.
      Compare the parsed cache entry against the raw Network response, which is what makes the
      before/after visible

---

## Phase 2: Hide what cannot be written

**Goal**: FR-009 — create, edit and delete controls are **absent** for read-only holders.
**Independent test**: a read-only role sees lists and no write controls, module by module (SC-004).

Controls are removed, never disabled. FR-007 says so, and a disabled button still advertises an
action the person cannot take.

- [ ] T012 Audit which modules carry write controls and record the list in this file before
      changing any of them. SC-004 is measured "across every module", and a list assembled while
      editing is a list that quietly omits whatever was edited last
- [ ] T013 [P] Gate write controls in `app/ui/hr/` on `canWrite`
- [ ] T014 [P] Gate write controls in `app/ui/plant/` on `canWrite` — the client's Note 22 example
      role (logbook entry, nothing else in machinery) is this module, and is what SC-003 measures
- [ ] T015 [P] Gate write controls in `app/ui/inventory/` on `canWrite`
- [ ] T016 [P] Gate write controls in `app/ui/projects/` on `canWrite`
- [ ] T017 [P] Gate write controls in `app/ui/partners/` on `canWrite`
- [ ] T018 [P] Gate write controls in `app/ui/labour/` on `canWrite`
- [ ] T019 [P] Gate write controls in `app/ui/assets/` on `canWrite`
- [ ] T020 [P] Gate write controls in `app/ui/recruitment/` on `canWrite`
- [ ] T021 [P] Gate write controls in `app/ui/documents/` and `app/ui/letters/` on `canWrite`
- [ ] T022 Gate write controls in `app/ui/settings/` on `canWrite`. Settings is last because its
      own control (Phase 5) is gated by the same mechanism, and getting that backwards locks the
      feature's author out of the setting that configures it
- [ ] T023 **Do not gate the approvals surfaces.** Authority to approve comes from the chain's slot
      mapping, not from a permission value — `app/dashboard/approvals/layout.tsx` already records
      this. Note it here so a later sweep does not "finish the job" by gating them
- [ ] T024 Verification: sign in as the read-only role and walk every module — quickstart
      Scenario 2. Record the pass, including the 403 replay that confirms the server is the actual
      boundary

---

## Phase 3: The guard reads levels

**Goal**: FR-008, FR-011. **Independent test**: direct URL entry is refused consistently with
feature 014's existing guard, and a user with nothing visible is told so.

- [ ] T025 Extend feature 014's module guard to consult `canWrite` for routes that are
      write-by-nature. Extend the existing mechanism; do not add a second guard (FR-016)
- [ ] T026 Identify which routes are write-by-nature. **The API already did this work and the
      answer is not "whatever uses POST"**: its T014 found two routes that are writes by verb and
      reads by meaning — `POST /attendance/import/validate` (checks a file, imports nothing) and
      `POST /dashboard/reports/:type/export` (exporting a report is seeing it). Mirror that
      judgement rather than re-deriving it from HTTP verbs
- [ ] T027 Render the no-visible-modules message (FR-011) when `visibleModules` is empty. Plainly,
      and naming who to ask — a user seeing an empty shell with no explanation assumes the product
      is broken rather than that their access is pending
- [ ] T028 **FR-010 — a permission change reaches the holder on their next load, with no cache
      clear.** Uncovered until now, and it fails in the direction that matters: a user whose write
      access was revoked keeps being offered write controls, and a user newly granted access keeps
      being refused. `['currentUser']` must not be served stale across a reload — refetch it on mount
      rather than trusting a cached entry
- [ ] T029 **The service worker is the other half of FR-010** (spec edge case: "navigation cached by
      the service worker from before a permission change"). `app/sw.ts` exists and caches navigation.
      Confirm it does not serve a cached shell whose menu reflects permissions the user no longer has,
      and that a permission change does not require the user to clear site data — which is a thing no
      site worker will ever do and an administrator cannot do for them
- [ ] T030 Verification for FR-010: revoke a permission on a signed-in user, reload, and confirm the
      change is reflected without clearing anything. Then grant one back. Both directions, because
      only one of them is the security-relevant one and only the other is the one users complain about
- [ ] T031 Verification: direct-URL entry to a refused route, and a user with no modules

---

## Phase 4: The switcher

**Goal**: FR-001 – FR-006. **Independent test**: quickstart Scenario 3, including the cache
inspection.

**This phase retires `CompanyProvider`.** Six screens read it. It is deliberately not the first
phase: it is the largest mechanical change in the feature, and putting it before the level work
would make one blast radius out of two.

- [ ] T032 Create `app/lib/api/company-selection.ts` with `listSelectableCompanies()` and
      `setCompanySelection(companyId)` (Principle V). Both are `@SelfService()` on the API — no
      permission is involved in choosing which of your own companies you work in
- [ ] T033 Create `app/ui/company-switcher.tsx`. Visible only when the **selectable list has more
      than one entry** (FR-001) — *not* when the user holds `CROSS_COMPANY_ACCESS`, which is a
      different population and is what the retired provider got wrong
- [ ] T034 Mount the switcher in `app/ui/shell-header.tsx`, so the selected company is visible at
      all times (FR-002) and present on every screen (FR-001). The retired provider rendered its own
      selector inside page content, which could satisfy neither
- [ ] T035 On a successful `setCompanySelection`, call `queryClient.clear()` (FR-005). Note beside
      it why a curated list of invalidations was rejected: it passes review and then fails the first
      time somebody adds a query without thinking about companies — which is to say it fails later,
      quietly, on a screen nobody was watching
- [ ] T036 Warn before switching with unsaved changes (FR-006)
- [ ] T037 **No screen sends a `companyId` to be scoped.** The server resolves and re-validates the
      selection per request. Note this where the switcher writes, so nobody later "fixes" a screen
      by threading an id through it — a second, unvalidated answer to a question the server already
      answers
- [ ] T038 Retire `app/ui/settings/company-context.tsx`. It holds the selection in `useState` and
      defaults to the first active company, so a switch there never reaches the server and the UI
      and the data disagree about which company is current. It also **throws** without a provider,
      which already cost a crash this cycle that `tsc` and `next build` both passed over
- [ ] T039 [P] Move `app/ui/settings/project-documents-screen.tsx` off `useCompanyContext`
- [ ] T040 [P] Move `app/ui/settings/signatories-screen.tsx` off `useCompanyContext`
- [ ] T041 [P] Move `app/ui/settings/letter-kinds-screen.tsx` off `useCompanyContext`
- [ ] T042 [P] Move `app/ui/documents/company-documents-screen.tsx` off `useCompanyContext`
- [ ] T043 [P] Move `app/ui/plant/use-plant-refs.ts` off `useCompanyContext`
- [ ] T044 [P] Move `app/ui/assets/use-asset-refs.ts` off `useCompanyContext`
- [ ] T045 Delete the stale comments in `app/ui/projects/project-form.tsx` and
      `app/ui/projects/project-documents-panel.tsx` explaining why they avoid `useCompanyContext`.
      The reason they document stops being true in this phase, and a comment describing a hazard
      that no longer exists sends the next reader looking for it
- [ ] T046 Verification: quickstart Scenario 3 in full, **including step 4's cache inspection**.
      SC-006 is an inspection rather than a glance because a stale answer is a plausible answer

---

## Phase 5: Cash

**Goal**: FR-012 – FR-015. **Independent test**: quickstart Scenario 4, module by module (SC-005).

The hiding itself is the API's. `CashVisibilityInterceptor` already shapes responses, which is why
FR-013 covers exports without separate work: an export built from the same response carries the
same nulls.

- [ ] T047 Add `getCashVisibility()` and `setCashVisibility(hide)` to `app/lib/api/settings.ts`
- [ ] T048 Create `app/ui/settings/cash-visibility.tsx`, present only for `COMPANY_SETTINGS` at
      **write** level (FR-012) — the first real consumer of Phase 1's `hasWrite`. Absent, not
      disabled
- [ ] T049 Create `app/ui/hidden-amount.tsx` rendering a field where `amountHidden` is true. A
      stated absence, **never a blank cell and never `0`** — the API returns null rather than zero
      precisely so the two can be told apart, and rendering it as empty throws that away
- [ ] T050 Render `amountHidden` wherever a cash amount can appear. Audit by field, not by screen:
      the API decides per row from `paymentMode`, holds no screen list, and the web holding one is
      how the two drift
- [ ] T051 **Any total spanning a hidden row must say it is incomplete** (FR-014), rather than
      present a figure that is quietly short by the value of every hidden row in it. This is the
      requirement the retired spec marker was really about
- [ ] T052 On a successful setting change, invalidate the affected queries so open screens update
      without a manual reload (FR-015)
- [ ] T053 Note that cash **entry** is unaffected — the interceptor "never touches a query or a
      row". No entry control is gated by this setting (Clarifications, 2026-10-01)
- [ ] T054 Verification: quickstart Scenario 4 module by module (SC-005), the export, and recording
      a cash payment with hiding on

---

## Phase 6: Verification

Recorded, not asserted. Each of these is a measurement or a pass somebody performed.

- [ ] T055 NFR-001: the switcher at 320px with the longest company name — reachable, operable, and
      not obscuring page content (quickstart Scenario 5). Principle VI applies because the shell is
      a mobile-critical surface
- [ ] T056 NFR-002: measure switch-to-usable, including the cache clear, against the 2-second
      budget. A figure, not an impression — `clear()` costs a visible refetch and this is what makes
      that acceptable rather than regrettable
- [ ] T057 SC-001: records created after a switch belong to the selected company
- [ ] T058 SC-003: the Note 22 example role sees logbook entry and no other part of machinery, in
      navigation **and** by direct access
- [ ] T059 SC-004: no write control visible to a read-only role, across every module in T015's list
- [ ] T060 SC-005: no cash figure on any screen or export with hiding on, module by module
- [ ] T061 SC-006: no previous-company data in the cache after a switch
- [ ] T062 FR-017: every read through a typed API module, no component calling `fetch`, no inline
      styling, all copy in `constants.ts`. A recorded sweep — this is the requirement that decays
      silently, and this feature touches more files than any other in the wave
- [ ] T063 Record every measurement and pass in this file, beside its task. A verification whose
      result lives only in a terminal somebody has closed is not a verification

---

## Dependencies & Execution Order

```
Phase 1 (levels) ─┬─> Phase 2 (hide writes)
                  └─> Phase 3 (guard)
Phase 4 (switcher) — independent of 1–3; sequenced after to limit blast radius
Phase 1 (T013) ────> Phase 5 (settings control gating)
All ──────────────> Phase 6
```

### Parallel opportunities

- T004, T005 together
- T016–T024 are one module each, all `[P]`
- T039–T044 are one consumer each, all `[P]`

## MVP scope

**Phases 1 and 2.** They deliver SC-003 and SC-004 — the client's Note 22 complaint — and need no
other phase. Phase 4 is the feature's headline but the narrower ask; Phase 5 is largely rendering
over work the API has already done.

## Notes

- 54 implementation tasks, 9 verification tasks, 63 total. None creates a test file.
- The whole feature is additive except T038, which removes a mechanism that now contradicts the
  server.
