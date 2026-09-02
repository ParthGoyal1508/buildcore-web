# Contract: Sidebar Navigation Visibility

The UI contract this feature must satisfy. Normative; `NAV_MODULES` in `app/lib/constants.ts` is its
single implementation, and the quickstart checks against this table.

## Module → permission

A module is **visible** when the user holds **at least one** of its governing permissions (any-of,
FR-002). Order is significant: it is both the sidebar's render order and the FR-008 landing order.

| # | Module | Link target (`href`) | Guarded subtree (`guardPrefix`) | Governing permissions | Route exists today |
|---|---|---|---|---|---|
| 1 | Dashboard | `/dashboard` | `/dashboard` | `DASHBOARD` | yes |
| 2 | HR & Payroll | `/dashboard/hr` | `/dashboard/hr` | `EMPLOYEES` \| `ATTENDANCE` \| `PAYROLL` | yes |
| 3 | Projects | `/dashboard/projects` | `/dashboard/projects` | `PROJECTS` | **no** |
| 4 | Plant & Machinery | `/dashboard/plant` | `/dashboard/plant` | `MACHINERY` | **no** |
| 5 | Inventory | `/dashboard/inventory` | `/dashboard/inventory` | `INVENTORY` | **no** |
| 6 | Partners | `/dashboard/partners` | `/dashboard/partners` | `PARTNERS` | **no** |
| 7 | Reports | `/dashboard/reports` | `/dashboard/reports` | `REPORTS` | **no** |
| 8 | My Workspace | `/my/punch` | **`/my`** | `MY_WORKSPACE` | yes |
| 9 | Settings | `/dashboard/settings` | `/dashboard/settings` | `SETTINGS` \| `USER_MANAGEMENT` \| `COMPANY_SETTINGS` | yes |

**Two columns, not one.** For eight modules the link target and the guarded subtree coincide. My
Workspace is the exception: it links to `/my/punch` because that is the tab a worker wants, but it
guards all of `/my`. Prefix-matching the link target would leave `/my/leave`, `/my/salary`,
`/my/reimbursements` and `/my/face-enrol` unmatched and therefore unguarded.

**Longest prefix wins.** `/dashboard` is a prefix of every other module route, so a first-match
resolution would attribute `/dashboard/hr` to Dashboard and gate HR behind `DASHBOARD`. Resolution
MUST take the longest matching `guardPrefix`.

**Dashboard guards one page, not a subtree.** Longest-prefix alone is not enough: `/dashboard`
still captures every route in the shell that no *other* module claims — `/dashboard/account-creation`
today, and anything added later before its own module exists — which would silently make `DASHBOARD`
the key to the whole application. Dashboard's guard therefore matches its exact path only; the other
eight cover their subtrees.

**Matching is on whole path segments.** `/dashboard/hrms` MUST NOT match the `/dashboard/hr` prefix,
or a module could be gated by a neighbour's rules purely because their names share an opening
substring.

The five routes marked **no** are not yet built (features 006–009 own them). They are filtered and
guarded by this contract regardless, so the behaviour is correct the day those routes land; until
then those links 404 for everyone, which is itself an argument for filtering them out.

## Guard decision table

Applied by `ModuleGuard` for `/dashboard/*` and by the `/my` layout for `/my/*`.

| Session state | Module permission held? | Result |
|---|---|---|
| Loading | — | Neutral placeholder. Never the module's content, never a refusal. (FR-011) |
| Loaded | yes | Render the module. |
| Loaded | no | Access-refused panel in place of module content. (FR-006) |
| Loaded, zero governing permissions | — | Empty-state panel naming the situation; Sign Out remains. (FR-009) |
| Load failed, `/dashboard/*` | — | No modules; state the failure. (FR-010) |
| Load failed, `/my/*` | — | **Fall through to the shell** — offline is expected here. (FR-010a) |
| Loaded, route not in the table | — | Not this feature's concern; render normally. Sub-section guards (`HR_PERMISSIONS`, `SETTINGS_PERMISSIONS`) still apply below. |

## Invariants

- **I1**: The set of modules rendered in the sidebar equals `visibleModules(permissions)` exactly —
  no module is rendered disabled, greyed, or as a tooltip. (FR-001)
- **I2**: The sidebar and the guard read the same `NAV_MODULES` array. A module hidden from the
  sidebar is refused by the guard, and vice versa, by construction. (FR-014)
- **I3**: The guard's decision is computed from `permissions`, never from what the sidebar rendered.
  Hiding a link is presentation; it is never the mechanism preventing access. (FR-007)
- **I4**: The identity panel and Sign Out render in every state in the table above, including both
  failure rows. (FR-004)
- **I6**: A pathname resolves to at most one module, by longest `guardPrefix` match among the
  modules whose guard covers it, on whole path segments. A pathname matching none is not this
  feature's concern and renders normally.
- **I5**: This contract is advisory to the client only. `buildcore-api` refuses the underlying
  requests with `@RequirePermissions` regardless, and that is the enforcement.
