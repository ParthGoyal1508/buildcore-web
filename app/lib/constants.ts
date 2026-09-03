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
  /** The My Workspace module index — tiles, like every other module's landing. */
  myWorkspace: '/my',
  myPunch: '/my/punch',
  myLeave: '/my/leave',
  mySalary: '/my/salary',
  myFaceEnrol: '/my/face-enrol',
  myReimbursements: '/my/reimbursements',

  // --- HR & Payroll admin (feature 005) ---
  // Nested under the existing /dashboard shell: unlike My Workspace above, these
  // are desktop surfaces operated by HR and payroll staff at a desk
  // (Constitution VI as amended v2.0.0).
  hr: '/dashboard/hr',
  hrEmployees: '/dashboard/hr/employees',
  hrEmployee: (id: string) => `/dashboard/hr/employees/${id}`,
  hrAttendance: '/dashboard/hr/attendance',
  hrHolidays: '/dashboard/hr/attendance/holidays',
  hrAttendanceImport: '/dashboard/hr/attendance/import',
  hrLateComing: '/dashboard/hr/attendance/late-coming',
  hrLeave: '/dashboard/hr/leave',
  hrPayroll: '/dashboard/hr/payroll',
  hrPayrollRun: (id: string) => `/dashboard/hr/payroll/${id}`,
  hrChallans: '/dashboard/hr/challans',
  hrLoans: '/dashboard/hr/loans',
  hrAdvances: '/dashboard/hr/advances',
  hrTds: '/dashboard/hr/tds',
  hrReimbursements: '/dashboard/hr/reimbursements',
  hrReEnrolment: '/dashboard/hr/re-enrolment',

  // --- Projects (feature 008) ---
  // Clients, Sites and the Portfolio are built (US1-US3). BOQ, DWR, revenue,
  // billing, budget, P&L and documents are specified but not yet built, so they
  // have no routes here — a route that leads nowhere is the dead link feature 014
  // exists to prevent.
  projects: '/dashboard/projects',
  projectsPortfolio: '/dashboard/projects/portfolio',
  projectsNewProject: '/dashboard/projects/portfolio/new',
  projectsEditProject: (id: string) =>
    `/dashboard/projects/portfolio/${id}/edit`,
  projectsClients: '/dashboard/projects/clients',
  projectsSites: '/dashboard/projects/sites',

  // --- Partners (feature 007) ---
  partnersVendors: '/dashboard/partners/vendors',
  partnersVendorCategories: '/dashboard/partners/vendors/categories',
  partnersContractors: '/dashboard/partners/contractors',
  partnersContractor: (id: string) => `/dashboard/partners/contractors/${id}`,
  partnersCompliance: '/dashboard/partners/contractors/compliance',
  partnersRag: '/dashboard/partners/contractors/rag',
  partnersBocw: '/dashboard/partners/bocw',
  // --- Modules not yet built (features 006, 009) ---
  // Listed because feature 014 filters and guards the sidebar from one definition,
  // and that definition has to name every module the sidebar shows. Each has a
  // placeholder page rendering <ModuleInProgress>, so following a sidebar link the
  // app itself drew explains itself rather than 404ing. Only the module index is
  // stubbed — a deeper path under one of these is a genuinely wrong URL and still
  // 404s.
  plant: '/dashboard/plant',
  inventory: '/dashboard/inventory',
  partners: '/dashboard/partners',
  reports: '/dashboard/reports',
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
  claimReceiptRequired: (category: string, threshold: number) =>
    `${category} claims above ${threshold} need a receipt attached.`,
  confirmDeleteClaim:
    'Delete this draft claim? It has not been submitted, so nothing is kept.',
  confirmWithdrawClaim:
    'Withdraw this claim from review? It stays on your record as withdrawn.',
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
  /** An open shift started today. The In/Out boxes show the day's first in and
   * last out, so a punch-in made after the last punch-out does not appear in them
   * at all — this is the only thing on screen that accounts for the button. */
  punchOpenSince: (capturedAt: string) =>
    `You are currently punched in, since ${new Date(capturedAt).toLocaleTimeString(
      undefined,
      { hour: '2-digit', minute: '2-digit' },
    )}. Punch out to close this shift.`,
  /** Shown in place of the punch control once the day's pair is recorded. */
  punchDayComplete:
    'You have punched in and out for today. Attendance for today is complete.',
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

  // --- Role-based navigation (feature 014) ---
  noModulesTitle: 'No modules assigned',
  noModulesBody:
    'Your role does not include access to any part of the application yet. Ask a Super Admin to assign the permissions you need.',
  navLoadFailed: 'Your access could not be checked, so no modules are shown.',
  navRedirecting: 'Taking you to the first module your role can open…',
  navPermissionsHint:
    'These decide which modules this role sees in the sidebar, and which it can open.',
  /**
   * Shown at a module whose sidebar entry exists but whose feature has not been
   * built yet. Named rather than generic: someone who arrived from the sidebar
   * needs to know it is *this* module that is unfinished, not that they mistyped.
   */
  moduleInProgressTitle: (name: string) => `${name} is in progress`,
  moduleInProgressBody:
    'This part of BuildCore is still being built. Check back soon.',
  /** The nine permissions that gate content *inside* a module rather than a sidebar
   * entry. Said once, here, rather than repeated on every checkbox: an admin who
   * clears one of these expecting the menu to change is misled, and the section this
   * introduces is the place to prevent that (FR-013). */
  nonNavPermissionsHint:
    'These grant access to areas inside a module. They do not add or remove anything from the sidebar.',
  permissionControlsModule: (module: string) => `Shows "${module}" in the sidebar`,

  // --- Projects (feature 008) ---
  /** The 409 from `DELETE /projects/clients/:id`. The API's own message names the
   * project count; this is the fallback when it does not reach us. */
  clientHasProjects:
    'This client has linked projects and cannot be deleted. Set it inactive instead.',
  projectHasRecords:
    'This project has recorded data and cannot be deleted. Set its status to completed instead.',
  siteInUse:
    'This site is still in use and cannot be deleted. Set it inactive instead.',
  /** Shown on every write control while a project is locked (spec FR-003). */
  projectLocked:
    'This project is locked. An administrator must unlock it before anything can be changed.',
  projectLockConfirm:
    'Lock this project? All data entry will be disabled until it is unlocked.',
  projectUnlockConfirm:
    'Unlock this project? Data entry will be re-enabled for everyone.',
  /** The route-change interception on the project form (spec FR-002). */
  discardChanges: 'Discard your changes to this project?',
  gstinFormat: 'Enter a valid 15-character GSTIN, e.g. 27AAPFU0939F1ZV.',
  /** Said on the site form, where the number is not self-explanatory. */
  geofenceHint: 'Employees punching outside this radius will be flagged.',
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

// ─────────────────────────────────────────────────────────────────────────────
// HR & Payroll (feature 005)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which permission each `/dashboard/hr/*` area requires, enforced by
 * `app/dashboard/hr/layout.tsx`.
 *
 * Same shape and same caveat as `SETTINGS_PERMISSIONS`: this is a UX affordance
 * that avoids rendering a page the user cannot use. `buildcore-api` guards every
 * one of these endpoints with `@RequirePermissions`, and that is the real gate.
 * The values mirror the controller decorators exactly — where the backend guards
 * an area with `ATTENDANCE` rather than the permission the area's name suggests
 * (leave administration is one), this map follows the backend, not the name.
 */
export const HR_PERMISSIONS = {
  employees: 'EMPLOYEES',
  attendance: 'ATTENDANCE',
  leave: 'ATTENDANCE',
  payroll: 'PAYROLL',
  challans: 'CHALLANS',
  loans: 'LOANS',
  advances: 'PAYROLL',
  tds: 'PAYROLL',
  reimbursements: 'EMPLOYEES',
  're-enrolment': 'EMPLOYEES',
} as const;

export type HrSection = keyof typeof HR_PERMISSIONS;

// ─────────────────────────────────────────────────────────────────────────────
// Partners (feature 007)
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors the backend `VendorType` enum exactly. */
export const VENDOR_TYPES = [
  'material',
  'fuel',
  'hire',
  'service',
  'subcontractor',
  'labour_contractor',
] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];

/** The two vendor types that may carry a contractor compliance profile. The backend
 * refuses the others with a 400, so the vendor picker filters to these rather than
 * offering a choice that cannot succeed. */
export const CONTRACTOR_VENDOR_TYPES: readonly VendorType[] = [
  'subcontractor',
  'labour_contractor',
];

export const CONTRACTOR_COMPLIANCE_STATUSES = [
  'compliant',
  'partially_compliant',
  'non_compliant',
] as const;

export const CONTRACTOR_DOCUMENT_TYPES = [
  'labour_license',
  'pf_registration',
  'esic_registration',
  'insurance',
  'bocw_registration',
] as const;
export type ContractorDocumentType = (typeof CONTRACTOR_DOCUMENT_TYPES)[number];

export const MONTHLY_COMPLIANCE_STATUSES = [
  'missing',
  'partial',
  'submitted',
  'verified',
] as const;

/** The monthly statuses plus `gray`, which the RAG matrix uses for a month that is
 * not yet due. It is not a compliance state — a filing that is not due has not been
 * missed — so it exists only here. */
export const RAG_CELL_STATUSES = [
  'verified',
  'submitted',
  'partial',
  'missing',
  'gray',
] as const;
export type RagCellStatus = (typeof RAG_CELL_STATUSES)[number];

export const BOCW_STATUSES = ['pending', 'partial', 'paid'] as const;
export type BocwStatus = (typeof BOCW_STATUSES)[number];

/**
 * Which permission each `/dashboard/partners/*` section requires.
 *
 * Vendor categories are the odd one out: the table lives in `settings` because it is
 * a company master, and the backend gates it on `SETTINGS` rather than `PARTNERS`
 * (007 FR-015). A user with `PARTNERS` alone can tag a vendor with a category but
 * cannot create one, and the guard has to reflect that or the screen 403s on load.
 */
/**
 * The status and classification vocabularies of the Projects module (feature 008).
 *
 * Mirrors the Prisma enums exactly. Declared here rather than inline in the zod
 * schemas so a badge's colour map and the schema that validates the value cannot
 * come to disagree about what the values are (Principle III).
 */
export const CLIENT_STATUSES = ['active', 'inactive'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const SITE_STATUSES = ['active', 'inactive'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const PROJECT_STATUSES = [
  'planning',
  'ongoing',
  'on_hold',
  'completed',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_DIVISIONS = ['contract', 'own'] as const;
export type ProjectDivision = (typeof PROJECT_DIVISIONS)[number];

export const PROJECT_SITE_TYPES = ['site', 'toll', 'plant'] as const;
export type ProjectSiteType = (typeof PROJECT_SITE_TYPES)[number];

/**
 * Which permission each `/dashboard/projects/*` section requires.
 *
 * All three are `PROJECTS` today. The map exists anyway because the sections that
 * follow do not share it — the backend gates DWR on `DWR` and revenue, billing and
 * P&L on `PROJECT_FINANCIALS` — and adding a section then means adding a row here
 * rather than discovering the guard was never per-section in the first place.
 */
export const PROJECTS_PERMISSIONS = {
  portfolio: 'PROJECTS',
  clients: 'PROJECTS',
  sites: 'PROJECTS',
} as const;

export type ProjectsSection = keyof typeof PROJECTS_PERMISSIONS;

/** Label for a projects enum value, via the shared enum labeller. */
export function projectsLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return hrLabel(value);
}

export const PARTNERS_PERMISSIONS = {
  vendors: 'PARTNERS',
  contractors: 'PARTNERS',
  bocw: 'PARTNERS',
} as const;

export type PartnersSection = keyof typeof PARTNERS_PERMISSIONS;

/** Label for a partners enum value. Delegates to the shared enum labeller so there
 * is one place that turns `labour_contractor` into "Labour contractor", and this
 * feature's terms live in `ENUM_LABEL_OVERRIDES` with everyone else's. */
export function partnersLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return hrLabel(value);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The top-level sidebar modules and the permissions that govern each (feature 014,
 * FR-003).
 *
 * This is the tier above `SETTINGS_PERMISSIONS` and `HR_PERMISSIONS`: those gate areas
 * *within* a module, this gates whether the module is reachable at all.
 *
 * It is the single definition FR-014 requires. `app/ui/dashboard/nav-links.tsx` renders
 * the sidebar from it and `app/lib/permissions.ts` answers the route guard from it, so
 * the menu and the gate cannot disagree about what a user may reach. Two definitions
 * would drift, and the drift shows up as either a visible link that 403s on click or a
 * hidden page still reachable by typing its URL.
 *
 * `permissions` is ANY-OF — the module appears when the user holds at least one. Two
 * modules list several because they aggregate what the backend guards separately.
 *
 * `href` and `guardPrefix` are separate on purpose. They coincide for eight modules;
 * My Workspace links to `/my/punch`, the tab a field worker actually wants, but guards
 * the whole of `/my`. Prefix-matching the link target would leave `/my/leave` and its
 * siblings matching nothing, and therefore unguarded.
 *
 * Icons live in `nav-links.tsx`, not here. This file is imported by server components
 * throughout the app, and pulling nine icon components into every one of those bundles
 * for tidiness would cost real bytes for no benefit; `NavModuleId` keeps that record
 * exhaustive instead.
 */
export const NAV_MODULES = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    href: ROUTES.dashboard,
    guardPrefix: ROUTES.dashboard,
    // The one module that guards a single page rather than a subtree. `/dashboard` is
    // the prefix of every other route in the shell, so guarding its subtree would put
    // routes no module claims — `/dashboard/account-creation` today — behind the
    // DASHBOARD permission, quietly making it the key to the whole application.
    guardsSubtree: false,
    permissions: ['DASHBOARD'],
  },
  {
    id: 'hr',
    name: 'HR & Payroll',
    href: ROUTES.hr,
    guardPrefix: ROUTES.hr,
    guardsSubtree: true,
    permissions: ['EMPLOYEES', 'ATTENDANCE', 'PAYROLL'],
  },
  {
    id: 'projects',
    name: 'Projects',
    href: ROUTES.projects,
    guardPrefix: ROUTES.projects,
    guardsSubtree: true,
    permissions: ['PROJECTS'],
  },
  {
    id: 'plant',
    name: 'Plant & Machinery',
    href: ROUTES.plant,
    guardPrefix: ROUTES.plant,
    guardsSubtree: true,
    permissions: ['MACHINERY'],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    href: ROUTES.inventory,
    guardPrefix: ROUTES.inventory,
    guardsSubtree: true,
    permissions: ['INVENTORY'],
  },
  {
    id: 'partners',
    name: 'Partners',
    href: ROUTES.partners,
    guardPrefix: ROUTES.partners,
    guardsSubtree: true,
    permissions: ['PARTNERS'],
  },
  {
    id: 'reports',
    name: 'Reports',
    href: ROUTES.reports,
    guardPrefix: ROUTES.reports,
    guardsSubtree: true,
    permissions: ['REPORTS'],
  },
  {
    // Leaves the `/dashboard` route tree, for a user who is both an admin and an
    // employee (003 research.md §2). `/my` keeps its own shell — a bottom tab bar on
    // a phone — but mounts the same SideNav from `md` up, so following this link on a
    // desktop no longer drops every other module.
    id: 'my-workspace',
    name: 'My Workspace',
    href: ROUTES.myWorkspace,
    guardPrefix: '/my',
    guardsSubtree: true,
    permissions: ['MY_WORKSPACE'],
  },
  {
    id: 'settings',
    name: 'Settings',
    href: ROUTES.settings,
    guardPrefix: ROUTES.settings,
    guardsSubtree: true,
    permissions: ['SETTINGS', 'USER_MANAGEMENT', 'COMPANY_SETTINGS'],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  href: string;
  guardPrefix: string;
  /** Whether `guardPrefix` covers everything beneath it, or only that exact path. */
  guardsSubtree: boolean;
  // `satisfies` rather than a plain annotation: it type-checks every value against
  // the real Permission union while keeping the literal types the derived types below
  // depend on. A typo'd permission fails to compile here rather than silently hiding
  // a module from everyone.
  permissions: readonly Permission[];
}[];

export type NavModule = (typeof NAV_MODULES)[number];
export type NavModuleId = NavModule['id'];

/**
 * The 13 permissions that govern a sidebar module, out of the 22 assignable. The other
 * 9 — DWR, Project Financials, Challans, Loans, Logbook, Fuel, Daily Worker Registry,
 * Data Export, Data Delete — gate content below module level, and the roles screen says
 * so rather than letting an admin clear one and wait for a menu change that never comes
 * (FR-013).
 */
export const NAV_GOVERNING_PERMISSIONS: ReadonlySet<Permission> = new Set(
  NAV_MODULES.flatMap((navModule) => navModule.permissions),
);

/**
 * Which module a permission makes visible, for the roles screen's checkbox captions.
 * Derived from `NAV_MODULES` rather than written out again, so a module renamed above
 * cannot leave a stale caption here.
 */
export const NAV_MODULE_BY_PERMISSION: ReadonlyMap<Permission, string> = new Map(
  NAV_MODULES.flatMap((navModule) =>
    navModule.permissions.map((permission) => [permission, navModule.name] as const),
  ),
);

/** Default page size for the server-paginated employee list (spec FR-001). */
export const EMPLOYEE_PAGE_SIZE = 25;

/**
 * How long after a reveal the unmasked PII value stays on screen (spec FR-003).
 *
 * A revealed Aadhaar left visible until navigation is a shoulder-surfing exposure
 * that outlives the reason it was revealed for, and every reveal is separately
 * written to the backend's audit log — so the value re-masks itself rather than
 * relying on the clerk to remember.
 */
export const PII_REVEAL_TIMEOUT_MS = 30_000;

/** The four fields the audited reveal endpoint accepts, one per call. */
export const PII_FIELDS = ['aadhaar', 'pan', 'bankAccountNumber', 'uan'] as const;
export type PiiField = (typeof PII_FIELDS)[number];

export const PII_FIELD_LABELS: Record<PiiField, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  bankAccountNumber: 'Bank account number',
  uan: 'UAN',
};

// --- Enum value lists, mirroring buildcore-api's prisma schema exactly ---

export const GENDERS = ['male', 'female', 'other'] as const;
export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;
export const EMPLOYMENT_TYPES = ['full_time', 'contract', 'daily_wage'] as const;
export const CALCULATION_MODES = ['monthly', 'daily'] as const;
export const ATTENDANCE_STATUS_OVERRIDES = [
  'present',
  'absent',
  'on_leave',
  'weekly_off',
  'holiday',
] as const;
export const LEAVE_TYPES = ['earned', 'casual', 'sick', 'lwp'] as const;
export const LEAVE_APPLICATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export const HOLIDAY_TYPES = ['national', 'regional', 'company'] as const;
export const PAYROLL_RUN_STATUSES = ['draft', 'processed', 'paid'] as const;
export const LOAN_STATUSES = ['pending', 'active', 'closed'] as const;
export const LOAN_SCHEDULE_STATUSES = ['upcoming', 'paid', 'overdue'] as const;
export const SALARY_ADVANCE_STATUSES = [
  'pending',
  'approved',
  'disbursed',
  'closed',
] as const;
export const EXIT_REASONS = ['resignation', 'termination', 'contract_end'] as const;
export const TAX_DECLARATION_STATUSES = ['declared', 'verified'] as const;
export const CHALLAN_TYPES = ['pf', 'esic', 'pt', 'tds'] as const;
export type ChallanType = (typeof CHALLAN_TYPES)[number];

/**
 * Turns a snake_case enum value into a display label ("full_time" → "Full Time").
 *
 * Deliberately the same transformation `permissionLabel` applies, kept as its own
 * export rather than reused under that name because the two mirror different
 * backend enums and are free to diverge.
 */
export function enumLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Overrides where the mechanical label is wrong or unhelpfully terse. */
const ENUM_LABEL_OVERRIDES: Record<string, string> = {
  // Projects (008)
  on_hold: 'On hold',
  // "Own" alone reads as a typo in a status column; the pair is contract work vs
  // work the company is doing for itself.
  own: 'Own work',

  // Partners (007)
  labour_contractor: 'Labour contractor',
  non_compliant: 'Non-compliant',
  partially_compliant: 'Partially compliant',
  labour_license: 'Labour licence',
  pf_registration: 'PF registration',
  esic_registration: 'ESIC registration',
  bocw_registration: 'BOCW registration',
  gray: 'Not yet due',
  bocw_pending: 'Pending',
  bocw_partial: 'Partial',
  bocw_paid: 'Paid',
  lwp: 'Leave Without Pay',
  uan: 'UAN',
  pf: 'PF',
  esic: 'ESIC',
  pt: 'Professional Tax',
  tds: 'TDS',
  on_leave: 'On Leave',
  full_time: 'Full Time',
  daily_wage: 'Daily Wage',
};

export function hrLabel(value: string): string {
  return ENUM_LABEL_OVERRIDES[value] ?? enumLabel(value);
}

/**
 * Badge colours for the statuses that appear in HR tables (spec FR-006).
 *
 * Colour is never the only signal — every badge also carries its text label, so a
 * colour-blind reader loses nothing.
 */
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  // Partners (007). `bocw_*` keys are deliberately prefixed: BOCW's `partial` means
  // "part-paid" and reads better in orange, while compliance's `partial` means "one
  // of two challans filed" and is yellow. One key for both would force the same
  // colour on two different meanings.
  compliant: 'bg-green-100 text-green-800',
  partially_compliant: 'bg-amber-100 text-amber-800',
  non_compliant: 'bg-red-100 text-red-800',
  submitted: 'bg-blue-100 text-blue-800',
  partial: 'bg-amber-100 text-amber-800',
  missing: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-600',
  bocw_pending: 'bg-red-100 text-red-800',
  bocw_partial: 'bg-orange-100 text-orange-800',
  bocw_paid: 'bg-green-100 text-green-800',
  expiring_soon: 'bg-orange-100 text-orange-800',
  expired: 'bg-red-100 text-red-800',
  // Attendance
  present: 'bg-green-100 text-green-800',
  complete: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  half_day: 'bg-orange-100 text-orange-800',
  on_leave: 'bg-blue-100 text-blue-800',
  weekly_off: 'bg-gray-100 text-gray-700',
  holiday: 'bg-gray-100 text-gray-700',
  // Workflow
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
  draft: 'bg-gray-100 text-gray-700',
  processed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  active: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-700',
  disbursed: 'bg-indigo-100 text-indigo-800',
  declared: 'bg-amber-100 text-amber-800',
  verified: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  upcoming: 'bg-gray-100 text-gray-700',
};

/**
 * Statutory ceilings per deduction section, mirroring `buildcore-api`'s
 * `hrPayroll.tds.sectionCeilings` defaults.
 *
 * Held here so the declaration form can show the capped deductible amount live
 * beside what the employee declared — a ₹300,000 80C declaration is worth
 * ₹150,000, and finding that out only when the payslip arrives is what generates
 * the query. The backend caps it regardless; this is the same number shown early.
 *
 * A deployment that overrides `TDS_CEILING_*` must update these to match — they
 * are display-only, so a mismatch misinforms rather than miscalculates.
 */
export const TDS_SECTION_CEILINGS: Record<string, number> = {
  '80C': 150_000,
  '80D': 25_000,
  '80CCD1B': 50_000,
  HRA: 0,
};

/** The sections the declaration form offers, in the order they are usually filed. */
export const TDS_SECTIONS = ['80C', '80D', '80CCD1B', 'HRA'] as const;

export const HR_MESSAGES = {
  // Employees
  employeeSaved: 'Employee saved.',
  employeeLoadFailed: 'Could not load this employee.',
  statutoryNeedsNumbers:
    'PF requires both a UAN and a PF number; ESIC requires an ESIC number. Fill them in or turn the contribution off.',
  revealPiiHint: (field: string) =>
    `Revealing the full ${field} is recorded against your account.`,
  piiReRedacted: 'Hidden again.',
  noEmployees: 'No employees match these filters.',

  // Documents
  documentsProgress: (done: number, total: number) =>
    `${done} of ${total} mandatory documents uploaded`,
  documentExpiringSoon: (days: number) =>
    days < 0
      ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
      : `Expires in ${days} day${days === 1 ? '' : 's'}`,

  // Attendance
  periodLocked:
    'That period is locked by a processed payroll run, so attendance for it can no longer be changed.',
  noAttendance: 'No attendance records for this date and site.',
  attendanceSaved: 'Attendance updated.',
  importNothingValid:
    'Nothing in this file can be imported — every row failed validation. Fix the errors and upload again.',
  importPartial: (ok: number, bad: number) =>
    `${ok} row${ok === 1 ? '' : 's'} ready to import, ${bad} rejected. Only the valid rows will be committed.`,

  // Leave
  rejectNeedsRemarks: 'A rejection needs a reason — the employee sees this remark.',
  leaveDecided: 'Application updated.',

  // Payroll
  runLocked:
    'This run has been processed, so its figures can no longer change. Reverse it or start a new run.',
  confirmProcessRun:
    'Process this payroll run? Its figures are frozen afterwards and the period is locked against attendance edits.',
  confirmMarkPaid:
    'Mark this run as paid? This is the final state — it cannot be reopened.',
  registerNeedsProcessedRun:
    'A register is produced from a processed or paid run. Process this run first.',
  registerMismatch:
    'The register total does not match the run. Do not file this until the difference is explained.',
  missingPan:
    'Employees without a PAN are taxed at the higher rate. Resolve these before filing.',

  // Loans & advances
  confirmApproveLoan: (amount: string) =>
    `Approve this loan of ${amount}? The repayment schedule is generated on approval and EMIs start deducting from the next run.`,
  advanceDistinctFromLoan:
    'An advance is recovered in full from the next payroll run; a loan is repaid over an EMI schedule.',

  // Offboarding
  confirmProcessFnf:
    'Process this full & final settlement? It creates a draft payroll run and closes every outstanding loan and advance.',
  fnfNegative:
    'This settlement is negative — recoveries exceed what is owed. It must be collected separately; payroll will not pay a negative amount.',
} as const;
