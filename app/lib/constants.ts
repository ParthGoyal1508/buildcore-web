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

  // --- My Workspace (feature 003) ---
  // A separate top-level tree, not nested under /dashboard: its users are field
  // employees on phones, and it gets a bottom-tab shell rather than the sidenav.
  myPunch: '/my/punch',
  myLeave: '/my/leave',
  mySalary: '/my/salary',
  myFaceEnrol: '/my/face-enrol',
} as const;

/**
 * Maximum acceptable GPS uncertainty, in metres, before a punch may be submitted
 * (spec FR-007, research.md §4).
 *
 * Checked in the browser *before* the network request, not just server-side. A
 * reading accurate to half a kilometre tells you nothing about whether the worker
 * is inside a 200-metre site geofence, so submitting it would only produce an
 * exception for an admin to resolve by hand — the employee is better served by
 * being asked to wait a moment for a better fix.
 *
 * Overridable via `NEXT_PUBLIC_MAX_GPS_ACCURACY_METERS` because the right value is
 * device- and site-dependent, not universal: a phone on site reports a GPS fix
 * accurate to a few metres, while a laptop positioning from Wi-Fi is routinely
 * coarser than this default — which makes the gate impossible to satisfy on the
 * very machine most local testing happens on. Raise it for desktop testing; leave
 * it at the default for a deployment whose sites have tight geofences.
 */
export const MAX_GPS_ACCURACY_METERS = Number(
  process.env.NEXT_PUBLIC_MAX_GPS_ACCURACY_METERS ?? 100,
);

/**
 * Stand-in coordinates used when the browser cannot locate the device — development
 * only, and never in a production build.
 *
 * Desktop browsers frequently cannot produce a fix at all: a laptop has no GPS, and
 * if the operating system's location services are switched off for the browser,
 * both the precise and the coarse request simply time out. That leaves the punch
 * screen untestable on the very machine it is developed on, for a reason unrelated
 * to anything the feature does.
 *
 * Defaults deliberately match `seedWorkspaceFixtures`' demo site, so a fallback
 * punch lands inside the geofence and exercises the in-range path rather than the
 * exception path. Point both at your own coordinates to test somewhere real.
 */
export const DEV_FALLBACK_POSITION = {
  latitude: Number(process.env.NEXT_PUBLIC_DEV_FALLBACK_LATITUDE ?? 19.076),
  longitude: Number(process.env.NEXT_PUBLIC_DEV_FALLBACK_LONGITUDE ?? 72.8777),
} as const;

/**
 * Which camera the capture screen uses, remembered per device (FR-015a).
 *
 * `user` is the front camera and the default: a worker holding their own phone is
 * the common case. `environment` is the rear one, which a tablet mounted at a site
 * gate needs, since there the rear camera is the one pointing at the worker.
 */
export type CameraFacing = 'user' | 'environment';
export const CAMERA_FACING_STORAGE_KEY = 'buildcore.my.cameraFacing';
export const DEFAULT_CAMERA_FACING: CameraFacing = 'user';

/** Photos required to enrol, mirroring the backend's configured bounds. */
export const ENROLMENT_PHOTO_RANGE = { min: 3, max: 5 } as const;

/**
 * Capture ceiling applied before a photo is uploaded.
 *
 * A phone camera frame at full sensor resolution is hundreds of kilobytes to
 * several megabytes, and base64 adds roughly a third on top. Uploading that is
 * wasted twice over: it is spent on site mobile data, and the server immediately
 * downscales to 640px (punch) or 800px (enrolment) anyway, so the extra pixels are
 * discarded on arrival.
 *
 * 1280px on the longest edge keeps comfortably more detail than the server's own
 * target — so its resize still has room to work from — while bringing a frame down
 * to roughly 150-250 KB. The API's body limit is sized against this number; if you
 * raise it, raise `MAX_REQUEST_BODY_SIZE` on the backend to match.
 */
export const CAPTURE_MAX_DIMENSION = 1280;
export const CAPTURE_JPEG_QUALITY = 0.85;

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
  confirmDeleteRole: (name: string, users: number) =>
    users > 0
      ? `Delete the "${name}" role? ${users} user${users === 1 ? '' : 's'} will lose the access it grants until reassigned.`
      : `Delete the "${name}" role? No users currently hold it.`,
  confirmDelete: (what: string, name: string) =>
    `Delete the ${what} "${name}"? This cannot be undone.`,
  protectedRole: 'The Super Admin role is protected and cannot be edited or deleted.',

  // --- My Workspace (feature 003) ---
  cameraDenied:
    'Camera access is blocked. Allow it in your browser settings, then try again.',
  cameraUnavailable:
    'No camera is available on this device, so a photo cannot be captured here.',
  locationDenied:
    'Location access is blocked. Allow it in your browser settings — a punch cannot be recorded without it.',
  locationUnavailable:
    'Your location could not be determined. If you are indoors, move near a window or outside and try again.',
  locationTimedOut:
    'Locating you took too long. Check that location is switched on for this device, then try again.',
  /**
   * Browsers expose geolocation only on a secure origin — HTTPS, or localhost.
   * Reached most often when testing from a phone against a dev server over the
   * local network by IP, where every other feature works and only this one fails,
   * with nothing on screen to say why.
   */
  punchLocating: 'Finding your location…',
  punchSubmitting: 'Recording your punch…',
  /**
   * Shown whenever the dev fallback position is used, never silently substituted:
   * a punch carrying a made-up location must be obviously distinguishable from a
   * real one while testing.
   */
  locationDevFallback:
    'Using the development fallback location — your device could not be located.',
  locationInsecureConnection:
    'Location is unavailable over an insecure connection. Open this site over HTTPS (or on localhost) to punch in.',
  locationInaccurate: (accuracy: number) =>
    `Your location is only accurate to about ${Math.round(accuracy)}m, which is not precise enough to confirm you are on site. Wait a moment and try again.`,
  punchQueued:
    'Queued — this punch will sync automatically when you are back online.',
  punchQueuedCount: (count: number) =>
    `${count} punch${count === 1 ? '' : 'es'} queued — will sync when you are back online.`,
  punchSyncFailed: (reason: string) => `A queued punch could not be synced: ${reason}`,
  punchExceptionFlagged:
    'Punch recorded, but it needs review — your face or location did not match. Your supervisor has been notified; you do not need to punch again.',
  payrollLocked:
    'This period is closed for payroll. Punches and leave changes dated inside it can no longer be recorded.',
  notEnrolled: 'Enrol your face before punching in.',
  enrolmentConsent:
    'I consent to my facial data being captured and stored for attendance verification.',
  noSalaryPeriods:
    'No payslips yet. One appears here once your first month of payroll has been processed.',
  leaveDayCountApprox:
    'Approximate — the final day count excludes your site’s holidays and is confirmed when you submit.',
  reEnrolmentPending:
    'Your re-enrolment request is waiting for approval. You will be able to re-capture once it is approved.',
  reEnrolmentRejected: (remarks: string | null) =>
    remarks
      ? `Your re-enrolment request was declined: ${remarks}`
      : 'Your re-enrolment request was declined.',
  reEnrolmentExpired:
    'Your approval window has closed without being used. Request re-enrolment again to continue.',
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
