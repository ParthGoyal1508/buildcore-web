# Contract: Search, Slip Delivery and Exit Clearance (web ↔ api)

Split by backend state. Parts 1 and 3 are live; Part 2 is not.

---

## Part 1 — cross-register search (LIVE, backend Phases 1–3)

```ts
GET /search?term=<string>

interface SearchResult {
  register: 'employee' | 'vendor' | 'equipment' | 'project';
  id: string;
  code: string;
  name: string;
  matchedOn: 'code' | 'name';
  // ...register-specific identifying detail
}
```

### Authorisation is per register, and silence is the contract

The controller is **authenticated with no `@RequirePermissions`** — deliberately. The registry checks
each register's permission *before* calling it, and a caller lacking one gets an empty contribution.

**A register the caller may not see is never named.** It does not appear in `unavailableSources`,
because that would disclose the register's existence. FR-005 is enforced here, and the web can undo
it trivially:

| Tempting | Why it is a disclosure |
| --- | --- |
| A group header per register | "Vendors — no results" tells someone vendors exist |
| "Searched 4 of 5 registers" | A count is an inventory |
| "Some results are hidden from you" | States it outright |
| Per-register empty states | Which message appears reveals what exists |

**The rule**: render only groups that returned rows, and use **one** empty state for every case. A
user with one register and a user with four see an identical screen when nothing matches — and that
must hold mid-keystroke, not only at rest.

### Ordering

An **exact code match sorts first**. Beyond that the backend does not specify an order, so the web
must not impose one — a client-side sort would silently defeat the one rule that exists.

### Minimum term length

Below it the control says **keep typing**, never "nothing matched" (FR-001c). The two mean different
things to the person typing and look identical otherwise.

### `matchedOn`

Render it. A row that appeared because of its *name*, to somebody who typed something code-shaped,
otherwise reads as a wrong result (FR-001b).

## Part 2 — slip delivery (NOT LIVE, backend Phase 4, 0 of 13)

```ts
GET  /payroll/runs/:id/slip-deliveries        // delivered, failed, undeliverable
POST /payroll/runs/:id/slip-deliveries/retry  // resends ONLY failures
```

**Sending is an explicit action** (decision of 2026-10-01). The screen carries a send control, not
only a status view.

- **Retry is safe to press twice.** The backend keys `SlipDelivery` uniquely on
  `(payrollRunId, employeeId)`, making a retry an upsert per employee. The web still should not
  present "retry" and "send all" as interchangeable: the retry resends **only** failures, and the
  distinction is the difference between 12 emails and 500.
- **A run that is not fully approved refuses delivery** with a code naming the reason (FR-009). Show
  the reason; do not disable the control with no explanation.
- **Failures are isolated** — one bad address does not stop the other 499 — so the status list is
  partial-by-design and must read that way rather than as a failed run.
- The address is stored **as sent**. An employee whose email is corrected after a failure must not
  have the old failure read as though it went to the new address, so the list shows the address the
  attempt used.

## Part 3 — exit clearance (LIVE, backend Phase 7, 19 of 19)

```ts
GET  /…/exit-clearance        // EMPLOYEES at READ
POST /…/exit-clearance/waivers // EMPLOYEES at WRITE
```

### The level split is this contract's one hard dependency

The backend's controller: *"Under 019's level model the GET needs read and the waiver needs write,
derived from the verb — which is exactly right here, since waiving writes off company money."*

So the waiver control **cannot be gated correctly until the web parses `grants`** — feature 019's web
Phase 1. Until then `EMPLOYEES` means only "holds the area at some level", and the waiver would be
offered to every reader with the server's 403 as the sole protection.

### What the clearance returns, and what it does not

- Every outstanding item with its owner (FR-012).
- **Assets in custody as their own group** within that list (FR-012a) — an asset has a site, an
  expected return date and a condition on return, and grouping it with money obscures that.
- **Nothing is stored but the waivers.** The outstanding set is computed, so there is no clearance
  record to stale.

### Two things this screen must not do

- **It must not return an asset.** It links to the allocation in the asset register (FR-012b). The
  asset module owns returning, with its condition grade and consequences; a second control here would
  be a second way to close an allocation, and the two would disagree.
- **It must not show a recovery value for an unreturned asset.** The backend deliberately computes
  none: that needs a valuation rule — original cost, depreciated, or replacement — and the client has
  not made that commercial decision. A waiver records the write-off without a rupee figure.

### The waiver's own semantics

A waiver requires a reason and displays its author (FR-014). It records that the company is not
chasing this — it does **not** mark the obligation discharged. An asset waived is still an asset the
employee has.

Final settlement is unavailable while items are outstanding, **naming them** (FR-013).
