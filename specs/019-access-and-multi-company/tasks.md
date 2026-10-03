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

- [x] T012 Audit which modules carry write controls and record the list in this file before
      changing any of them. SC-004 is measured "across every module", and a list assembled while
      editing is a list that quietly omits whatever was edited last
- [x] T013 [P] Gate write controls in `app/ui/hr/` on `canWrite`
- [x] T014 [P] Gate write controls in `app/ui/plant/` on `canWrite` — the client's Note 22 example
      role (logbook entry, nothing else in machinery) is this module, and is what SC-003 measures
- [x] T015 [P] Gate write controls in `app/ui/inventory/` on `canWrite`
- [x] T016 [P] Gate write controls in `app/ui/projects/` on `canWrite`
- [x] T017 [P] Gate write controls in `app/ui/partners/` on `canWrite`
- [x] T018 [P] Gate write controls in `app/ui/labour/` on `canWrite`
- [x] T019 [P] Gate write controls in `app/ui/assets/` on `canWrite`
- [x] T020 [P] Gate write controls in `app/ui/recruitment/` on `canWrite`
- [x] T021 [P] Gate write controls in `app/ui/documents/` and `app/ui/letters/` on `canWrite`
- [x] T022 Gate write controls in `app/ui/settings/` on `canWrite`. Settings is last because its
      own control (Phase 5) is gated by the same mechanism, and getting that backwards locks the
      feature's author out of the setting that configures it
- [x] T023 **Do not gate the approvals surfaces.** Authority to approve comes from the chain's slot
      mapping, not from a permission value — `app/dashboard/approvals/layout.tsx` already records
      this. Note it here so a later sweep does not "finish the job" by gating them
- [ ] T024 **NOT RUN** Verification: sign in as the read-only role and walk every module — quickstart
      Scenario 2. Record the pass, including the 403 replay that confirms the server is the actual
      boundary

---

## Phase 3: The guard reads levels

**Goal**: FR-008, FR-011. **Independent test**: direct URL entry is refused consistently with
feature 014's existing guard, and a user with nothing visible is told so.

- [x] T025 Extend feature 014's module guard to consult `canWrite` for routes that are
      write-by-nature. Extend the existing mechanism; do not add a second guard (FR-016)
- [x] T026 Identify which routes are write-by-nature. **The API already did this work and the
      answer is not "whatever uses POST"**: its T014 found two routes that are writes by verb and
      reads by meaning — `POST /attendance/import/validate` (checks a file, imports nothing) and
      `POST /dashboard/reports/:type/export` (exporting a report is seeing it). Mirror that
      judgement rather than re-deriving it from HTTP verbs
- [x] T027 Render the no-visible-modules message (FR-011) when `visibleModules` is empty. Plainly,
      and naming who to ask — a user seeing an empty shell with no explanation assumes the product
      is broken rather than that their access is pending
- [x] T028 **FR-010 — a permission change reaches the holder on their next load, with no cache
      clear.** Uncovered until now, and it fails in the direction that matters: a user whose write
      access was revoked keeps being offered write controls, and a user newly granted access keeps
      being refused. `['currentUser']` must not be served stale across a reload — refetch it on mount
      rather than trusting a cached entry
- [x] T029 **The service worker is the other half of FR-010** (spec edge case: "navigation cached by
      the service worker from before a permission change"). `app/sw.ts` exists and caches navigation.
      Confirm it does not serve a cached shell whose menu reflects permissions the user no longer has,
      and that a permission change does not require the user to clear site data — which is a thing no
      site worker will ever do and an administrator cannot do for them
- [ ] T030 **NOT RUN** Verification for FR-010: revoke a permission on a signed-in user, reload, and confirm the
      change is reflected without clearing anything. Then grant one back. Both directions, because
      only one of them is the security-relevant one and only the other is the one users complain about
- [ ] T031 **NOT RUN** Verification: direct-URL entry to a refused route, and a user with no modules

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

- [x] T047 Add `getCashVisibility()` and `setCashVisibility(hide)` to `app/lib/api/settings.ts`
- [x] T048 Create `app/ui/settings/cash-visibility.tsx`, present only for `COMPANY_SETTINGS` at
      **write** level (FR-012) — the first real consumer of Phase 1's `hasWrite`. Absent, not
      disabled
- [x] T049 Create `app/ui/hidden-amount.tsx` rendering a field where `amountHidden` is true. A
      stated absence, **never a blank cell and never `0`** — the API returns null rather than zero
      precisely so the two can be told apart, and rendering it as empty throws that away
- [x] T050 Render `amountHidden` wherever a cash amount can appear. Audit by field, not by screen:
      the API decides per row from `paymentMode`, holds no screen list, and the web holding one is
      how the two drift
- [x] T051 **Any total spanning a hidden row must say it is incomplete** (FR-014), rather than
      present a figure that is quietly short by the value of every hidden row in it. This is the
      requirement the retired spec marker was really about
- [x] T052 On a successful setting change, invalidate the affected queries so open screens update
      without a manual reload (FR-015)
- [x] T053 Note that cash **entry** is unaffected — the interceptor "never touches a query or a
      row". No entry control is gated by this setting (Clarifications, 2026-10-01)
- [ ] T054 **NOT RUN** Verification: quickstart Scenario 4 module by module (SC-005), the export, and recording
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

- [x] T064 [US3] Read `CASH_ENTRY` through `hasWrite`-style access on the current user, and hide every
      control that records a cash payment behind it. Hide, not disable: a disabled button invites a
      support call, and the client's intent is that the figures and their machinery are not visible at
      all to an office viewer.
- [x] T065 [US3] Show the labour payment sheet's denomination breakup only to a `CASH_ENTRY` holder. It
      is hidden from everyone today, including the cashier counting notes against it.
- [x] T066 [US3] **A screen that loses its cash controls must say so**, per FR-014. A payment sheet with
      no way to record a payment and no explanation reads as a broken screen, and the person who meets it
      cannot tell whether to report a bug or ask for access.
- [ ] T067 **NOT RUN** [P] [US3] Manual pass with and without the permission, both at desktop and 320px. The
      with-permission case matters as much: the whole design exists so a cashier keeps working, and a
      change that hides controls from everybody would pass a test that only checked the restricted view.
- [x] T068 [US3] Confirm no screen infers cash-entry rights from the hiding setting. They are two
      controls deliberately — one company-wide and about display, one per-caller and about capability —
      and a screen that conflates them reintroduces the company-wide entry block the design rejected.

### Phase 7 implementation record, 2026-10-02

**The phase found a broken screen before it found a missing control.** T064 asked for cash controls
hidden behind `CASH_ENTRY`. Reading the money fields first turned up something worse: every one of
them parsed as `decimal`, a union of number and string, and the backend's hiding interceptor
replaces a cash row's amount with **`null`**. So for any company with hiding switched on,
`paymentSchema.parse` threw and the payments list did not render a blank amount — it did not render
at all. One cash disbursement did the same to a whole payment sheet, through the nested
`deductionSchema`.

That is the **fourth** time this cycle the server and these schemas disagreed about a field, after
`ApiError.details`, the project-document `missingTypeIds` and `grants` — and the first where the
disagreement broke a screen instead of quietly dropping something. `hideableDecimal` and
`amountHidden` in `app/lib/api/cash-hiding.ts` are the fix, applied **only** to the fields the
interceptor can actually reach: widening every money field to nullable would conceal the next
genuine null, and a missing figure and a concealed one are different facts.

**A hidden figure now reads "Hidden", not an em dash.** `rupees(null)` already produced an em dash,
which is what these screens show for *no amount recorded*. Leaving it would have meant a reader
could not tell a concealed payment from an unrecorded one — and `amountHidden` is exactly the field
the backend added so they could.

A nulled deduction is not summed as zero. Summing it would understate the column by the value of
every concealed deduction, which is the arithmetic the backend nulls rather than zeroes to prevent;
a column with any hidden row shows "Hidden" instead.

### Two rights, not one

`CASH_ENTRY` carries both levels and `app/lib/cash-entry.ts` exposes them separately:
`mayEnterCash` (write — record a cash payment) and `maySeeCashBreakup` (either level — see a
denomination breakup). A supervisor checking a payout against the notes needs the second and not the
first. `useCashRights` shares the `['currentUser']` query key all 45 existing call sites use, so it
adds no request.

### T068: nothing infers one control from the other

Confirmed by grep: `hideCashTransactions` appears in exactly one place in this client — the comment
in `cash-entry.ts` saying nothing may read it. The two controls stay separate, which is the whole
point of the two-control design.

**One deliberate divergence.** The backend hides the breakup from a non-holder *only when hiding is
on*; this client hides it from a non-holder regardless. Being stricter about display costs nothing —
it never shows something the server concealed — and the alternative is for the client to read the
company's hiding setting, which is precisely what T068 forbids. Recorded here rather than resolved
silently.

### What was hidden, and what was not

The `cash` option disappears from the inventory payment modal and the labour disburse modal — the
option, not the form, because a non-cash payment must stay recordable. Hidden and not disabled, per
T064: a disabled control invites a support call.

Each screen that loses a control says so, naming the permission (FR-014, T066). "Ask an
administrator" sends somebody to ask for they-know-not-what.

The disburse modal defaults to `bank` for a non-holder. It defaulted to `cash` unconditionally,
which would have left the form arriving in a state its viewer could not submit.

**T067 NOT RUN** — the manual pass with and without the permission, at desktop and 320px. This
repository has no test framework (`TODO(TESTING_STANDARD)`), so `tsc`, `eslint` and `next build` are
the automated verification: all three clean.

### Phases 2, 3 and 6 implementation record, 2026-10-02

#### T012 — the audit, before anything was changed

Files carrying a `useMutation`, by module:

| Module | `app/ui/<module>` | `app/dashboard/<module>` |
|---|---|---|
| hr | 19 | 0 |
| plant | 11 | 6 |
| inventory | 7 | 5 |
| projects | 3 | 3 |
| partners | 5 | 4 |
| labour | 0 | 7 |
| assets | 5 | 2 |
| recruitment | 2 | 7 |
| documents | 1 | 0 |
| letters | 0 | 0 |
| settings | 13 | 0 |

**Roughly a hundred files, and that number is what decided the design.** Gating each control
individually would have been a hundred opportunities to name the wrong permission, silently: naming
one the caller happens to hold looks exactly like naming the right one, and nothing in a build or a
lint run can tell them apart. There is no test framework here to catch it either.

#### What was built instead: resolve the area from the route

`app/lib/write-access.tsx` answers "may the person on this screen write here" with no argument from
the caller. Every module has published its own section-to-permission map since it was built, to gate
its own tabs — `PLANT_PERMISSIONS`, `HR_PERMISSIONS`, and seven more — so the mapping already
existed and was already being kept correct for a reason unrelated to this.

**Section before module, longest prefix wins.** Plant is why, and it is also the client's own
example of what they asked for in `bugs.md` item 19: site staff who may enter logbook and diesel
readings and touch nothing else in machinery. `MACHINERY`, `LOGBOOK`, `FUEL`, `MAINTENANCE` and
`HIRE_BILLS` are five permissions inside one module, and a module-level answer gets that case wrong
in both directions at once.

#### The default inverted, which is the whole of T013 to T022

`Button` and `RowAction` are now **write-gated by default**, with `intent="read"` for the exceptions.
Of 147 `Button` call sites one changes nothing; of about 70 `RowAction` call sites seven only look.
So the work became marking eight controls rather than wrapping two hundred and sixteen, and the
failure mode moved to the safe side: forgetting `read` hides a harmless control, where forgetting a
wrapper would have left a destructive one on screen for somebody who may not use it.

`SecondaryButton` is deliberately **not** gated. It is overwhelmingly Cancel and Close inside modals
that a reader cannot open in the first place, and gating it would have made those modals
un-dismissable in the one case where one did open.

Removed, never disabled, per FR-007.

#### Two exclusions, both deliberate

**The approvals surfaces** (T023): authority to approve comes from the chain's slot mapping, not
from a permission value. They sit outside every `guardPrefix`, so "no module claims this route" and
"deliberately ungated" are one condition rather than two that have to be kept in step.

**My Workspace**: an employee punching in is writing, and those endpoints carry no permission at all
on the server — they are `@SelfService()`, answerable to who the caller is. Gating them on
`MY_WORKSPACE` at write level would have taken the punch button away from the employees the module
exists for.

#### T025, T026 — write-by-nature routes

Two: `/dashboard/projects/portfolio/new` and `/dashboard/hr/employees/new`. Everywhere else creation
happens in a modal reached from a now-gated control, so the list is short by construction.
`/dashboard/account-creation/new` is deliberately absent — it is how an account comes to exist, under
no module, governed by role.

Not derived from HTTP verbs, per T026: the backend's audit found two routes that are writes by verb
and reads by meaning, and that judgement is mirrored rather than re-derived. The check extends
`ModuleGuard` rather than adding a second guard (FR-016) — two guards deciding the same question is
how they come to disagree.

#### T028 — the stale-permission window was real

`['currentUser']` inherited the client's 30-second `staleTime`, which is right for settings data and
wrong for the field that decides every guard, every hidden control and every section tab across
roughly 45 components. `setQueryDefaults(['currentUser'], { staleTime: 0, refetchOnMount: 'always' })`
in `app/providers.tsx` — set once rather than at 45 reads, because a rule that must be remembered at
each read is already broken somewhere.

`refetchOnMount: 'always'` rather than a shorter window, because the risk is not age: it is a mount
that trusts the cache. The cached value still renders immediately, so the cost is one background
request per navigation.

#### T029 — the service worker was already correct

`app/sw.ts` routes everything cross-origin or under `/bff` to `NetworkOnly`, ahead of
`defaultCache`'s catch-all. So no API response is ever cached, `['currentUser']` included. The app
shell *is* precached — but the shell is a bundle that renders the menu from a live `['currentUser']`
fetch, not a snapshot of one. **No change needed, and recorded rather than asserted**, because the
reason it is safe is a rule in a different file that a future caching change could undo.

#### T047 to T053 — the toggle `bugs.md` item 16 actually asked for

It did not exist in this client at all. The API has had `GET`/`PATCH /settings/cash-visibility`
since 019 Phase 5; nothing called it, so the client's "add a toggle to hide all cash payment
entries" was unreachable from the product.

`app/ui/settings/cash-visibility.tsx` is one component in two shapes: a compact toggle in the shell
header, because the client said "in the main menu" and the situation it is for is situational —
somebody walks into the room — and a panel on Settings → Companies, where somebody goes looking for
it and where there is room to say what it does. One component rather than two, so the two cannot
disagree about what the switch currently says. Present only for `COMPANY_SETTINGS` at **write**
level, and absent otherwise: a disabled switch would tell every reader in the company that the
figures in front of them can be concealed.

On success the whole query cache is invalidated (T052), not a list of cash-holding modules: the API
decides per row from `paymentMode` and keeps no screen list, and a list kept here is how the two
drift.

T053 confirmed: nothing gates a cash *entry* control on this setting. The one control that depends
on it is the denomination breakup's visibility, which depends on `CASH_ENTRY` instead.

#### Verification

`npx tsc --noEmit`, `npx eslint app` (0 errors) and `npm run build` all clean.

**T024, T030, T031, T054 NOT RUN** — all four are browser passes against a running API with
specific roles provisioned. This repository has no test framework (`TODO(TESTING_STANDARD)`), so
there is no automated stand-in for them, and saying so is more useful than implying otherwise.

---

## Phase 8: Amendment of 2026-10-03 — setting the levels, not just honouring them (FR-018 – FR-021)

Appended, not renumbered. T001–T068 above are shipped and their numbering is referenced from commit
messages and from the api repository's task files.

**Why this exists.** Every requirement in this feature until now is about honouring the read/write
distinction, and none is about setting it. The role editor offers one checkbox per area, and the
backend's rule that a role naming no levels gets read **and** write — correct as a migration
default, so no existing role changed meaning — makes that silent. The half that refuses works
perfectly; the half that configures was never built, so Note 22's own example could be produced
only by calling the API directly.

**Backend dependency**: api `aaa850d` (2026-10-03) — `grants` now comes back on every role read. It
was writable since Phase 1 and readable nowhere, which is why the screen had nothing to render.

- [X] T069 Read `grants` on the role schema in `app/lib/api/settings.ts` (FR-019)

      Done 2026-10-03, with `.default([])` so a server predating the field still parses — an empty
      list means "no levels named", which is exactly what the backend treats as read+write.

- [X] T070 Send `grants` from `createRole` and `updateRole` (FR-018)

      Done, and **always sent**. Omitting it means read and write on everything, so a role narrowed
      on this screen would silently widen again on the next save that left it out.

- [X] T071 Offer each granted area at read-only or read+write, seeded from the role's current grants

      Done. The level appears only under a ticked area: an area nobody has granted has no level to
      choose, and a disabled pair of radios against every unticked row turns a nine-item list into
      twenty-seven controls to read past.

      **An area absent from `grants` seeds as writable**, not read-only. That is what the backend
      does with a role that named no levels, and every role predating the split is in that state —
      seeding read-only would narrow every existing role the first time somebody opened it to
      rename it.

- [X] T072 Make write imply read (FR-020)

      Done structurally rather than by validation: `grantsFor` emits both rows for a writable area,
      so there is no control that can express write-without-read. The backend refuses it anyway —
      confirmed against the running API, which returns `WRITE_WITHOUT_READ` — but a form whose only
      protection is the server's refusal is a form that shows somebody an error for a state it
      offered them.

- [X] T073 Word the choice in terms of what a holder can do (FR-021)

      Done: "View only" and "View and change", with what each means underneath. An administrator
      here is deciding whether somebody can change records; "read" and "write" are this system's
      words for that, not theirs, and using them makes the safer option sound like the technical one.

- [X] T074 An area that is unchecked carries no level

      Done — unticking clears the level rather than leaving an orphan the next save re-sends.
      Ticking grants view **and** change, which is what every role held before levels existed: the
      narrower choice should be deliberate, not one somebody trips into.

- [X] T075 Verification: create a role with view-only machinery and read it back — Note 22's own
      example

      **Run against the real API** on 2026-10-03, on a spare port: `Site Logbook Clerk` created with
      `MACHINERY` at `read` only, and read back from the list with that grant intact. Before this
      change the same request from the interface produced a role holding read **and** write.

      The second half — signing in as that role and confirming the logbook is readable while nothing
      in machinery is editable — is **NOT RUN**: it needs a browser and a provisioned user. The
      guard enforcing it is covered by api tests; what was missing was never the enforcement.

#### Verification

`npx tsc --noEmit`, eslint on the touched files and `npm run build` all clean. The api half is
`aaa850d`.
