# Quickstart: Validating Role-Based Navigation

No test framework is installed in this repo (constitution `TODO(TESTING_STANDARD)`), so validation
is the automated checks below plus three deliberate manual passes. Run them from
`/Users/parthgoyal/Projects/buildcore-web`.

## Prerequisites

- `buildcore-api` running and reachable at the configured API base URL.
- At least three accounts whose roles differ: one holding every permission, one holding a narrow
  set (for example `ATTENDANCE` + `MY_WORKSPACE`), and one holding none.
  Roles are created on **Settings > Roles**; accounts are assigned roles on **Settings > Users**.

## Automated checks

```bash
npm run lint          # eslint, including the React Compiler rules
npx tsc --noEmit      # strict type check
npm run build         # next build + serwist build
```

All three must pass. They prove the feature compiles and lints; they prove nothing about
behaviour, which is what the passes below are for.

```bash
npm run dev           # http://localhost:3001
```

## Pass 1 — the role matrix (SC-001, SC-002, SC-005)

For each account, sign in and compare the sidebar against
[contracts/navigation.md](./contracts/navigation.md).

| Account | Expected sidebar |
|---|---|
| All permissions | All nine modules |
| `ATTENDANCE` + `MY_WORKSPACE` | HR & Payroll, My Workspace — and nothing else |
| `PAYROLL` only | HR & Payroll only (proves the any-of rule, FR-002) |
| `USER_MANAGEMENT` only | Settings only (any-of again, on the other multi-permission module) |
| No permissions | No modules; the empty state; Sign Out still present (FR-009, SC-007) |

Then, still signed in as the narrow account in a second browser: as an administrator, clear
`ATTENDANCE` from that role on **Settings > Roles**, save, and reload the narrow account's window.
HR & Payroll must disappear **without signing out** (FR-005, SC-005). Confirm the round trip took
under a minute and involved no screen other than Settings > Roles (SC-004).

## Pass 2 — direct URL refusal (SC-003)

Signed in as the narrow account, type each URL directly into the address bar:

| URL | Expected |
|---|---|
| `/dashboard` | Refused — the role lacks `DASHBOARD` |
| `/dashboard/settings` | Refused |
| `/dashboard/hr` | Opens (role holds `ATTENDANCE`) |
| `/my/punch` | Opens (role holds `MY_WORKSPACE`) |

Then sign in as the account with no permissions and confirm `/dashboard` lands on the empty state
rather than looping between redirects (FR-008, FR-009).

**Scope note**: Projects, Plant & Machinery, Inventory, Partners and Reports have no routes yet, so
they 404 rather than showing a refusal panel. Verify only that they are absent from the sidebar;
their guard entries are exercised when features 006–009 build those routes.

## Pass 3 — viewport and keyboard (SC-008, FR-012, FR-015)

At a **320px** viewport — the sidebar is a mobile-critical surface under Principle VI, so this pass
is mandatory, not optional:

- Check each of the accounts above. For every module count from 0 to 9, the navigation must wrap
  into tidy rows with no horizontal scrolling of the page body.
- Every target stays at least 44×44px.
- The identity panel and Sign Out remain reachable at every count.

Then, at desktop width, tab through the sidebar: every visible link and the Sign Out button must be
reachable and activatable by keyboard alone, with a visible focus state.

## Pass 4 — degraded states (FR-010, FR-010a)

- **Session load failure on `/dashboard`**: with the app open, stop `buildcore-api` and reload.
  Expect no modules and a stated failure — never a fallback to the full menu.
- **Offline on `/my`**: with a signed-in session holding `MY_WORKSPACE`, switch the browser to
  offline and reload `/my/punch`. The shell must still open so a queued punch can be recorded.
  This is the FR-010a exemption and is the one place a failed load must **not** refuse.

## Pass 5 — the roles screen (FR-013)

On **Settings > Roles**, open any role for editing. Each permission that governs a sidebar module
must say which module it governs, and the nine that govern none — DWR, Project Financials, Challans,
Loans, Logbook, Fuel, Daily Worker Registry, Data Export, Data Delete — must be distinguishable from
those that do. An administrator must not be able to clear one of those nine expecting the sidebar to
change.
