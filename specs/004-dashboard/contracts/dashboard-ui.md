# Contract: Dashboard UI routes and `app/lib/api/dashboard.ts`

Routes live under the existing `DashboardLayout` shell (research.md §3). Every function below is a
typed wrapper in `app/lib/api/dashboard.ts` calling the corresponding `buildcore-api` endpoint in
`specs/004-dashboard-backend/contracts/dashboard-api.md`.

## `/dashboard` (User Stories 1, 2) — MODIFIED, existing page

**Page**: `app/dashboard/page.tsx` (rewritten — research.md §2) renders `WidgetRenderer`-mapped
output grouped by `section`, replacing the removed `app/ui/dashboard/cards.tsx`.

**Functions**:
- `getWidgets(): Promise<WidgetResult[]>` → `GET /dashboard/widgets` (react-query, 30s
  `refetchInterval`)

**Shared components** (used across all widget-driven screens):
- `app/ui/dashboard/widget-renderer.tsx` — `WidgetRenderer`, `KpiCard`, `WidgetTable`,
  `WidgetList`, `StatCard`, `ComingSoonCard`, `UnsupportedWidgetCard` (research.md §1)

## `/dashboard/site` (User Story 5)

**Page**: `app/dashboard/site/page.tsx` + `app/ui/dashboard/site-selector.tsx`.

**Functions**:
- `getSites(): Promise<{ id: string; name: string }[]>` → `GET /site-dashboard/sites`
- `getSiteWidgets(siteId): Promise<WidgetResult[]>` → `GET /site-dashboard/widgets?siteId=`
  (re-fetched on `siteId` change)

## `/dashboard/group` (User Story 6)

**Page**: `app/dashboard/group/page.tsx` + `app/ui/dashboard/employee-search.tsx`.

**Functions**:
- `getGroupCompanies(): Promise<WidgetResult[]>` → `GET /group/companies`
- `getStatutoryCalendar(): Promise<WidgetResult>` → `GET /group/statutory-calendar` (always
  `unavailable` today)
- `searchGroupEmployees(q): Promise<Employee[]>` → `GET /group/employees/search?q=` (debounced,
  min 2 chars — research.md, spec FR-011)

## `/dashboard/activity-log` (User Story 3)

**Page**: `app/dashboard/activity-log/page.tsx` + `app/ui/dashboard/activity-log-list.tsx`.

**Functions**:
- `getActivityLog(module, timeRange, page): Promise<{ entries: ActivityLogEntry[]; hasMore:
  boolean }>` → `GET /activity-log?module=&timeRange=&page=`

## Notifications (header, no route — User Story 4)

**Components**: `app/ui/dashboard/notification-bell.tsx`, `notification-panel.tsx` (research.md
§5), added to the existing shell header (wherever `SideNav`'s parent layout renders header chrome).

**Functions**:
- `getNotifications(): Promise<NotificationRow[]>` → `GET /notifications`
- `getNotificationCount(): Promise<{ count: number }>` → `GET /notifications/count` (30s
  `refetchInterval`)

## `/dashboard/reports` (User Story 7)

**Page**: `app/dashboard/reports/page.tsx` + `app/ui/dashboard/report-type-list.tsx` +
`app/ui/dashboard/filter-field.tsx` (research.md §6) + `app/ui/dashboard/report-result-table.tsx`
(reuses `WidgetTable`).

**Functions**:
- `getReportTypes(): Promise<ReportType[]>` → `GET /reports/types`
- `runReport(type, params): Promise<ReportResult>` → `POST /reports/:type/run`
- `exportReport(type, params, format): Promise<Blob | { exportJobId: string }>` →
  `POST /reports/:type/export` — branches on `200` (blob) vs `202` (job id), research.md §7
- `getExportStatus(jobId): Promise<ExportJobStatus>` → `GET /reports/exports/:id` (polled while
  `pending`/`processing`)

## Shared: `app/ui/dashboard/nav-links.tsx` (MODIFIED)

Adds "Group Dashboard" (`/dashboard/group`), "Site Dashboard" (`/dashboard/site`), and "Activity
Log" (`/dashboard/activity-log`) entries alongside the existing eight; "Reports" now points to the
real `/dashboard/reports` route this feature builds.
