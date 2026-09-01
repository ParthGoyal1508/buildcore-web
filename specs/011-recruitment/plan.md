# Implementation Plan: Recruitment & Onboarding Frontend

**Branch**: `011-recruitment` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-recruitment/spec.md`

## Summary

Build seven route areas under `/dashboard/recruitment/*` — Requisitions (Open Positions), the
candidate Pipeline (one screen serving the matrix's Interviews / Selected / Joining Pending via a
deep-linkable `?stage=` filter, with a board and a table view), Interviews, Offers, Onboarding,
Letter Templates and Letters, Resignations, and Reports. Key UI behaviours: masked PII rendered
exactly as returned with a deliberate re-fetch to reveal, a live-reconciling salary-component editor
that disables Save before the backend can reject it, a token-validating letter-template editor, and
optimistic board moves that revert on conflict.

**Created by the 2026-09-01 gap-closure pass** against the module/submodule matrix, which found
rows 22 and 23 entirely uncovered by frontend specs 001–010.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + `zod`, `@tanstack/react-query`,
`formatCurrency` (008), `StatusBadge` (007/008), `ResponsiveList` (006/009), `skeletons.tsx`.
**One new dependency is expected** for the board's drag-and-drop; it must be keyboard-accessible and
is a research decision, not assumed here. The funnel chart is plain SVG/CSS — no charting library.

**Storage**: N/A — all data in `buildcore-api` feature 011.

**Testing**: Manual per quickstart.md, plus targeted checks for PII non-persistence (SC-002) and the
disabled-Save reconciliation guard (SC-003).

**Performance Goals**: Letter generation feedback within 10s for one employee (SC-007). Pipeline
board renders 200 candidate cards without jank.

**Constraints**: All API calls through `app/lib/api/recruitment.ts`; department/designation
dropdowns reuse the existing `settings.ts` module; no candidate-facing or public route is added
(ratified 2026-09-01); the unmasked candidate payload must never reach any client-side cache.

**Scale/Scope**: ~10 route files, ~24 components, ~30 typed API functions.

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| I. Component-based, server-first | Server Components by default; `"use client"` confined to the board, the component-row editor, the template editor, and modals. Data shaping in `app/lib/`. | PASS |
| II. No inline styles | Tailwind + `clsx` throughout. The funnel chart's computed bar dimensions are the single permitted numeric exception, isolated to one named line (spec FR-020). | PASS |
| III. Centralized constants | Routes, stage names, status labels, and badge colour maps in a constants module — no inline literals (spec FR-017). | PASS |
| IV. Type safety + zod | Every response validated at the boundary; `z.infer` used downstream (spec FR-005). | PASS |
| V. API access boundary | All calls via `app/lib/api/recruitment.ts`; no raw `fetch()` in any component (spec FR-004). | PASS |
| VI. Mobile-first (NON-NEGOTIABLE) | `ResponsiveList` on every list; board falls back to the table below the mobile breakpoint (spec FR-008); 44×44px targets; no hover-gated action; wide tables and the funnel scroll in their own container. | PASS |
| `middleware.ts` route guard | `/dashboard/recruitment/*` guarded with `RECRUITMENT`; report routes additionally `REPORTS` (spec FR-002). | PASS |

## Project Structure

```text
app/dashboard/recruitment/
├── layout.tsx
├── requisitions/page.tsx
├── pipeline/page.tsx                 # ?stage= deep link, board + table
├── interviews/page.tsx
├── onboarding/[employeeId]/page.tsx
├── letter-templates/page.tsx
├── letters/page.tsx
├── resignations/page.tsx
└── reports/
    ├── new-joinings/page.tsx
    ├── funnel/page.tsx
    └── resignations/page.tsx

app/lib/api/recruitment.ts
app/ui/recruitment/                   # ~24 components per data-model.md
middleware.ts                          # MODIFIED — /dashboard/recruitment/* mapping
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Add "Recruitment" nav group to `nav-links.tsx`
- [ ] Create `app/dashboard/recruitment/layout.tsx` (breadcrumb + sub-nav)
- [ ] Create `app/lib/api/recruitment.ts` with all typed API function stubs
- [ ] Extend `middleware.ts` with a `/dashboard/recruitment/*` matcher — `RECRUITMENT`, plus
      `REPORTS` on report sub-routes (spec FR-002)
- [ ] Add recruitment routes, stage names, status labels and badge colour maps to the constants
      module (spec FR-017)
- [ ] Add a shared `usePermission` affordance so approve-only actions are **not rendered** rather
      than disabled (spec FR-003)

**Checkpoint**: Nav, layout, API module, route guard, and constants ready.

### Phase 2: Types and zod schemas

- [ ] Define every interface and zod schema in `app/lib/api/recruitment.ts` — data-model.md
- [ ] Include a permissive fallback for unrecognised stage/status values so an unknown value renders
      rather than throwing (spec FR-025)

**Checkpoint**: All types defined; components buildable with correct prop shapes.

### Phase 3: US1 — Requisitions (P1) 🎯 MVP

- [ ] `RequisitionForm.tsx`: department/designation from `settings.ts`, CTC min/max cross-field
      validation, employment type, target date
- [ ] `RequisitionTable.tsx`: `ResponsiveList`-based, positions filled/total, age, `StatusBadge`
- [ ] `app/dashboard/recruitment/requisitions/page.tsx`: list + filters, submit/approve/reject
      actions gated by permission rendering
- [ ] 409 on delete surfaced as a toast naming the candidate count (spec FR-012)

**Checkpoint**: Open Positions is independently usable.

### Phase 4: US2 & US3 — Pipeline and Interviews (P1)

- [ ] `PipelineTable.tsx` (`ResponsiveList`) and `PipelineBoard.tsx` (client, drag-and-drop)
- [ ] View toggle persisted per user; board auto-falls back to table below the mobile breakpoint
      (spec FR-008)
- [ ] `?stage=` deep link drives both views (spec FR-007)
- [ ] Optimistic stage move with revert-on-409 showing the current stage from the response
      (spec FR-009)
- [ ] `CandidateForm.tsx` with duplicate-phone/email 409 surfaced inline plus a link to the existing
      candidate
- [ ] `CandidateDrawer.tsx`: masked values as returned; "Reveal" re-fetches the detail endpoint and
      holds the unmasked payload in component state only — never react-query cache, localStorage, or
      sessionStorage (spec FR-006)
- [ ] `InterviewSchedule.tsx` + `InterviewFeedbackForm.tsx`: Today / Upcoming / Overdue grouping,
      per-interviewer feedback, feedback action hidden for non-interviewers
- [ ] Advance-to-Selected blocked with pending rounds named and linked

**Checkpoint**: The matrix's Interviews, Selected, and Joining Pending items all resolve.

### Phase 5: US4 — Offers (P1)

- [ ] `SalaryBreakupEditor.tsx`: repeatable rows via `useFieldArray`, live total and live variance
      against `offeredCtc / 12`, **Save disabled while variance exceeds tolerance** (spec FR-010) —
      a deterministic client-side rule per the 2026-09-01 ratification
- [ ] `OfferModal.tsx`: outside-budget inline warning; Issue action requires the approve permission
- [ ] Generate Letter action with progress state; missing-template 409 surfaced with a link to the
      template screen (spec FR-013)
- [ ] Accepted offers render read-only with a "revise by issuing a new offer" affordance

**Checkpoint**: Offers issue and accept; candidates reach Joining Pending.

### Phase 6: US5 — Joining and Onboarding (P1)

- [ ] `JoiningForm.tsx`: success state showing the generated employee code with links to 005 and the
      onboarding screen; delayed-joining marker
- [ ] `app/dashboard/recruitment/onboarding/[employeeId]/page.tsx`: items grouped Documents / Kit /
      Induction with a progress indicator
- [ ] `DocumentVerifyForm.tsx`: number-format validated client-side before submit; typed `accept`
      attribute; upload progress; a failed upload does not roll back the parent (spec FR-021)
- [ ] `KitIssueForm.tsx`: quantity, and the resulting issue reference displayed when linked
- [ ] Waive action hidden without the approve permission; requires a non-empty reason
- [ ] Attendance-blocked marker states the existing Settings gate as a consequence, adding no second
      client-side check (spec US5 scenario 9)

**Checkpoint**: A candidate becomes an employee administrable by 005.

### Phase 7: US6 & US7 — Letters and Resignations (P2)

- [ ] `LetterTemplateEditor.tsx`: plain textarea plus a token palette that inserts at cursor;
      unknown tokens highlighted and **Save disabled** (spec FR-011) — the second deterministic
      client-side rule
- [ ] Activation visibly deactivates the prior active template of that type in the same update
- [ ] `LettersTable.tsx`: version history expandable, every version downloadable through the typed
      client
- [ ] Relieving-letter 409 surfaced with a link to the payroll screen
- [ ] `ResignationForm.tsx`: live-computed expected last working day; waiver fields appear when the
      agreed date is earlier; 409s surfaced with reason
- [ ] `app/dashboard/recruitment/reports/resignations/page.tsx`: tenure, reason aggregates, attrition

**Checkpoint**: 005's exit flow can link here; letters generate.

### Phase 8: US8 — Reports (P3)

- [ ] `NewJoiningsReport.tsx` and `FunnelReport.tsx` (plain SVG/CSS funnel; computed bar dimensions
      isolated to a single named line — spec FR-020)
- [ ] Conversion percentages, average time-to-hire, per-source breakdown
- [ ] Export reusing the established synchronous-download / async-job handling (spec FR-022)
- [ ] Distinct empty states, not errors

### Phase 9: Polish

- [ ] Verify `formatCurrency` on every monetary field and `StatusBadge` on every status
- [ ] Verify skeleton / empty / error-with-retry states on every list (spec FR-026)
- [ ] TypeScript type check (`npx tsc --noEmit`)
- [ ] Spot-check every screen at 320px and for keyboard operability; confirm the board's
      table fallback and that no action is hover-gated
- [ ] Confirm by inspection that no unmasked PII is written to any client-side storage (SC-002)
