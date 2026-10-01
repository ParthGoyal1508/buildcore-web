/**
 * The timezone the business operates in.
 *
 * Every "today" and every calendar-day boundary in this app is this zone's, not the
 * browser's and not UTC. The API is configured the same way (`APP_TIMEZONE`,
 * defaulting to `Asia/Kolkata`), and the two must agree: at UTC+5:30 a UTC-derived
 * "today" is the previous date for the first five and a half hours of every working
 * day, so a client and a server disagreeing about it means a date the user picked
 * being refused as being in the future.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  changePassword: '/change-password',
  settings: '/dashboard/settings',
  settingsCompanies: '/dashboard/settings/companies',
  settingsRoles: '/dashboard/settings/roles',
  settingsUsers: '/dashboard/settings/users',
  settingsEmployeeSetup: '/dashboard/settings/employee-setup',
  /** Who approves what (feature 016). Guarded by SETTINGS, matching the backend. */
  settingsApprovals: '/dashboard/settings/approvals',
  /**
   * The company's statutory papers (017 US1). Guarded by COMPANY_SETTINGS, matching
   * the backend: the same people who may edit the registration numbers are the people
   * who may see the certificates behind them.
   */
  settingsCompanyDocuments: '/dashboard/settings/company-documents',
  /** Which documents every project must hold (017 US2). Writes need SETTINGS. */
  settingsProjectDocuments: '/dashboard/settings/project-documents',
  /** Letter kinds as data — a new kind without a release (017 US5, FR-011). */
  settingsLetterKinds: '/dashboard/settings/letter-kinds',
  /** Named signatories and their signature graphics (017 US4). */
  settingsSignatories: '/dashboard/settings/signatories',
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
  /** What a project holds, and what it still owes (017 FR-024). */
  projectsProjectDocuments: (id: string) =>
    `/dashboard/projects/portfolio/${id}/documents`,
  projectsClients: '/dashboard/projects/clients',
  projectsSites: '/dashboard/projects/sites',

  // --- Dashboard: Reminders centre (feature 004, US9) ---
  // Not a NAV_MODULES entry: Reminders is part of the Dashboard module, not a
  // module of its own, and it is gated by DASHBOARD. Note that the `dashboard`
  // entry in NAV_MODULES carries `guardsSubtree: false`, so `ModuleGuard` returns
  // 'unknown-route' for this path — the permission check lives in
  // `app/dashboard/reminders/layout.tsx`, the same way HR and Settings gate their
  // own sections.
  reminders: '/dashboard/reminders',

  // Approvals (feature 016). Not a NAV_MODULES entry and deliberately not gated by a
  // permission: authority to approve comes from the chain's slot mapping, not from a
  // permission value, so anyone signed in may have a queue — see
  // app/dashboard/approvals/layout.tsx.
  approvals: '/dashboard/approvals',

  // --- Dashboard: Activity Log, Site & Group dashboards (feature 004) ---
  // Sub-pages of the Dashboard module, gated by DASHBOARD in their own layouts
  // (the `dashboard` NAV_MODULES entry is guardsSubtree: false — see reminders).
  activityLog: '/dashboard/activity-log',
  siteDashboard: '/dashboard/site',
  groupDashboard: '/dashboard/group',

  // --- Partners (feature 007) ---
  partnersVendors: '/dashboard/partners/vendors',
  partnersVendorCategories: '/dashboard/partners/vendors/categories',
  partnersContractors: '/dashboard/partners/contractors',
  partnersContractor: (id: string) => `/dashboard/partners/contractors/${id}`,
  partnersCompliance: '/dashboard/partners/contractors/compliance',
  partnersRag: '/dashboard/partners/contractors/rag',
  partnersBocw: '/dashboard/partners/bocw',
  // --- Inventory (feature 009) ---
  inventoryStock: '/dashboard/inventory/stock',
  inventoryPurchases: '/dashboard/inventory/purchases',
  inventoryIssues: '/dashboard/inventory/issues',
  inventoryTransfers: '/dashboard/inventory/transfers',
  inventoryPayments: '/dashboard/inventory/payments',
  inventoryIndents: '/dashboard/inventory/indents',
  inventoryIndent: (id: string) => `/dashboard/inventory/indents/${id}`,
  inventoryProcurement: '/dashboard/inventory/indents/procurement',

  // --- Labour (feature 013) ---
  // Back-office surfaces under the /dashboard shell (desktop-first, responsive); the
  // supervisor muster capture is a field surface OUTSIDE /dashboard, a phone-first
  // sibling of /my (spec FR-001).
  labour: '/dashboard/labour',
  labourWageRates: '/dashboard/labour/wage-rates',
  labourWorkers: '/dashboard/labour/workers',
  labourGangs: '/dashboard/labour/gangs',
  labourMusters: '/dashboard/labour/musters',
  labourMuster: (id: string) => `/dashboard/labour/musters/${id}`,
  labourPaymentSheets: '/dashboard/labour/payment-sheets',
  labourPaymentSheet: (id: string) => `/dashboard/labour/payment-sheets/${id}`,
  labourAdvances: '/dashboard/labour/advances',
  labourReportsDeployment: '/dashboard/labour/reports/deployment',
  labourReportsAttendance: '/dashboard/labour/reports/attendance',
  labourReportsPaymentRegister: '/dashboard/labour/reports/payment-register',
  /** Field muster capture, outside /dashboard (spec FR-001). */
  musterCapture: '/labour/muster',

  // --- Recruitment & Onboarding (feature 011) ---
  recruitment: '/dashboard/recruitment',
  recruitmentRequisitions: '/dashboard/recruitment/requisitions',
  recruitmentPipeline: '/dashboard/recruitment/pipeline',
  recruitmentInterviews: '/dashboard/recruitment/interviews',
  recruitmentOnboarding: (employeeId: string) =>
    `/dashboard/recruitment/onboarding/${employeeId}`,
  recruitmentLetterTemplates: '/dashboard/recruitment/letter-templates',
  recruitmentLetters: '/dashboard/recruitment/letters',
  recruitmentResignations: '/dashboard/recruitment/resignations',
  recruitmentReportsNewJoinings: '/dashboard/recruitment/reports/new-joinings',
  recruitmentReportsFunnel: '/dashboard/recruitment/reports/funnel',
  recruitmentReportsResignations: '/dashboard/recruitment/reports/resignations',

  // --- Modules not yet built (feature 006) ---
  // --- Plant & Machinery (feature 006) ---
  plant: '/dashboard/plant',
  plantEquipment: '/dashboard/plant/equipment',
  plantEquipmentDetail: (id: string) => `/dashboard/plant/equipment/${id}`,
  plantLogbook: '/dashboard/plant/logbook',
  plantFuel: '/dashboard/plant/fuel',
  plantServices: '/dashboard/plant/services',
  plantMaintenance: '/dashboard/plant/maintenance',
  plantHireBills: '/dashboard/plant/hire-bills',
  plantSpareParts: '/dashboard/plant/spare-parts',
  plantMasters: '/dashboard/plant/masters',

  // Built by 009; the module index is a real screen rather than
  // <ModuleInProgress>. Kept here because NAV_MODULES points the sidebar at it.
  inventory: '/dashboard/inventory',

  // --- Project Assets (feature 012) ---
  assets: '/dashboard/assets',
  assetsRegister: '/dashboard/assets/register',
  assetsAsset: (id: string) => `/dashboard/assets/register/${id}`,
  assetsStock: '/dashboard/assets/stock',
  assetsSummary: '/dashboard/assets/summary',
  assetsAllocations: '/dashboard/assets/allocations',
  assetsCustody: '/dashboard/assets/allocations/custody',
  assetsMasters: '/dashboard/assets/masters',

  // --- Modules not yet built ---
  // Listed because feature 014 filters and guards the sidebar from one definition,
  // and that definition has to name every module the sidebar shows. Each has a
  // placeholder page rendering <ModuleInProgress>, so following a sidebar link the
  // app itself drew explains itself rather than 404ing. Only the module index is
  // stubbed — a deeper path under one of these is a genuinely wrong URL and still
  // 404s.
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
/**
 * Exit clearance (021 US4) — what a leaver still owes.
 *
 * Kinds are grouped by **consequence**, not by module: an asset has a site and a due date
 * and physically exists somewhere, which is a different kind of obligation from money, and
 * grouping them together obscures what is actually outstanding.
 */
export const CLEARANCE_COPY = {
  heading: 'Exit clearance',
  hint: 'Derived from each module on every read, so returning an asset in the asset register clears it here with no second action.',
  loading: 'Loading…',
  noExit: 'No exit has been initiated for this employee.',
  groups: {
    asset_custody: 'Assets in custody',
    recoverable_kit: 'Recoverable kit',
    salary_advance: 'Outstanding advances',
    account_access: 'Account access',
  },
  /** Nothing outstanding at all. Distinct from "we could not check" below. */
  allClear: 'Nothing outstanding.',
  openAllocation: 'Open in asset register',
  /**
   * Said where an asset appears. The asset module owns returning — with its condition
   * grade and its own consequences — so a return control here would be a second way to
   * close an allocation, and the two would disagree.
   */
  returnElsewhere: 'Returned in the asset register, not here.',
  cancel: 'Cancel',
  waive: 'Waive',
  waiveHeading: 'Stop pursuing this',
  /** FR-014: the reason is required, and the backend enforces a real minimum. */
  waiveReasonLabel: 'Why the company is not pursuing this',
  waiveReasonShort: (min: number) =>
    `A reason of at least ${min} characters is required — this writes off company money.`,
  waiveSubmit: 'Record waiver',
  waiveFailed: 'The waiver could not be recorded.',
  /**
   * A waiver is **not** a discharge. The backend is explicit: an asset waived here stays
   * open in the asset register, because marking it returned would put a false fact in the
   * register that owns the truth.
   */
  waivedBy: (name: string, at: string) => `Waived by ${name} on ${at}`,
  waivedNotReturned: 'Waived — not returned. The obligation stands on the record.',
  settleBlocked: 'Final settlement is unavailable while anything above is outstanding.',
  settleReady: 'Nothing is outstanding. Final settlement may proceed.',
  /**
   * "Could not ask" is not "nothing held", and the difference is somebody leaving with a
   * laptop. Styled as a warning for that reason, where an ordinary outstanding item is not.
   */
  unavailable: (names: string) =>
    `${names} could not be checked, so this clearance may be incomplete. Settlement stays blocked until it can be.`,
  /**
   * Said once, where somebody would otherwise look for a figure. The backend deliberately
   * computes no recovery value for an unreturned asset: that needs a valuation rule —
   * original cost, depreciated, or replacement — and the client has not chosen one.
   */
  noAssetValuation:
    'No recovery amount is shown for an unreturned asset: a valuation rule has not been agreed.',
} as const;

/**
 * Dashboard search (021 US1). Register labels are copy here, unlike document kinds:
 * the four are fixed by the backend's own union rather than being company configuration,
 * so there is nothing for a company to rename.
 */
export const SEARCH_COPY = {
  label: 'Search',
  placeholder: 'Code or name — employee, vendor, equipment, project',
  /**
   * Shown below the minimum term length instead of an empty result.
   *
   * FR-001c: "nothing matched" and "too short to search" are different facts to the
   * person typing, and they look identical if you let them.
   */
  keepTyping: (min: number) =>
    `Keep typing — at least ${min} characters to search.`,
  searching: 'Searching…',
  /**
   * The **one** empty state, used for every case.
   *
   * Never varied by register. A per-register message would let somebody infer which
   * registers exist by watching which message appears, which is the disclosure FR-005
   * forbids — see `dashboard-search.tsx`.
   */
  empty: 'Nothing matched.',
  failed: 'Search could not be completed.',
  /** FR-001b — why a row the reader did not expect is in the list. */
  matchedOnName: 'matched on name',
  /**
   * Shown on a vendor row. Vendors are edited in a modal on their list, so there is no
   * per-vendor screen to open — and a reader who picked a named record and arrived at a
   * list deserves to have been told, not surprised.
   */
  opensList: 'opens the vendor list',
  truncated: 'More matches exist than are shown. Narrow the term to see them.',
  /**
   * A register the caller may search that could not be asked. Never a permission
   * problem — the backend omits those entirely — so naming it discloses nothing.
   */
  unavailable: (names: string) =>
    `${names} could not be searched just now, so matches there are missing.`,
  registers: {
    employee: 'Employees',
    vendor: 'Vendors',
    equipment: 'Equipment',
    project: 'Projects',
  },
} as const;

/** Debounce for dashboard search (021 NFR-001): typing must not be a request per keystroke. */
export const SEARCH_DEBOUNCE_MS = 250;

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

/**
 * Reminder severity bands, in the order the list presents them (spec FR-025).
 *
 * Ordered worst-first to match the API's own sort, so a filter dropdown built from
 * this array reads the same way the rows below it do.
 */
export const REMINDER_SEVERITIES = ['overdue', 'warning', 'info'] as const;

export type ReminderSeverity = (typeof REMINDER_SEVERITIES)[number];

/** How often the dashboard widgets, notifications and badge re-poll (004 §5). A
 * display cadence — every poll computes live on the server. */
export const DASHBOARD_REFRESH_INTERVAL_MS = 30_000;

/** Debounce before the Group Dashboard's employee search fires (004 FR-011). */
export const EMPLOYEE_SEARCH_DEBOUNCE_MS = 300;

/** The Activity Log's time-range filter options (004 FR-006). */
export const ACTIVITY_TIME_RANGES = ['today', '7d', '30d', '90d'] as const;
export type ActivityTimeRange = (typeof ACTIVITY_TIME_RANGES)[number];

/** The Activity Log's module filter buckets (004 FR-006). */
export const ACTIVITY_MODULES = [
  'hr',
  'settings',
  'payroll',
  'machinery',
  'projects',
  'inventory',
  'partners',
  'recruitment',
  'labour',
] as const;
export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

/**
 * Copy for each severity band.
 *
 * Centralised per Principle III, and separate from the colour map below because the
 * two change for different reasons — a wording tweak should not risk a colour.
 */
export const REMINDER_SEVERITY_LABELS: Record<ReminderSeverity, string> = {
  overdue: 'Overdue',
  warning: 'Due soon',
  info: 'Upcoming',
};

/**
 * How the reminders list renders a signed days-remaining figure (spec FR-025).
 *
 * The sign carries the meaning, so it is spelled out in words rather than shown as a
 * bare `-3`: a negative number in a column headed "days remaining" is read as a
 * mistake at least as often as it is read as "overdue".
 */
export function daysRemainingLabel(days: number): string {
  if (days < 0) {
    const late = Math.abs(days);
    return `${late} day${late === 1 ? '' : 's'} overdue`;
  }
  if (days === 0) return 'Due today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

/**
 * Human labels for the reminder source modules the engine can report.
 *
 * Falls back to a de-slugged form for a module registered after this map was
 * written — the engine is extensible by design, so a new `sourceModule` string
 * arriving here is expected rather than an error.
 */
const REMINDER_MODULE_LABELS: Record<string, string> = {
  settings: 'Settings',
  machinery: 'Plant & Machinery',
  project_assets: 'Project Assets',
  projects: 'Projects',
  inventory: 'Inventory',
  partners: 'Partners',
  hr: 'HR & Payroll',
};

export function reminderModuleLabel(sourceModule: string): string {
  return (
    REMINDER_MODULE_LABELS[sourceModule] ??
    sourceModule
      .split(/[_-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

/** The same treatment for a reminder `type`, e.g. `document_expiry`. */
export function reminderTypeLabel(type: string): string {
  return type
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * The company switcher's own copy (019 FR-001 – FR-006).
 *
 * Its own block rather than keys inside `MESSAGES`, which is where sign-in and session copy lives.
 * Principle III keeps strings out of components; it does not ask for one bucket.
 */
export const COMPANY_SWITCHER = {
  label: 'Company',
  /**
   * Named screens, not "you have unsaved changes".
   *
   * Somebody switching company has usually forgotten the half-filled form two tabs back, and that is
   * the whole reason to ask. A message that cannot say what is at risk gets dismissed as noise.
   */
  confirmDiscard: (screens: string) =>
    `Switching company will discard unsaved changes on: ${screens}. Continue?`,
  switchFailed:
    'Could not switch company. You are still working in the previous one.',
} as const;

export const MESSAGES = {
  invalidCredentials: 'Invalid email or password',
  welcomeBack: (name: string) => `Welcome back, ${name}!`,
  lockoutFallback: 'Account temporarily locked. Try again later.',
  rateLimited: 'Too many attempts. Please try again later.',

  // --- Why a session ended (feature 015 FR-011) ---
  // Shown on the sign-in page when a renewal was refused, so someone returning after
  // a long absence is told what happened instead of meeting an unexplained form.
  // Keyed by the backend's code, never by its prose.
  sessionExpired: 'Your session expired. Please sign in again.',
  sessionRevoked:
    'Your session was ended for security reasons. Please sign in again.',
  // Deliberately the same sentence a user sees for an expiry: to them the two are the
  // same event, and "the server did not receive your session cookie" is not something
  // they can act on. The distinction is preserved in the URL and the console for
  // whoever has to diagnose it, because this code almost always means a deployment
  // fault rather than anything the user did.
  sessionCookieMissing: 'Your session has ended. Please sign in again.',

  // --- Settings (feature 002) ---
  accessDeniedTitle: 'You do not have access to this page',
  accessDeniedBody:
    'Your role does not include the permission this page requires. Ask a Super Admin if you think this is wrong.',
  saveFailed: 'Could not save your changes. Please review the form and try again.',
  loadFailed: 'Could not load this list. Please try again.',

  // --- Project Assets (feature 012) ---
  assetsLoadFailed: 'Could not load the asset register. Please try again.',
  assetsSaveFailed: 'Could not save this asset. Please review the form and try again.',
  assetsEmpty:
    'No assets registered yet. Register one to start tracking where it is and who holds it.',
  assetsEmptyFiltered: 'No assets match these filters.',
  assetsStockEmpty: 'Nothing in stock at any site yet.',
  assetsAllocationsEmpty: 'Nothing has been allocated yet.',
  assetsAllocationsEmptyFiltered: 'No allocations match these filters.',
  assetsCustodyEmpty: 'Nobody is currently holding an asset.',
  assetsNoCategories:
    'No asset categories exist yet. Add one under Masters before registering an asset.',
  assetsNoGrades:
    'No condition grades exist yet. Add them under Masters — a return cannot be recorded without one.',
  assetsExportFailed: 'Could not build the export. Please try again.',
  never: 'Never',
  confirmDeleteRole: (name: string, users: number) =>
    users > 0
      ? `Delete the "${name}" role? ${users} user${users === 1 ? '' : 's'} will lose the access it grants until reassigned.`
      : `Delete the "${name}" role? No users currently hold it.`,
  confirmDelete: (what: string, name: string) =>
    `Delete the ${what} "${name}"? This cannot be undone.`,
  protectedRole: 'The Super Admin role is protected and cannot be edited or deleted.',

  // --- Dashboard: Reminders centre (feature 004, US9) ---
  remindersEmpty: 'Nothing is due. Reminders appear here as due dates approach.',
  remindersEmptyFiltered:
    'No reminders match these filters. Clear them to see everything that is due.',
  /** Spec FR-026: an unavailable source is reported, never allowed to fail the screen. */
  remindersUnavailable: (modules: string) =>
    `Not counted yet: ${modules}. These modules are not built, so anything due in them cannot be shown.`,
  remindersLoadFailed:
    'Could not load reminders. Nothing has been missed — try again.',
  reminderSnoozed: (until: string) => `Snoozed until ${until}.`,
  snoozeReasonRequired: 'Give a reason, so the next person to see this knows why.',
  snoozeDatePast: 'Pick a date in the future, or the reminder returns immediately.',
  /** Spec FR-028, for a reminder whose module has no screen to open yet. */
  reminderNoDestination:
    'This reminder has no screen to open yet — its module is still being built.',

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

  // Inventory (feature 009)
  // --- Plant & Machinery (feature 006) ---
  plantEquipmentEmpty: 'No machines are registered yet.',
  plantEquipmentEmptyFiltered: 'No machines match these filters.',
  plantLogbookEmpty: 'No logbook entries yet.',
  plantFuelEmpty: 'No fuel entries yet.',
  plantServicesEmpty: 'No service schedules yet.',
  plantMaintenanceEmpty: 'No maintenance jobs yet.',
  plantHireBillsEmpty: 'No hire bills yet.',
  plantSparePartsEmpty: 'No spare parts are registered yet.',
  plantServiceBillsEmpty: 'No service bills against this job yet.',
  plantPartsEmpty: 'No parts have been consumed on this job yet.',
  plantReconciliationEmpty:
    'No spare part declares a link to an inventory item.',
  plantLoadFailed: 'Could not load this list. Try again.',
  plantSaveFailed: 'Could not save. Try again.',
  plantNoCategories:
    'No equipment categories exist yet. Add one under Masters before registering a machine.',
  plantNoDocTypes:
    'No document types exist yet. Add one under Masters before attaching a document.',
  plantStatusLocked:
    'Under Maintenance is set by opening a maintenance job, not on this form.',
  plantClosedJobParts:
    'This job is closed. Parts cannot be added to work whose cost has already been reported.',
  plantUnverifiedPay:
    'Verify this bill before recording a payment against it.',
  plantIncompatiblePart:
    'This part is not listed as compatible with this machine’s category. You can still fit it — the consumption will be flagged for review.',
  plantReversalReason: 'Say why this consumption is being reversed.',
  plantNoHireRate:
    'No hire rate is on file for this category on that date. Add one under Masters, or enter a rate on the bill.',
  plantHireBillOwned:
    'Hire bills are for hired machines. A repair invoice for a machine you own is a service bill.',
  plantConfirmDeleteEquipmentDoc: 'Remove this document?',
  plantConfirmDeleteLogbook:
    'Delete this entry? The machine’s reading and utilisation will be re-derived from what remains.',
  plantConfirmVerifyHireBill: (variance: string) =>
    `Billed hours differ from the logbook by ${variance}. Verify this bill anyway?`,

  inventoryEmpty: 'Nothing has been received into stock yet.',
  inventoryEmptyFiltered: 'No stock matches these filters.',
  purchasesEmpty: 'No purchases recorded yet.',
  issuesEmpty: 'No material has been issued yet.',
  transfersEmpty: 'No transfers recorded yet.',
  paymentsEmpty: 'No payments recorded yet.',
  indentsEmpty: 'No material has been indented yet.',
  itemsEmpty: 'No items yet. Add one to start recording purchases.',
  categoriesEmpty: 'No categories yet.',
  inventoryLoadFailed: 'Could not load this list. Try again.',
  confirmDeletePurchase:
    'Delete this purchase? The stock it added is reversed and the average rate recalculated. The record is kept, not erased.',
  confirmDeleteIssue:
    'Delete this issue? The material returns to the store it came from.',
  confirmDeleteTransfer:
    'Delete this transfer? Both stores go back to the balances they had.',
  confirmDeletePayment:
    'Delete this payment? Every bill it settled goes back to what it owed.',
  purchaseHasAllocations:
    'This bill has allocated payments. Delete the payment before deleting the purchase.',
  itemInUse:
    'This item has movement history and cannot be deleted. Retire it instead — it stays on old records and stops appearing in new ones.',
  categoryHasItems:
    'This category still has items. Recategorise them before deleting it.',
  transferSameSite: 'Source and destination stores cannot be the same.',
  insufficientStock: (available: number, unit: string) =>
    `Insufficient stock — ${available} ${unit} available.`,
  stockHint: (available: number, unit: string) =>
    `Available: ${available} ${unit}`,
  paymentFifoNote:
    "Allocated automatically against this vendor's oldest unpaid bills first. Anything beyond what is owed is recorded as an advance.",
  approvalDoesNotReserve:
    'Approving an indent does not reserve stock. Material is only committed when it is actually issued, so an approved indent can still be short if another site issues first.',
  procurementNotSummed:
    'Indent demand and reorder shortfall are listed separately on purpose. The same item can appear in both, and adding them together would order it twice.',
  indentHasFulfilment:
    'This indent has been partly fulfilled and can no longer be cancelled.',
  reductionNeedsReason:
    'Approving less than was requested needs a reason, so the site can tell a decision from an oversight.',
  outstandingExceeded: (outstanding: number) =>
    `This indent line has only ${outstanding} outstanding.`,
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
  'LABOUR_APPROVE',
  /**
   * Added by 009 and 006 respectively, mirroring the backend's `Permission` enum.
   *
   * They were missing here, which meant the Roles screen — the only place an
   * administrator can grant a permission — could not render a checkbox for them.
   * `INVENTORY_APPROVE` had been in that state since 009 shipped: the backend
   * gated indent approval on it and the UI offered no way to grant it.
   */
  'INVENTORY_APPROVE',
  'MAINTENANCE',
  'HIRE_BILLS',
  'RECRUITMENT',
  'RECRUITMENT_APPROVE',
  /**
   * Added by 012. `ASSETS` opens the module; `ASSETS_APPROVE` gates the approvals
   * the backend reserves — request approval, transfer cancellation and
   * condemnation. Both are assignable, so both need a checkbox here.
   */
  'ASSETS',
  'ASSETS_APPROVE',
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
  // Matches the backend's own guard on `/approvals/chains` and
  // `/approvals/slot-mappings`. Defining a chain is a settings act; *approving*
  // something is not, and has no permission at all — see
  // app/dashboard/approvals/layout.tsx.
  approvals: 'SETTINGS',
  // 017. COMPANY_SETTINGS rather than SETTINGS: these are the documents behind the
  // company's registration numbers, and the backend guards them with the same
  // permission that guards those numbers.
  'company-documents': 'COMPANY_SETTINGS',
  // Reading requirements needs only PROJECTS; the screen that *changes* them is a
  // settings act, so the section is gated on the write.
  'project-documents': 'SETTINGS',
  'letter-kinds': 'SETTINGS',
  signatories: 'SETTINGS',
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
    // Any-of, unlike most entries here, because 006's sections genuinely carry
    // five different permissions — 002's enum reserved MACHINERY, LOGBOOK and FUEL
    // separately and 006 adds MAINTENANCE and HIRE_BILLS. Gating the subtree on
    // MACHINERY alone would lock an operator who holds only LOGBOOK out of the
    // logbook the backend would happily serve them. The per-section check is in
    // `app/dashboard/plant/layout.tsx`; this list is only "may this user see the
    // module at all".
    permissions: [
      'MACHINERY',
      'LOGBOOK',
      'FUEL',
      'MAINTENANCE',
      'HIRE_BILLS',
    ],
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
    id: 'labour',
    name: 'Labour',
    href: ROUTES.labour,
    guardPrefix: ROUTES.labour,
    guardsSubtree: true,
    // Any-of: the registry permission opens the module; report sub-routes
    // additionally require REPORTS, gated in the labour layout (spec FR-002).
    permissions: ['DAILY_WORKER_REGISTRY'],
  },
  {
    id: 'recruitment',
    name: 'Recruitment',
    href: ROUTES.recruitment,
    guardPrefix: ROUTES.recruitment,
    guardsSubtree: true,
    // Report sub-routes additionally require REPORTS, gated in the layout.
    permissions: ['RECRUITMENT'],
  },
  {
    id: 'assets',
    name: 'Assets',
    href: ROUTES.assets,
    guardPrefix: ROUTES.assets,
    guardsSubtree: true,
    // A module of its own rather than a section of Inventory or Plant (012 web
    // T001). The three hold different things — assets are allocated and returned,
    // materials are consumed, machines are metered — and a user who has to guess
    // which module holds a scaffolding pipe looks in all three.
    permissions: ['ASSETS'],
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
 * The permissions that govern a sidebar module, out of the assignable set. The rest —
 * DWR, Project Financials, Challans, Loans, Logbook, Fuel, Daily Worker Registry, Data
 * Export, Data Delete, and the two `*_APPROVE` permissions — gate content below module
 * level, and the roles screen says so rather than letting an admin clear one and wait
 * for a menu change that never comes (FR-013).
 *
 * Counted rather than listed on purpose: the split was "13 of 22" when 014 shipped and
 * has moved twice since (006's MAINTENANCE and HIRE_BILLS, 012's ASSETS), and a number
 * written into prose here goes stale silently while the derivation below never does.
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

  // Plant (006). `enumLabel` would give "Ok" and "Km", which read as typos.
  ok: 'OK',
  km: 'Kilometres',
  hours: 'Hours',
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

/**
 * What an employee is told when somebody changed their attendance (016 FR-009a).
 *
 * Its own block rather than a few entries in `HR_MESSAGES`, because the reader is different: these
 * sentences are read by the person whose day was changed, not by the administrator who changed it.
 * Wording that is fine in an admin tool — "modified", "override" — is not fine here.
 */
export const MY_ATTENDANCE_MESSAGES = {
  /** Singular and plural said separately: "1 changes" on somebody's pay record is careless. */
  changedHeading: (count: number) =>
    count === 1
      ? 'This day was changed by an administrator'
      : `This day was changed ${count} times by administrators`,
  changedBy: (actor: string, when: string) => `${actor} · ${when}`,
  /** The diff. Reads as a sentence so it survives being flattened onto one line at 320px. */
  fieldChange: (field: string, from: string, to: string) =>
    `${field}: ${from} → ${to}`,
  fieldNames: {
    inTime: 'In',
    outTime: 'Out',
    statusOverride: 'Status',
  } as Record<string, string>,
  /** For a side of the diff that held nothing — distinct from a value that is unknown. */
  empty: 'not set',
  reasonGiven: (reason: string) => `Reason: ${reason}`,
  /**
   * T047. An administrator is not obliged to give a reason, and an empty field would read as
   * though the screen failed to load one. Saying so plainly is the requirement.
   */
  reasonMissing: 'No reason was given.',
  /**
   * Shown when a change is recorded but no field differs — which the data permits, because a
   * correction resubmitting the same values still writes a row. Saying "changed" and then listing
   * nothing would look like a rendering fault.
   */
  noFieldsChanged: 'No times or status were altered by this change.',
} as const;

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
  /**
   * Unused, and kept only so the next person looking for it finds this note rather than
   * reintroducing it (016 FR-009c). A correction is not an update: it is submitted for
   * approval, and the day does not change until the chain completes. "Attendance updated"
   * was true before api 016 phase 8 and is now precisely the wrong sentence.
   */
  attendanceSaved: 'Attendance updated.',
  correctionSubmitted:
    'Correction submitted for approval. The day will not change until it is approved.',
  correctionAwaiting: (level: string) => `Correction awaiting ${level}`,
  /** When the chain reports no level — it has finished, or nothing is mapped to decide it. */
  correctionAwaitingUnknown: 'Correction awaiting approval',
  correctionPendingHint:
    'A correction for this day is already awaiting approval. Submitting another will raise a second one.',
  correctionSubmit: 'Submit for approval',
  correctionSubmitting: 'Submitting…',
  correctionDialogHint: (date: string) =>
    `Attendance for ${date}. This is submitted for approval rather than applied — the day changes only once the chain approves it, and the change is then recorded in the modifications trail with its before and after values.`,
  correctionRemarksHint:
    'Shown to the approvers, and kept in the modifications trail if the correction is approved.',

  // The modification trail's filters (016 FR-012d)
  modificationEmployeeFilter: 'Employee',
  modificationAllEmployees: 'All employees',
  modificationActorFilter: 'Changed by',
  modificationAllActors: 'Anyone',
  modificationFrom: 'From',
  modificationTo: 'To',
  /** Only reachable if a row carries neither a name nor an id — kept so the cell is never blank. */
  modificationActorUnknown: 'Unknown',
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

// ─────────────────────────────────────────────────────────────────────────────
// Inventory (feature 009)
// ─────────────────────────────────────────────────────────────────────────────

/** The eight units the item master accepts (009 FR-018). */
export const ITEM_UNITS = [
  'BAG',
  'CUM',
  'KG',
  'NOS',
  'MT',
  'LTR',
  'RMT',
  'SQM',
] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

export const PURCHASE_BILL_STATUSES = ['unpaid', 'part_paid', 'paid'] as const;
export type PurchaseBillStatus = (typeof PURCHASE_BILL_STATUSES)[number];

export const PAYMENT_MODES = ['upi', 'bank_transfer', 'cash', 'cheque'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const TRANSFER_STATUSES = ['pending', 'in_transit', 'received'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const INDENT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'partially_fulfilled',
  'fulfilled',
  'cancelled',
] as const;
export type IndentStatus = (typeof INDENT_STATUSES)[number];

/**
 * The transitions the backend's transfer state machine permits, from each state.
 *
 * Held here so the status control offers only what will succeed, rather than
 * letting the user pick a transition the API answers with a 409.
 */
export const TRANSFER_NEXT_STATUSES: Record<
  TransferStatus,
  readonly TransferStatus[]
> = {
  pending: ['in_transit', 'received'],
  in_transit: ['received'],
  received: [],
};

/**
 * Which permission each `/dashboard/inventory/*` section requires.
 *
 * Stock and the movement screens are `INVENTORY`. The item and category masters are
 * `SETTINGS`, because they are `settings`-schema company reference data and the
 * backend gates them that way (009 research.md §1) — the same split vendor
 * categories already have in Partners. Indent *approval* is `INVENTORY_APPROVE`,
 * the one permission value 009 adds.
 */
export const INVENTORY_PERMISSIONS = {
  stock: 'INVENTORY',
  purchases: 'INVENTORY',
  issues: 'INVENTORY',
  transfers: 'INVENTORY',
  payments: 'INVENTORY',
  indents: 'INVENTORY',
  masters: 'SETTINGS',
  approve: 'INVENTORY_APPROVE',
} as const;

export type InventorySection = keyof typeof INVENTORY_PERMISSIONS;

/** Label for an inventory enum value, via the shared enum labeller. */
export function inventoryLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return hrLabel(value);
}

/**
 * How far past its required-by date an indent is, in words.
 *
 * The backend already computes `overdueByDays`; this is only the wording, kept
 * beside the other copy so a change lands in one place.
 */
export function overdueLabel(days: number): string {
  if (days <= 0) return '';
  return days === 1 ? '1 day overdue' : `${days} days overdue`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Labour (feature 013)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which permission each labour section requires, enforced by the labour layout.
 * Mirrors the backend controllers: the registry permission opens the module and
 * every operational screen; reports additionally require REPORTS; the LABOUR_APPROVE
 * actions are hidden without that permission (spec FR-002, FR-003).
 */
export const LABOUR_PERMISSIONS = {
  'wage-rates': 'DAILY_WORKER_REGISTRY',
  workers: 'DAILY_WORKER_REGISTRY',
  gangs: 'DAILY_WORKER_REGISTRY',
  musters: 'DAILY_WORKER_REGISTRY',
  'payment-sheets': 'DAILY_WORKER_REGISTRY',
  advances: 'DAILY_WORKER_REGISTRY',
  reports: 'REPORTS',
} as const;

export type LabourSection = keyof typeof LABOUR_PERMISSIONS;

/** Labour attendance types (spec FR-029: an unrecognised value renders its raw
 * label rather than being dropped — the zod schema uses `.catch`). */
export const ATTENDANCE_TYPES = [
  'full_day',
  'half_day',
  'absent',
  'overtime_only',
] as const;

export const ATTENDANCE_TYPE_LABELS: Record<string, string> = {
  full_day: 'Full Day',
  half_day: 'Half Day',
  absent: 'Absent',
  overtime_only: 'Overtime Only',
};

export const MUSTER_STATUSES = ['draft', 'submitted', 'approved'] as const;

export const ENGAGEMENT_TYPES = ['direct', 'contractor'] as const;

export const PAYMENT_SHEET_STATUSES = [
  'draft',
  'approved',
  'partially_disbursed',
  'closed',
] as const;

export const PAYMENT_SHEET_LINE_STATUSES = [
  'pending',
  'disbursed',
  'reversed',
] as const;

export const ADVANCE_STATUSES = [
  'pending',
  'approved',
  'disbursed',
  'closed',
] as const;

export const LABOUR_PAYMENT_MODES = ['cash', 'bank'] as const;

export const RATE_SOURCES = ['override', 'project_rate'] as const;

export const RATE_SOURCE_LABELS: Record<string, string> = {
  override: 'Worker override',
  project_rate: 'Project rate',
};

/** Indian currency note denominations, descending — the client renders the
 * server-computed breakup against these; the authoritative list is company config on
 * the backend (spec FR-027). */
export const CASH_DENOMINATIONS = [
  500, 200, 100, 50, 20, 10, 5, 1,
] as const;

/** Label for a labour enum value, via the shared enum labeller, with attendance
 * types given friendly copy. */
export function labourLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return ATTENDANCE_TYPE_LABELS[value] ?? hrLabel(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Plant & Machinery (feature 006)
// ─────────────────────────────────────────────────────────────────────────────

/** What an equipment category's machines meter. */
export const METER_TYPES = ['hours', 'km'] as const;
export type MeterType = (typeof METER_TYPES)[number];

export const EQUIPMENT_OWNERSHIPS = ['owned', 'hired'] as const;
export type EquipmentOwnership = (typeof EQUIPMENT_OWNERSHIPS)[number];

export const POWER_SOURCES = [
  'diesel',
  'petrol',
  'electric',
  'manual',
] as const;
export type PowerSource = (typeof POWER_SOURCES)[number];

/**
 * `under_maintenance` is deliberately absent from what the equipment form offers.
 *
 * The backend refuses it outright (006 FR-002): a machine goes under maintenance by
 * having a job opened against it, and letting the form set it would let the register
 * and the job list disagree about whether a machine is down.
 */
export const EQUIPMENT_STATUSES = [
  'active',
  'under_maintenance',
  'inactive',
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

/** The two an admin may actually choose. */
export const SETTABLE_EQUIPMENT_STATUSES = ['active', 'inactive'] as const;

export const SERVICE_SCHEDULE_STATUSES = ['ok', 'due_soon', 'overdue'] as const;
export type ServiceScheduleStatus = (typeof SERVICE_SCHEDULE_STATUSES)[number];

export const MAINTENANCE_TYPES = ['breakdown', 'scheduled'] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const MAINTENANCE_STATUSES = ['open', 'closed'] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const HIRE_BILL_STATUSES = [
  'pending_verification',
  'verified',
  'paid',
] as const;
export type HireBillStatus = (typeof HIRE_BILL_STATUSES)[number];

export const SERVICE_BILL_STATUSES = ['pending_verification', 'verified'] as const;
export type ServiceBillStatus = (typeof SERVICE_BILL_STATUSES)[number];

export const SERVICE_BILL_PAYMENT_STATUSES = [
  'unpaid',
  'partially_paid',
  'paid',
] as const;
export type ServiceBillPaymentStatus =
  (typeof SERVICE_BILL_PAYMENT_STATUSES)[number];

export const SPARE_PART_MOVEMENT_TYPES = [
  'receipt',
  'consumption',
  'reversal',
] as const;
export type SparePartMovementType = (typeof SPARE_PART_MOVEMENT_TYPES)[number];

/**
 * Which permission each `/dashboard/plant/*` section requires.
 *
 * Mirrors the backend's corrected mapping (006 research.md §7): `MACHINERY`,
 * `LOGBOOK` and `FUEL` were reserved by name in 002 and are reused verbatim; only
 * `MAINTENANCE` and `HIRE_BILLS` are new. The three machinery masters are `SETTINGS`
 * for the same reason the item and vendor category masters are — they are
 * `settings`-schema company reference data.
 *
 * Spare parts and service bills reuse `MAINTENANCE` (006 FR-028), adding no
 * permission of their own.
 */
export const PLANT_PERMISSIONS = {
  equipment: 'MACHINERY',
  logbook: 'LOGBOOK',
  fuel: 'FUEL',
  services: 'MAINTENANCE',
  maintenance: 'MAINTENANCE',
  spareParts: 'MAINTENANCE',
  serviceBills: 'MAINTENANCE',
  hireBills: 'HIRE_BILLS',
  masters: 'SETTINGS',
} as const;

export type PlantSection = keyof typeof PLANT_PERMISSIONS;

/** Label for a plant enum value, via the shared enum labeller. */
export function plantLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return hrLabel(value);
}

/**
 * A meter reading with its unit, so "1,208" never has to be guessed at.
 *
 * The unit follows the machine rather than the reading: a crane's life is measured
 * in running hours and a tipper's in kilometres, and the same number means very
 * different things on the two.
 */
export function formatReading(
  value: number,
  meterType: MeterType | string | null | undefined,
): string {
  const unit = meterType === 'km' ? 'km' : 'hrs';
  return `${value.toLocaleString('en-IN')} ${unit}`;
}

/**
 * A fuel variance as a signed percentage.
 *
 * Signed deliberately: under-consumption is as informative as over-consumption, and
 * showing "25%" for both would hide which one a machine is doing.
 */
export function formatVariance(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recruitment & Onboarding (feature 011)
// ─────────────────────────────────────────────────────────────────────────────

/** Which permission each recruitment section requires, enforced by the layout.
 * Reports additionally require REPORTS (spec FR-002); RECRUITMENT_APPROVE actions
 * are hidden without that permission (spec FR-003). */
export const RECRUITMENT_PERMISSIONS = {
  requisitions: 'RECRUITMENT',
  pipeline: 'RECRUITMENT',
  interviews: 'RECRUITMENT',
  onboarding: 'RECRUITMENT',
  'letter-templates': 'RECRUITMENT',
  letters: 'RECRUITMENT',
  resignations: 'RECRUITMENT',
  reports: 'REPORTS',
} as const;

export type RecruitmentSection = keyof typeof RECRUITMENT_PERMISSIONS;

export const REQUISITION_STATUSES = [
  'draft',
  'pending_approval',
  'open',
  'rejected',
  'closed',
] as const;

/** Candidate pipeline stages (spec FR-025: an unrecognised value renders its raw
 * label — the zod schema uses `.catch`). */
export const CANDIDATE_STAGES = [
  'applied',
  'shortlisted',
  'interviewing',
  'selected',
  'offer_issued',
  'offer_accepted',
  'joined',
  'rejected',
  'no_show',
] as const;

/** The board's ordered, recruiter-visible columns. */
export const PIPELINE_COLUMNS = [
  'applied',
  'shortlisted',
  'interviewing',
  'selected',
  'offer_issued',
  'offer_accepted',
  'joined',
] as const;

export const OFFER_STATUSES = [
  'draft',
  'issued',
  'accepted',
  'declined',
  'superseded',
] as const;

export const INTERVIEW_ROUND_TYPES = [
  'telephonic',
  'technical',
  'hr',
  'managerial',
  'final',
] as const;

export const INTERVIEW_MODES = ['in_person', 'phone', 'video'] as const;
export const INTERVIEW_OUTCOMES = ['recommend', 'hold', 'reject'] as const;

export const REQUISITION_EMPLOYMENT_TYPES = ['permanent', 'contract', 'walk_in'] as const;

export const CANDIDATE_SOURCES = [
  'referral',
  'agency',
  'walk_in',
  'portal',
  'internal',
] as const;

export const LETTER_TYPES = [
  'offer',
  'appointment',
  'confirmation',
  'relieving',
  'experience',
] as const;

export const RESIGNATION_REASON_CATEGORIES = [
  'better_opportunity',
  'personal',
  'relocation',
  'health',
  'compensation',
  'work_environment',
  'other',
] as const;

export const RESIGNATION_STATUSES = ['submitted', 'accepted', 'withdrawn'] as const;

const RECRUITMENT_STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  selected: 'Selected',
  offer_issued: 'Offer Issued',
  offer_accepted: 'Joining Pending',
  joined: 'Joined',
  rejected: 'Rejected',
  no_show: 'No Show',
  pending_approval: 'Pending',
};

/** Label for a recruitment enum value, via the shared title-caser, with friendly
 * copy for the stages that need it. */
export function recruitmentLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return RECRUITMENT_STAGE_LABELS[value] ?? hrLabel(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Assets (feature 012)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The asset lifecycle, mirroring the backend's `AssetStatus` (spec FR-018).
 *
 * Listed in lifecycle order rather than alphabetically, because that is the order a
 * status filter reads best in: a user scanning the dropdown is looking for "where in
 * its life is this thing", not for a word beginning with `s`.
 */
export const ASSET_STATUSES = [
  'not_in_service',
  'idle',
  'allocated',
  'in_transit',
  'under_repair',
  'scrapped',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/**
 * The statuses an edit may set directly.
 *
 * `allocated` and `in_transit` are absent because the backend refuses them on the
 * register endpoint: they belong to the allocation and transfer flows, which also
 * move the stock behind them. Offering an option that always fails is worse than not
 * offering it — the same treatment `SETTABLE_EQUIPMENT_STATUSES` gives
 * `under_maintenance`.
 */
export const SETTABLE_ASSET_STATUSES = [
  'idle',
  'under_repair',
  'scrapped',
] as const;

/** Statuses that count as "in service" for the summary's active totals (FR-021). */
export const ACTIVE_ASSET_STATUSES: readonly string[] = [
  'not_in_service',
  'idle',
  'allocated',
  'in_transit',
  'under_repair',
];

export const ASSET_TRACKING_MODES = ['serialised', 'bulk'] as const;
export type AssetTrackingMode = (typeof ASSET_TRACKING_MODES)[number];

export const ASSET_ALLOCATION_STATUSES = ['open', 'closed'] as const;
export type AssetAllocationStatus =
  (typeof ASSET_ALLOCATION_STATUSES)[number];

/**
 * Which permission each Assets section requires beyond the module tier.
 *
 * Only the masters differ: editing a company master is an administrator's job and the
 * backend gates those routes on `SETTINGS`, not `ASSETS`. Everything else in the
 * module shares `ASSETS`, so the module guard already covers it — unlike Plant, whose
 * sections genuinely carry five different permissions.
 */
export const ASSETS_PERMISSIONS = {
  register: 'ASSETS',
  stock: 'ASSETS',
  summary: 'ASSETS',
  allocations: 'ASSETS',
  masters: 'SETTINGS',
} as const;

export type AssetsSection = keyof typeof ASSETS_PERMISSIONS;

/** Label for an assets enum value, via the shared enum labeller. */
export function assetsLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return hrLabel(value);
}

/**
 * A quantity with its unit of measure.
 *
 * A bulk asset's quantity means nothing without its unit — "40" is forty pipes or
 * forty metres of pipe, and the two are not the same order. A serialised asset has
 * no unit and reads as a bare 1.
 */
export function formatAssetQuantity(
  quantity: number,
  unitOfMeasure: string | null | undefined,
): string {
  const number = quantity.toLocaleString('en-IN', {
    maximumFractionDigits: 3,
  });
  return unitOfMeasure ? `${number} ${unitOfMeasure}` : number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Approvals (feature 016)
//
// No approval copy may be written inline in a component. Every sentence a reviewer
// reads about a chain is here, so the same decision reads the same way in every
// module — which is the entire point of the feature (Principle III).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The three decisions, with their labels and whether a reason is required.
 *
 * Ordered approve-first because that is the common case and the one a reviewer reaches
 * for; the two that need justification sit after it.
 *
 * `requiresReason` mirrors the backend's FR-006 rather than guessing at it: the server
 * refuses a reject or return with no reason and answers `APPROVAL_REASON_REQUIRED`. This
 * flag is what lets the control ask for the reason *before* sending, so a reviewer is not
 * told off for something the form could have asked for.
 */
export const APPROVAL_ACTIONS = [
  { action: 'approve', label: 'Approve', requiresReason: false },
  { action: 'reject', label: 'Reject', requiresReason: true },
  { action: 'return', label: 'Return for correction', requiresReason: true },
] as const;

export type ApprovalActionKey = (typeof APPROVAL_ACTIONS)[number]['action'];

/**
 * Why the control is inert — one message per `inertReason`, keyed by the backend's code.
 *
 * Four sentences rather than one, because they have four different remedies, and telling
 * them apart is the difference between waiting, asking someone else, and opening a
 * settings screen. Never branch on message text; branch on the code.
 *
 * `already_decided` is the one that matters most. A Super Admin holds every permission in
 * the system, so "you do not have permission" said to one is simply untrue — and it sends
 * the one person who *can* change permissions off to change permissions that were never
 * the problem.
 *
 * `slot_unmapped` is the only one describing a **fault** rather than a state, and the only
 * one that never resolves itself by waiting. It names the remedy because the person who
 * hits it is rarely the person who can apply it — and since the approval settings screen
 * exists, it can name where. Anyone holding `SETTINGS` can fix it in about a minute; the
 * reader who hits this message usually cannot, which is why it says who to ask.
 */
export const APPROVAL_INERT_MESSAGES = {
  awaiting_other: (awaitingUserName: string | null, levelLabel: string | null) =>
    awaitingUserName
      ? `Waiting on ${awaitingUserName}`
      : `Waiting on ${levelLabel ?? 'the next approver'}`,
  already_decided: (_user: string | null, levelLabel: string | null) =>
    levelLabel
      ? `You already decided this at ${levelLabel}`
      : 'You have already decided this',
  insufficient_authority: (
    _user: string | null,
    levelLabel: string | null,
  ) => `${levelLabel ?? 'Another level'} decides this`,
  slot_unmapped: (_user: string | null, levelLabel: string | null) =>
    `Nobody can approve this yet: no role is mapped to ${
      levelLabel ?? 'this level'
    } for your company. Someone with settings access must map it under ` +
    `Settings → Approvals before this can move.`,
} as const;

/**
 * The originator's side of a returned item (FR-005).
 *
 * Worth stating why this copy exists at all: `returned` holds the item's chain slot, so
 * nothing else can be raised for the same record, and resubmitting is the only exit. A
 * reader who is not told that sees an item that looks finished and is not.
 */
/**
 * What the Action/Review control says when a decision could not be recorded (FR-006).
 *
 * Used **in place of** the error's own message whenever that error carries no
 * machine-readable `code`. A refusal from the spine is worth quoting — it names the level,
 * or says the slot is unmapped, and the reader can act on it. Anything without a code is a
 * transport failure, and what reaches the browser then is the proxy's own words: quickstart
 * Pass 3 kills the API mid-submission and the control faithfully displayed
 * "Internal Server Error" to somebody who had just typed a paragraph of justification.
 * True, and useless. The one thing that reader needs to know is that their words are safe.
 */
export const APPROVAL_DECISION_FAILED =
  'The decision could not be recorded — the server could not be reached. ' +
  'Your reason has been kept; try again.';

export const APPROVAL_RESUBMIT = {
  /** Shown to the originator where the approve/reject/return buttons would be. */
  prompt: 'This was returned to you for correction.',
  action: 'Resubmit for approval',
  inFlight: 'Resubmitting…',
  /** After a successful resubmit, before the record's own state refreshes. */
  done: 'Sent back for approval.',
  failed:
    'It could not be resubmitted — the server could not be reached. Try again.',
  /**
   * Said once, next to the button. People resubmit without changing anything otherwise —
   * the chain restarts from level one either way, and the approver who returned it is
   * looking for a change.
   */
  hint: 'Make the correction first — this starts the chain again from the first approver.',
} as const;

/**
 * The worker's own view of a punch that was flagged (016 T042).
 *
 * Written for somebody who did not choose to be in an approval chain and does not know
 * the word "chain". "Being checked" rather than "pending approval"; "the office" rather
 * than a level label they have no way to interpret. The one thing they must understand
 * is when the item is waiting on *them*, which is what the resubmit copy says.
 */
export const MY_PUNCH_EXCEPTIONS = {
  heading: 'Punches being checked',
  /** Shown when the list is empty — the ordinary case, and good news. */
  empty: 'None of your punches need checking.',
  loadFailed: 'Your flagged punches could not be loaded.',
  /** Why this punch was flagged, in the worker's words rather than the system's. */
  reasons: {
    geofence: 'Recorded away from your site',
    face: 'Photo did not match',
    both: 'Recorded away from your site, and the photo did not match',
    unknown: 'Flagged for checking',
  },
  /** What a worker should take from the state, without naming a level. */
  beingChecked: 'Being checked by the office.',
  /** A punch that never entered a chain — visible, but not actionable by anyone here. */
  notInChain:
    'This punch is flagged but has not been sent for checking. Ask your supervisor.',
} as const;

/**
 * How often the pending-approval count re-checks the server (FR-013, SC-005).
 *
 * The count is a badge on every screen, so this is the only thing in the app that
 * notices a decision somebody *else* made. React Query is configured with
 * `refetchOnWindowFocus: false` globally, so without an interval nothing refetches at
 * all and the badge can sit on a stale number indefinitely — which matters because two
 * approvers can hold the same level, and the second one's queue would still offer an
 * item the first already decided.
 *
 * Sixty seconds: one small request per user per minute, against a count that is a
 * single indexed query. Faster buys little — approvals are a human-paced queue, not a
 * chat — and slower stops it being a live count in any useful sense.
 */
export const APPROVAL_COUNT_POLL_MS = 60_000;

/**
 * When an item's age in the queue becomes visually distinguishable (spec US3 scenario 5).
 *
 * Two working days. Short enough that a stalled decision is visible before somebody
 * chases it, long enough that a normal overnight wait does not paint the whole queue
 * amber — a warning everything triggers is a warning nobody reads.
 */
export const APPROVAL_QUEUE_AGE_WARNING_HOURS = 48;

/**
 * Human labels for the action types that exist today.
 *
 * A lookup with a fallback, **not** an exhaustive map. The backend's `actionType` is free
 * text by design so a module can join the spine without a release on this side, so an
 * unrecognised value is an expected input rather than a failure — `approvalActionTypeLabel`
 * turns `letter_work_order` into "Letter work order" and moves on.
 */
export const APPROVAL_ACTION_TYPE_LABELS: Record<string, string> = {
  attendance_exception: 'Attendance exception',
  attendance_exception_legacy: 'Attendance exception (historical)',
  payroll_run: 'Payroll run',
  payment_release: 'Payment release',
  letter_work_order: 'Work order',
  letter_loi: 'Letter of intent',
  letter_purchase_order: 'Purchase order',
  final_settlement: 'Final settlement',
  attendance_correction: 'Attendance correction',
  director_final_set_change: 'Change to the Director approval set',
};

/**
 * Copy for the Director approval set (016 FR-017 to FR-020).
 *
 * The three state labels are the load-bearing strings on that screen. "Not required" and "Not
 * configured" must not be interchangeable in a reader's mind: the first is a decision somebody
 * made and can be held to, the second is a question nobody has answered. Written as full phrases
 * rather than badges for that reason.
 */
export const DIRECTOR_FINAL_MESSAGES = {
  heading: 'Director approval',
  intro:
    'Which actions cannot take effect until the Director approves them. Changes here are themselves submitted for the Director’s approval — they do not take effect when you save.',
  stateLabels: {
    final: 'Director required',
    not_final_by_decision: 'Not required — decided',
    not_configured: 'Nobody has decided',
  } as Record<string, string>,
  stateHints: {
    final: 'This cannot take effect until the Director approves it.',
    not_final_by_decision:
      'Somebody decided this needs no Director. The decision is recorded below.',
    not_configured:
      'Nothing says either way, so the shipped default governs. This is the gap worth reviewing.',
  } as Record<string, string>,
  decidedBy: (name: string, when: string) => `Decided by ${name} · ${when}`,
  /** For a mark that is in force but that nobody is recorded as having set. */
  decidedByNobody: 'No decision is recorded against this.',
  /** The submit control's label, said before it is pressed rather than after (FR-018). */
  submit: 'Submit for the Director’s approval',
  submitting: 'Submitting…',
  submitted:
    'Submitted for the Director’s approval. Nothing has changed yet — the set below is still what governs today.',
  noChanges: 'Nothing has been changed yet.',
  pendingHeading: 'A change is awaiting the Director',
  pendingBy: (name: string, when: string) => `Proposed by ${name} · ${when}`,
  pendingChange: (action: string, from: string, to: string) =>
    `${action}: ${from} → ${to}`,
  /** FR-019. Shown to every reader so two people do not submit the same edit. */
  pendingLocked:
    'While this is outstanding, no further change can be submitted for this company.',
  inForce: 'In force today',
  proposed: 'Proposed',
  /**
   * The one entry that cannot be changed. Rendered as an explanation rather than a disabled
   * control, because "why can I not change this" is the question it should answer.
   */
  selfChangeLocked:
    'The approval requirement on changing this set cannot itself be changed — it is the gate that makes every other entry meaningful.',
  readOnly:
    'You can see which actions require the Director, but not change them.',
} as const;

/** The label for an action type, falling back to a readable form of the raw key. */
export function approvalActionTypeLabel(actionType: string): string {
  const known = APPROVAL_ACTION_TYPE_LABELS[actionType];
  if (known) return known;
  const words = actionType.replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : actionType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents and letters (feature 017)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copy for the document and letter surfaces (Principle III).
 *
 * **Document kind labels are deliberately absent.** The required set is company
 * configuration and two companies may differ, so the names come from the server. A
 * constant here would be wrong the first time somebody added a kind — and FR-011 exists
 * precisely so they can.
 */
export const DOCUMENT_COPY = {
  missingHeading: 'Still to be uploaded',
  presentHeading: 'On file',
  expiringHeading: 'Expiring soon',
  /**
   * Shown when a required kind has no document type defined at all.
   *
   * A different sentence from "not uploaded", because it has a different next step:
   * somebody has to create the type before anything can be uploaded against it.
   */
  /**
   * Reworded 2026-09-16. It used to send the reader to Employee Setup, which is a
   * different permission and a different screen — and the action beside this line now
   * defines the type here, so the old sentence described a detour nobody has to take.
   */
  typeNotDefined: 'No document type defined for this kind yet',
  defineAndUpload: 'Define and upload',
  /**
   * Documents outside the required eight (FR-019).
   *
   * "Also on file" rather than "Other" or "Supplementary": the reader is looking at a
   * compliance screen, and the useful thing to say is that these are held too — not to
   * name the category they fall into.
   */
  supplementaryHeading: 'Also on file',
  supplementaryHint:
    'Not part of the required set, so these do not change the figures above.',
  addKindHeading: 'Add a document kind',
  addKindHint:
    'For anything the required set does not cover — an MSME certificate, a trade licence, a rent agreement. It will be available to this company only, and will not appear in employee documents.',
  addKindNameLabel: 'What is it called?',
  addKindExpires: 'This document expires',
  addKindNeedsNumber: 'It carries a reference number',
  addKindSubmit: 'Add kind',
  addKindFailed: 'The document kind could not be added. Please try again.',

  // ── Project document requirements (FR-022) ──────────────────────────────────
  /**
   * Said in the present tense and about what happens next, not about system state.
   * "usingDefaults: true" is a fact about a column; what an administrator needs to know
   * is that editing these makes them theirs.
   */
  requirementsDefaults:
    'These are the documents BuildCore expects every project to hold. They become this company’s own set the moment you save.',
  requirementsConfigured:
    'This company’s own set. Every project is measured against it.',
  requirementsAddHeading: 'Require another document',
  requirementsAddPlaceholder: 'Choose a document kind…',
  requirementsAddButton: 'Require it',
  requirementsNoneToAdd:
    'Every kind this company has defined is already on the list. Add a new kind below to require something else.',
  requirementsSave: 'Save requirements',
  requirementsDiscard: 'Discard changes',
  requirementsSaved: 'Requirements saved.',
  requirementsSaveFailed:
    'The requirements could not be saved. Nothing was changed.',
  requirementsEmpty:
    'No documents are required. Every project will report itself fully papered.',
  requirementsUndefinedHeading: 'Not available to require yet',
  requirementsUndefinedHint:
    'BuildCore expects these, but this company has no document type for them. Projects are not measured against a kind that does not exist.',
  requirementsDefineIt: 'Define it',
  requirementsDefineFailed:
    'The document kind could not be defined. Please try again.',
  requirementsKindHint:
    'For a document BuildCore does not name — a site handover note, a client NOC. It becomes available to require immediately.',
  defineFailed:
    'The document type could not be defined. Please try again.',
  expiryRequired: 'This document expires, so an expiry date is required.',
  restrictedNotice:
    'Regulated personal data. It can be downloaded, and every download is recorded — there is no preview.',
  uploadFailed: 'The document could not be uploaded. Please try again.',
  supersedeHint: 'Uploading a new version keeps the old one on file.',

  // ── A kind's strength, named by its consequence (FR-022a, T066) ─────────────
  /**
   * **Not "Required" and "Optional".**
   *
   * Those were the labels until 2026-10-01 and the task forbids them, for a reason worth keeping:
   * "optional" describes a kind by what it is not, and since the 2026-09-16 amendment the two
   * strengths differ in *effect* — one refuses the creation of a project, the other is reported
   * outstanding and blocks nothing. A reader choosing between "Required" and "Optional" cannot
   * tell that, and the person who most needs to is the one deciding whether to make a kind
   * mandatory.
   */
  strengthMandatory: 'Blocks project creation',
  strengthAdvisory: 'Reported as outstanding',
  strengthMandatoryHint:
    'A project cannot be created until a document of this kind is attached.',
  strengthAdvisoryHint:
    'A project can be created without it. It is reported as outstanding until it is filed.',
  strengthLegend: 'What happens without it',

  // ── A project's own papers (FR-024) ─────────────────────────────────────────
  projectDocumentsHeading: 'Documents on file',
  /**
   * T078. Readiness is one view of a project's papers and must not be the only one — "3 of 5
   * required" cannot answer "what do we hold for this project", which is where the client's
   * item 3 ends.
   */
  projectDocumentsHint:
    'Everything filed against this project, required and supplementary alike.',
  projectDocumentsEmpty: 'Nothing has been filed against this project yet.',
  projectDocumentRequiredBadge: 'Answers a required kind',
  projectDocumentSupplementaryBadge: 'Supplementary',
  projectDocumentFiledBy: (name: string, when: string) =>
    `Filed by ${name} · ${when}`,
  /** When the uploader's account has gone; the document and its date are still the point. */
  projectDocumentFiledAt: (when: string) => `Filed ${when}`,
  projectDocumentOpen: 'Open',
  projectDocumentDownloadFailed:
    'The document could not be downloaded. Please try again.',
  projectDocumentsOutstandingHeading: 'Still outstanding',
  projectDocumentsOutstandingMandatory: (name: string) =>
    `${name} — blocks project creation`,
  projectDocumentsOutstandingAdvisory: (name: string) =>
    `${name} — reported as outstanding`,

  // ── Documents on the project creation form (FR-023, FR-023a, FR-023b) ───────
  creationHeading: 'Project documents',
  creationHint:
    'These are uploaded as you choose them, so a refused submission never loses a file you have already attached.',
  creationNoneRequired: 'This company requires no documents of a new project.',
  creationMandatoryHeading: 'Needed to create the project',
  creationAdvisoryHeading: 'Can follow later',
  creationAttached: (fileName: string) => `Attached: ${fileName}`,
  creationReplace: 'Replace',
  creationUploading: (fileName: string) => `Uploading ${fileName}…`,
  creationUploadFailed: (fileName: string, reason: string) =>
    `${fileName} could not be uploaded. ${reason}`,
  /** T072: the server's refusal, said on the control it refers to. */
  creationRefusedHere: 'The server refused the project without this document.',
  /**
   * The summary beside the submit control. Names the count, not the kinds — the kinds are named on
   * their own controls, and repeating them here is the matching exercise T072 exists to remove.
   */
  creationBlocked: (count: number) =>
    count === 1
      ? 'One required document is still missing.'
      : `${count} required documents are still missing.`,

  // ── Payment transfer proof (FR-020, FR-021 — bugs.md item 23) ───────────────
  /**
   * The gap item 23 names: a payment carried a reference number somebody typed and nothing
   * behind it. So the absence is stated as a fact about the payment, not as an error — nobody
   * did anything wrong by recording a payment before the advice arrived.
   */
  proofMissing: 'No proof attached',
  proofAttached: 'Proof attached',
  proofAttachedOn: (when: string) => `Proof attached ${when}`,
  proofAttach: 'Attach proof',
  proofReplace: 'Replace proof',
  proofOpen: 'Open proof',
  proofUploading: 'Attaching…',
  proofAttachFailed: 'The proof could not be attached. Please try again.',
  proofDownloadFailed: 'The proof could not be opened. Please try again.',
  /** FR-021 as a filter, not a count — "14 payments lack proof" makes somebody scroll. */
  proofFilterLabel: 'Proof',
  proofFilterAll: 'All payments',
  proofFilterMissing: 'Missing proof',
  proofFilterPresent: 'Proof attached',
  /**
   * Said once above the list when the filter is on, because a list that silently excludes rows
   * is a list somebody will read as the whole set.
   */
  proofFilterActive:
    'Showing only payments with no proof attached.',
} as const;

/** Copy for the letters surfaces. */
export const LETTER_COPY = {
  // ── Letters on a subject's own screen (017 US6 — bugs.md item 18) ───────────
  /**
   * A letter is always *about* something, and the person who wants it is on that thing's screen.
   * So the heading says whose letters these are relative to where the reader already is, rather
   * than naming the subject again — the screen above has already named it.
   */
  subjectHeading: 'Letters',
  subjectEmpty: 'No letters have been issued for this yet.',
  subjectOpen: 'Open',

  awaitingApproval:
    'This letter is waiting for approval and cannot be issued yet.',
  issueFailed: 'The letter could not be issued.',
  previewFailed: 'The preview could not be generated.',
  composedBadge: 'Awaiting approval',
  issuedBadge: 'Issued',
  executedBadge: 'Executed',
  /**
   * Shown verbatim when deleting a kind is refused.
   *
   * The backend's message names what is in the way. A generic "could not delete" throws
   * away the only part of the response that says what to do instead.
   */
  kindInUseFallback:
    'This letter kind cannot be deleted while letters still reference it.',
  signatoryRequired: 'This kind of letter carries a signature — choose a signatory.',
} as const;

/**
 * How a letter's three states read.
 *
 * `composed` is not an error state and must not be styled as one: the letter exists and
 * is waiting on a person, which `ActionReview` says in detail beside it.
 */
export const LETTER_STATUS_LABELS = {
  composed: LETTER_COPY.composedBadge,
  issued: LETTER_COPY.issuedBadge,
  executed: LETTER_COPY.executedBadge,
} as const;

/** Copy for payment proof (017 US7). */
export const PAYMENT_PROOF_COPY = {
  missing: 'No proof attached',
  attach: 'Attach proof',
  replace: 'Replace proof',
  view: 'View proof',
  missingFilterLabel: 'Missing proof only',
} as const;
