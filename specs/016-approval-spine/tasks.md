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
