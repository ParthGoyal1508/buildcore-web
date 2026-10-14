import { ROUTES } from '@/app/lib/constants';

/**
 * Where each dashboard card leads (2026-10-15).
 *
 * The client asked for every dashboard item to be a way into its module — "Employees →
 * HR & Payroll". `WidgetRenderer` deliberately knows no widget's id, so the mapping lives
 * here, beside the pages that render the cards, and is handed to the renderer as a plain
 * `href`. A widget with no entry still renders, just without a link — a new card is never
 * broken by being missing from this list, only less useful.
 *
 * Each target is the screen gated on the same permission the API gates the widget on (the
 * widget's `requires`), so a card a person can see never links them into a refusal. The
 * Pending Approvals card goes to Approvals, which is not permission-gated at all; Alerts &
 * Reminders goes to the Reminders centre, and each of its rows to the reminder's own
 * record (the `href` the API already sends per row).
 */
export const WIDGET_LINKS: Record<string, string> = {
  // Company dashboard.
  'total-employees': ROUTES.hrEmployees,
  'present-today': ROUTES.hrAttendance,
  'absent-today': ROUTES.hrAttendance,
  'on-leave': ROUTES.hrLeave,
  'pending-approvals': ROUTES.approvals,
  'active-projects': ROUTES.projectsPortfolio,
  'total-machinery': ROUTES.plantEquipment,
  'contract-value': ROUTES.projectsPortfolio,
  'employees-on-muster': ROUTES.hrAttendance,
  'alerts-reminders': ROUTES.reminders,
  'today-attendance': ROUTES.hrAttendance,
  'recent-leaves': ROUTES.hrLeave,

  // Site dashboard — the same cards, scoped to one site.
  'workers-today': ROUTES.hrAttendance,
  'site-today-attendance': ROUTES.hrAttendance,
  'machinery-deployed': ROUTES.plantEquipment,
  'machinery-at-site': ROUTES.plantEquipment,
  'fuel-consumed': ROUTES.plantFuel,
  'fuel-consumption': ROUTES.plantFuel,
  'material-stock-value': ROUTES.inventoryStock,
  'material-stock': ROUTES.inventoryStock,
};

/** The link for a widget, or undefined when it has none. */
export function widgetHref(id: string): string | undefined {
  return WIDGET_LINKS[id];
}
