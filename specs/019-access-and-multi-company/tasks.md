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

## Phase 1: Read the levels ✅ implemented 2026-10-01

**⚠️ Blocks Phases 2 and 3.** Inert by design: nothing changes on screen. The point is to make the
level visible to the code before anything acts on it.

- [~] T001 [P] ~~Add `COMPANY_COPY`, `ACCESS_COPY` and `CASH_COPY`~~ — **deferred to Phases 4 and 5**,
      where their screens are. Nothing in this phase renders anything, so this copy would have no
      consumer, and unused constants in `constants.ts` are how that file becomes unreadable
- [~] T002 [P] ~~Add `ROUTES.cashVisibility`~~ — **deferred to Phase 5** for the same reason
- [X] T003 `AccessLevel` as a closed union, in `app/lib/api/users.ts` beside `grantSchema` rather than
      in `permissions.ts`. It is derived from the zod schema (`Grant['level']`), so the type and the
      parser cannot disagree — two declarations of the same union is how one of them goes stale
- [X] T004 `grants` parsed in `currentUserSchema`, `.default([])` so a session cached from before this
      change parses rather than signing the user out
- [X] T005 The note is there, and says what to do rather than only what happened: when a field seems
      missing from the API, read the raw response first, because these schemas are a filter and a field
      nobody parsed looks exactly like a field nobody sent
- [~] T006 ~~`writePermissions` on `NavModule`~~ — **deferred to Phase 2.** `NavModule` is derived
      (`(typeof NAV_MODULES)[number]`), so adding an optional property to some entries makes the
      derived type a union where only some members carry it, and every read needs narrowing. Worth
      doing **with** its consumer so the shape is chosen against real call sites rather than guessed
- [~] T007 ~~Populate `writePermissions`~~ — **deferred to Phase 2**, with T006
- [~] T008 ~~`canWrite(…, navModule)`~~ — **deferred to Phase 2.** Nothing in this phase or in the
      three screens built on it is per-module; the waiver gate is per-permission. A helper with no
      caller cannot be checked against reality
- [X] T009 `LEVEL_AGNOSTIC_PERMISSIONS` exported from `app/lib/api/users.ts`, with the six values
      listed rather than derived — a rule inferred here ("anything ending `_APPROVE`") would quietly
      disagree the day the backend adds one that does not fit the pattern
- [X] T010 `hasWrite(user, permission)`. **Fails closed**: an area absent from `grants` is not
      writable, which is what makes `.default([])` safe — a user on a pre-change cached session is
      offered no write control rather than all of them. Of the two possible mistakes, hiding a control
      somebody holds is the recoverable one
- [X] T011 `npx tsc --noEmit`, `npm run lint` and `npm run build` all clean (2 pre-existing lint
      warnings, in files this phase does not touch)
- [ ] T011a Verification: confirm via React Query Devtools that `['currentUser']` carries `grants`,
      and compare it against the raw Network response — quickstart Scenario 1. **Needs a browser and a
      running API; not run.** The field's presence in the response is confirmed statically
      (`metadata.ts` records `grants: { required: true }` on `UserResponseDto`), but that is not the
      same as seeing it parsed

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

## Phase 4: The switcher ✅ implemented 2026-10-01

**Goal**: FR-001 – FR-006. **Independent test**: quickstart Scenario 3, including the cache
inspection.

**This phase retires `CompanyProvider`.** Six screens read it. It is deliberately not the first
phase: it is the largest mechanical change in the feature, and putting it before the level work
would make one blast radius out of two.

- [X] T032 Create `app/lib/api/company-selection.ts` with `listSelectableCompanies()` and
      `setCompanySelection(companyId)` (Principle V). Both are `@SelfService()` on the API — no
      permission is involved in choosing which of your own companies you work in
- [X] T033 Create `app/ui/company-switcher.tsx`. Visible only when the **selectable list has more
      than one entry** (FR-001) — *not* when the user holds `CROSS_COMPANY_ACCESS`, which is a
      different population and is what the retired provider got wrong
- [X] T034 Mount the switcher in `app/ui/shell-header.tsx`, so the selected company is visible at
      all times (FR-002) and present on every screen (FR-001). The retired provider rendered its own
      selector inside page content, which could satisfy neither
- [X] T035 On a successful `setCompanySelection`, call `queryClient.clear()` (FR-005). Note beside
      it why a curated list of invalidations was rejected: it passes review and then fails the first
      time somebody adds a query without thinking about companies — which is to say it fails later,
      quietly, on a screen nobody was watching
- [X] T036 Warn before switching with unsaved changes (FR-006)
- [X] T037 **No screen sends a `companyId` to be scoped.** The server resolves and re-validates the
      selection per request. Note this where the switcher writes, so nobody later "fixes" a screen
      by threading an id through it — a second, unvalidated answer to a question the server already
      answers
- [X] T038 Retire `app/ui/settings/company-context.tsx`. It holds the selection in `useState` and
      defaults to the first active company, so a switch there never reaches the server and the UI
      and the data disagree about which company is current. It also **throws** without a provider,
      which already cost a crash this cycle that `tsc` and `next build` both passed over
- [X] T039 [P] Move `app/ui/settings/project-documents-screen.tsx` off `useCompanyContext`
- [X] T040 [P] Move `app/ui/settings/signatories-screen.tsx` off `useCompanyContext`
- [X] T041 [P] Move `app/ui/settings/letter-kinds-screen.tsx` off `useCompanyContext`
- [X] T042 [P] Move `app/ui/documents/company-documents-screen.tsx` off `useCompanyContext`
- [X] T043 [P] Move `app/ui/plant/use-plant-refs.ts` off `useCompanyContext`
- [X] T044 [P] Move `app/ui/assets/use-asset-refs.ts` off `useCompanyContext`
- [X] T045 Delete the stale comments in `app/ui/projects/project-form.tsx` and
      `app/ui/projects/project-documents-panel.tsx` explaining why they avoid `useCompanyContext`.
      The reason they document stops being true in this phase, and a comment describing a hazard
      that no longer exists sends the next reader looking for it
- [ ] T046 **NOT RUN.** Verification: quickstart Scenario 3 in full, **including step 4's cache inspection**.
      SC-006 is an inspection rather than a glance because a stale answer is a plausible answer

### Phase 4 implementation record, 2026-10-01

**"Six screens read it" was wrong — 23 did, plus 14 more through a wrapper hook.** Counted before
touching anything, which is why this is recorded rather than discovered halfway. The provider was
mounted at 11 places and `useCompanyContext` was called in 23 files; `usePlantCompanyId` and
`useAssetsCompanyId` wrap it for a further 14 plant and asset screens.

**Two deviations from the task list, both deliberate.**

*T037, "no screen sends a `companyId`".* True now of every screen that read the provider directly.
It is **not** true of the plant and asset subtrees: `usePlantCompanyId()` and `useAssetsCompanyId()`
survive as the seam and now return `useSelectedCompanyId()` — the server's own answer — instead of the
provider's local state. Re-pointing two functions was the smaller and safer change than editing
fourteen more screens, and the requirement's stated reason no longer applies: the id they send is not
a second, unvalidated answer when it came from the server in the first place, and `companyScope()`
validates it either way. The second source of truth is gone, which is what the phase was for.

*T036, the unsaved-changes warning.* Needed somewhere to read dirty state from, and nothing existed —
the two forms that track `isDirty` guard themselves with `beforeunload`, which never fires for a
company switch because a switch is a client-side state change. `app/lib/unsaved-changes.ts` is a small
opt-in registry and those two forms now register with it. **Coverage is two screens**, and the
confirmation names them rather than claiming to speak for the whole application.

**A state the plan did not account for, found while wiring the switcher.** A cross-company caller who
has never selected a company has selected *nothing*, and the backend then scopes nothing —
`companyScope()` widens for them and every list genuinely spans every company. Nothing comes back
marked `selected` in that state. Showing `companies[0]` would have captioned three companies' figures
with one company's name, which is the precise bug the provider produced; so the unselected state gets
its own "All companies" option that says what is actually on screen.

**Two wrong assumptions about the contract, caught before they shipped.** `selectableFor` returns
`{ id, name, selected }` — no `shortCode`, which a schema demanding it would have thrown on, and a
`selected` flag a schema not declaring it would have stripped on arrival. The second is the same
failure as the permission levels this client discarded for a year (see T004).

**A bug fixed as a side effect.** The provider defaulted to the first active company, so a
cross-company administrator who never touched the selector created recruitment records against
whichever company sorted first. Those writes now derive the company from the session, and a caller
with no selection gets an explicit refusal instead of a silent wrong answer.

**A note on the diff.** An early pass ran `npx prettier --write` over the touched files. There is no
prettier config in this repo, so prettier used its own defaults — double quotes, 80 columns — and
rewrote 2,400 lines of untouched code. It was reverted and the edits redone without it; the commit is
a net reduction, which is what retiring a mechanism should look like. Worth knowing before anybody
else reaches for prettier here.

**Still not run:** T046, quickstart Scenario 3 including step 4's cache inspection. SC-006 is an
inspection rather than a glance because a stale answer is a plausible answer, and nobody has run it.

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

---

## Phase 7: Cash entry controls disappear without the permission (added 2026-10-02)

The web half of the client's cash answer. The api gains a `CASH_ENTRY` permission; this phase makes the
controls it governs vanish for a caller who lacks it.

**Phase 5's premise changed.** It was planned against "hiding is display-only, no control disappears",
which the 2026-10-01 session established from shipped code. The client reversed it on 2026-10-02.
Phase 5's rendering work still stands — blank, never zero — and this phase sits beside it rather than
replacing it.

- [ ] T064 [US3] Read `CASH_ENTRY` through `hasWrite`-style access on the current user, and hide every
      control that records a cash payment behind it. Hide, not disable: a disabled button invites a
      support call, and the client's intent is that the figures and their machinery are not visible at
      all to an office viewer.
- [ ] T065 [US3] Show the labour payment sheet's denomination breakup only to a `CASH_ENTRY` holder. It
      is hidden from everyone today, including the cashier counting notes against it.
- [ ] T066 [US3] **A screen that loses its cash controls must say so**, per FR-014. A payment sheet with
      no way to record a payment and no explanation reads as a broken screen, and the person who meets it
      cannot tell whether to report a bug or ask for access.
- [ ] T067 [P] [US3] Manual pass with and without the permission, both at desktop and 320px. The
      with-permission case matters as much: the whole design exists so a cashier keeps working, and a
      change that hides controls from everybody would pass a test that only checked the restricted view.
- [ ] T068 [US3] Confirm no screen infers cash-entry rights from the hiding setting. They are two
      controls deliberately — one company-wide and about display, one per-caller and about capability —
      and a screen that conflates them reintroduces the company-wide entry block the design rejected.
