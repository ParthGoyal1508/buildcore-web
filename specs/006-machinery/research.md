# Research: Machinery Module Frontend

## 1. Route structure: `/dashboard/plant/*`

**Decision**: All nine screens live under `/dashboard/plant/*`
(`/dashboard/plant`, `/logbook`, `/fuel`, `/maintenance`, `/hire-bills`, `/categories`,
`/doc-types`, `/rates`, `/utilization`), resolving the existing `nav-links.tsx` "Plant & Machinery"
entry.

**Rationale**: `nav-links.tsx` already points there — the same "resolve the existing link" pattern
used by every admin-facing feature so far (HR & Payroll's `/dashboard/hr`).

## 2. Modals vs. dedicated pages

**Decision**: Add/Edit Equipment, New Maintenance Job, New Service Schedule, and Add Hire Bill are
all modals; Equipment's Documents live on a dedicated per-machine detail page
(`/dashboard/plant/[id]`); every other screen is its own top-level list page.

**Rationale**: Matches the PRD's own explicit "Modal" naming for each add/edit flow (all are flat,
single-submit forms, unlike HR & Payroll's eight-tab Employee form) — no dedicated-page research
question needed here, unlike that feature.

## 3. Charting: `recharts`

**Decision**: The Utilization Report's horizontal stacked-bar band distribution is built with
`recharts` (now pre-approved via constitution amendment, v1.1.0 → v1.2.0).

**Rationale**: User-selected when asked (AskUserQuestion) over the CSS-only alternative, since no
chart-like visual exists anywhere in `buildcore-web` yet and the team wants charting
infrastructure in place rather than a one-off CSS bar.

**Alternatives considered**: A CSS-only proportional flexbox bar — the lower-dependency option;
not selected.

## 4. Documents UI pattern

**Decision**: Equipment's per-machine Documents section (`/dashboard/plant/[id]`) is a new
`app/ui/machinery/equipment-documents.tsx` component, visually mirroring the UI pattern
established by HR & Payroll's `documents-tab.tsx`, but with its own `app/lib/api/machinery.ts`
data-fetching functions (`listEquipmentDocuments`, `uploadEquipmentDocument`) — never importing or
reusing HR's Employee-specific component or its API functions.

**Rationale**: Directly applies this project's established "component *pattern* reuse, data-
fetching stays feature-specific" principle (the same distinction made for the salary-slip
component vs. its data-fetching function in HR & Payroll).

## 5. Vendor dropdowns (no vendor management UI)

**Decision**: Fuel Entry's and Hire Bill's Vendor fields are `<select>` dropdowns populated from
the backend's existing (interim) vendor-list endpoint. This feature builds no vendor management
screen.

**Rationale**: The PRD frames vendors as coming "from Partners," and `buildcore-api`'s Machinery
backend (specs/006-machinery-backend) already notes its own `VendorsController` as an interim gate
pending a real Partners feature — this frontend follows the same scope boundary rather than
building UI for a module that doesn't exist yet.

## 6. Middleware permission mapping

**Decision**: `middleware.ts` gains a `/dashboard/plant/*` route matcher mapping each sub-path to
its permission: `ASSET_REGISTER` (equipment, `/[id]`, utilization report), `LOGBOOK`, `FUEL`,
`MAINTENANCE`, `HIRE_BILLS`, `MACHINERY_SETTINGS` (categories, doc-types, rates) — mirroring
`buildcore-api`'s own six-value permission set (specs/006-machinery-backend) exactly.

**Rationale**: Same pattern as every prior admin-facing feature's middleware extension (Settings,
My Workspace, Dashboard, HR & Payroll); prevents the recurring "middleware not extended for the
new route prefix" gap this session's analyze passes have repeatedly caught.

## 7. API access

**Decision**: All Machinery API calls go through a new `app/lib/api/machinery.ts`, `zod`-
validating every response against the shapes in `buildcore-api`'s contracts/machinery-api.md — no
component makes a direct `fetch()` call.

**Rationale**: Constitution Principle V/IV, applied identically to every prior feature.

## 8. Dashboard/Notification integration

**Decision**: This feature adds zero widget-specific or notification-specific frontend code. Once
`buildcore-api`'s Machinery backend registers its new providers into the Dashboard's existing
`WIDGET_PROVIDERS`/`NOTIFICATION_PROVIDERS` registries, the Dashboard feature's already-built
generic `WidgetRenderer` and notification dropdown automatically render the new Machinery Cost/
Fuel Cost/Hire Bills widgets and Document Expiry/Fuel Variance/Maintenance Due notifications —
exactly the "adding a real tile later requires zero frontend change" guarantee the Dashboard
feature was built for.

**Rationale**: Directly follows from the Dashboard feature's own architecture; nothing new to
decide here.
