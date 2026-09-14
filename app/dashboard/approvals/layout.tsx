/**
 * `/dashboard/approvals` — and the one thing this layout deliberately does **not** do.
 *
 * Every other area of the shell puts a permission chokepoint here: `DashboardPermissionGuard`
 * for the Reminders and Activity Log pages, the module tier's `ModuleGuard` for the rest.
 * This one adds neither, and the omission is the point.
 *
 * **There is no permission that grants the right to approve.** Authority comes from
 * holding the role a chain's level is mapped to, resolved per item by the server —
 * `buildcore-api`'s `/approvals/*` endpoints carry no `@RequirePermissions` for exactly
 * that reason. A site engineer holding only `ATTENDANCE` may be the first approver on
 * every attendance exception in the company; gating this page behind a permission would
 * hide their own queue from them.
 *
 * The queue is per-caller by construction: the API returns only what *this* user may act
 * on, and an empty queue is the correct answer for somebody no chain level resolves to.
 * That is a better guard than a permission check, because it cannot drift out of step
 * with the chain configuration.
 *
 * `ModuleGuard` in the shell layout still runs and resolves this path as an unknown route,
 * which it admits — the same treatment `/dashboard/account-creation` gets, and for the
 * same reason: `NAV_MODULES` describes modules, and this is not one.
 */
export default function ApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
