# Data Model: Recruitment & Onboarding Frontend

**Feature**: `011-recruitment` | **Date**: 2026-09-01

All types are `z.infer` from schemas defined in `app/lib/api/recruitment.ts`. No hand-written
duplicate interfaces (constitution Principle IV). Every schema below is applied at the API boundary.

## zod schemas and inferred types

| Schema | Key fields | Notes |
|---|---|---|
| `requisitionSchema` | code, departmentId, designationId, positionCount, filledPositions, employmentType, projectId?, siteId?, targetJoiningDate, budgetedCtcMin/Max, justification, status | `openPositions` derived client-side as `positionCount − filledPositions` |
| `candidateSchema` | id, requisitionId, fullName, phone, email, totalExperienceYears, currentEmployer?, currentCtc?, expectedCtc?, source, referredByEmployeeId?, resumeRef?, stage, employeeId?, flags | **phone/email/CTC arrive masked**; the same schema parses the unmasked detail response |
| `candidateStageSchema` | `z.enum([...]).catch('unknown')` | The `.catch` is what satisfies spec FR-025 — an unrecognised stage renders rather than throwing |
| `stageHistorySchema` | fromStage, toStage, actorName, occurredAt, remarks? | Read-only |
| `interviewSchema` | candidateId, roundNumber, roundType, scheduledAt, mode, location?, interviewers[], status, rescheduleCount | Grouped client-side into Today / Upcoming / Overdue |
| `interviewFeedbackSchema` | interviewerId, outcome, score (1–10), comments | One row per interviewer |
| `offerSchema` | designationId, departmentId, offeredCtc, salaryBreakup[], proposedJoiningDate, confirmedJoiningDate?, probationMonths, noticePeriodDays, reportingManagerId, outsideBudget, status, letterId? | |
| `salaryComponentSchema` | name, monthlyAmount | Array drives `SalaryBreakupEditor` |
| `joiningSchema` | actualJoiningDate, dateOfBirth, gender, permanentAddress, emergencyContact, siteId? | |
| `onboardingItemSchema` | itemType, documentTypeId?, kitItemId?, status, completedBy?, completedAt?, waiverReason?, linkedIssueId? | |
| `letterTemplateSchema` | letterType, name, bodyTemplate, letterheadAssetId?, isActive | |
| `generatedLetterSchema` | letterType, employeeId?, candidateId?, version, isSuperseded, issuedAt, downloadUrl | |
| `resignationSchema` | employeeId, resignationDate, reasonCategory, reasonDetail, noticePeriodDays, expectedLastWorkingDay, agreedLastWorkingDay?, noticeWaiverDays?, status | |
| `funnelReportSchema` | stageCounts, conversions[], averageTimeToHireDays, sourceBreakdown[] | |

## Client-side derived values (never sent to the API)

- `openPositions = positionCount − filledPositions`
- `breakupTotal = Σ salaryBreakup[].monthlyAmount`
- `breakupVariance = breakupTotal − (offeredCtc / 12)` — **drives the disabled Save** (spec FR-010)
- `expectedLastWorkingDay = resignationDate + noticePeriodDays` — displayed live before submit
- `unknownTokens` — template body tokens not in the type's documented set (spec FR-011)

## Component inventory (`app/ui/recruitment/`)

| Component | Client? | Purpose |
|---|---|---|
| `requisition-table.tsx` | – | `ResponsiveList` list with positions and status badge |
| `requisition-form.tsx` | ✓ | Create/edit with CTC cross-field validation |
| `pipeline-table.tsx` | – | Stage-filtered `ResponsiveList` view |
| `pipeline-board.tsx` | ✓ | Drag-and-drop columns; falls back to table below the mobile breakpoint |
| `candidate-form.tsx` | ✓ | Create with duplicate 409 inline |
| `candidate-drawer.tsx` | ✓ | Masked detail + Reveal (component state only — never cached) |
| `interview-schedule.tsx` | ✓ | Schedule/reschedule with round-number 409 |
| `interview-feedback-form.tsx` | ✓ | Per-interviewer outcome/score/comments |
| `salary-breakup-editor.tsx` | ✓ | `useFieldArray` rows, live total and variance |
| `offer-modal.tsx` | ✓ | Composes the breakup editor; outside-budget warning |
| `joining-form.tsx` | ✓ | Creates the employee; success shows the generated code |
| `onboarding-checklist.tsx` | – | Grouped items with progress |
| `document-verify-form.tsx` | ✓ | Number-format check, typed upload |
| `kit-issue-form.tsx` | ✓ | Quantity + linked issue reference |
| `letter-template-editor.tsx` | ✓ | Textarea + token palette, unknown-token highlighting |
| `letters-table.tsx` | – | Version history, download via typed client |
| `resignation-form.tsx` | ✓ | Live expected-last-working-day |
| `funnel-report.tsx` | – | Plain SVG/CSS funnel; computed bar dimensions on one named line |
| `new-joinings-report.tsx` | – | Tabular report |
| `resignation-report.tsx` | – | Tenure, reason aggregates, attrition |

## Cross-module reads

| Need | Existing module |
|---|---|
| Departments, designations, document types | `app/lib/api/settings.ts` |
| Employee record link after joining | `app/lib/api/` HR module |
| Kit issue → inventory | `app/lib/api/inventory.ts` |
| Sites/projects on a requisition | `app/lib/api/projects.ts` |

## Storage policy

Nothing from this feature is written to `localStorage` or `sessionStorage` except the pipeline
view-mode preference (table vs board). **The unmasked candidate payload is held in component state
only** and is never placed in the react-query cache — the Reveal action uses a non-cached fetch
(spec FR-006, SC-002).
