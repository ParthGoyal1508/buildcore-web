export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  changePassword: '/change-password',
  settings: '/dashboard/settings',
  settingsCompanies: '/dashboard/settings/companies',
  settingsRoles: '/dashboard/settings/roles',
  settingsUsers: '/dashboard/settings/users',
  settingsEmployeeSetup: '/dashboard/settings/employee-setup',
  /** Feature 010 (Account Creation) owns this route; it does not exist yet, so the
   * Users screen's "Add User" control is rendered disabled rather than linked. */
  accountCreation: '/dashboard/account-creation',
} as const;

export const MESSAGES = {
  invalidCredentials: 'Invalid email or password',
  welcomeBack: (name: string) => `Welcome back, ${name}!`,
  lockoutFallback: 'Account temporarily locked. Try again later.',
  rateLimited: 'Too many attempts. Please try again later.',

  // --- Settings (feature 002) ---
  accessDeniedTitle: 'You do not have access to this page',
  accessDeniedBody:
    'Your role does not include the permission this page requires. Ask a Super Admin if you think this is wrong.',
  saveFailed: 'Could not save your changes. Please review the form and try again.',
  loadFailed: 'Could not load this list. Please try again.',
  never: 'Never',
  addUserUnavailable:
    'Adding accounts arrives with the Account Creation module — not available yet.',
  confirmDeleteRole: (name: string, users: number) =>
    users > 0
      ? `Delete the "${name}" role? ${users} user${users === 1 ? '' : 's'} will lose the access it grants until reassigned.`
      : `Delete the "${name}" role? No users currently hold it.`,
  confirmDelete: (what: string, name: string) =>
    `Delete the ${what} "${name}"? This cannot be undone.`,
  protectedRole: 'The Super Admin role is protected and cannot be edited or deleted.',
} as const;

/**
 * The permissions a role may be granted through this UI.
 *
 * Mirrors `buildcore-api`'s `ASSIGNABLE_PERMISSIONS` exactly — every value of the
 * backend `Permission` enum except `CROSS_COMPANY_ACCESS`, which only the protected
 * Super Admin role carries and which the API rejects with a 400 from role CRUD.
 * Offering it here would be a checkbox that always fails.
 *
 * tasks.md T002 says "20 fixed values"; the enum has since grown to 23 (DWR and
 * PROJECT_FINANCIALS were split out by feature 008, CROSS_COMPANY_ACCESS added by
 * 001), leaving 22 assignable.
 */
export const PERMISSIONS = [
  'DASHBOARD',
  'EMPLOYEES',
  'ATTENDANCE',
  'PROJECTS',
  'DWR',
  'PROJECT_FINANCIALS',
  'MACHINERY',
  'INVENTORY',
  'PARTNERS',
  'REPORTS',
  'PAYROLL',
  'CHALLANS',
  'LOANS',
  'LOGBOOK',
  'FUEL',
  'DAILY_WORKER_REGISTRY',
  'MY_WORKSPACE',
  'SETTINGS',
  'USER_MANAGEMENT',
  'COMPANY_SETTINGS',
  'DATA_EXPORT',
  'DATA_DELETE',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Human-readable label for a permission value, for checkbox lists and summaries. */
export function permissionLabel(permission: string): string {
  return permission
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Which permission each Settings section requires, enforced by
 * `app/dashboard/settings/layout.tsx`. Mirrors the guards on the backend's own
 * controllers — the browser check is for UX; the API is the real gate.
 */
export const SETTINGS_PERMISSIONS = {
  companies: 'COMPANY_SETTINGS',
  roles: 'USER_MANAGEMENT',
  users: 'USER_MANAGEMENT',
  'employee-setup': 'EMPLOYEES',
} as const;

/** `/dashboard/settings/users` additionally requires one of these roles (FR-010),
 * matching `UsersAdminService.assertMayAdminister()` on the backend. */
export const USER_ADMIN_ROLES = ['Super Admin', 'HO User'] as const;

/**
 * The backend's 423 response bakes the unlock time into its message as a raw
 * ISO timestamp (auth.service.ts). Reformat it for display rather than
 * showing backend text verbatim (mirrors the 401 case, where the frontend
 * owns its own copy regardless of what the backend returned).
 */
export function formatLockoutMessage(rawMessage: string): string {
  const match = rawMessage.match(/after (.+)\.$/);
  if (!match) return MESSAGES.lockoutFallback;
  const unlockTime = new Date(match[1]);
  if (Number.isNaN(unlockTime.getTime())) return MESSAGES.lockoutFallback;
  return `Account temporarily locked. Try again after ${unlockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
}
