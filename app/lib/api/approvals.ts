import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * Every `/approvals/*` call to `buildcore-api` (feature 016).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts it
 * (Principle IV), and the `z.infer` type is what the UI consumes.
 *
 * **Every schema below was checked against a live response from a running API**, not
 * against `data-model.md`, and doing so found four places where the document and the
 * shipped backend had drifted apart. Those are recorded at the schemas that carry them.
 * Feature 005 shipped six schema mismatches by trusting the document; 008 found
 * `contractValue` arriving as a string from one endpoint and a number from another.
 *
 * ## What this module deliberately does not have
 *
 * **No `submit()`, and no `resubmit()`.** Putting an item into a chain is the owning
 * module's act, done server-side when the item is created or flagged — an attendance
 * exception enters its chain from `/my/punch`, a payroll run from the monthly schedule.
 * A browser function that submitted things into chains would be a second way for an item
 * to get there, and the two would disagree about which items are governed.
 *
 * **No chain-configuration calls.** `/approvals/chains` and `/approvals/slot-mappings`
 * exist and are guarded by `SETTINGS`, but the settings screen that would use them is not
 * in this feature's task list. Until it is built, slots are mapped by an administrator
 * calling the API directly — see the note on `APPROVAL_INERT_MESSAGES.slot_unmapped`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared enums
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plain strings rather than a `z.enum`, matching the reminders module's reasoning: the
 * backend's `actionType` and `entityType` are deliberately free text so a module can join
 * the spine without a change on either side. An enum here would turn every new backend
 * chain into a frontend release.
 */
const openString = z.string();

export const APPROVAL_DECISION_ACTIONS = [
  'approve',
  'reject',
  'return',
] as const;
export type ApprovalDecisionAction = (typeof APPROVAL_DECISION_ACTIONS)[number];

const decisionActionSchema = z.enum(APPROVAL_DECISION_ACTIONS);

/**
 * `abandoned` is in this list although no screen renders it as a choice: a chain closed
 * because its item was cancelled still comes back from the API, and a schema that refused
 * it would turn a correct response into "could not load".
 */
const approvalStateSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'returned',
  'abandoned',
]);
export type ApprovalStateName = z.infer<typeof approvalStateSchema>;

/**
 * Why the control is inert (backend FR-011).
 *
 * **`insufficient_authority`, not `not_authorised`.** `data-model.md` in this feature
 * folder says the latter; the shipped backend sends the former, and the backend is what
 * the browser actually receives. Branching on a value the server never sends would render
 * every unauthorised control as a blank.
 *
 * Four values because they have four different remedies, and one of them —
 * `already_decided` — is knowable only on the server. Without it this app would have to
 * tell a Super Admin who already decided that they lack permission, which is untrue and
 * sends the one person who can change permissions to go and change them.
 */
export const APPROVAL_INERT_REASONS = [
  'awaiting_other',
  'already_decided',
  'insufficient_authority',
  'slot_unmapped',
] as const;
export type ApprovalInertReason = (typeof APPROVAL_INERT_REASONS)[number];

const inertReasonSchema = z.enum(APPROVAL_INERT_REASONS);

// ─────────────────────────────────────────────────────────────────────────────
// The state that renders beside an item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One recorded act, as the record displays it.
 *
 * `actorName` resolves even for a deactivated account — the backend looks the name up
 * without filtering on status, because history that cannot say who acted is not history.
 */
const decisionSchema = z.object({
  position: z.number(),
  levelLabel: z.string(),
  actorUserId: z.string(),
  actorName: z.string(),
  action: decisionActionSchema,
  reason: z.string().nullable(),
  decidedAt: z.string(),
  /** Which round of the chain. A returned-and-resubmitted item starts round 2. */
  round: z.number(),
});

/**
 * Everything the interface needs about one item's approval, with nothing left to infer.
 *
 * Three corrections against `data-model.md`, all found by parsing a live response:
 *
 * - The latest act arrives as **`latestDecision`**, not `latestAction`.
 * - **`levelLabel` is nullable.** It is null once the chain has finished, because there is
 *   no level deciding any more. Typing it as a bare string parsed fine on a pending item
 *   and threw on the first approved one.
 * - **`href` is nullable.** A module that has no screen for its item supplies none.
 *
 * Unknown keys are stripped rather than rejected (zod's default): the backend sends a few
 * fields no screen here uses, and a strict object would break this app every time the API
 * added one.
 */
const approvalStateObjectSchema = z.object({
  instanceId: z.string(),
  companyId: z.string(),
  actionType: openString,
  entityType: openString,
  entityId: z.string(),

  subject: z.string(),
  href: z.string().nullable(),

  state: approvalStateSchema,
  currentPosition: z.number(),
  /** So the interface can say "2 of 3" without a second call. */
  totalLevels: z.number(),
  round: z.number(),
  /** Times returned **and resubmitted** — a bare return has not completed a round yet. */
  returnCount: z.number(),

  /** Null when a scheduled job raised the item; `originatorName` then reads "The system". */
  originatorUserId: z.string().nullable(),
  originatorName: z.string(),

  /** The level deciding now. Null once the chain has finished. */
  levelLabel: z.string().nullable(),
  awaitingRoleName: z.string().nullable(),
  /** Named only when exactly one person could act; null when several could, or none. */
  awaitingUserName: z.string().nullable(),
  /** Zero is a real configuration problem, not a quiet wait. */
  awaitingHolderCount: z.number(),

  canActNow: z.boolean(),
  inertReason: inertReasonSchema.nullable(),

  latestDecision: decisionSchema.nullable(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export const approvalStateSchemaForModules = approvalStateObjectSchema;

export type ApprovalState = z.infer<typeof approvalStateObjectSchema>;
export type ApprovalDecisionEntry = z.infer<typeof decisionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// The queue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row of the cross-module queue.
 *
 * `subject` and `href` are server-supplied because the spine holds only an opaque
 * reference to the item it governs (backend research §1). This application must not
 * maintain a second mapping from entity type to route — that mapping would then have to
 * be kept in step with the backend's forever, and would be wrong first in whichever
 * module was added last.
 *
 * `requestedById` is nullable to match `originatorUserId`: a scheduled payroll run has
 * nobody behind it, and `requestedByName` then reads "The system".
 */
const queueEntrySchema = z.object({
  instanceId: z.string(),
  actionType: openString,
  entityType: openString,
  entityId: z.string(),
  subject: z.string(),
  href: z.string().nullable(),
  requestedById: z.string().nullable(),
  requestedByName: z.string(),
  requestedAt: z.string(),
  /** Hours since the item entered the chain, so a queue can be sorted by neglect. */
  ageHours: z.number(),
  currentPosition: z.number(),
  levelLabel: z.string(),
});

const queuePageSchema = z.object({
  items: z.array(queueEntrySchema),
  nextCursor: z.string().nullable(),
});

const queueCountSchema = z.object({ count: z.number() });

export type ApprovalQueueEntry = z.infer<typeof queueEntrySchema>;
export type ApprovalQueuePage = z.infer<typeof queuePageSchema>;
export type ApprovalCount = z.infer<typeof queueCountSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Calls
// ─────────────────────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface ApprovalQueueQuery {
  limit?: number;
  cursor?: string | null;
}

/** Everything awaiting this user, across every module. */
export async function getApprovalQueue(
  query: ApprovalQueueQuery = {},
): Promise<ApprovalQueuePage> {
  const raw = await authFetch<unknown>(`/approvals/queue${qs({ ...query })}`);
  return queuePageSchema.parse(raw);
}

/**
 * The badge count.
 *
 * A separate endpoint from the queue, and it must stay that way: the badge appears on
 * every screen, and pulling a page of rows to render a number is the kind of cost that
 * only shows up once the queue is long.
 */
export async function getApprovalCount(): Promise<ApprovalCount> {
  const raw = await authFetch<unknown>('/approvals/queue/count');
  return queueCountSchema.parse(raw);
}

/**
 * The full ordered history for one item, oldest first.
 *
 * `entityType` is interpolated into the path and is server-supplied free text, so it is
 * encoded rather than trusted to be path-safe.
 */
export async function getApprovalHistory(
  entityType: string,
  entityId: string,
): Promise<ApprovalDecisionEntry[]> {
  const raw = await authFetch<unknown>(
    `/approvals/${encodeURIComponent(entityType)}/${encodeURIComponent(
      entityId,
    )}/history`,
  );
  return z.array(decisionSchema).parse(raw);
}

export interface DecideInput {
  action: ApprovalDecisionAction;
  /** Required by the server for `reject` and `return`. */
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain configuration (SETTINGS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One slot and the role it resolves to for this company.
 *
 * The API returns **every canonical slot, mapped or not**, so an unmapped slot is a
 * visible gap on the settings screen rather than an absent row nobody notices. That
 * matters more than it sounds: an unmapped slot is the one failure mode of this feature
 * that never resolves itself by waiting — until `first_approver` and `hr` are bound, no
 * attendance exception can be decided by anybody.
 *
 * `roleId` and no role *name*. `Role` lives in the backend's `settings` schema and the
 * approval spine may not read it (Constitution Principle I over there), so the name is
 * resolved here against the roles list this screen already holds.
 */
const slotMappingSchema = z.object({
  slotKey: z.string(),
  label: z.string(),
  roleId: z.string().nullable(),
});

const slotMappingListSchema = z.object({
  slots: z.array(slotMappingSchema),
});

export type ApprovalSlotMapping = z.infer<typeof slotMappingSchema>;

/** One level of a chain. */
const chainLevelSchema = z.object({
  id: z.string(),
  position: z.number(),
  slotKey: z.string(),
  isFinalAuthority: z.boolean(),
  label: z.string().nullable(),
});

/**
 * A chain definition.
 *
 * Deactivated chains are included. An item already travelling one keeps the chain it
 * entered — superseding a chain writes a new row rather than editing the old — so an
 * administrator needs to be able to see what the old one was.
 */
const chainSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  actionType: openString,
  isFinalAuthorityRequired: z.boolean(),
  isActive: z.boolean(),
  levels: z.array(chainLevelSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ApprovalChain = z.infer<typeof chainSchema>;
export type ApprovalChainLevel = z.infer<typeof chainLevelSchema>;

/** Every chain defined for the caller's company. Requires `SETTINGS`. */
export async function getApprovalChains(): Promise<ApprovalChain[]> {
  const raw = await authFetch<unknown>('/approvals/chains');
  return z.array(chainSchema).parse(raw);
}

/** Every canonical slot and the role it resolves to. Requires `SETTINGS`. */
export async function getSlotMappings(): Promise<ApprovalSlotMapping[]> {
  const raw = await authFetch<unknown>('/approvals/slot-mappings');
  return slotMappingListSchema.parse(raw).slots;
}

/**
 * Binds one slot to one role. Requires `SETTINGS`.
 *
 * **Refused with `APPROVAL_CHAIN_UNSATISFIABLE` when the mapping would leave an active
 * chain unable to complete** — two of its levels resolving to the same role, which under
 * the backend's FR-021a means nobody can decide both. The refusal names the conflicting
 * levels, so the message is worth showing verbatim rather than replacing with a generic
 * one; it is the only thing standing between a routine settings edit and a payroll run
 * that silently stops moving.
 *
 * One slot per call rather than a whole map, matching the endpoint: a bulk write would
 * either half-apply or have to report which member of the batch was the problem, which is
 * the same single-slot message with extra steps.
 */
export async function putSlotMapping(input: {
  slotKey: string;
  roleId: string;
}): Promise<unknown> {
  return authFetch<unknown>('/approvals/slot-mappings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/**
 * Records one decision and returns the item's updated state.
 *
 * Refusals arrive as an `ApiError` carrying the backend's `code` —
 * `APPROVAL_NOT_AUTHORISED`, `APPROVAL_ALREADY_DECIDED`, `APPROVAL_SLOT_UNMAPPED`,
 * `APPROVAL_NOT_PENDING`, `APPROVAL_REASON_REQUIRED`. Callers branch on the code, never
 * on the message: wording is allowed to change without breaking a client, and this is the
 * contract feature 015 established with `SESSION_EXPIRED`.
 */
export async function decideApproval(
  instanceId: string,
  input: DecideInput,
): Promise<ApprovalState> {
  const raw = await authFetch<unknown>(
    `/approvals/${encodeURIComponent(instanceId)}/decide`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return approvalStateObjectSchema.parse(raw);
}
