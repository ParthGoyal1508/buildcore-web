import { z } from 'zod';

import { REMINDER_SEVERITIES } from '@/app/lib/constants';
import { authFetch } from '@/app/lib/session';

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
