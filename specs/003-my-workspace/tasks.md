---

description: "Task list for feature implementation"
---

# Tasks: My Workspace Frontend (Punch, Leave, Salary, Face Enrolment)

**Input**: Design documents from `/specs/003-my-workspace/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/my-workspace-ui.md, quickstart.md

**Tests**: Not included — no automated test framework is installed in `buildcore-web` yet
(constitution's documented gap); verification is manual via `quickstart.md`, especially for
camera/GPS/offline behaviors that are inherently hard to automate without device-API mocking
infrastructure this repo doesn't have.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. All paths are in this repo (`buildcore-web`) — the
backend this feature consumes is a separate, already-fully-specced feature in the sibling
`buildcore-api` repo (`specs/003-my-workspace-backend`) and is not re-tasked here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `@serwist/next` to `package.json` and configure service-worker registration for
      offline app-shell caching (research.md §5)
- [X] T002 [P] Add `/my/*` routes, user-facing copy, and the GPS accuracy threshold to
      `app/lib/constants.ts`
- [X] T003 [P] Create `app/lib/offline-queue.ts`: native IndexedDB wrapper —
      `enqueue(entry)`, `drainQueue()`, `getQueuedCount()` (research.md §5, data-model.md
      "OfflineQueueEntry")
- [X] T004 [P] Create `zod` schemas for `FaceEnrolmentStatus`, `PunchResult`, `AttendanceDay`,
      `LeaveBalance`, `LeaveApplication`, `SalarySlip`, `ReEnrolmentState` in
      `app/lib/api/my-workspace.ts` (schema definitions only, functions per-story)

**Checkpoint**: Service worker, constants, offline-queue module, and response schemas ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Create `app/my/layout.tsx`: bottom tab bar shell (Punch/Leave/Salary/Face-Enrol),
      registers the `window.addEventListener('online', ...)` listener that calls
      `offline-queue.ts`'s `drainQueue()` (research.md §5)
- [X] T005a Extend `middleware.ts` (introduced by feature 001, already extended by feature 002 for
      `/dashboard/settings/*`) so its route matcher/protected-paths config also covers `/my/*`,
      redirecting an unauthenticated request to `/login` — spec FR-016, SC-007. This is a new
      top-level route tree outside `/dashboard/*`, so it is not covered by the existing matcher
      without this change.
- [X] T006 [P] Create `app/ui/my/camera-capture.tsx`: shared live-preview capture component
      wrapping `getUserMedia` (research.md §3), with a clear error state for denied/unavailable
      camera (spec FR-015)
- [X] T007 [P] Add the cross-shell "Admin Dashboard" link to `app/my/layout.tsx`'s bottom-nav
      area (visible only for a dual-role token) and a "My Workspace" entry to
      `app/ui/dashboard/nav-links.tsx` — research.md §2, spec FR-017
- [X] T008 [P] Create a `ResponsiveList`-reuse import path from the Settings feature (or confirm
      `app/ui/settings/responsive-list.tsx` is reusable as-is) for this feature's tabular data —
      research.md §9

**Checkpoint**: Shell, camera component, cross-navigation, and the reusable list pattern ready —
user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Enrol face biometrics (Priority: P1) 🎯 MVP

**Goal**: An employee can capture 3–5 photos, acknowledge consent, and enrol.

> **Amended 2026-08-31 (FR-002b)**: consent withdrawal is no longer part of this story's UI. The
> original goal and independent test also covered "consent withdrawal reverts status"; that control
> is removed from the screen (see Phase 12 below). The backend route is unchanged.

**Independent Test**: Enrol with 3 photos + consent, confirm "Enrolled" status; reload and confirm
the capture/Enrol controls are locked and no withdrawal control is offered.

### Implementation for User Story 1

- [X] T009 [P] [US1] Add `getEnrolmentStatus()`, `enrol()`, `withdrawConsent()` to
      `app/lib/api/my-workspace.ts`
- [X] T010 [US1] Create `app/ui/my/face-enrolment-status.tsx`: status badge, photo-capture flow
      (uses `CameraCapture`, T006), running counter/thumbnail grid, consent method + acknowledgement,
      Enrol action disabled until ≥3 photos + consent (depends on T006, T009) — native `<label>`/
      `<button>` elements and full keyboard operability for every non-camera control, per spec
      FR-020
- [X] T011 [US1] Create `app/my/face-enrol/page.tsx` (depends on T010)
- [X] T012 [US1] Wire the locked/hidden state for an already-enrolled employee, replaced by the
      re-enrolment entry point (US7 will extend this) — spec FR-003

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Punch in/out with camera and GPS (Priority: P1)

**Goal**: An enrolled employee can punch in/out with live clock, camera capture, and GPS.

**Independent Test**: Punch in (camera+GPS) → IN TIME populates; punch out → OUT TIME/WORKED
populate.

### Implementation for User Story 2

- [X] T013 [P] [US2] Add `submitPunch()` to `app/lib/api/my-workspace.ts`
- [X] T014 [US2] Create `app/ui/my/punch-clock.tsx`: server-synced live clock (research.md §7), IN/
      OUT/WORKED info boxes, Punch In/Out button (uses `CameraCapture` T006 +
      `navigator.geolocation`, client-side accuracy gate per research.md §4/spec FR-007, and a
      distinct location-permission-denied error state — separate from the accuracy check — per
      spec FR-015)
- [X] T015 [US2] Wire the payroll-locked proactive banner and rejection message on `punch-clock.tsx`
      — spec FR-006
- [X] T016 [US2] Wire the non-blocking exception notice (face-match/geofence exception result from
      `submitPunch()`'s response) on `punch-clock.tsx` — spec FR-005
- [X] T017 [US2] Create `app/my/punch/page.tsx` rendering `PunchClock` (depends on T014)
- [X] T018 [US2] Wire the double-tap guard (disable Punch button immediately on tap until the
      in-flight request resolves) — spec Edge Cases

**Checkpoint**: User Stories 1 AND 2 both independently functional.

---

## Phase 5: User Story 3 - View attendance history (Priority: P2)

**Goal**: Monthly attendance history table with month/year navigation and status badges.

**Independent Test**: Navigate months, confirm correct status badges per day; empty months show
empty state.

### Implementation for User Story 3

- [X] T019 [P] [US3] Add `getAttendanceHistory()` to `app/lib/api/my-workspace.ts`
- [X] T020 [US3] Create `app/ui/my/attendance-history.tsx`: `ResponsiveList`-based (T008) table
      with month/year navigation and distinct status badge styling (Present/Absent/Weekly Off/
      Holiday/On Leave) — spec FR-008
- [X] T021 [US3] Register `attendance-history.tsx` on `app/my/punch/page.tsx` (T017)

**Checkpoint**: User Stories 1–3 independently functional.

---

## Phase 6: User Story 4 - Apply for and manage leave (Priority: P2)

**Goal**: View balance, apply for leave with day-count preview, cancel pending, see decisions on
next view.

**Independent Test**: View balance, apply within it, confirm Pending; cancel it.

### Implementation for User Story 4

- [X] T022 [P] [US4] Add `getLeaveBalance()`, `getLeaveApplications()`, `applyLeave()`,
      `cancelLeaveApplication()` to `app/lib/api/my-workspace.ts`
- [X] T023 [US4] Create `app/ui/my/leave-balance.tsx`: balance table with financial-year selector
      — spec FR-010
- [X] T024 [US4] Create `app/ui/my/apply-leave-form.tsx`: type/date-range/reason fields, live
      day-count preview (excludes weekends/holidays, matching backend logic — research.md,
      contracts/my-workspace-ui.md), inline over-balance blocking for non-LWP types — spec FR-011;
      native `<label>`/`<button>` elements and full keyboard operability, per spec FR-020
- [X] T025 [US4] Create `app/ui/my/leave-applications.tsx`: `ResponsiveList`-based (T008) table
      with status badges and a Cancel action shown only for Pending — spec FR-010, FR-012
- [X] T026 [US4] Create `app/my/leave/page.tsx` rendering all three (depends on T023–T025)

**Checkpoint**: User Stories 1–4 independently functional.

---

## Phase 7: User Story 5 - View and download salary slip (Priority: P2)

**Goal**: Month selector limited to Processed/Paid, slip view, PDF download.

**Independent Test**: Month selector excludes Draft; view and download return matching figures.

### Implementation for User Story 5

- [X] T027 [P] [US5] Add `getAvailablePeriods()`, `getSalarySlip()`, `downloadSalarySlipPdf()`
      (research.md §8) to `app/lib/api/my-workspace.ts`
- [X] T028 [US5] Create `app/ui/my/salary-slip.tsx`: month selector, slip view (all PRD-specified
      sections), Download action triggering a browser save via object URL — spec FR-013
- [X] T029 [US5] Create `app/my/salary/page.tsx` rendering `SalarySlip` (depends on T028)
- [X] T030 [US5] Wire the empty state for an employee with no Processed/Paid months yet — spec
      Acceptance Scenario 4

**Checkpoint**: User Stories 1–5 independently functional.

---

## Phase 8: User Story 6 - Punch while offline (Priority: P3)

**Goal**: A punch made offline queues locally and auto-syncs on reconnect, preserving capture time.

**Independent Test**: Simulate offline, punch, confirm "Queued" indicator; restore connectivity,
confirm auto-sync with original capture time.

### Implementation for User Story 6

- [X] T031 [US6] Wire `punch-clock.tsx` (T014) to detect `navigator.onLine === false` or a network-
      error `submitPunch()` failure and route the punch into `offline-queue.ts`'s `enqueue()`
      (T003) instead of failing outright — spec FR-009
- [X] T032 [US6] Add a "Queued — will sync when online" indicator to `punch-clock.tsx`, sourced
      from `offline-queue.ts`'s `getQueuedCount()`
- [X] T033 [US6] Wire `app/my/layout.tsx`'s `online` listener (T005) to call `drainQueue()`, which
      calls `submitPunch()` for each queued entry in capture order and removes it on success
- [X] T034 [US6] Wire a per-punch failure notice (e.g. backend rejects a too-old `capturedAt`) when
      `drainQueue()`'s submission fails, rather than silently dropping or retrying forever — spec
      Acceptance Scenario 4

**Checkpoint**: User Stories 1–6 independently functional.

---

## Phase 9: User Story 7 - Request and complete biometric re-enrolment (Priority: P3)

**Goal**: Request re-enrolment, see pending/approved/rejected state, complete fresh capture within
the granted window.

**Independent Test**: Request → (admin approves elsewhere) → "Re-enrol Now" appears → complete →
old state replaced, action consumed.

### Implementation for User Story 7

- [X] T035 [P] [US7] Add `getReEnrolmentState()`, `requestReEnrolment()`, `completeReEnrolment()`
      to `app/lib/api/my-workspace.ts`
- [X] T036 [US7] Extend `face-enrolment-status.tsx` (T010) with the re-enrolment states: "Request
      Re-enrolment" action (reason selection, disabled while pending), "Pending Approval" badge,
      rejected-with-remarks display, and the one-time "Re-enrol Now" action (reuses `CameraCapture`
      T006 for fresh capture) — spec FR-014; same native-element/keyboard-operability standard as
      T010, per spec FR-020
- [X] T037 [US7] Wire the unlock-unavailable states (no request, already consumed, expired after 7
      days) to hide "Re-enrol Now" appropriately — spec Acceptance Scenario 5

**Checkpoint**: All seven user stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T038 [P] Run `npm run lint` and `next build`/`tsc --noEmit` across all new/modified files
- [ ] T039 [P] Manually verify every camera- and location-dependent action shows a clear error
      state when permission is denied/unavailable — spec FR-015/SC-002
- [ ] T040 [P] Manually verify every non-camera interactive control across all screens is
      keyboard-operable with a visible focus indicator — spec FR-020/SC-008
- [ ] T041 [P] Manually verify attendance-history and leave-applications tables render as cards at
      a mobile viewport (reusing Settings' established pattern) — spec FR-018
- [ ] T042 Run the full `quickstart.md` validation scenarios end-to-end (including offline and
      re-enrolment) against a local environment and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–9)**: All depend on Foundational
  - US1 (Enrolment) has no dependency on other stories; US7 (Re-enrolment) directly extends its
    component (T010) and must follow it
  - US2 (Punch) can build in parallel with US1 (using a test-seeded enrolled employee); US6
    (Offline sync) directly extends its component (T014) and must follow it
  - US3 (History) registers onto US2's page (T017) — build after US2's shell exists, though its own
    logic is independent
  - US4 (Leave) and US5 (Salary) are both fully independent of US2/US3/US6/US7
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Within Foundational, T006–T008 can run in parallel (T005 is the shell all of them attach to,
  build first)
- Once Foundational completes: US1, US4, US5 can proceed fully in parallel; US2 can proceed in
  parallel too but US6 must wait on it; US3 waits on US2's page shell; US7 waits on US1's component

---

## Parallel Example: User Story 1

```bash
# Launch independent pieces of User Story 1 together:
Task: "Add getEnrolmentStatus/enrol/withdrawConsent to app/lib/api/my-workspace.ts"
Task: "Create app/ui/my/face-enrolment-status.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Enrolment)
4. Complete Phase 4: User Story 2 (Punch)
5. **STOP and VALIDATE**: Run quickstart.md Scenarios 1–2 independently
6. Deploy/demo if ready — core self-service biometric attendance on a phone

### Incremental Delivery

1. Setup + Foundational → foundation ready (shell, camera component, offline-queue module)
2. US1 (Enrolment) → US2 (Punch) → test independently → MVP
3. US3 (History) → US4 (Leave) → US5 (Salary) → each tested independently → full self-service
   portal
4. US6 (Offline sync) → US7 (Re-enrolment) → each tested independently → resilience + biometric
   lifecycle complete

---

## Phase 11: Convergence

Appended by a convergence pass over the codebase after Phases 1–10. T039–T042 above
remain open because they are manual-verification steps requiring a running app and a
real device; the items below are gaps found in the code itself.

- [ ] T043 Expose the employee's site holiday calendar so `apply-leave-form.tsx`'s
      day-count preview matches what the backend actually computes. The contract
      names a `getHolidayCalendar(siteId)` call, but no such endpoint exists in
      `buildcore-api`'s `/my/*` contract, so the preview currently excludes weekends
      only and is labelled approximate per spec FR-011, contracts/my-workspace-ui.md
      (partial)
- [X] T044 Verify `next build` end to end once Google Fonts is reachable. The build
      currently fails on `next/font/google` being unable to fetch Inter and Lusitana
      from this machine — a pre-existing, environment-only failure (the untouched
      baseline fails identically), so `tsc --noEmit` and `eslint` are the only
      verification this feature's code has had per tasks T038 (missing)
- [ ] T045 Confirm the service worker actually registers and serves the `/my/*`
      shell offline. `@serwist/next`'s classic webpack wrapper is incompatible with
      Next.js 16's default Turbopack build, so this was migrated to configurator
      mode (`serwist.config.js` + `serwist build` in the build script) — a path that
      has not been exercised because the build cannot complete here
      per research.md §5 (missing)
- [ ] T046 Reconcile research.md §1/tasks T005a, which refer to `middleware.ts` from
      feature 001. Next.js 16 renamed that file to `proxy.ts`, which is what this
      repo actually has and what was extended to cover `/my/:path*`
      per spec FR-016 (contradicts)
- [ ] T047 Decide whether the `/my/*` routes should additionally require the
      MY_WORKSPACE permission. They are currently authentication-only, matching the
      backend contract's rule that only admin-side routes carry a permission — but
      the backend has no permission guard on them either, so any authenticated
      account with an employee record can reach the whole shell
      per spec FR-016 (partial)

---

## Phase 12: Convergence

Appended by a convergence pass run after the workspace implementation landed, with
`next build` passing, typecheck clean, and lint clean. US1–US7 are all implemented and
wired into pages; the offline queue and re-enrolment flow are both present. The two items
below are what the assessment found outstanding.

- [X] T048 **CRITICAL** — Downscale and re-encode each captured frame in
      `app/ui/my/camera-capture.tsx` before handing it to `onCapture`. It currently draws
      the video at full sensor resolution (`canvas.width = video.videoWidth`) and encodes
      at JPEG quality 0.9, so a single frame from a modern phone is commonly hundreds of
      kilobytes to several megabytes, and base64 adds roughly a third on top. The API
      rejects those payloads outright — a three-photo enrolment built from
      representative photographs measures 565 KB and returns `413 request entity too
      large` against the running backend. Draw to a canvas capped on its longest edge and
      encode at a lower quality; the server downscales to 640px for punch photos and 800px
      for enrolment anyway, so anything beyond that is bandwidth spent on pixels that are
      immediately discarded — and spent over site mobile data. Coordinate the chosen
      dimensions with the backend's companion task (T097 in the API repo), so the client
      cap and the server limit are set against the same number
      per US1/AC, US2/AC, contract photo payloads (missing)

- [X] T049 (done — see Phase 13, T103–T106) Build User Story 8 (Reimbursement Requests) — or, if it is being deliberately
      deferred, record that decision in `spec.md` so the gap stops reading as an
      oversight. The spec defines US8 at P3 with full acceptance scenarios (claim form
      with category dropdown, amount, expense date, description, receipt upload, and the
      per-category maximum hint), but no US8 phase was ever generated into this
      `tasks.md`, and `app/` contains no reimbursement route, component, or API client
      function. The backend already implements the entire surface — `POST/GET
      /my/reimbursements`, `PATCH /my/reimbursements/:id`, `POST
      /my/reimbursements/:id/withdraw`, `DELETE /my/reimbursements/:id` — so this is a
      user story that exists on both sides of the contract except in the UI
      per spec US8 (missing)

---

## Phase 13: Camera Selection (FR-015a)

Added after the initial implementation, from field use: the capture surface pins
`facingMode: 'user'`, which breaks a gate-mounted tablet (whose rear camera is the one
facing the worker) and locks out anyone whose front camera is broken.

- [X] T050 Add front/rear camera selection to `app/ui/my/camera-capture.tsx`. Track the
      chosen `facingMode` in state, pass it to `getUserMedia`, and re-acquire the stream
      when it changes — tearing down the previous stream first, since leaving the old
      track live holds the camera open and the new request then fails on some devices.
      Keep the existing teardown-on-unmount behaviour intact
      per FR-015a (missing)

- [X] T051 Enumerate available cameras via `navigator.mediaDevices.enumerateDevices()` and
      render the toggle only when more than one video input exists. A device with a single
      camera MUST NOT show a disabled control. Note that labels and a reliable device list
      are only available after permission has been granted, so the check has to run once
      the stream is live rather than on first paint
      per FR-015a (missing)

- [X] T052 Persist the selection per device in `localStorage`, defaulting to the front
      camera when nothing is stored. Reads and writes MUST be wrapped in try/catch —
      Safari private mode throws on access rather than returning null, which would
      otherwise take the whole capture screen down with it. Put the storage key in
      `app/lib/constants.ts` rather than inline
      per FR-015a (missing)

- [X] T053 Verify switching mid-session does not discard already-captured enrolment shots:
      `face-enrolment-status.tsx` holds `shots` above `CameraCapture`, so it should
      survive, but the stream re-acquisition path is what would break it
      per FR-015a (missing)

- [ ] T054 [P] Confirm the toggle is keyboard-operable and labelled for screen readers
      (it is a control, so FR-020's semantic-HTML and keyboard rule applies even though
      the camera preview itself is exempt), and that its state is announced rather than
      conveyed by icon alone
      per FR-015a, FR-020 (missing)

---

## Phase 12: Amendment 2026-08-31 — Consent controls on Face Enrolment (FR-002a, FR-002b)

**Goal**: Face Enrolment collects consent through the acknowledgement checkbox alone, and offers no
self-service consent-withdrawal action in any enrolment state.

**Independent Test**: As a not-enrolled employee, confirm the enrolment form shows a checkbox and
no consent-method dropdown; as an enrolled employee, and again with a re-enrolment request pending,
confirm no "Withdraw consent" control appears anywhere on the screen.

**Context**: UI-only delta to an already-shipped story. `DELETE /my/face-enrol/consent` and backend
FR-004/FR-017 are unchanged, and `withdrawConsent()` stays exported from the API client as a typed
but uncalled wrapper (deliberate — see plan.md's amendment section).

### Implementation

- [X] T098 [US1] Remove the consent-method `SelectField` (and its `consentMethod` state) from
      `app/ui/my/face-enrolment-status.tsx`, passing a literal `'digital'` to `enrol()` instead,
      and drop the now-unused `SelectField` import
      per FR-002a

- [X] T099 [US1] Remove the "Withdraw consent" `SecondaryButton` and its explanatory paragraph from
      the `isEnrolled && !unlockActive` branch of `app/ui/my/face-enrolment-status.tsx`
      per FR-002b

- [X] T100 [US7] Remove the "Withdraw consent" `SecondaryButton` from the
      `re_enrolment_requested` branch of `app/ui/my/face-enrolment-status.tsx`, leaving the
      pending-approval notice as a status-only section — accepted consequence, plan.md
      per FR-002b

- [X] T101 [US1] Delete the now-unreferenced `withdraw` mutation (and any `SecondaryButton` import
      left unused) from `app/ui/my/face-enrolment-status.tsx`, keeping `withdrawConsent()` itself
      exported from `app/lib/api/my-workspace.ts`
      per FR-002b

- [ ] T102 Verify with `npx tsc --noEmit` and by walking quickstart.md Scenario 1 steps 3, 4, and
      4a that no consent-method dropdown and no withdrawal control render in any enrolment state
      per FR-002a, FR-002b
      — PARTIAL (2026-08-31): `npx tsc --noEmit` and `eslint` on the component are both clean, and
      all three enrolment branches were read to confirm no withdrawal control remains. The manual
      browser walkthrough of Scenario 1 steps 3/4/4a has NOT been run

---

## Phase 13: Amendment 2026-09-01 — User Story 8, punch state, attendance bounds, SW caching

Appended after Phase 12. Every task below is already implemented; they are recorded so `tasks.md`
still describes the code that exists. T049 (build US8 or record its deferral) is closed by
T103–T106.

### User Story 8 — Reimbursements

- [X] T103 [US8] Add reimbursement schemas and client functions to
      `app/lib/api/my-workspace.ts`; `amount` is coerced from the string Prisma serialises
      `DECIMAL` as
      per FR-021, contracts/my-workspace-ui.md

- [X] T104 [US8] Create `app/ui/my/reimbursement-form.tsx` — one component for file and edit,
      since the two differ only in endpoint and starting values, and splitting them would
      duplicate the receipt-threshold logic that is the only real behaviour in it. The receipt
      requirement updates live as the amount changes and blocks submit client-side as well as
      server-side; "Save as draft" skips the rule, since a draft is not in review yet
      per FR-021, US8 AC1, AC2

- [X] T105 [US8] Create `app/ui/my/reimbursement-claims.tsx` — history via `ResponsiveList`, six
      status badges, payment mode once paid. Row actions follow US8 AC3 exactly: draft →
      Edit/Submit/Delete, submitted → Withdraw, decided → none. No disabled controls on a decided
      claim, which would imply it might reopen. Submit is a status-only `PATCH`, which the backend
      re-checks against the claim's final values so a draft saved under the threshold cannot be
      submitted over it
      per FR-021, US8 AC3, AC4, AC5

- [X] T106 [US8] Create `app/my/reimbursements/page.tsx` and add the "Claims" tab to
      `app/my/layout.tsx`
      per FR-021

### Punch state and attendance bounds

- [X] T107 [US2] Take the Punch screen's in/out state from `getOpenPunch()` instead of today's
      attendance row, write it from the punch response rather than waiting on a refetch, and
      re-read it on error so a disagreement self-corrects. A punch-in left open overnight blocks
      the next one, so the previous same-day inference offered a punch-in the server refused
      per FR-019b

- [X] T108 [US2] Surface an open punch-in carried over from an earlier day, naming the day it was
      made — an empty "In time" beside a "Punch Out" button otherwise reads as a bug
      per FR-019c

- [X] T109 [US3] Clamp attendance month navigation at the current month: disable the forward
      control and reject a forward step in the handler, so the guard holds however `step()` is
      called
      per FR-008

### Service worker

- [X] T110 Stop the service worker caching `buildcore-api` responses: prepend a `NetworkOnly`
      rule for cross-origin requests ahead of Serwist's `defaultCache`, whose final rule cached
      every API GET for an hour. Beyond staleness, that cache is scoped to the origin rather than
      the session and survives sign-out, so on a shared site phone one employee's attendance,
      payslip or claim responses could be served to the next person who signs in
      per FR-019a, FR-026 (backend spec)

### Consent controls (recorded from the 2026-08-31 amendment)

- [ ] T111 [US1] Walk quickstart.md Scenario 1 steps 3, 4 and 4a in a browser to confirm no
      consent-method dropdown and no withdrawal control render in any enrolment state. Typecheck,
      lint and a read of all three branches confirm it statically; the manual pass has not been run
      per FR-002a, FR-002b — carries forward the unfinished half of T102

---

## Phase 14: Amendment 2026-09-01 (b) — one punch per day on the Punch screen (FR-019c, FR-019d)

**Goal**: The Punch screen offers exactly the one action still available today, or none once the
day's punch-in and punch-out are both recorded.

**Independent Test**: With no punch today, the screen offers Punch In. After punching in, it offers
Punch Out and says when the shift started. After punching out, it shows the day's in time, out time
and worked hours with no control at all.

**Depends on** the backend's Phase 15 (`GET /my/punch/open` reshaped to today's state).

- [X] T112 [US2] Reshape the open-punch client call to today's state —
      `{ punchedInAt, punchedOutAt, isComplete }` — in `app/lib/api/my-workspace.ts`, renaming it
      to match what it now answers
      per FR-019b, contracts/my-workspace-ui.md

- [X] T113 [US2] Drive the Punch action from that state in `app/ui/my/punch-clock.tsx`: Punch In
      when the day has no punch-in, Punch Out while the shift is open, and no control once
      `isComplete`
      per FR-019c

- [X] T114 [US2] Render the completed-day summary — in time, out time, worked hours — in place of
      the action once the day is complete. Not a disabled button: backend FR-008 allows one pair a
      day, so a control offered after that can only ever be refused, and a disabled one still
      advertises a capability that does not exist
      per FR-019c

- [X] T115 [US2] Keep the open-shift notice while a shift is running, and drop the "from an earlier
      day" variant — a stale punch-in is no longer reported by the endpoint and is no longer
      actionable
      per FR-019d, backend FR-008a

- [X] T116 [US2] Handle the backend's 409 alongside the existing 423 branch, surfacing the server's
      message rather than the generic save-failed copy
      per FR-019b, backend FR-008

- [X] T117 [US6] Confirm a queued offline punch refused on sync (409) still surfaces once through
      the existing `punchSyncFailed` path, rather than being dropped silently
      per FR-009, backend FR-008
