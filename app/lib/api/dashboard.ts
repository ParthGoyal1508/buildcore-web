import { z } from 'zod';

import { REMINDER_SEVERITIES } from '@/app/lib/constants';
import { authFetch, authFetchBlob } from '@/app/lib/session';

/**
 * Every `/dashboard/*` call to `buildcore-api` (feature 004).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts
 * it (Principle IV), and the `z.infer` type is what the UI consumes.
 *
 * Scoped to the **reminders engine** (US9). Widgets, notifications, the activity log
 * and reports are in `contracts/dashboard-web-api.md` but have no functions here,
 * because the endpoints they would call do not exist yet — a typed stub against an
 * absent endpoint is a compile-time promise the runtime cannot keep.
 *
 * Every schema below was checked against a live response from a running API, not
 * against `data-model.md`. That is not belt-and-braces: feature 005 shipped six
 * schema mismatches by trusting the document, and 008 found `contractValue` arriving
 * as a string from one endpoint and a number from another.
 */

function qs(
  params: Record<string, string | number | boolean | undefined | null>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminders (US9)
// ─────────────────────────────────────────────────────────────────────────────

const severitySchema = z.enum(REMINDER_SEVERITIES);

/**
 * One reminder.
 *
 * `sourceModule`, `type` and `entityType` are plain strings, deliberately not enums:
 * the whole point of the engine is that a module can register a new rule without a
 * change on either side, so a `sourceModule` this build has never seen is an expected
 * value, not a validation failure. An enum here would turn every new backend rule
 * into a frontend release.
 */
const reminderSchema = z.object({
  /** `<ruleKey>:<entityId>` — the id the snooze endpoint takes. */
  id: z.string(),
  ruleKey: z.string(),
  sourceModule: z.string(),
  type: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  companyId: z.string(),
  subject: z.string(),
  /** `YYYY-MM-DD`. */
  dueDate: z.string(),
  /** Negative when overdue. */
  daysRemaining: z.number(),
  severity: severitySchema,
  /** Absent for a module with no screen to open yet. */
  actionLink: z.string().optional(),
});

const unavailableSourceSchema = z.object({
  ruleKey: z.string(),
  sourceModule: z.string(),
  reason: z.literal('module_pending'),
});

const reminderListSchema = z.object({
  reminders: z.array(reminderSchema),
  unavailable: z.array(unavailableSourceSchema),
  truncated: z.boolean(),
});

const reminderCountSchema = z.object({
  total: z.number(),
  bySeverity: z.object({
    info: z.number(),
    warning: z.number(),
    overdue: z.number(),
  }),
});

const snoozeResultSchema = z.object({
  id: z.string(),
  snoozeUntil: z.string(),
  reason: z.string(),
});

export type Reminder = z.infer<typeof reminderSchema>;
export type UnavailableReminderSource = z.infer<typeof unavailableSourceSchema>;
export type ReminderList = z.infer<typeof reminderListSchema>;
export type ReminderCount = z.infer<typeof reminderCountSchema>;

export interface ReminderQuery {
  type?: string;
  module?: string;
  severity?: string;
  /** `all` requires CROSS_COMPANY_ACCESS; the API answers 403 otherwise. */
  scope?: 'company' | 'all';
  companyId?: string;
}

export async function getReminders(
  query: ReminderQuery = {},
): Promise<ReminderList> {
  const raw = await authFetch<unknown>(`/dashboard/reminders${qs({ ...query })}`);
  return reminderListSchema.parse(raw);
}

export async function getReminderCount(
  query: ReminderQuery = {},
): Promise<ReminderCount> {
  const raw = await authFetch<unknown>(
    `/dashboard/reminders/count${qs({ ...query })}`,
  );
  return reminderCountSchema.parse(raw);
}

export interface SnoozeInput {
  /** `YYYY-MM-DD`, inclusive. */
  snoozeUntil: string;
  reason: string;
}

export async function snoozeReminder(
  id: string,
  input: SnoozeInput,
): Promise<z.infer<typeof snoozeResultSchema>> {
  const raw = await authFetch<unknown>(
    // The id carries a colon, which is legal in a path segment but must survive
    // whatever the browser does to it.
    `/dashboard/reminders/${encodeURIComponent(id)}/snooze`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return snoozeResultSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Widgets (US1/US2/US5/US6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One widget's self-describing envelope (data-model.md). `value` and `unavailable`
 * are both optional and mutually exclusive: the backend sends exactly one. `value` is
 * `unknown` on purpose — a KPI is a number, a table is `{ columns, rows }`, a stat is
 * `{ present, total }` — the renderer switches on `displayType`, so the wire type
 * stays open rather than forcing a discriminated union the contract does not need.
 */
const widgetResultSchema = z.object({
  id: z.string(),
  displayType: z.string(),
  title: z.string(),
  section: z.string(),
  value: z.unknown().optional(),
  unavailable: z
    .object({ reason: z.string(), module: z.string() })
    .optional(),
});

export type WidgetResult = z.infer<typeof widgetResultSchema>;

const widgetListSchema = z.array(widgetResultSchema);

export async function getWidgets(): Promise<WidgetResult[]> {
  const raw = await authFetch<unknown>('/dashboard/widgets');
  return widgetListSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications (US4)
// ─────────────────────────────────────────────────────────────────────────────

const notificationRowSchema = z.object({
  type: z.string(),
  severity: z.string(),
  title: z.string(),
  subtitle: z.string(),
  actionLink: z.string(),
  occurredAt: z.string(),
});

export type NotificationRow = z.infer<typeof notificationRowSchema>;

const notificationCountSchema = z.object({ count: z.number() });

export async function getNotifications(): Promise<NotificationRow[]> {
  const raw = await authFetch<unknown>('/notifications');
  return z.array(notificationRowSchema).parse(raw);
}

export async function getNotificationCount(): Promise<number> {
  const raw = await authFetch<unknown>('/notifications/count');
  return notificationCountSchema.parse(raw).count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Log (US3)
// ─────────────────────────────────────────────────────────────────────────────

const activityLogEntrySchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  module: z.string(),
  target: z.string().nullable(),
  timestamp: z.string(),
});

export type ActivityLogEntry = z.infer<typeof activityLogEntrySchema>;

const activityLogFeedSchema = z.object({
  entries: z.array(activityLogEntrySchema),
  hasMore: z.boolean(),
});

export type ActivityLogFeed = z.infer<typeof activityLogFeedSchema>;

export interface ActivityLogQuery {
  module?: string;
  timeRange?: string;
  page?: number;
}

export async function getActivityLog(
  query: ActivityLogQuery = {},
): Promise<ActivityLogFeed> {
  const raw = await authFetch<unknown>(`/activity-log${qs({ ...query })}`);
  return activityLogFeedSchema.parse(raw);
}

/** Fetches the filtered feed as a CSV blob for the caller to download (FR-006a). */
export async function exportActivityLog(
  query: Omit<ActivityLogQuery, 'page'> = {},
): Promise<Blob> {
  return authFetchBlob(`/activity-log/export${qs({ ...query })}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Site Dashboard (US5)
// ─────────────────────────────────────────────────────────────────────────────

const siteSchema = z.object({ id: z.string(), name: z.string() });
export type Site = z.infer<typeof siteSchema>;

export async function getSites(): Promise<Site[]> {
  const raw = await authFetch<unknown>('/site-dashboard/sites');
  return z.array(siteSchema).parse(raw);
}

export async function getSiteWidgets(siteId: string): Promise<WidgetResult[]> {
  const raw = await authFetch<unknown>(
    `/site-dashboard/widgets${qs({ siteId })}`,
  );
  return widgetListSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Dashboard (US6)
// ─────────────────────────────────────────────────────────────────────────────

export async function getGroupCompanies(): Promise<WidgetResult[]> {
  const raw = await authFetch<unknown>('/group/companies');
  return widgetListSchema.parse(raw);
}

export async function getStatutoryCalendar(): Promise<WidgetResult> {
  const raw = await authFetch<unknown>('/group/statutory-calendar');
  return widgetResultSchema.parse(raw);
}

const groupEmployeeSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),
  name: z.string(),
  companyId: z.string(),
});
export type GroupEmployee = z.infer<typeof groupEmployeeSchema>;

export async function searchGroupEmployees(
  q: string,
): Promise<GroupEmployee[]> {
  const raw = await authFetch<unknown>(
    `/group/employees/search${qs({ q })}`,
  );
  return z.array(groupEmployeeSchema).parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports (US7)
// ─────────────────────────────────────────────────────────────────────────────

const filterSpecSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['date', 'dateRange', 'select', 'text']),
  options: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional(),
  required: z.boolean().optional(),
});
export type FilterSpec = z.infer<typeof filterSpecSchema>;

const reportTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAvailable: z.boolean(),
  filters: z.array(filterSpecSchema),
});
export type ReportType = z.infer<typeof reportTypeSchema>;

const reportDataSchema = z.object({
  columns: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(z.record(z.string(), z.unknown())),
});
const reportResultSchema = z.union([
  reportDataSchema,
  z.object({
    unavailable: z.object({ reason: z.string(), module: z.string() }),
  }),
]);
export type ReportData = z.infer<typeof reportDataSchema>;
export type ReportResult = z.infer<typeof reportResultSchema>;

export interface ReportRunBody {
  fromDate?: string;
  toDate?: string;
  filters?: Record<string, string>;
}

export async function getReportTypes(): Promise<ReportType[]> {
  const raw = await authFetch<unknown>('/reports/types');
  return z.array(reportTypeSchema).parse(raw);
}

export async function runReport(
  type: string,
  body: ReportRunBody,
): Promise<ReportResult> {
  const raw = await authFetch<unknown>(`/reports/${encodeURIComponent(type)}/run`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return reportResultSchema.parse(raw);
}

const asyncExportSchema = z.object({
  exportJobId: z.string(),
  status: z.string(),
});

const exportStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'ready', 'failed']),
  downloadUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
});
export type ExportStatus = z.infer<typeof exportStatusSchema>;

/** A synchronous export (the file) or an async job to poll — or an unavailable type. */
export type ExportOutcome =
  | { mode: 'sync'; blob: Blob }
  | { mode: 'async'; exportJobId: string; status: string }
  | { mode: 'unavailable'; module: string };

export async function exportReport(
  type: string,
  body: ReportRunBody & { format: 'pdf' | 'excel' },
): Promise<ExportOutcome> {
  const blob = await authFetchBlob(
    `/reports/${encodeURIComponent(type)}/export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  // A 202 (async) or an unavailable-type body comes back as JSON; a ready file comes
  // back as its own content type. Branch on what the bytes actually are.
  if (blob.type.includes('application/json')) {
    const json = JSON.parse(await blob.text());
    if (json && typeof json === 'object' && 'unavailable' in json) {
      return { mode: 'unavailable', module: json.unavailable.module };
    }
    const job = asyncExportSchema.parse(json);
    return { mode: 'async', exportJobId: job.exportJobId, status: job.status };
  }
  return { mode: 'sync', blob };
}

export async function getExportStatus(id: string): Promise<ExportStatus> {
  const raw = await authFetch<unknown>(
    `/reports/exports/${encodeURIComponent(id)}`,
  );
  return exportStatusSchema.parse(raw);
}

/** Downloads a finished async export's file. */
export async function downloadExport(id: string): Promise<Blob> {
  return authFetchBlob(`/reports/exports/${encodeURIComponent(id)}/download`);
}

/** Triggers a browser download of a blob under the given filename. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
