---

description: "Task list for feature implementation"
---

# Tasks: Recruitment & Onboarding Frontend

**Input**: Design documents from `/specs/011-recruitment/`
**Tests**: Manual per quickstart, plus targeted checks for PII non-persistence (SC-002), the
disabled-Save reconciliation guard (SC-003), and 320px rendering (SC-004).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Shared Infrastructure

- [ ] T001 [P] Add "Recruitment" nav group to `nav-links.tsx`
- [ ] T002 Create `app/dashboard/recruitment/layout.tsx` (breadcrumb + sub-nav)
- [ ] T003 Create `app/lib/api/recruitment.ts` with all typed API function stubs
- [ ] T004 Extend `middleware.ts` with a `/dashboard/recruitment/*` matcher — `RECRUITMENT`, plus
      `REPORTS` on report sub-routes (spec FR-002)
- [ ] T005 [P] Add recruitment routes, stage names, status labels, and badge colour maps to the
      constants module (spec FR-017)
- [ ] T006 [P] Add a shared `usePermission` affordance so approve-only actions are **not rendered**
      rather than disabled (spec FR-003)

**Checkpoint**: Nav, layout, API module, guard, and constants ready.

---

## Phase 2: Types and zod schemas

- [ ] T007 Define every interface and zod schema in `app/lib/api/recruitment.ts` — data-model.md
- [ ] T008 [P] Add `.catch()` fallbacks on the stage and status enums so an unrecognised value
      renders rather than throwing (spec FR-025)

---

## Phase 3: US1 — Requisitions (P1) 🎯 MVP

- [ ] T009 [US1] `requisition-form.tsx`: department/designation from `settings.ts`, CTC min/max
      cross-field validation, employment type, target date
- [ ] T010 [US1] `requisition-table.tsx`: `ResponsiveList`, positions filled/total, age,
      `StatusBadge` with the documented colour map
- [ ] T011 [US1] `app/dashboard/recruitment/requisitions/page.tsx`: list, filters, and
      submit/approve/reject actions gated by permission rendering (spec FR-003)
- [ ] T012 [US1] Delete 409 surfaced as a toast naming the candidate count (spec FR-012)
- [ ] T013 [P] [US1] Skeleton / empty / error-with-retry states (spec FR-026)

---

## Phase 4: US2 & US3 — Pipeline and Interviews (P1)

- [ ] T014 [US2] `pipeline-table.tsx` (`ResponsiveList`) driven by the `?stage=` filter
      (spec FR-007)
- [ ] T015 [US2] `pipeline-board.tsx` (client): drag-and-drop stage columns
- [ ] T016 [US2] View toggle persisted per user; **board auto-falls back to the table below the
      mobile breakpoint** (spec FR-008)
- [ ] T017 [US2] Optimistic stage move with revert-on-409 showing the current stage from the
      response (spec FR-009)
- [ ] T018 [US2] `candidate-form.tsx`: duplicate phone/email 409 inline with a link to the existing
      candidate
- [ ] T019 [US2] `candidate-drawer.tsx`: masked values as returned; **Reveal re-fetches the detail
      endpoint into component state only — never the react-query cache, localStorage, or
      sessionStorage** (spec FR-006)
- [ ] T020 [US2] `noShow` warning marker and the Joining Pending overdue filter
- [ ] T021 [US3] `interview-schedule.tsx`: Today / Upcoming / Overdue grouping; round-number 409
      inline
- [ ] T022 [US3] `interview-feedback-form.tsx`: outcome, 1–10 score, comments, all required;
      **action not rendered for non-interviewers without the permission**
- [ ] T023 [US3] Per-interviewer feedback listed separately on a multi-interviewer round
- [ ] T024 [US3] Advance-to-Selected blocked with the pending rounds named and linked
- [ ] T025 [P] [US2] Verify by inspection that no unmasked PII reaches any client-side storage
      (SC-002)

**Checkpoint**: Interviews, Selected, and Joining Pending all resolve as deep links (SC-006).

---

## Phase 5: US4 — Offers (P1)

- [ ] T026 [US4] `salary-breakup-editor.tsx`: `useFieldArray` rows with a live total and a live
      variance against `offeredCtc / 12`
- [ ] T027 [US4] **Disable Save while the variance exceeds tolerance** (spec FR-010) — the
      deterministic client-side rule ratified 2026-09-01
- [ ] T028 [US4] `offer-modal.tsx`: outside-budget inline warning; Issue requires the approve
      permission
- [ ] T029 [US4] Generate Letter with a progress state; **missing-template 409 surfaced with a link
      to the template screen** (spec FR-013)
- [ ] T030 [US4] Accepted offers render read-only with a "revise by issuing a new offer" affordance;
      superseded offers in a collapsed history
- [ ] T031 [P] [US4] Verify Save stays disabled for a non-reconciling breakup (SC-003)

---

## Phase 6: US5 — Joining and Onboarding (P1)

- [ ] T032 [US5] `joining-form.tsx`: success state showing the generated employee code with links to
      the employee record and the onboarding screen
- [ ] T033 [US5] Delayed-joining marker with the day count; no-show handling
- [ ] T034 [US5] `app/dashboard/recruitment/onboarding/[employeeId]/page.tsx`: items grouped
      Documents / Kit / Induction with a completed-count progress indicator
- [ ] T035 [US5] `document-verify-form.tsx`: number-format validated client-side before submit;
      typed `accept`; upload progress; **a failed upload does not roll back the parent record**
      (spec FR-021)
- [ ] T036 [US5] `kit-issue-form.tsx`: quantity, with the resulting issue reference shown when linked
- [ ] T037 [US5] Waive **not rendered** without the approve permission; requires a non-empty reason
- [ ] T038 [US5] Attendance-blocked marker stating the existing Settings gate as a consequence —
      **no second client-side check** (spec US5 scenario 9)

---

## Phase 7: US6 & US7 — Letters and Resignations (P2)

- [ ] T039 [US6] `letter-template-editor.tsx`: plain textarea plus a token palette inserting at
      cursor
- [ ] T040 [US6] **Unknown tokens highlighted and Save disabled** (spec FR-011) — the second
      deterministic client-side rule
- [ ] T041 [US6] Activation visibly deactivates the prior active template of that type in the same
      list update
- [ ] T042 [US6] `letters-table.tsx`: expandable version history, every version downloadable
      **through the typed client** (spec FR-004)
- [ ] T043 [US6] Relieving-letter 409 surfaced with a link to the payroll screen
- [ ] T044 [US7] `resignation-form.tsx`: live-computed expected last working day; waiver fields
      appear when the agreed date is earlier; 409s surfaced with reason
- [ ] T045 [US7] `resignation-report.tsx`: tenure, reason-category aggregates, attrition rate,
      settlement-pending marker

**Unblocks**: 005's amendment (its exit/F&F links depend on T044 and T029/T043).

---

## Phase 8: US8 — Reports (P3)

- [ ] T046 [US8] `new-joinings-report.tsx` with period, department, and project filters
- [ ] T047 [US8] `funnel-report.tsx`: stage counts, conversion percentages, time-to-hire, per-source
      breakdown — plain SVG/CSS, **computed bar dimensions isolated to a single named line**
      (spec FR-020)
- [ ] T048 [US8] Export reusing the established synchronous-download / async-job handling
      (spec FR-022)
- [ ] T049 [P] [US8] Distinct empty states, not errors; `REPORTS` guard verified

---

## Phase 9: Polish

- [ ] T050 [P] Verify `formatCurrency` on every monetary field and `StatusBadge` on every status
- [ ] T051 [P] Verify skeleton / empty / error-with-retry on every list (spec FR-026)
- [ ] T052 TypeScript type check (`npx tsc --noEmit`)
- [ ] T053 Spot-check every screen at 320px and for keyboard operability; confirm the board's table
      fallback and that no action is hover-gated (SC-004)
- [ ] T054 Enumerate every backend 409 in this module and confirm each maps to a specific,
      actionable message (SC-005)

## Dependencies

```
Phase 1-2 → US1 → US2 → US3 → US4 → US5 → US6
                                    → US7 (independent of the funnel)
                                    → US8 (needs US2/US5/US7)

External: backend 011 must exist. 005's amendment blocks on T029/T043/T044.
          004's Department Dashboard reads Open Positions from T011.
```

## Implementation Strategy

**MVP (Phases 1–6)**: the full funnel to an administrable employee — the gap the matrix names.
**Increment 2 (Phase 7)**: letters and resignations — also unblocks 005.
**Increment 3 (Phase 8)**: reporting.
