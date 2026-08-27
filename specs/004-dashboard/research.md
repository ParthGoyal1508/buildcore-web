# Research: Dashboard & General Frontend (Widgets, Notifications, Activity Log, Reports)

## 1. Generic widget renderer: one switch component, no per-widget components

**Decision**: A single `<WidgetRenderer entry={WidgetResult} />` component
(`app/ui/dashboard/widget-renderer.tsx`) switches on `entry.displayType` (`'kpi' | 'table' | 'list'
| 'stat'`) to one of four small presentational components (`KpiCard`, `WidgetTable`, `WidgetList`,
`StatCard`), or — when `entry.unavailable` is present — a shared `ComingSoonCard` regardless of
`displayType`; an unrecognized `displayType` falls back to a shared `UnsupportedWidgetCard` (spec
FR-017). Every screen in this feature (`/dashboard`, `/dashboard/site`, `/dashboard/group`) maps
its widget-list response through this one component — no `if (entry.id === 'total-employees')`
branch exists anywhere.

**Rationale**: This is the spec's own central constraint (FR-001, SC-002) — a real test of the
architecture is that a brand-new widget id, unknown at build time, still renders correctly through
this switch purely from its `displayType`/`section`/`value` shape.

**Alternatives considered**: A per-widget component registry keyed by `id` (mirroring the backend's
own provider-per-widget pattern) — rejected: that's the right pattern *server-side* (each widget's
distinct *computation* logic genuinely differs), but client-side there is no per-widget
*rendering* logic to justify it — the whole point is that four generic renderers cover every shape
the backend can produce.

## 2. Replacing the existing hardcoded `CardWrapper`

**Decision**: `app/dashboard/page.tsx` and `app/ui/dashboard/cards.tsx` (today: a hardcoded
`getDashboardSummary()` returning zeros, per its own comment "replace with a real call... once the
HR/Projects/Plant/Reports modules exist") are replaced by a data-fetching Server Component wrapper
around `WidgetRenderer`-mapped output, laid out by `section`.

**Rationale**: This is exactly the placeholder the existing code's own comment anticipates
replacing; this feature is that replacement.

**Alternatives considered**: Leave `cards.tsx` in place alongside the new widget system — rejected:
would leave two competing sources of "what the Dashboard shows," contradicting FR-004's single
widget-list call.

## 3. Route placement and shell additions

**Decision**: `/dashboard` (existing), `/dashboard/group`, `/dashboard/site`, `/dashboard/
activity-log`, `/dashboard/reports` (the `/dashboard/reports` segment is new — `nav-links.tsx`'s
existing "Reports" entry currently points nowhere real yet). `nav-links.tsx` gains "Group
Dashboard," "Site Dashboard," and "Activity Log" entries alongside the existing eight. Notifications
are a header-anchored dropdown panel (per clarification), not a route.

**Rationale**: Consistent with the Settings feature's already-established `/dashboard/*` nesting
precedent (that feature's own research.md §1).

**Alternatives considered**: None seriously — this is a settled precedent, not a fresh decision.

## 4. Data fetching: `@tanstack/react-query` with polling

**Decision**: Every list in this feature (widgets, notifications, activity log, report types/
results, export-job status) uses `@tanstack/react-query` (already introduced by the Settings
feature), with `refetchInterval` set to the documented refresh interval (30s, matching the
backend's own documented default) for widgets and the notification count/list; other lists (activity
log, report results) fetch on demand/filter-change only, not polled.

**Rationale**: Consistent with this repo's own precedent (Settings feature's research.md §3);
`refetchInterval` is react-query's built-in polling primitive — no custom interval/timer code
needed, satisfying FR-005/FR-008 without inventing a new mechanism.

**Alternatives considered**: A custom `setInterval` + manual refetch — rejected: react-query
already provides this exact capability; a hand-rolled version would just be a worse duplicate.

## 5. Notification dropdown panel

**Decision**: `app/ui/dashboard/notification-bell.tsx`, a `"use client"` component in the shell
header rendering the bell + badge (react-query polling the count endpoint) and, on click, a
panel (`app/ui/dashboard/notification-panel.tsx`) using a click-outside listener + `Escape` key
handler to close (spec Acceptance Scenario 5) — no new route, no new routing state.

**Rationale**: Directly implements the clarification; a dropdown is a self-contained UI concern
that doesn't need URL/routing involvement.

**Alternatives considered**: A headless popover library — rejected: no such library is pre-approved
in the constitution's stack, and a click-outside + Escape handler is a small, well-understood
pattern not worth a new dependency for.

## 6. Generic report-filter rendering

**Decision**: A second small switch component, `<FilterField spec={FilterSpec} />`
(`app/ui/dashboard/filter-field.tsx`), switches on `spec.type` (`'text' | 'select' | 'date' |
'dateRange' | 'numberRange'`) to a corresponding `react-hook-form`-registered input — the same
generic-rendering principle as §1, applied to report filters (spec FR-013).

**Rationale**: Keeps the "no per-item hardcoded frontend knowledge" principle consistent across
both widgets and report filters, rather than treating Reports as a special case.

**Alternatives considered**: A per-report-type filter form component — rejected: identical reasoning
to §1's rejected alternative; report filter *shapes* are a small, enumerable set even though report
*types* aren't.

## 7. Export handling (sync vs. async)

**Decision**: `POST /reports/:type/export` is called via `apiFetch`; a `200` response is a blob,
triggering an immediate browser download (same object-URL pattern as the My Workspace feature's
salary-slip PDF, research.md §8 there); a `202` response starts polling `GET /reports/exports/:id`
(react-query, short interval, stopped once `status` is terminal) and shows a "Processing..." state;
if the admin navigates away, the My Workspace-established Notifications pattern (an "Export Ready"
entry) surfaces completion instead.

**Rationale**: Reuses two already-established patterns (blob download, polling) rather than
inventing new ones; matches spec FR-014's requirement that a large export never blocks the UI.

**Alternatives considered**: WebSocket/SSE push for export completion — rejected: no real-time
infrastructure exists anywhere else in this app (My Workspace's own research.md already rejected
this for the same reason); polling + notification-on-return is sufficient for the "async, not
blocking" requirement.

## 8. Accessibility and mobile-first patterns

**Decision**: Reuses the Settings feature's `ResponsiveList` pattern for `WidgetTable`/`WidgetList`
and the established semantic-HTML/keyboard-operability conventions for all filters/selectors/export
buttons (spec FR-019) — no new pattern invented.

**Rationale**: Consistency with the now twice-established repo convention (Settings, My Workspace).

**Alternatives considered**: None — this is a settled precedent.
