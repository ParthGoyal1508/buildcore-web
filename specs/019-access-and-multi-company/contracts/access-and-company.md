# Contract: Access Levels, Company Selection and Cash Visibility (web ↔ api)

What this app consumes from `buildcore-api` feature 019. Every shape here is **already served**;
this file records what the web must parse, because the one defect found in planning was a field
the server sends and the client discards.

---

## Part 1 — the current user now carries levels

`GET /users/me` (and the login response) already include `grants`. The web's
`currentUserSchema` must be widened to parse it.

```ts
/** One area the caller holds, at one level. Mirrors the api's `Grant`. */
const grantSchema = z.object({
  permission: z.string(),
  level: z.enum(['read', 'write']),
});

const currentUserSchema = z.object({
  // ...existing fields...
  permissions: z.array(z.string()),
  grants: z.array(grantSchema).default([]),   // ← NEW
});
```

`.default([])` rather than required: a cached login response from before this change parses
rather than throwing the user out at the door.

### The two meanings, which are not interchangeable

| Field | Means | Use it for |
| --- | --- | --- |
| `permissions` | the areas held **at some level** | visibility — may this person reach the module at all |
| `grants` | area **and** level | capability — may this person write in it |

Reading `permissions` where a level is needed is the bug this contract exists to prevent, and it
fails *open*: a read-only role would be shown every write control, and only the server's 403
would stop them.

### The values where a level is meaningless

`CROSS_COMPANY_ACCESS`, `DATA_EXPORT` and the four `_APPROVE` permissions **appear in `grants` at
both levels** — the api's migration doubled every entry. Asking whether one of them is "write" is
meaningless, not false. Level-aware helpers must answer from `permissions` for these and consult
`grants` only for areas where a level carries meaning.

## Part 2 — company selection lives on the server

```ts
/** GET /settings/companies/selectable — self-service; the companies this caller may work in. */
listSelectableCompanies(): Promise<SelectableCompany[]>

/** PUT /my/company-selection — self-service; records the choice. */
setCompanySelection(companyId: string): Promise<void>
```

Both are `@SelfService()` on the api: choosing which of *your own* accessible companies you work
in is not an administrative act and needs no permission.

**No screen sends a `companyId` to be scoped.** The server resolves the selection per request and
re-validates it against the caller's accessible companies every time. A web client that also
passed a company id would be offering a second, unvalidated answer to the same question.

**FR-001's population is the length of this list**, not the `CROSS_COMPANY_ACCESS` permission. One
selectable company means no switcher.

## Part 3 — cash arrives pre-hidden

No request parameter and no web-side screen list. Any response field subject to hiding arrives as:

```ts
{ amount: null, amountHidden: true }
```

**Never `0`.** The web must render the distinction: a hidden figure is a stated absence, and a
zero is a figure. A total computed client-side across rows where any `amountHidden` is true is
incomplete and must say so (FR-014) rather than present a number that is quietly short.

```ts
/** GET /settings/cash-visibility, PATCH /settings/cash-visibility — COMPANY_SETTINGS. */
getCashVisibility(): Promise<{ hideCashTransactions: boolean }>
setCashVisibility(hide: boolean): Promise<{ hideCashTransactions: boolean }>
```

FR-012's "available to authorised users and absent for others" maps to `COMPANY_SETTINGS` at
**write** level — which is the first real consumer of Part 1.

## What this contract deliberately does not include

- **Any enforcement.** Every endpoint is guarded server-side. Hiding a control is courtesy, so a
  user is not shown an action whose every request returns 403.
- **A cash screen list.** See Part 3 — there isn't one, by design.
- **Client-side persistence of the selection.** Part 2 is why.
