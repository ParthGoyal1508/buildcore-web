# Data Model: Approval Spine (Web)

**Feature**: 016-approval-spine | **Date**: 2026-09-13

This application stores nothing. Everything below is a **view shape** — what the API returns and what
components consume, validated with `zod` at the boundary per Principle IV.

---

## `ApprovalState` — what renders beside an item

Returned by the owning module's endpoints (embedded) and by the spine's own.

```ts
{
  instanceId: string;
  state: 'pending' | 'approved' | 'rejected' | 'returned' | 'abandoned';
  currentPosition: number;
  levelLabel: string;        // the configured slot label — NEVER a role name this app chose
  awaitingUserName: string | null;
  canActNow: boolean;
  // Why the control is inert, when it is. research.md §2 — three states, not one.
  inertReason: 'awaiting_other' | 'already_decided' | 'not_authorised' | 'slot_unmapped' | null;
  latestAction: {
    action: 'approve' | 'reject' | 'return';
    actorName: string;       // resolves even for a deactivated user
    decidedAt: string;       // ISO
    reason: string | null;
  } | null;
  returnCount: number;
}
```

`levelLabel` and `awaitingUserName` come from the server because chain levels resolve through
configurable role slots (research.md §3). Deriving either here would be right for one company and
wrong for the other.

`inertReason` is the field that makes FR-003a implementable. Without it this application would have
to infer why it cannot act, and it cannot — `already_decided` is knowable only to the server.

---

## `DecisionHistoryEntry`

```ts
{
  position: number;
  levelLabel: string;
  action: 'approve' | 'reject' | 'return';
  actorName: string;
  decidedAt: string;
  reason: string | null;
}
```

Ordered oldest to newest. A returned-and-resubmitted item shows its earlier decisions too — the
history must show that the item went round, which is what `returnCount` quantifies.

---

## `ApprovalQueueEntry`

```ts
{
  instanceId: string;
  actionType: string;        // 'attendance_exception' | 'payroll_run' | …
  entityType: string;
  entityId: string;
  subject: string;           // supplied by the owning module at submit time
  requestedByName: string;
  requestedAt: string;
  ageHours: number;
  levelLabel: string;
  href: string;              // where to open the item
}
```

`subject` and `href` are server-supplied because the spine holds only an opaque reference to the item
(backend research §1) and this application should not maintain a second mapping from entity type to
route — that mapping would then have to be kept in step with the backend's forever.

---

## `ApprovalCount`

```ts
{ count: number }
```

Its own shape because the navigation badge asks for it on every screen and must not pull the queue
(research.md §4).

---

## Client state

| State | Where | Why |
|---|---|---|
| Queue list and count | react-query, invalidated on a successful decision, refetched on window focus | Freshness without realtime infrastructure (research.md §4) |
| In-flight decision | Component-local | Prevents double submission (spec FR-005) |
| Typed reason | Component-local, **preserved across a failed submission** | Spec FR-006 — losing a paragraph of justification to a dropped connection is how people stop trusting a system |

Nothing is persisted to `localStorage`. A decision in progress is not worth restoring across a
reload, and a stale one would be actively misleading.

---

## Constants (Principle III)

All in `app/lib/constants.ts`:

- `APPROVAL_ACTIONS` — approve / reject / return, with labels and whether a reason is required.
- `APPROVAL_INERT_MESSAGES` — one message per `inertReason`, keyed by code. The `slot_unmapped`
  message names the settings screen; it is the only one describing a fault rather than a state.
- `APPROVAL_QUEUE_AGE_WARNING_HOURS` — when an item's age becomes visually distinguishable
  (spec US3 scenario 5).

No approval copy may be written inline in a component.
