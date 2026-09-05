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

  // --- Dashboard: Reminders centre (feature 004, US9) ---
  // Not a NAV_MODULES entry: Reminders is part of the Dashboard module, not a
  // module of its own, and it is gated by DASHBOARD. Note that the `dashboard`
  // entry in NAV_MODULES carries `guardsSubtree: false`, so `ModuleGuard` returns
  // 'unknown-route' for this path — the permission check lives in
  // `app/dashboard/reminders/layout.tsx`, the same way HR and Settings gate their
  // own sections.
  reminders: '/dashboard/reminders',

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
