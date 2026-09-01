# Data Model: Labour Management Frontend

**Feature**: `013-labour` | **Date**: 2026-09-01

All types are `z.infer` from schemas in `app/lib/api/labour.ts` (Principle IV). Applied at the API
boundary.

## zod schemas and inferred types

| Schema | Key fields | Notes |
|---|---|---|
| `skillCategorySchema` | name, code, defaultDailyRate? | `settings`-owned master |
| `wageRateSchema` | projectId, skillCategoryId, dailyRate, effectiveFrom, effectiveTo?, isCurrent, isLocked | `isLocked` drives read-only rendering (spec FR-018) |
| `labourWorkerSchema` | labourCode, fullName, phone, gender, dateOfBirth, aadhaarNumber?, bankAccount?, skillCategoryId, engagementType, contractorId?, siteId, rateOverride?, faceEnrolmentId?, status | **aadhaar/bankAccount arrive masked** |
| `gangSchema` | name, gangLeaderWorkerId, siteId, members[] | |
| `musterSchema` | siteId, date, supervisorId, latitude, longitude, accuracyMetres, geofenceViolation, lowGpsAccuracy, distanceFromFenceMetres?, source, capturedAt, receivedAt, isOfflineSynced, status, flags | |
| `musterLineSchema` | workerId, attendanceType, overtimeHours?, photoRef, faceMatchScore?, faceMatchLow, skillCategoryIdOnDay | `faceMatchLow` renders as a **subtle chip only** (spec FR-009) |
| `attendanceTypeSchema` | `z.enum([...]).catch('unknown')` | Satisfies spec FR-029 |
| `paymentSheetSchema` | projectId, periodFrom, periodTo, engagementType, status, grossTotal, deductionTotal, netTotal, denominationBreakup?, contractorGroups? | |
| `paymentSheetLineSchema` | workerId, daysWorked, overtimeHours, resolvedRate, rateSource, grossWage, deductions[], netPayable, paymentMode?, paidOn?, paidAmount?, shortPaymentReason?, acknowledgementRef?, carriedForwardBalance, status | |
| `denominationSchema` | denomination, count | Plus per-worker residual |
| `labourAdvanceSchema` | workerId, amount, reason, recoveryInstalments, instalmentAmount, recoveryStartPeriod, outstandingBalance, exceedsLimit, status, recoveryHistory[] | |

## Offline queue extension (reuses `app/lib/offline-queue.ts`)

The existing `OfflineQueueEntry` is **extended**, not replaced (spec FR-006):

```
OfflineQueueEntry  (existing: id, kind, payload, capturedAt, ...)
  └── kind: 'muster'          NEW discriminant
      payload: MusterDraft    site, date, GPS reading, worker lines with photo blobs
```

Existing functions are reused verbatim: `enqueue`, `listQueued`, `getQueuedCount`, `remove`,
`drainQueue`, and the `DrainFailure` / `DrainResult` shapes surface the retry state (spec FR-011).
**No second queue, no second IndexedDB store.**

## Client-side derived values

- `instalmentAmount = amount / recoveryInstalments` — displayed live before submit
- `cardsMissingPhotos` — count driving the **disabled Submit** in muster step 3 (spec FR-010)
- `attendanceTypeCounts` — the step-3 review summary
- Geofence result and distance come from **`punch-clock.tsx`'s existing handling**, not recomputed

**Not computed client-side**: gross wage, deductions, net payable, and the denomination breakup all
come from the API.

## Component inventory

| Component | Client? | Purpose |
|---|---|---|
| `app/ui/labour/muster-wizard.tsx` | ✓ | Three-step wizard shell |
| `muster-step-session.tsx` | ✓ | GPS/geofence via `punch-clock.tsx` handling; warn-and-proceed banner |
| `worker-muster-card.tsx` | ✓ | Photo via **`camera-capture.tsx`**, attendance type, OT field |
| `muster-step-review.tsx` | ✓ | Counts, missing-photo count, disabled Submit |
| `offline-queue-indicator.tsx` | ✓ | Uses `getQueuedCount` / `drainQueue` |
| `wage-rate-table.tsx` / `wage-rate-form.tsx` | – / ✓ | Effective-dated history, locked read-only |
| `worker-table.tsx` / `worker-form.tsx` | – / ✓ | Masked PII; conditional contractor field |
| `gang-form.tsx` | ✓ | Single-membership 409 inline |
| `muster-queue.tsx` / `muster-detail.tsx` | – | Approval; **photos lazy-loaded** (spec FR-028) |
| `generate-sheet-modal.tsx` | ✓ | Missing-rate 409 with a create-rate link |
| `payment-sheet-table.tsx` | – | Lines with rate source and column totals |
| `denomination-panel.tsx` | – | Note counts + residual, print-clean |
| `disburse-modal.tsx` | ✓ | Acknowledgement via **`camera-capture.tsx`** |
| `advance-form.tsx` / `advance-table.tsx` | ✓ / – | Live instalment, recovery history |
| `deployment-report.tsx` / `attendance-report.tsx` / `payment-register.tsx` | – | Reports |

## Cross-module reads

| Need | Existing module / component |
|---|---|
| Sites, geofences, projects | `app/lib/api/projects.ts` |
| Contractors | `app/lib/api/partners.ts` |
| Camera capture | `app/ui/my/camera-capture.tsx` — **reused** |
| GPS / geofence handling | `app/ui/my/punch-clock.tsx` — **reused** |
| Offline queue | `app/lib/offline-queue.ts` — **extended, not duplicated** |
| Face enrolment | 003's existing enrolment flow |

## Storage policy

IndexedDB is used **only** through the existing offline queue, holding in-progress and queued
musters including photo blobs until they drain. **Masked worker PII is never written to any
client-side cache or storage, and the unmasked detail payload is never persisted** (spec FR-013,
SC-005).
