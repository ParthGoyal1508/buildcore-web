# Tasks: Approval Spine (Web)

**Input**: Design documents from `/specs/016-approval-spine/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/action-review.md](./contracts/action-review.md)

**Tests**: **No test framework is installed** — a standing constitution constraint
(`TODO(TESTING_STANDARD)`). **No test-file tasks appear below.** Verification is `npm run lint`,
`npx tsc --noEmit`, `npm run build`, and the ten manual passes in [quickstart.md](./quickstart.md).

**Cross-repo dependency**: every task here consumes `buildcore-api`'s 016 endpoints. The web half
cannot be verified before the backend's Phase 1 and Phase 2 are deployed locally.

**The thing that makes this feature work**: sameness. One component, used identically everywhere. A
task that adds a module-specific variant has failed even if it passes review.

---

## Phase 1: Foundational — the typed boundary

- [X] T001 Create `app/lib/api/approvals.ts` with `zod` schemas for `ApprovalState`,
      `DecisionHistoryEntry`, `ApprovalQueueEntry` and `ApprovalCount` per
      [data-model.md](./data-model.md), parsed at the boundary (Principle IV)
- [X] T002 (FR-014) Add the typed calls: `decide()`, `history()`, `queue()`, `queueCount()`. **All access to
      approvals goes through this module** (Principle V); no component may call `fetch`
- [X] T003 [P] (FR-015) Add `APPROVAL_ACTIONS`, `APPROVAL_INERT_MESSAGES` and
      `APPROVAL_QUEUE_AGE_WARNING_HOURS` to `app/lib/constants.ts` (Principle III). Four inert
      messages, keyed by code — the `slot_unmapped` one names the settings screen, because it
      describes a fault rather than a state

---

## Phase 2: US1 — One control, everywhere, identical (P1)

**Goal**: a reviewer learns the control once.

**Independent test**: open a reviewable item in three modules; the control is in the same place,
offers the same choices, reads the same way.

- [X] T004 [US1] (FR-001, FR-002) Create `app/ui/approvals/action-review.tsx` implementing
      [contracts/action-review.md](./contracts/action-review.md). Props are `state`, `onDecide`,
      `entityLabel`, `size`. **Module identity is deliberately not a prop** — it is what would let
      one module diverge
- [X] T005 [US1] (FR-003, FR-003a) Render the four inert states as four distinct messages
      (research.md §2). The states come from the backend's `inertReason`; this app computes none of
      them. A Super
      Admin who already decided must read "You approved this at {level}", **never** "you do not have
      permission" — that is untrue, and it sends the one person who can change permissions to go and
      change them
- [X] T006 [US1] Branch on `inertReason` and the backend's error codes, never on message text — the
      contract feature 015 established with `SESSION_EXPIRED`
- [X] T007 [US1] (FR-004) Require a reason inline for reject and return; do not send without one
- [X] T008 [US1] (FR-005) Disable during flight with visible progress, so repeated clicks produce
      exactly one request
- [X] T009 [US1] **Preserve the typed reason across a failed submission** and allow retry without
      retyping (spec FR-006). Losing a paragraph of justification to a dropped connection is how
      people stop trusting a system
- [X] T010 [US1] (FR-007) Ensure a failed decision throws to the caller and never navigates away — only a 401
      from renewal ends a session (feature 015; restated because losing a screen mid-review is
      exactly the regression worth guarding)
- [X] T011 [US1] (FR-003b) Use the server-supplied `levelLabel` and `awaitingUserName` everywhere
      authority is described. **No role name may be written in this application** — the two companies may map the
      same slot differently, so a hardcoded name is right for one and silently wrong for the other
- [X] T012 [US1] Mount the control on attendance exceptions in `app/dashboard/hr/attendance/`, the
      first and only consumer in this phase

**Checkpoint**: quickstart Passes 1, 2, 3 and 4 hold. Pass 2 is the one worth doing twice.

---

## Phase 3: US2 — The record says who last touched it (P1)

- [X] T013 [US2] (FR-008) Create `app/ui/approvals/last-action.tsx` rendering the latest action,
      actor and time from `state.latestAction`
- [X] T014 [US2] (FR-009) Create `app/ui/approvals/decision-history.tsx` as a **disclosure on the
      record**,
      not a link to a separate page — the requirement is that the answer is in that place
      (research.md §6)
- [X] T015 [US2] Show a returned-and-resubmitted item's earlier decisions too, with `returnCount`
      visible; the history must show that the item went round
- [X] T016 [US2] Render nothing that implies an action on an item never acted on — its state reads
      as awaiting a first decision
- [X] T017 [P] [US2] Place `<LastAction>` in the attendance exception list and detail views
- [X] T018 [US2] Ensure the actor survives dense-table treatment at 320px: with the existing
      `ResponsiveList` card fallback or an `overflow-x` container, the actor must remain
      discoverable. Attribution truncated away entirely fails the requirement at exactly the width
      where it is most likely to be read in a hurry

---

## Phase 4: US3 — One place that shows what is waiting (P2)

- [X] T019 [US3] Create `app/dashboard/approvals/page.tsx` with a `layout.tsx` module guard,
      following the feature 014 pattern
- [X] T020 [US3] (FR-010, FR-011) Create `app/ui/approvals/queue-table.tsx` showing module,
      subject, requester and age, with the decision takeable from the row
- [X] T021 [US3] Distinguish items older than `APPROVAL_QUEUE_AGE_WARNING_HOURS` visually
- [X] T022 [US3] (FR-006) Say plainly when the queue is empty rather than rendering a blank screen
- [X] T023 [US3] (FR-013) Invalidate the queue and count on a successful decision so the item
      leaves without a manual refresh; refetch on window focus (research.md §4)
- [X] T024 [US3] (FR-012) Add the pending count to `app/ui/dashboard/sidenav.tsx`, **reusing the existing
      reminder-badge mechanism** rather than adding a second one (Principle III)
- [X] T025 [US3] Back the badge with `queueCount()` only — it appears on every screen and must not
      pull the whole queue for a number

**Checkpoint**: quickstart Passes 5 and 6.

---

## Phase 5: Verification

- [X] T025a (FR-016) Confirm no inline styling was introduced in any approval component
      (Principle II) — a review item, not a lint rule, since nothing enforces it automatically
- [X] T026 [P] `npx tsc --noEmit`
- [X] T027 [P] `npm run lint` — expect 0 errors and the 2 pre-existing unused-var warnings in
      `account-creation.ts` and `assets.ts`. Prettier is **not** safe to run repo-wide here
- [X] T028 `npm run build`
- [X] T029 Quickstart Pass 7: grep the approval surfaces for hardcoded role names; expect nothing
- [X] T030 Quickstart Pass 8: open a 50-item list and confirm **one** approval-state request in
      Network, not fifty. This is the mistake the batch contract exists to prevent, and it will not
      be noticed until a list gets long in production
- [X] T031 Quickstart Pass 9: every approval surface at 320px under constitution v2.1.0 — nothing
      clipped, no control unreachable, the page body not scrolling horizontally. **No screen in this
      product has ever been checked at that width**, so expect findings rather than confirmations
- [X] T032 Quickstart Pass 10: repeat Passes 1, 3 and 5 in **Safari**, where session and cookie
      behaviour differs most and this product has been bitten before
- [X] T033 Work quickstart Passes 1–6 in order

---

## Dependencies

```
T001 ─▶ T002 ─▶ everything   (nothing renders before the typed boundary exists)
T003 ─▶ T005                 (messages before the component that shows them)

T004 ─▶ T005 ─▶ T006 ─▶ T007 ─▶ T008 ─▶ T009 ─▶ T010 ─▶ T011 ─▶ T012
        (all one file, app/ui/approvals/action-review.tsx — sequential)

T013, T014 ─▶ T015, T016 ─▶ T017 ─▶ T018
T019 ─▶ T020 ─▶ T021, T022 ─▶ T023 ─▶ T024 ─▶ T025
```

US1, US2 and US3 are independent of one another once Phase 1 is done, and may be built in any order.

## Parallel opportunities

- T003 — constants only, no component depends on it until T005.
- T017 — different files from T013/T014.
- T026, T027 — independent checks.

T004–T012 all touch `action-review.tsx`: **not** parallel despite belonging to one story.

## MVP scope

**Phase 1 + Phase 2 (T001–T012)** is the minimum that delivers the client's Note 6 — one control, in
one module, behaving correctly. Phases 3 and 4 make the chain legible and timely; neither is optional
in practice, only separable.

## What no task here can cover

There is no test framework, so every guarantee in this file rests on somebody running the manual
passes. **T030 and T031 are the two most likely to be skipped and the two whose absence costs most**
— an N+1 that only bites in production, and a responsive floor nothing in this codebase has ever been
measured against.

---

## Implementation note — 2026-09-14

**T001–T029 are done and committed. T030–T033 are not, and cannot be by me** — they require a
browser, a 320px viewport and Safari. They are left unchecked rather than marked on the strength of
reasoning, because the whole value of a manual pass is that somebody looked.

Verification that did run: `npx tsc --noEmit` clean, `npm run lint` **0 errors** and exactly the two
pre-existing unused-var warnings T027 predicts, `npm run build` clean with `/dashboard/approvals`
emitted as a static route.

### Every schema was checked against a live API, and four things had drifted

`app/lib/api/approvals.ts` carries a comment saying its schemas were checked against live responses.
That is literally true: the API was booted locally, fixtures were created, and every payload below
was captured and parsed through the shipped schemas — queue page, count, attendance-exception rows
(with an embedded approval state) and history. All four parse.

Doing it found four places where this feature's own `data-model.md` and the shipped backend disagree.
In every case the backend won, because the backend is what the browser receives:

1. **`inertReason` is `insufficient_authority`, not `not_authorised`.** Branching on a value the
   server never sends would have rendered every unauthorised control as a blank.
2. **The latest act arrives as `latestDecision`, not `latestAction`.**
3. **`levelLabel` is nullable** — null once the chain has finished. Typed as a bare string it parses
   fine on a pending item and throws on the first approved one, which is the worst kind of schema
   bug: it passes every test you thought to write.
4. **`href` is nullable** on both the state and the queue row. A module with no screen for its item
   supplies none.

`data-model.md` was left as written. It is a design artifact recording what was intended; the code
records what is true, and says where they differ.

### The queue was fabricating data, and the fix was to narrow the prop

The first version of `queue-table.tsx` built a full `ApprovalState` to hand to `<ActionReview>`,
inventing `totalLevels`, `round` and `returnCount` to fill the shape. Every one of those was a number
the browser did not know, presented as though it did — and the day the control started reading one,
the queue would have lied quietly.

`<ActionReview>` now takes `ActionReviewState`: a structural subset of exactly what it reads, with
`currentPosition` and `totalLevels` **optional**. A module passes its full state unchanged; the queue
passes the five fields it actually has. The "level 2 of 3" line renders only when both are present,
because a queue row knows its position and not the chain's length.

### `/dashboard/approvals` deliberately has no permission guard

T019 says "with a `layout.tsx` module guard, following the feature 014 pattern". Following that
literally would have been wrong, and the layout says why in place of doing it.

**There is no permission that grants the right to approve.** Authority comes from holding the role a
chain's level is mapped to — `buildcore-api`'s `/approvals/*` endpoints carry no
`@RequirePermissions` for exactly that reason. A site engineer holding only `ATTENDANCE` may be the
first approver on every attendance exception in the company, and a permission gate would hide their
own queue from them. The queue is per-caller by construction: the server returns only what this user
may act on, which is a better guard than a permission check because it cannot drift out of step with
the chain configuration.

`ApprovalBadge` follows the same rule — no `enabled:` gate, unlike `ReminderBadge`'s `DASHBOARD`
check — and hides itself when the count is zero. Approvals is a queue, not a destination: a permanent
"Approvals 0" trains people to read past it, and the week it says 3 they will read past that too.

### What the attendance exceptions screen became

It was read-only, on the stated reasoning that resolving an exception belonged on the punch itself.
That reasoning was right for a single-step confirmation and is wrong for a chain: an exception now
travels Site / Employer → HR → Director, and the people at levels two and three have no interest in
the punch screen. It now lists each flagged punch with its level, its last action, a history
disclosure, and the shared control.

The endpoint moved with it — `/workspace-admin/attendance-exceptions` returns `{ punch, approval }`
with the approval state resolved in one batch, so a fifty-row list costs one request rather than
fifty. `approval` is nullable and the null case is real: a punch flagged before this feature shipped
has no instance, and the row reads "Not in a chain" instead of an empty cell that looks like nothing
to do.

### What is not built, and it is the thing that blocks deployment

**There is no settings screen for slot mappings, and no task in this file creates one.** The 33 tasks
cover the reviewer-facing surfaces only; the spec names the settings screen in an inert message
(T003) and nowhere else.

This matters more than it looks. Until an administrator maps `first_approver`, `hr` and `final` to
roles, **every attendance exception in every company is undecidable and no payroll run can produce a
bank transfer sheet.** That is not a hypothetical: the local development company has all three slots
unmapped right now, and the live capture used to verify these schemas shows
`inertReason: "slot_unmapped"` on a real flagged punch.

The backend endpoints exist — `GET`/`PUT /approvals/slot-mappings` and `GET`/`POST`/`PUT`/`DELETE
/approvals/chains`, all guarded by `SETTINGS`. What is missing is a page that calls them. Until there
is one, slots are mapped by calling the API directly, and `APPROVAL_INERT_MESSAGES.slot_unmapped`
says so rather than pointing at a screen that does not exist.

**This should be the next piece of work on this feature.**

### Fixtures left in the local development database

Verifying against a live API meant creating rows. They are still there:

- one `PunchRecord` for a seeded employee, dated today, `geofenceResult: exception`,
  `exceptionResolution: pending`, with its `attendance_exception` approval instance;
- two `payment_release` approval instances (one `returned`, one `pending`);
- a `final` → Super Admin slot mapping for the development company.

`prisma/seed.ts` clears punches, so a reseed removes the first. The rest are harmless and are what
makes the approvals queue non-empty for whoever runs T033.

---

## Phase 6: Approval settings — added after the fact, 2026-09-14

These were not in the original task list, and their absence was the gap the note above
identified: the 33 tasks built every reviewer-facing surface and nothing that could
**configure** one. Until the slots are mapped, none of those surfaces can do anything.

- [X] T034 Add the chain and slot-mapping calls to `app/lib/api/approvals.ts` —
      `getApprovalChains()`, `getSlotMappings()`, `putSlotMapping()`, with `zod` schemas
      parsed at the boundary (Principle IV, Principle V)
- [X] T035 Add `approvals` to `SETTINGS_PERMISSIONS` (`SETTINGS`, matching the backend's own
      guard), `ROUTES.settingsApprovals` and `SETTINGS_SECTIONS`, so the section appears in
      the index tiles and the tab strip through the one definition both already read
- [X] T036 Create `app/dashboard/settings/approvals/page.tsx` and
      `app/ui/settings/approval-settings.tsx`: one role dropdown per slot, saved on change
- [X] T037 Show the count of unmapped levels before the form, not beside a row — somebody
      arriving here after being told "nobody can approve this yet" needs the scale of what
      is missing, not an empty dropdown to hunt for
- [X] T038 Surface the `APPROVAL_CHAIN_UNSATISFIABLE` refusal **verbatim**. It names the two
      conflicting levels, and that naming is the entire value of the guard
- [X] T039 List the company's chains read-only, each level showing the role it currently
      resolves to, with unmapped levels flagged

## Implementation note — Phase 6, 2026-09-14

`npx tsc --noEmit` clean, `npm run lint` 0 errors (the same two pre-existing warnings),
`npm run build` clean with `/dashboard/settings/approvals` emitted.

### Verified against a live system, and the loop closes

The four exported approval calls were run **unmodified** against a running API — the real
functions, the real schemas, the real responses. `getSlotMappings`, `getApprovalChains`,
`getApprovalQueue` and `getApprovalCount` all parse.

More useful than the parse: the state transition this whole feature was blocked on was
driven through the endpoint this screen calls, and observed on a real flagged punch.

| | before mapping | after mapping |
|---|---|---|
| `inertReason` | `slot_unmapped` | `insufficient_authority` |
| `awaitingHolderCount` | 0 | 2 |

Before, the control renders the amber fault: "Nobody can approve this yet: no role is
mapped to Site / Employer for your company." After, it renders the ordinary grey state:
"First approver decides this" — correct, because the signed-in account is a Super Admin
mapped to `final`, not to level 1.

The FR-021b guard was exercised too, by deliberately mapping `hr` to the same role as
`final`:

> Chain "attendance_exception" would become unsatisfiable: level 2 (HR) and level 3
> (Director) would both resolve to the same role. One person cannot approve the same item
> twice, so any item entering this chain would stall at level 3 whenever a single person
> holds that role.

That is shown verbatim. A generic "could not save" would throw away the only part of the
message that says what to do about it.

### Saved one slot at a time, deliberately

The endpoint takes one slot per call, and the screen matches it rather than batching. A
bulk save would either half-apply — a settings form that partly succeeded — or have to
report which member of the batch was refused, which is the same single-slot message with
extra steps. Saving on change rather than behind a Save button follows from the same
thing: each write is independently valid or independently refused.

There is no "unset" option in the dropdown. The backend has no delete for a mapping, and
offering a control that silently did nothing would be worse than not offering it.

### What is still not built

**Chain definition is read-only here.** `POST`/`PUT`/`DELETE /approvals/chains` exist and
are guarded, but this screen only lists chains. That is a deliberate scope call rather than
an oversight: the *blocking* problem was that slots could not be mapped from the product,
and chain editing is a larger surface — ordered levels, contiguity, final-authority
placement, the unsatisfiability check running in both directions — that nothing currently
needs. Every company gets working default chains from the backend's seeder, and the
read-only list is enough to see what they are and whether they are staffed.

Worth building when a company first wants a chain shape other than the default. Not before.

### The manual passes are still not run

T030–T033 remain unchecked, and this phase adds no browser verification of its own. The
screen builds, its types check, and every call it makes has been proven against a live API
— but nobody has looked at it.

---

## Phase 7: Convergence

Appended by `/speckit-converge` on 2026-09-14 against tip `326e849`. Two gaps, one of which the
web half creates and the backend cannot currently resolve.

- [X] T040 **CRITICAL** Give the user a way out of `returned` (missing; traces to backend FR-005 via
      this spec's FR-002). `APPROVAL_ACTIONS` in `app/lib/constants.ts:1864` offers "Return for
      correction", and FR-002 requires it — so the product actively manufactures the `returned` state.
      But `app/lib/api/approvals.ts` exports no resubmit call, and the originator has no affordance
      anywhere to send a returned item back up the chain. Returning an item is currently a one-way
      trapdoor (see buildcore-api T061 for why: `returned` is a live state whose only exit is a service
      method with no HTTP route). **This task is blocked on buildcore-api T061** — there is nothing to
      call until that endpoint exists. When it does: add `resubmitApproval()` to the typed module
      (Principle V), and surface it to the originator on the record, with its copy in the constants
      module (FR-015). Note that `ActionReviewState` has no notion of "you raised this and it came
      back" today — `inertReason` has four values and none of them is that — so the shared control
      needs a state for the originator, not just for approvers.
- [X] T041 **HIGH** Make the queue and count reflect decisions taken elsewhere per FR-013 and SC-005
      (partial). FR-013 says both "MUST reflect decisions taken elsewhere without a manual reload" and
      SC-005 says the count "matches the queue contents at all times". Today invalidation is wired at
      all three decision sites (`queue-table.tsx:76`, `exceptions-modal.tsx:81`,
      `approval-settings.tsx:69`), which covers *the current user's own decision in the current tab* —
      but nothing else. `app/providers.tsx:25` sets `refetchOnWindowFocus: false` globally and neither
      `ApprovalBadge` nor the queue sets a `refetchInterval`, so a decision by another approver, in
      another tab, or on another device never arrives; a manual reload is the only way. This collides
      directly with FR-021 (two approvers at one level must not both decide): both see the item, the
      first decides, and the second's queue still shows it — they click approve and get a refusal they
      have no way to have anticipated, which is the exact confusion FR-013 exists to prevent. Add a
      `refetchInterval` to the count query at minimum (the badge is cheap and mounted everywhere);
      decide separately whether the queue itself polls or refetches on focus, and record the interval
      in the constants module rather than inline.

### Implementation note — T040, T041, 2026-09-14

**T041 is done, and my finding overstated it.** I wrote that neither the badge nor the
queue refetched. The queue does: `queue-table.tsx` sets `refetchOnWindowFocus: true`
locally, overriding the global default, and a queue left open on a second monitor was
already refreshing when the tab regained focus. The real gap was the **badge** alone, and
it is the worse half — it is mounted on every screen, so the reader is usually *not*
looking at approvals and focus would never fire while they worked elsewhere in the app.
It now polls on `APPROVAL_COUNT_POLL_MS` (60s) and also refetches on focus.

**T040 is only half done, and the half that is missing is a screen that does not exist.**

Built and verified: `resubmitApproval()` in the typed module, `canResubmitNow` on the
state schema, and the originator's branch in `ActionReview` — checked *before* the inert
branch, because a returned item carries no `inertReason` and would otherwise fall through
to `return null` and vanish. Copy is in the constants module. The exported function was
run unmodified against a live API: a returned item came back `pending`, round 2, with
`canActNow: true` for the caller, and a second call was refused `APPROVAL_NOT_PENDING`.

What is missing is a **call site**, and not by oversight. `ActionReview` has two: the
approvals queue and the HR exceptions modal. Neither can ever be the right home:

- The queue lists items awaiting *you as an approver*. A returned item you raised is by
  definition not one of those.
- The exceptions modal is an administrator's screen. For the only module on the spine,
  `punch.service.ts` sets `originatorUserId` to the **employee who punched** — so the
  originator is a worker, and an administrator opening that modal is never the person who
  can resubmit. The admin does still see what happened, via `<LastAction>` on the row.

The employee's own workspace under `app/my/` has no approval surface at all — it never
tells a worker their punch was flagged, let alone returned. That screen is the remaining
work, and it is a new surface rather than a wiring change, which is why it is not folded
into this note as done. Until it exists, an approver who returns an attendance exception
is returning it to somebody who will never be shown it.

- [X] T042 Give the employee a view of their own flagged punches under `app/my/`, showing
      each punch's approval state and the resubmit affordance when `canResubmitNow` is
      true. The control, the typed call and the copy all exist; what is missing is a route,
      a list, and a module endpoint the employee may call for their *own* punches (the
      current `workspace-admin/attendance-exceptions` list is permission-guarded for
      reviewers and returns the whole company). Without this, `return` remains a decision
      nobody downstream can act on for the one module currently on the spine.

### Implementation note — T042, 2026-09-14

T040 and T042 are both done; T040 was only ever waiting on a call site, and this is it.

`GET /my/punch/exceptions` (buildcore-api, `PunchService.listMyExceptions`) and
`PunchExceptions` on the existing **Punch** page. Not a new bottom-bar tab: that bar
already carries six targets and its own comment notes they share the width of a phone, so
a seventh would crowd it — and a flagged punch belongs in the worker's attendance section
anyway. Placed above the month's history, because a section a worker has to scroll past
the calendar to find is one they will not find.

Verified live, with the real exported functions against a booted API, logged in as an
actual employee rather than an admin:

```
rows parsed: 2
target  → state: returned, canActNow: false, inertReason: null, canResubmitNow: true
resubmit → state: pending, round 2
after    → state: pending, canResubmitNow: false
```

That first line is the whole point: `canActNow: false` with a null `inertReason` is what
used to render as nothing at all, so the punch was invisible to the only person who could
move it.

**One thing found and deliberately not changed.** `decide()` has no originator check, so
an employee who happened to hold the first-approver role could approve their own flagged
punch. That is pre-existing and independent of this screen — they could already do it
through the admin exceptions modal with `ATTENDANCE` permission — and whether an
originator may decide their own item is a policy question the spec does not answer.
FR-021a forbids deciding *twice*, not deciding on what you raised. Worth putting to the
client rather than quietly deciding here.

Still not run: T030–T033, the browser passes. Nobody has opened this screen.

### Implementation note — T030, T031, T032, 2026-09-14

Run with Playwright (already installed globally) driving **Chromium and WebKit** against a
production build (`npm run build && npm start`) and the real API. Not the dev server: see
the false readings below.

**T030 / Pass 8 — the batch contract holds at scale.** 50 pending approvals created for
one user. The queue rendered 25 rows (one page) from exactly **one** `/approvals/queue`
request. The exceptions modal made one list request and **zero** per-row approval-state
requests — `statesOf` is doing its job. This is the N+1 the contract exists to prevent and
it is not there.

**T031 / Pass 9 — 320px. All four 016 surfaces pass; one page fails and it is not ours.**
Measured by actually scrolling the page (`window.scrollTo(2000,0)` then reading
`scrollX`), because `documentElement.scrollWidth` reports overflow for content correctly
contained in an `overflow-x-auto` scroller and gave false failures.

| surface | scrollX | verdict |
|---|---|---|
| Approvals queue | 0 | ok |
| Approval settings | 0 | ok |
| Exceptions modal (dialog itself: 320px wide, 0 uncontained overflow) | — | ok |
| `/my/punch` — after the fix below | 0 | ok |
| `/dashboard/hr/attendance` (page chrome) | **309** | **FAIL** |
| Dashboard home, HR employees (controls) | 0 | ok |

The control pages passing matters: this is not an app-wide 320px failure, so the one that
fails is a real, specific defect.

- **Fixed**: `app/ui/my/attendance-history.tsx`. Its month stepper plus the "Attendance"
  heading measured 354px against 320 and pushed the body sideways. Pre-existing, but
  `/my/punch` only became an approval surface when T042 put `PunchExceptions` on it, so
  the sweep reaches it now. `flex-wrap` on the header row and a 7rem month label.
- **Not fixed, reported**: `/dashboard/hr/attendance` scrolls 309px with 18 controls
  pushed out of reach. The offender is that page's own tab chrome (`ul.flex.min-w-max`
  and a sub-tab row), not any approval element — the 016 modal it hosts is clean. It
  belongs to whoever owns HR attendance, and quietly reflowing another feature's
  navigation from inside this one is how shared components acquire mystery rules.

**T032 / Pass 10 — WebKit is byte-identical to Chromium** on every surface above, and
login plus every authenticated page worked, which is the part Pass 10 exists to check
(session and cookie behaviour). No Safari-specific finding.

**Two false readings worth recording, because both would have been reported as facts.**
A `next-server` process survived `pkill -f "next start"` and served a stale build for
several measurements, producing 500s on static chunks and a page that rendered as "This
page couldn't load" — which measured as a passing 320px. And the dev server gave
`/my/punch` a clean 320 that the production build contradicted. Every number above is from
a clean build, a freshly killed port, and the correct user for the surface (the employee
for `/my/punch`, not the admin, who has no employee record).

**T033 remains unchecked.** Passes 2, 3, 4 and 6 involve killing the API mid-submission,
repeated clicking, and multi-account visibility — meaningful to drive by hand, and
automating them would test my script more than the product.

### Implementation note — T033, 2026-09-15

Passes 1–6 driven in Chromium against a production build and the real API. I had written
that automating these "would test my script more than the product"; that was wrong for
four of the six, and Pass 2 in particular turned out to be the most checkable thing in the
feature.

**Pass 2 — the three inert states. The one that matters most, and it holds.** One
Super Admin, one exceptions modal, three rows, three genuinely different sentences:

| row | control says |
|---|---|
| awaiting this user at Director | `Approve / Reject / Return for correction` |
| this user already decided at level 1, now at Director | **`You already decided this at Director`** |
| awaiting Site / Employer | `Site / Employer decides this` |
| with `first_approver` unmapped | `Nobody can approve this yet: no role is mapped to Site / Employer for your company. Someone with settings access must map it under Settings → Approvals before this can move.` |

Rows saying "permission" to a Super Admin: **0**. That is the untruth research.md §2 exists
to prevent, and it does not occur. The `slot_unmapped` copy naming the settings screen is
the correction made earlier this session — the message used to say the screen did not
exist — now confirmed against a live unmapped slot rather than by reading the constant.

**Pass 3 — a failed decision loses nothing.** Typed a 212-character reason, killed the API
mid-flight (`pkill -f 'node dist/main'`), submitted. Reason still in the box: 212 chars.
Failure shown. Still on the same screen, not signed out. All three hold.

> **Finding, not fixed.** The message shown is `Internal Server Error`. It passes the
> requirement — the failure is visible — but it is the wrong sentence for a supervisor who
> just lost a connection, and the control's own fallback copy ("The decision could not be
> recorded. Please try again.") is better than the message it actually displays, because
> `ApiError.message` carries the proxy's 500 text and wins. Worth changing to prefer the
> friendly copy when the error carries no `code`, but that is shared-control behaviour
> affecting every module and not something to alter while verifying it.

**Pass 4 — double submission is impossible.** Five clicks on Approve as fast as the driver
allows: exactly **one** POST left the browser.

**Pass 5 — the queue and the badge agree.** With 1 pending item: badge 1, queue 1. With 51:
badge 51, queue 25. Not a disagreement — the badge counts everything pending and the queue
pages at 25. The quickstart's wording ("same number of items") only holds below one page,
which is worth saying explicitly so a future reader does not record a failure here.

**Pass 6 — the queue never shows unactionable work.** An item this user decided at level 1,
now sitting at a level they also hold, is **absent** from their queue; an item genuinely
awaiting them is present.

**Pass 1 — one control everywhere.** Confirmed across the two surfaces that have it, with
identical actions and placement. Worth stating plainly that this is a weak pass today:
attendance exceptions is the only business module on the spine, so "identical across
modules" cannot really be tested until a second one migrates.

**A measurement error worth recording.** Pass 4 first reported zero requests, which I
nearly wrote up as a pass. The filter watched `POST /approvals/:id/decide`, but the
exceptions modal calls its own module's `/workspace-admin/attendance-exceptions/:id/resolve`,
which reaches `decide()` server-side. The item had in fact been approved exactly once. A
request counter that watches the wrong URL reports perfect behaviour and an empty screen
with equal confidence.

### Implementation note — the Pass 3 error copy, 2026-09-15

Changed, and **the new wording has not been seen in a browser.** Saying that plainly
because the rest of this file records things that were observed.

What changed: `ActionReview` showed the thrown error's own `message` whenever one existed.
A refusal from the spine deserves that — its message names the level, or the already-decided
state, or the unmapped slot. A transport failure does not: Pass 3 killed the API and the
control faithfully displayed **"Internal Server Error"** to somebody who had just typed a
paragraph of justification. A new `messageFor(e, fallback)` helper now shows the error's
message only when it carries a machine-readable `code`, which is the mark of a deliberate
refusal, and otherwise uses copy from the constants module. That also removes a real FR-015
violation: the decision-failure sentence was hardcoded in the component.

Verified: `tsc` clean, lint 0 errors, production build clean, and the branch is legible by
reading — `code` is set only by the API client when the backend sends one.

Not verified: that the new sentence appears. Two attempts to re-run Pass 3 against the
changed control produced harness artifacts rather than results, and both are worth
recording because each looked like a finding:

1. **`pkill` mid-submission raced the request.** The item ended up `returned` — the
   submission had *succeeded* — so the empty reason box and missing error I measured were a
   successful save, not a failed one. Killing a process is not a way to make a request fail;
   it is a way to make a request fail *sometimes*.
2. **Aborting the request deterministically showed no error at all** — which looked much
   worse, until a counter on the route handler showed **0 requests aborted**. The confirm
   click had never landed: my locator matched the button that *opens* the reason box rather
   than the one that submits it. A test that never presses the button reports a silent
   failure with complete confidence.

The original Pass 3 result stands as recorded above — reason preserved, failure visible, no
navigation — and was taken against the code as it then was. What is untested is only whether
the friendlier sentence renders in place of the proxy's. The path is short and the fallback
is a plain string, but it is untested, and a shared control that every module depends on is
exactly where that should be said out loud rather than assumed.

## Phase 8: Amendment of 2026-09-16 — bug 2's web half (FR-009a, FR-009b, FR-009c, FR-009d)

**Why this phase exists and why it is unchecked.** Phases 1-7 above are complete and their 42 tasks
are accurate for the requirements that existed when they were written. FR-009a to FR-009d were added
to `spec.md` on 2026-09-16 and never got tasks, so this file has read "complete" while the
specification carried four unbuilt requirements. The 42 stay as history; this phase is the work.

No test framework is installed (`TODO(TESTING_STANDARD)`). No task below creates a test file.
Verification is `npx tsc --noEmit`, `npm run lint`, `npm run build` and the browser passes named.

**Backend dependency**: api 016 phase 8 tasks T064-T066 extend `AttendanceMonth`'s per-day shape with
the modification fields and resolve the actor to a **name**, not an id.

**Landed 2026-09-30** (api `f121afe`), along with phase 8a's `pendingCorrection` on the daily row,
which T077 should have caught and did not — the browser was the consumer nobody checked. So the
browser passes below are now verifiable rather than blocked.

- [X] T043 (FR-009a) Extend `attendanceDaySchema` in `app/lib/api/my-workspace.ts` with the
  modification fields the backend adds — modified flag, actor **name**, time, before, after, and the
  reason where one was given. Parse them as optional so a day from an un-upgraded backend still
  validates rather than throwing on every employee's history screen.

  Done 2026-10-01. Parsed as optional **with a default of `[]`**, so no component has to decide
  what a missing array means — and so a staged rollout renders a month without modification detail
  rather than throwing on every employee's attendance screen.

- [X] T044 (FR-009a) Render the modification on the day in `app/ui/my/attendance-history.tsx`. It is a
  **property of the day**, so it renders inside the day's row or its expansion — not as a banner, a
  toast or a notification list.

  Done 2026-10-01 in `app/ui/my/attendance-history.tsx`, rendered through a new optional `detail`
  slot on `ResponsiveList` — a full-width block beneath the day's own row, on both the desktop table
  and the mobile card. A column was the alternative and was rejected: before/after/reason cannot be
  read in a table cell at 320px.

- [X] T045 (FR-009a) Make it **not dismissable and not clearable**. No close control, no "seen" state,
  nothing persisted in local storage that hides it. The requirement says so explicitly because a
  dismissable record of somebody else changing your attendance is a record that disappears the first
  time it is inconvenient.

  Done 2026-10-01. There is no expander, no `seen` state and nothing in `localStorage`. The
  `detail` slot on `ResponsiveList` is deliberately always-rendered for the same reason — a
  component that *could* hide this would be one stored key away from hiding it permanently.

- [X] T046 (FR-009a) Show from-what-to-what, not only that a change occurred. A day reading "modified"
  with no before value tells the employee something happened and nothing about what.

  Done 2026-10-01, and the trap here was not the diff but the **clock**. A snapshot's times are
  `HH:mm` in UTC while the day's own times are ISO rendered in the reader's zone, so an employee in
  IST would have read “In: 03:35 → 03:40” directly beneath a row saying 09:05 — every figure
  correct, the pair incomprehensible. `snapshotTime` converts using the day's date. Only fields
  that actually moved are listed.

- [X] T047 (FR-009a) Where no reason was given, say so plainly rather than rendering an empty field.
  The backend's `reason` is free text and optional; an empty string and "no reason given" must not look
  the same.

  Done 2026-10-01. `No reason was given.` where the field is null, and a separate sentence again
  for a change where no field differs at all — which the data permits, and which would otherwise
  render as a heading with nothing under it.

- [X] T048 (FR-009a) Put every string in `app/lib/constants.ts` (Principle III), and use no inline
  styling (Principle II).

  Done 2026-10-01. Copy is in `MY_ATTENDANCE_MESSAGES`, its own block rather than entries in
  `HR_MESSAGES`, because the reader is the employee whose day was changed and not the administrator
  who changed it. No inline styles.

- [ ] T049 (FR-009b) **Mobile-critical under Principle VI.** Attendance viewing is on the closed list,
  so this must be *reachable and usable* at 320px, not merely unbroken there. Verify the modification
  detail is readable without horizontal scroll and without a hover-only affordance — the person whose
  attendance was changed is the one most likely to be looking at it on a phone.

  Built for it 2026-10-01: the detail wraps rather than scrolls, every line `break-words`, and
  nothing is behind a hover. Left unticked — the requirement is a measured 320px pass in a browser,
  and that is the browser task below, not something code review can assert.

- [X] T050 (FR-009c) In `app/dashboard/hr/attendance/page.tsx`, present a submitted correction as
  **awaiting approval**, never as applied. Use the existing `app/ui/approvals/action-review.tsx` and
  `last-action.tsx` rather than new components — this is the same approval state the rest of the
  application already renders.

  Done in `app/ui/hr/attendance-table.tsx` (2026-10-01), and **neither component was used** — noting
  the deviation because the task named them. Both are decision controls: they exist so a reviewer can
  approve or return an item, and they need an `instanceId`, a `canActNow` and an inert reason. Nothing
  on this screen decides anything. The administrator who submitted the correction is not its approver,
  and rendering a control that is inert for every viewer would read as a broken button rather than as
  a state. What the row needs is one fact — a correction is outstanding, and this level has it — which
  is what `pendingCorrection` carries. The approval surface remains the place a decision is taken.

  Three separate lies were removed along the way: the button said `Save`, the dialog said every edit
  is recorded in the modifications trail, and the copy constant said `Attendance updated.` All three
  were true before api 016 phase 8 and are now the wrong sentence.
- [ ] T051 (FR-009c) Ensure the corrected day does **not** read as corrected until the chain completes.
  The employee's view in T044 must show nothing for a pending correction. A day that reads corrected
  while a decision is still pending tells the administrator a decision has been taken that has not, and
  tells the employee their attendance changed when it did not.

  **The administrator half is done** (2026-10-01): the row's times and status are the stored ones, and
  the correction shows as awaiting a level beside them rather than in place of them. Left open for the
  employee half, which cannot be checked until T044 renders anything at all. The API guarantee it rests
  on is already in place and covered — `AttendanceModification` is written on apply, never on submit
  (api T075), so a pending correction is invisible to the employee's history by construction.
- [X] T052 (FR-009c) Branch on the backend's approval state and error codes, never on message text —
  the convention T006 established for this feature. The row's marker branches on the presence of
  `pendingCorrection` and on the chain's own `levelLabel`; the dialog branches on HTTP 423. No string
  is matched.
- [X] T053 (FR-009d) Add filtering by **the person who made the change** to the administrative
  modifications view, alongside the existing employee and date filters. The backend adds `actorUserId`
  to `ModificationsQueryDto` (api 016 T070).

  Done 2026-10-01 in `app/ui/hr/modifications-modal.tsx`. The filter needed api work first: T070
  added the query input and nothing returned the list of people to offer, so the endpoint now sends
  `actors` — the distinct actors in scope, **not** narrowed by the actor filter, since options
  derived from filtered rows collapse to the one already chosen (api T083f).

- [X] T054 (FR-009d) Make the actor filter compose with the existing filters rather than replacing
  them — an audit asking "what did this person change to this employee in September" is the question
  worth answering.

  Done 2026-10-01 — and the employee and date filters this was meant to compose with **did not
  exist** on this screen; it fetched 100 rows unfiltered. All four now compose, because the question
  an audit is actually asked is “what did this person change to this employee in September”, and no
  one filter alone answers it.

- [X] T055 (FR-009d) Present the actor by name, resolved server-side. Do not render a user id, and do
  not fetch names one per row.

  Done 2026-10-01. `actorName` is resolved server-side in one query per page (api T083e); the
  column falls back to the id only for a row from an API predating the field, never by design.

- [X] T056 All access through the typed API modules in `app/lib/api` (Principle V). No direct `fetch`.

  Done 2026-10-01. Everything goes through `app/lib/api/hr-payroll.ts` and
  `app/lib/api/my-workspace.ts`; no `fetch` was added.

- [ ] T057 Browser pass: as an employee, view a month containing an administrator-modified day and
  confirm the actor's name, the time, before, after and the reason are all visible, that nothing
  dismisses it, and that it reads correctly at 320px.
- [ ] T058 Browser pass: as an administrator, submit a correction and confirm **both** views — it reads
  awaiting approval on the admin screen, and the employee's day shows nothing yet. Then approve it and
  confirm both change together.
- [X] T059 `npx tsc --noEmit`, `npm run lint`, `npm run build`.

  Done 2026-10-01: `tsc --noEmit` clean, eslint clean on touched files, `next build` succeeds.

## Phase 9: Amendment of 2026-09-29 — item 7's web half (FR-017, FR-018, FR-019, FR-020)

The backend answer to "every critical action requires Director approval" is a named, configurable set
rather than a literal every-action gate. That answer only works if the client can see the set — which
is what User Story 4 and these four requirements are for. `app/dashboard/settings/approvals` already
exists from Phase 6 and is where this belongs.

**Backend dependency**: api 016 phases 9-11 (T084-T107) — **landed 2026-09-30** (api `dc5a677`).
`GET /approvals/director-final` (not `/settings/approvals/...`, as this line originally said)
returns the **union** of registered action types, the config seed, and the stored rows — with three
states per action type, not two — alongside any pending change.

Two names had to be added on the api side before this phase could be built: `updatedByName` on each
entry and `proposedByName` on the pending change were user ids, and a settings screen saying
"decided by cmuoe9b7l00q5v8…" tells a client nothing about who chose that their payments need a
Director. The three-state logic also had no unit coverage, which it now has — it is the
load-bearing part of the answer to "every critical action".

- [X] T060 (FR-017) Add the director-final read to `app/lib/api/approvals.ts` with a zod schema
  carrying all **three** states per action type: final; not final by decision; not final because
  nothing configures it.

  Done 2026-10-01 in `app/lib/api/approvals.ts`. All three states are a `z.enum`, so a fourth
  arriving from the API fails loudly rather than rendering as a blank badge.

- [X] T061 (FR-017) Render the list in `app/dashboard/settings/approvals/`, listing every action type
  the system reports rather than only those configured.

  Done 2026-10-01 in `app/ui/settings/director-final-settings.tsx`, mounted on the existing
  `/dashboard/settings/approvals` page rather than a new one: the slot mappings and this both answer
  “who decides here”, and splitting them would mean nobody reviewing approval configuration sees
  both halves.

- [X] T062 (FR-017) Render the third state **distinctly**. An action type nothing configures must not
  look like one somebody decided needs no director — collapsing those two hides exactly the gap item 7
  is asking about, and it is the reason the backend reports three states.

  Done 2026-10-01, and the distinction is carried three ways rather than one: a different label
  (“Nobody has decided” against “Not required — decided”), a different sentence explaining what that
  means, and **amber rather than grey**. A gap nobody has decided must not recede to the same visual
  weight as a decision somebody took — that is the whole reason the API reports three states.

- [X] T063 (FR-018) Present a change as **submitted for the director's approval**, never as saved. The
  submit control's label must say so before it is pressed, not only after.

  Done 2026-10-01. The control reads “Submit for the Director’s approval” before it is pressed,
  and the confirmation afterwards says explicitly that nothing has changed yet and the list below is
  still what governs today.

- [X] T064 (FR-018) Keep the mark **currently in force** displayed while a change is pending. The
  screen shows what governs today and what has been proposed, as two readable things.

  Done 2026-10-01. Every row carries an “In force today” badge, and a second “Proposed” badge
  appears beside it once the reader moves the control — so what governs and what is being asked for
  are two readable things, never one ambiguous one.

- [X] T065 (FR-019) Show a pending change to every reader of the surface, so two people do not submit
  the same edit. Include who submitted it and when.

  Done 2026-10-01, and it needed api work first: `proposedBy` was a user id, so the screen could
  only have said “proposed by cmuoe9b7l…”. The API now resolves `proposedByName`. The pending notice
  renders above the list, since it changes how the list should be read, and lists each proposed
  change as from → to.

- [X] T066 (FR-020) For a user who may not configure approvals, render the list with **no control to
  change a mark** — hidden, not disabled (the Principle-consistent behaviour, and what web 019's FR-004
  requires generally).

  Done 2026-10-01 — **hidden, not disabled**, per the task and web 019 FR-004. A disabled control
  tells somebody the capability exists and they are not trusted with it, which is the wrong message
  on a settings screen. The read-only reader gets one sentence saying they can see the set but not
  change it, so the absence is explained rather than merely silent.

- [X] T067 (FR-020) Read the permission from `app/lib/permissions.ts`. Note in the task that once
  web 019 ships this becomes a level-aware check (`COMPANY_SETTINGS` at write); until then the existing
  module-level value is correct and needs no change.

  Done 2026-10-01: read from the caller's own `permissions`, the module-level `COMPANY_SETTINGS`
  value, with the note the task asked for recorded in the component — once web 019 ships this becomes
  a level-aware check at `write`.

- [X] T068 Reuse `app/ui/approvals/action-review.tsx` for the pending change's own approval rather than
  building a second control. A settings change that enters the chain is an ordinary chain item.

  **Deviation, 2026-10-01: `action-review.tsx` was not reused.** The task's reasoning is right —
  a settings change entering the chain is an ordinary chain item — but the decision on it is taken
  where every other decision is taken, in the approvals queue, and that surface already uses that
  component. On *this* screen the pending change is something to be *told about*, by readers who are
  mostly not its approver: FR-019 requires every reader to see it so two people do not submit the
  same edit. Rendering a decision control to all of them would be inert for nearly all of them, and
  an inert control reads as a broken one. Same reasoning as T050's deviation, one screen over.

- [X] T069 Copy in `app/lib/constants.ts`, no inline styling, access through `app/lib/api`.

  Done 2026-10-01. Copy is in `DIRECTOR_FINAL_MESSAGES`; no inline styling; all access through
  `app/lib/api/approvals.ts`.

- [ ] T070 Browser pass: open the settings surface, confirm all three states render distinctly, submit a
  change removing payment release, confirm the list still shows it as final and the pending change is
  visible, approve as Super Admin, confirm the list updates.
- [ ] T071 Browser pass: as a user without approval-configuration permission, confirm the list is
  readable and no change control appears anywhere on the screen.
- [X] T072 `npx tsc --noEmit`, `npm run lint`, `npm run build`.

  Done 2026-10-01: `tsc --noEmit` clean, eslint clean on touched files, `next build` succeeds.

### Dependencies for phases 8-9

Phase 8 needs api 016 phase 8 (T064-T083, outstanding). Phase 9 needs api 016 phases 9-11
(T084-T107, not started). Both can be written before their backend lands; neither can be verified
in a browser until it does.

Phases 8 and 9 are independent of each other.

### MVP for these amendments

**Phase 8's T043-T049** — the employee seeing that their own attendance was changed, by whom, and from
what to what. It is the client's own sentence in bug 2 ("it should also reflect in the attendance of
the affected employee"), it is mobile-critical, and it is the half of bug 2 that no screen currently
shows at all.

---

## Phase 9: The two new mobile-critical screens (added 2026-10-02)

**Prerequisite met:** web constitution v2.2.0 (2026-10-02) adds the approvals queue and site attendance
review to Principle VI's mobile-critical list. Principle VI is NON-NEGOTIABLE and its own "Changing the
list" clause requires an amendment, which no feature spec may make — so that amendment, not this task
list, was the gate on item 22.

The client declined widening Principle VI wholesale and named these two instead. Plant logbook, fuel
entry, material indents and inventory issue were offered and not chosen; they keep the 320px breakage
floor and nothing stronger.

Mobile-critical is a higher bar than "not broken": 44×44px touch targets, primary actions reachable
one-handed, no action gated behind hover, and no layout break between 320px and 428px.

- [x] T108 [US4] Bring the approvals queue to the mobile-critical standard at 320px. **The reason it is
      on the list is a Director deciding a payment release from a phone**, so approve, reject and return
      are the controls that must be reachable one-handed — not the filters.
- [x] T109 [US4] Audit the queue for hover-gated actions. A row-hover action menu is the usual way an
      otherwise-responsive list becomes unusable by touch, and it passes every desktop check.
- [x] T110 [US4] Make the item detail readable at 320px without the page body scrolling sideways. An
      approver who cannot read what they are approving will approve it anyway, which is worse than a
      broken layout.
- [x] T111 [US1] Bring site attendance review and correction to the same standard. **Its reason is a
      supervisor on a site fixing a day the punch refusal turned away**, so raising a correction is the
      control that must work, and the attendance grid is the hard part — it is wide by nature.
- [x] T112 [US1] The correction form at 320px: a form that submits a day's attendance from a phone is the
      whole point, and a date picker or a reason field that is unreachable there fails the requirement
      while the page looks fine.
- [ ] T113 **NOT RUN** [P] Manual pass at 320px and again at desktop for both screens, per the constitution's
      pre-merge check. No automated framework exists (`TODO(TESTING_STANDARD)`), so this is a person with
      device emulation and it is **not done until somebody has actually done it**.
- [ ] T114 **NOT RUN** [P] Keyboard operability on both, which Principle VI scopes to every screen regardless of
      viewport and which a touch-target pass does not cover.

### Phase 10 implementation record, 2026-10-02 — the two mobile-critical screens

#### The approvals queue stopped being a horizontally scrolling table

It used `DataTable`, which wraps a table in `overflow-x-auto`. That meets the **breakage floor** and
fails the mobile-critical standard, and the reason is specific: the decision controls were the last
column, which at 320px is off-screen to the right. **An approver who has to scroll sideways to find
Approve is an approver who approves without reading** — and the client put this screen on the list
precisely because a Director decides a payment release from a phone.

It now renders through `ResponsiveList`: cards below `md`, the same columns as a table above it. The
decision controls are `actions` rather than a column, which is what gets them the card's full width in
their own footer instead of the cramped right half of a `<dt>`/`<dd>` row.

#### T109 — the hover audit found nothing, and that is the finding

`grep` for `group-hover`, `opacity-0` and `invisible` across every `.tsx` in the application returns
three matches, all of them the word "invisible" in prose. **No action anywhere in this product is
gated behind hover.** Recorded rather than ticked silently, because the task exists to catch a thing
that passes every desktop check and the honest result is that it was never introduced.

#### Attendance: the grid stays wide, the control does not

T111 says the grid "is wide by nature", and it is left as a horizontal scroller deliberately. Reading
a grid sideways is a nuisance; being unable to reach the control is a failure. So the work went into
the control: the Mark/Edit action is full-width and 44px tall below `sm`, and the day-navigation
arrows — which were `px-3` with no height, about 24px of target — are 44×44.

The correction form was already single-column below `sm`. What it lacked was reach.

#### Three shared components changed, and that is the right blast radius

`Button`, `SecondaryButton` and `Modal` now give 44px targets below `sm` and keep the design's 40px
from `sm` up. Done there rather than on the two screens, because **the mobile-critical list is closed
today and the next addition to it should not have to remember this.** The modal's close control was a
28px target around a 20px icon — the worst one to leave small, since it is what somebody stabs at
repeatedly — and its footer now stacks full-width in reverse order below `sm`, putting the primary
action at the bottom where a thumb already is without changing DOM order and so without changing tab
order.

#### T113 and T114 NOT RUN

Both are browser passes: device emulation at 320px and 428px, and a keyboard walk. The constitution's
pre-merge check names a person doing it, there is no automated framework here
(`TODO(TESTING_STANDARD)`), and the work above is **built for** the standard rather than measured
against it. Saying so is more useful than a tick.
