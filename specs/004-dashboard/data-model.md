# Data Model: Dashboard & General Frontend (Widgets, Notifications, Activity Log, Reports)

`buildcore-web` holds no database of its own (Constitution Principle V). Every entity below is a
`zod`-validated client-side type mirroring `buildcore-api`'s
`specs/004-dashboard-backend/data-model.md`.

## WidgetResult

`{ id: string; displayType: 'kpi' | 'table' | 'list' | 'stat'; title: string; section: 'kpi' |
'sidebar' | 'alerts' | 'table' | 'group' | 'site'; actionLink?: string } & ({ value: unknown } |
{ unavailable: { reason: 'module_pending'; module: string } })`

Drives `WidgetRenderer` (research.md §1) across `/dashboard`, `/dashboard/site`, `/dashboard/
group`. `actionLink`'s presence (not the frontend's own route knowledge) is what makes an entry
clickable (spec Acceptance Scenario, User Story 1 #5).

## NotificationRow

`{ type: string; severity: 'red' | 'yellow' | 'orange' | 'blue'; title: string; subtitle: string;
actionLink: string; occurredAt: string }`

Drives the notification dropdown panel (research.md §5) and the header bell badge count.

## ActivityLogEntry

`{ id: string; actor: string; action: string; module: string; target: string; timestamp: string }`

Drives the Activity Log feed, paginated (`{ entries: ActivityLogEntry[]; hasMore: boolean }`).

## ReportType

`{ id: string; name: string; isAvailable: boolean; filters: FilterSpec[] }`

`FilterSpec`: `{ key: string; label: string; type: 'text' | 'select' | 'date' | 'dateRange' |
'numberRange'; options?: { value: string; label: string }[] }` — drives `FilterField` (research.md
§6).

## ReportResult

`{ columns: { key: string; label: string }[]; rows: Record<string, unknown>[] } | { unavailable:
{ reason: 'module_pending'; module: string } }`

## ExportJobStatus

`{ id: string; status: 'pending' | 'processing' | 'ready' | 'failed'; downloadUrl: string | null;
failureReason: string | null }`

Drives the Reports screen's post-export polling state (research.md §7).

## Cross-reference to `buildcore-api`

Every shape above corresponds 1:1 to a resource in `buildcore-api`'s
`specs/004-dashboard-backend/contracts/dashboard-api.md`; this document does not restate validation
rules or error responses already specified there.
