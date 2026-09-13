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

- [ ] T001 Create `app/lib/api/approvals.ts` with `zod` schemas for `ApprovalState`,
      `DecisionHistoryEntry`, `ApprovalQueueEntry` and `ApprovalCount` per
      [data-model.md](./data-model.md), parsed at the boundary (Principle IV)
- [ ] T002 (FR-014) Add the typed calls: `decide()`, `history()`, `queue()`, `queueCount()`. **All access to
      approvals goes through this module** (Principle V); no component may call `fetch`
- [ ] T003 [P] (FR-015) Add `APPROVAL_ACTIONS`, `APPROVAL_INERT_MESSAGES` and
      `APPROVAL_QUEUE_AGE_WARNING_HOURS` to `app/lib/constants.ts` (Principle III). Four inert
      messages, keyed by code — the `slot_unmapped` one names the settings screen, because it
      describes a fault rather than a state

---

## Phase 2: US1 — One control, everywhere, identical (P1)

**Goal**: a reviewer learns the control once.

**Independent test**: open a reviewable item in three modules; the control is in the same place,
offers the same choices, reads the same way.

- [ ] T004 [US1] (FR-001, FR-002) Create `app/ui/approvals/action-review.tsx` implementing
      [contracts/action-review.md](./contracts/action-review.md). Props are `state`, `onDecide`,
      `entityLabel`, `size`. **Module identity is deliberately not a prop** — it is what would let
      one module diverge
- [ ] T005 [US1] (FR-003, FR-003a) Render the four inert states as four distinct messages
      (research.md §2). The states come from the backend's `inertReason`; this app computes none of
      them. A Super
      Admin who already decided must read "You approved this at {level}", **never** "you do not have
      permission" — that is untrue, and it sends the one person who can change permissions to go and
      change them
- [ ] T006 [US1] Branch on `inertReason` and the backend's error codes, never on message text — the
      contract feature 015 established with `SESSION_EXPIRED`
- [ ] T007 [US1] (FR-004) Require a reason inline for reject and return; do not send without one
- [ ] T008 [US1] (FR-005) Disable during flight with visible progress, so repeated clicks produce
      exactly one request
- [ ] T009 [US1] **Preserve the typed reason across a failed submission** and allow retry without
      retyping (spec FR-006). Losing a paragraph of justification to a dropped connection is how
      people stop trusting a system
- [ ] T010 [US1] (FR-007) Ensure a failed decision throws to the caller and never navigates away — only a 401
      from renewal ends a session (feature 015; restated because losing a screen mid-review is
      exactly the regression worth guarding)
- [ ] T011 [US1] (FR-003b) Use the server-supplied `levelLabel` and `awaitingUserName` everywhere
      authority is described. **No role name may be written in this application** — the two companies may map the
      same slot differently, so a hardcoded name is right for one and silently wrong for the other
- [ ] T012 [US1] Mount the control on attendance exceptions in `app/dashboard/hr/attendance/`, the
      first and only consumer in this phase

**Checkpoint**: quickstart Passes 1, 2, 3 and 4 hold. Pass 2 is the one worth doing twice.

---

## Phase 3: US2 — The record says who last touched it (P1)

- [ ] T013 [US2] (FR-008) Create `app/ui/approvals/last-action.tsx` rendering the latest action,
      actor and time from `state.latestAction`
- [ ] T014 [US2] (FR-009) Create `app/ui/approvals/decision-history.tsx` as a **disclosure on the
      record**,
      not a link to a separate page — the requirement is that the answer is in that place
      (research.md §6)
- [ ] T015 [US2] Show a returned-and-resubmitted item's earlier decisions too, with `returnCount`
      visible; the history must show that the item went round
- [ ] T016 [US2] Render nothing that implies an action on an item never acted on — its state reads
      as awaiting a first decision
- [ ] T017 [P] [US2] Place `<LastAction>` in the attendance exception list and detail views
- [ ] T018 [US2] Ensure the actor survives dense-table treatment at 320px: with the existing
      `ResponsiveList` card fallback or an `overflow-x` container, the actor must remain
      discoverable. Attribution truncated away entirely fails the requirement at exactly the width
      where it is most likely to be read in a hurry

---

## Phase 4: US3 — One place that shows what is waiting (P2)

- [ ] T019 [US3] Create `app/dashboard/approvals/page.tsx` with a `layout.tsx` module guard,
      following the feature 014 pattern
- [ ] T020 [US3] (FR-010, FR-011) Create `app/ui/approvals/queue-table.tsx` showing module,
      subject, requester and age, with the decision takeable from the row
- [ ] T021 [US3] Distinguish items older than `APPROVAL_QUEUE_AGE_WARNING_HOURS` visually
- [ ] T022 [US3] (FR-006) Say plainly when the queue is empty rather than rendering a blank screen
- [ ] T023 [US3] (FR-013) Invalidate the queue and count on a successful decision so the item
      leaves without a manual refresh; refetch on window focus (research.md §4)
- [ ] T024 [US3] (FR-012) Add the pending count to `app/ui/dashboard/sidenav.tsx`, **reusing the existing
      reminder-badge mechanism** rather than adding a second one (Principle III)
- [ ] T025 [US3] Back the badge with `queueCount()` only — it appears on every screen and must not
      pull the whole queue for a number

**Checkpoint**: quickstart Passes 5 and 6.

---

## Phase 5: Verification

- [ ] T025a (FR-016) Confirm no inline styling was introduced in any approval component
      (Principle II) — a review item, not a lint rule, since nothing enforces it automatically
- [ ] T026 [P] `npx tsc --noEmit`
- [ ] T027 [P] `npm run lint` — expect 0 errors and the 2 pre-existing unused-var warnings in
      `account-creation.ts` and `assets.ts`. Prettier is **not** safe to run repo-wide here
- [ ] T028 `npm run build`
- [ ] T029 Quickstart Pass 7: grep the approval surfaces for hardcoded role names; expect nothing
- [ ] T030 Quickstart Pass 8: open a 50-item list and confirm **one** approval-state request in
      Network, not fifty. This is the mistake the batch contract exists to prevent, and it will not
      be noticed until a list gets long in production
- [ ] T031 Quickstart Pass 9: every approval surface at 320px under constitution v2.1.0 — nothing
      clipped, no control unreachable, the page body not scrolling horizontally. **No screen in this
      product has ever been checked at that width**, so expect findings rather than confirmations
- [ ] T032 Quickstart Pass 10: repeat Passes 1, 3 and 5 in **Safari**, where session and cookie
      behaviour differs most and this product has been bitten before
- [ ] T033 Work quickstart Passes 1–6 in order

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
