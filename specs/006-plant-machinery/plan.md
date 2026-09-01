# Implementation Plan: Plant & Machinery Frontend

**Branch**: `006-plant-machinery` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-plant-machinery/spec.md`

**Note**: this plan was created during the 2026-09-01 gap-closure pass. This feature was the only
frontend feature with no `plan.md` — it had `spec.md` and `tasks.md` alone. Creating it in full
(original scope plus the amendment) rather than only planning the amendment was ratified with the
user on 2026-09-01, bringing the feature to parity with the other eight.

## Summary

Build six route areas under `/dashboard/plant/*` — Asset Register, Logbook, Fuel, Maintenance,
Service Schedules, and Hire Bills — plus a Reference Data Masters screen and, per the 2026-09-01
amendment, Spare Parts stock and Service Bills. Key UI behaviours: live client-side computation of
Logbook Total Hours (`closing − opening`) and Fuel Amount (`qty × rate`), document expiry badges
visible on the register list without opening a detail, equipment status badges reflecting backend
auto-transitions, and — new in the amendment — live `Qty × Rate` on parts receipt plus read-only
computed TDS and Net Payable on service bills.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + `zod`, `@tanstack/react-query`,
`formatCurrency` (008), `StatusBadge` (007/008), `ResponsiveList`, `skeletons.tsx`. No new
dependency.

**Storage**: N/A — all data in `buildcore-api` feature 006.

**Testing**: Manual per the feature's tasks walkthrough.

**Performance Goals**: Register and logbook lists render 500 rows within 3 seconds, matching 009's
established target.

**Constraints**: All API calls through `app/lib/api/plant.ts` (spec FR-007); all monetary values via
`formatCurrency` (spec FR-006); every list screen uses `ResponsiveList` (spec FR-010); equipment
document alert badges must be visible on the list itself (spec FR-004).

**Scale/Scope**: ~8 route files, ~22 components (original ~16 plus ~6 from the amendment).

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| I. Component-based, server-first | Server Components by default; `"use client"` confined to modals, filters, and the live-computation forms. | PASS |
| II. No inline styles | Tailwind + `clsx` throughout. | PASS |
| III. Centralized constants | Routes, status names, payment-status labels and colour maps in constants. | PASS |
| IV. Type safety + zod | Every response validated at the boundary. | PASS |
| V. API access boundary | All calls via `app/lib/api/plant.ts` (spec FR-007, FR-018). | PASS |
| VI. Mobile-first (NON-NEGOTIABLE) | `ResponsiveList` on every list (spec FR-010, FR-019); 44×44px targets; no horizontal page scroll at 320px. | PASS |
| `middleware.ts` route guard | `/dashboard/plant/*` guarded per sub-route (spec FR-009); spare parts and service bills reuse `MAINTENANCE` (spec FR-011). | PASS |

## Project Structure

```text
app/dashboard/plant/
├── layout.tsx
├── register/page.tsx
├── logbook/page.tsx
├── fuel/page.tsx
├── maintenance/page.tsx
├── service-schedules/page.tsx
├── hire-bills/page.tsx
└── spare-parts/page.tsx        # NEW — 2026-09-01 amendment

app/lib/api/plant.ts
app/ui/plant/
middleware.ts                    # /dashboard/plant/* permission mapping
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] "Plant" nav group in `nav-links.tsx`; `app/dashboard/plant/layout.tsx`
- [ ] `app/lib/api/plant.ts` with all typed API function stubs
- [ ] `middleware.ts` matcher for `/dashboard/plant/*` per sub-route (spec FR-009)
- [ ] Plant constants — statuses, payment statuses, colour maps

### Phase 2: Types and zod schemas

- [ ] Define every interface and zod schema in `app/lib/api/plant.ts`

### Phase 3: US7 & US1 — Masters and Asset Register (P1)

- [ ] Reference Data Masters screen — Categories, Doc Types, Hire Rates (spec FR-008)
- [ ] `EquipmentTable.tsx` (`ResponsiveList`) with **document expiry badges on the list row**
      (spec FR-004) and status badges reflecting backend transitions (spec FR-005)
- [ ] `EquipmentForm.tsx` + document upload

### Phase 4: US2 — Logbook (P1)

- [ ] `LogbookForm.tsx` with **live Total Hours = closing − opening** as a read-only field
      (spec FR-002); `closing < opening` client-side guard
- [ ] `LogbookTable.tsx`; duplicate equipment+date 409 surfaced inline

### Phase 5: US3 — Fuel (P2)

- [ ] `FuelForm.tsx` with **live Amount = qty × rate** (spec FR-003)
- [ ] Variance alert surfaced on the list from the backend's computed flag

### Phase 6: US4 & US5 — Maintenance and Service Schedules (P2)

- [ ] `MaintenanceJobForm.tsx` + list; equipment status badge updates on open/close
- [ ] `ServiceScheduleTable.tsx` with ok / due soon / overdue status from the API

### Phase 7: US6 — Hire Bills (P3)

- [ ] `HireBillForm.tsx` with read-only computed TDS and Net Payable; verify/pay state transitions
- [ ] `HireBillTable.tsx` with payment status badges

### Phase A8: US8 & US9 — Spare Parts and Service Bills (P2) — 2026-09-01 amendment

- [ ] `SparePartTable.tsx` (`ResponsiveList`): stock, avg rate, stock value, reorder level with a
      **low-stock marker on the row** (spec amendment US8 scenario 2)
- [ ] `SparePartForm.tsx`: duplicate part-number 409 inline; optional inventory-item link
- [ ] `ReceivePartModal.tsx` with **live Amount = Qty × Rate** (spec FR-012)
- [ ] `JobPartsTab.tsx`: consumption with a live available-stock hint disabling Save when exceeded
      (spec FR-014); incompatible-part **non-blocking warning** (spec FR-015); Add Part disabled on a
      closed job with an explanatory tooltip (spec FR-016); reverse requires a reason
- [ ] `ServiceBillForm.tsx`: **TDS Amount and Net Payable as read-only computed fields, never
      editable inputs** (spec FR-013); duplicate bill-number 409 inline; Pay disabled while
      unverified with a tooltip (spec FR-016)
- [ ] `ServiceBillTable.tsx` with payment status badges (spec FR-020)
- [ ] Linked-part reconciliation view showing both balances side by side (spec FR-017)
- [ ] Equipment maintenance-cost panel — parts / internal labour / service bills / total

### Phase 9: Polish

- [ ] Verify `formatCurrency` (spec FR-006) and `StatusBadge` usage throughout
- [ ] Verify no computed financial field is an editable input (spec SC-A02)
- [ ] TypeScript type check (`npx tsc --noEmit`)
- [ ] Spot-check every list at a mobile viewport and for keyboard operability (spec FR-010, FR-019)
