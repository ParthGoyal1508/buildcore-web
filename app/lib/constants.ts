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
  /** The four statutory rates a running-account bill is computed at (025 US4). */
  settingsBillingRates: '/dashboard/settings/billing-rates',
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
  /**
   * One project's own home — the shell every section below hangs off (008 US4).
   *
   * Until 2026-10-04 this route did not exist and `/portfolio/<id>` was a 404: the six
   * sections were reachable only as six links on the portfolio row, and once inside one of
   * them the only way to another was back out to the list. US4 specified the detail page as
   * nine hash tabs on one route; it is built as routed sections instead, so a BOQ or a bill
   * can be linked to, reloaded and opened in a second tab.
   */
  projectsProject: (id: string) => `/dashboard/projects/portfolio/${id}`,
  projectsEditProject: (id: string) =>
    `/dashboard/projects/portfolio/${id}/edit`,
  /**
   * The three read-only sections of the shell, from the aggregate `GET /projects/:id` has
   * always returned and this app discarded until the shell was built.
   */
  projectsPeople: (id: string) => `/dashboard/projects/portfolio/${id}/people`,
  projectsMachinery: (id: string) =>
    `/dashboard/projects/portfolio/${id}/machinery`,
  projectsMaterials: (id: string) =>
    `/dashboard/projects/portfolio/${id}/materials`,
  /** What a project holds, and what it still owes (017 FR-024). */
  projectsProjectDocuments: (id: string) =>
    `/dashboard/projects/portfolio/${id}/documents`,
  projectsClients: '/dashboard/projects/clients',
  projectsSites: '/dashboard/projects/sites',

  /**
   * The BOQ for one project — the schedule every bill below is measured against (008 US5,
   * amended 2026-10-03).
   *
   * Gated on `PROJECTS` and not `PROJECT_FINANCIALS`, unlike the money screens below: a schedule
   * carries rates but it is the list of what is to be built, and a site engineer who may not open
   * a bill may certainly need to read it.
   */
  projectsBoq: (id: string) => `/dashboard/projects/portfolio/${id}/boq`,
  // 022 / 024. Gated on `DWR`, not `PROJECTS` — recording and approving a day's work is its own
  // permission, and the backend guards every one of these routes with it.
  /** Every daily work report on a project, and the form that records the next one. */
  projectsDwr: (id: string) => `/dashboard/projects/portfolio/${id}/dwr`,
  projectsDwrNew: (id: string) =>
    `/dashboard/projects/portfolio/${id}/dwr/new`,
  /** One report, its lines, and the submit / approve / reverse actions. */
  projectsDwrReport: (projectId: string, dwrId: string) =>
    `/dashboard/projects/portfolio/${projectId}/dwr/${dwrId}`,
  /** Correcting a draft. Draft only — the screen refuses anything further on (022 FR-018). */
  projectsDwrEdit: (projectId: string, dwrId: string) =>
    `/dashboard/projects/portfolio/${projectId}/dwr/${dwrId}/edit`,
  // 023 / 024. Gated on `PROJECT_FINANCIALS`: a bill is money, and somebody who may record a day's
  // work is not thereby entitled to see what the company charges for it.
  /** Every running-account bill package on a project. */
  /** Letters issued on a project — work order, LOI, purchase order (025 FR-033). */
  projectsLetters: (id: string) =>
    `/dashboard/projects/portfolio/${id}/letters`,
  projectsBillPackages: (id: string) =>
    `/dashboard/projects/portfolio/${id}/bill-packages`,
  /** One package: its proposed lines, the abstract, the register and the check list. */
  projectsBillPackage: (projectId: string, packageId: string) =>
    `/dashboard/projects/portfolio/${projectId}/bill-packages/${packageId}`,

  // --- Projects: billing and the P&L (feature 018, `bugs.md` items 11 and 14) ---
  // Gated on `PROJECT_FINANCIALS`, not `PROJECTS` — see `PROJECTS_PERMISSIONS`. Billing
  // and the summary are money screens and the backend guards them separately.
  /** Every client bill on a project, and the sheet that composes the next one (FR-001). */
  projectsBilling: (id: string) =>
    `/dashboard/projects/portfolio/${id}/billing`,
  /** One client bill, at the rates it was billed at (FR-006). */
  projectsClientBill: (projectId: string, billId: string) =>
    `/dashboard/projects/portfolio/${projectId}/billing/${billId}`,
  /** Subcontractor RA bills measured against a work order's award (FR-007). */
  projectsRaBills: (id: string) =>
    `/dashboard/projects/portfolio/${id}/ra-bills`,
  projectsRaBill: (projectId: string, billId: string) =>
    `/dashboard/projects/portfolio/${projectId}/ra-bills/${billId}`,
  /** Revenue and cost by category, monthly and cumulative, for one project (FR-010). */
  projectsSummary: (id: string) =>
    `/dashboard/projects/portfolio/${id}/summary`,
  /** Every project's position side by side, with the company total (FR-013). */
  projectsPnlBoard: '/dashboard/projects/pnl',

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
  /**
   * "Request waiver", not "Waive" (021 FR-016, task T049 — changed 2026-10-02).
   *
   * HR proposes and the Director countersigns, so the control does not waive anything. **A control
   * that says it has done a thing it has only proposed is the copy that gets an exit signed off on
   * a waiver nobody approved** — somebody presses it, reads "Waive", and reports the obligation
   * cleared.
   */
  waive: 'Request waiver',
  waiveHeading: 'Request a waiver',
  /** FR-014: the reason is required, and the backend enforces a real minimum. */
  waiveReasonLabel: 'Why the company is not pursuing this',
  waiveReasonShort: (min: number) =>
    `A reason of at least ${min} characters is required — this writes off company money.`,
  waiveSubmit: 'Send for approval',
  waiveFailed: 'The waiver request could not be sent.',
  /** Said in the modal, before it is sent, so nobody expects the item to clear. */
  waiveNeedsApproval:
    'This goes to the Director for approval. The obligation stays outstanding until they agree, and the exit cannot be settled before then.',
  /** The pending state on the row (T050). */
  waiverPending: (name: string, at: string) =>
    `Waiver requested by ${name} on ${at} — awaiting the Director's approval.`,
  waiverPendingStill:
    'Still outstanding. Nothing has been written off yet.',
  /** The rejected state (T051). Silence after a rejection reads as success. */
  waiverRejected: (name: string, at: string) =>
    `A waiver requested by ${name} on ${at} was not approved.`,
  waiverRejectedStill:
    'The obligation stands and the exit cannot be settled. It can be requested again with a fuller reason.',
  /** Who countersigned, beside who asked (T090's two facts). */
  waiverApprovedBy: (name: string, at: string) =>
    `Approved by ${name} on ${at}`,
  /**
   * A waiver is **not** a discharge. The backend is explicit: an asset waived here stays
   * open in the asset register, because marking it returned would put a false fact in the
   * register that owns the truth.
   */
  waivedBy: (name: string, at: string) => `Waived by ${name} on ${at}`,
  waivedNotReturned: 'Waived — not returned. The obligation stands on the record.',
  settleBlocked: 'Final settlement is unavailable while anything above is outstanding.',
  /**
   * Said when the only thing in the way is a waiver nobody has decided yet (T053).
   *
   * The gate is the api's, but an exit that will not settle with no stated reason sends somebody to
   * a developer — and "something is outstanding" is not an answer when the thing outstanding is a
   * request already made.
   */
  settleBlockedPending:
    'Final settlement is waiting on a waiver request the Director has not decided yet.',
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
  /**
   * What a cross-company caller sees before they have chosen (019 FR-010).
   *
   * Not a prompt - a description. In this state the backend scopes nothing, so every
   * list genuinely is showing every company at once, and naming one company here would
   * caption three companies' figures with one company's name.
   */
  allCompanies: 'All companies',
} as const;

/**
 * Slip delivery (021 FR-006 to FR-009) — `bugs.md` item 8.
 *
 * The retry's label **names its count**, and that is not decoration: the difference between it and
 * the send is twelve emails or five hundred, and an unlabelled "Retry" beside a "Send" is how
 * somebody picks the wrong one.
 */
export const SLIP_DELIVERY_COPY = {
  heading: 'Payslip delivery',
  hint: 'Emails each employee their payslip for this run, as an attachment. Sending is deliberate rather than automatic.',
  loading: 'Checking who has been sent their payslip…',
  loadFailed: 'Could not load the delivery status for this run.',
  send: 'Email payslips',
  sendRemaining: (count: number) =>
    count === 0 ? 'Email payslips' : `Email the remaining ${count}`,
  sendFailed: 'The payslips could not be sent.',
  retry: (count: number) =>
    count === 1 ? 'Retry 1 failure' : `Retry ${count} failures`,
  retryFailed: 'The failed payslips could not be resent.',
  noneYet: 'Nobody has been sent their payslip for this run yet.',
  tally: {
    sent: 'Sent',
    failed: 'Failed',
    undeliverable: 'No address',
    notAttempted: 'Not tried',
  },
  statusLabels: {
    sent: 'Sent',
    failed: 'Failed',
    undeliverable: 'No address',
    pending: 'Pending',
  } as Record<string, string>,
  // Says what to do, because a retry will not fix these — they have no address to retry to.
  undeliverableHint:
    'Some employees have no email address on file, so there is nothing to retry. Add an address on their record, then send again.',
  columns: {
    employee: 'Employee',
    address: 'Sent to',
    status: 'Status',
    detail: 'When / why',
  },
} as const;

/**
 * Reconciling the bank's returned sheet (021 FR-008 to FR-011) — `bugs.md` item 8.
 *
 * Two kinds of gap, named separately throughout: a line matching no employee is money that moved to
 * somebody the run does not know about; an employee with no line is money that **did not move**.
 * Different people chase each, and one "discrepancies" count would send both to whoever asked first.
 */
export const RECONCILIATION_COPY = {
  heading: 'Bank transaction sheet',
  hint: 'Upload the sheet the bank returned. Rows it cannot read are reported rather than rejected — the upload succeeds and the reconciliation is what is incomplete.',
  upload: 'Upload the bank’s sheet',
  uploading: 'Reading the sheet…',
  uploadFailed: 'That file could not be read as a spreadsheet.',
  noneYet: 'No transaction sheet has been uploaded for this run.',
  tally: {
    total: 'Lines in sheet',
    matched: 'Matched',
    unmatched: 'Unmatched',
    missing: 'Not in sheet',
  },
  unmatchedHint:
    'These lines name an account no employee in this run has. Money moved to somebody the run does not know about.',
  missingHint:
    'These employees are in the run and have no line in the sheet. That money did not move.',
  differenceHint:
    'A difference is reported, not judged: a transfer short by an advance recovery is correct, and this screen does not know which differences were intended.',
  columns: {
    row: 'Row',
    beneficiary: 'Beneficiary',
    account: 'Account',
    sheetAmount: 'In sheet',
    runAmount: 'In run',
    difference: 'Difference',
    matched: 'Matched to',
    reason: 'Why not',
    employee: 'Employee',
  },
} as const;

/**
 * Declaring a letter kind's fields (017 FR-011b, FR-011c) — `bugs.md` item 18.
 *
 * The copy repeatedly says **where a value comes from**, because that is the requirement rather than
 * a nicety: a field that is only a label is a placeholder that renders blank, and a blank in a signed
 * letter is indistinguishable from a deliberate omission.
 */
/**
 * Every word the template editor says (017 US5, FR-014) — `bugs.md` item 18.
 *
 * Principle III: no string below is written at a call site. The ones that carry weight are the
 * refusals — an author looking at a screen that is entirely one template needs to be told *which*
 * field is the problem, and "invalid template" tells them nothing they can act on.
 */
export const TEMPLATE_COPY = {
  title: 'Letter Templates',
  // Says what the editor is keyed to now. It used to say "one active template per type", and "type"
  // was the five-value enum 017 replaced with fifteen kinds.
  description:
    'One active template per letter kind. The variables a template may use are the fields its kind declares.',
  newTemplate: 'New template',
  edit: 'Edit',
  none: 'No templates yet.',
  loading: 'Loading templates…',
  loadFailed: 'Could not load the templates.',
  editHeading: 'Edit template',
  newHeading: 'New template',
  kindLabel: 'Letter kind',
  // The kind cannot change after the first save: the body is validated against that kind's declared
  // fields, and moving a template to another kind would leave every field in it undeclared.
  kindFixedHint:
    'Fixed once saved — a template’s variables are validated against its kind’s fields.',
  nameLabel: 'Name',
  bodyLabel: 'Body',
  bodyHint:
    'Fixed text with {{variables}}. Insert a variable from the list rather than typing it, so it cannot be misspelled.',
  fieldsHeading: 'Variables this kind declares',
  fieldsLoading: 'Loading this kind’s variables…',
  fieldsFailed:
    'Could not load this kind’s variables, so the editor cannot tell you which are valid. Saving is disabled until it can.',
  // Not a neutral empty state. A kind with no declared fields cannot have a template using any
  // variable at all, and the remedy is on another screen — so it is named.
  fieldsNone:
    'This kind declares no variables yet. Declare them on the letter kind first, in Settings → Letter kinds — a template may only use fields its kind declares.',
  requiredMark: 'required',
  manualSource: 'typed at issue time',
  insert: 'Insert',
  undeclaredHeading: (count: number) =>
    count === 1
      ? 'One variable is not declared by this kind'
      : `${count} variables are not declared by this kind`,
  // Named, every one of them. This is T135's whole requirement.
  undeclaredBody: (tokens: string[]) =>
    `${tokens.map((token) => `{{${token}}}`).join(', ')} — either declare ${
      tokens.length === 1 ? 'it' : 'them'
    } on the letter kind, or remove ${
      tokens.length === 1 ? 'it' : 'them'
    } from the body. A letter cannot be issued with a variable nothing supplies, because a blank where a value belongs cannot be told apart from a deliberate omission.`,
  activeLabel: 'Active — deactivates any other active template for this kind',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  saveFailed: 'Could not save the template.',
  activeBadge: 'Active',
} as const;

/**
 * The asset record on a settlement summary (021 FR-018a, FR-018b) — `bugs.md` item 10.
 *
 * Principle III: no string below is written at a call site. The one that carries the most weight is
 * `noDeduction` — the client asked for assets on the F&F summary and did not say what an unreturned
 * one is worth, and a summary that said nothing about valuation would be read as "nothing was
 * recovered because nothing was due".
 */
export const SETTLEMENT_ASSET_COPY = {
  heading: 'Assets held at exit',
  // Says why the list is here and why it is longer than the clearance above it.
  hint: 'Every asset this employee was given, including ones already returned. The clearance above lists only what is still outstanding.',
  loading: 'Loading the asset record…',
  // Not "no assets". This is the state where feature 012 could not be asked, and reporting it as
  // "held nothing" would have somebody sign off a settlement on a question nobody answered.
  unavailable:
    'The asset register could not be asked, so this settlement cannot say what the employee held. Do not read the empty list as "nothing outstanding".',
  none: 'No assets were ever allocated to this employee.',
  outcomes: {
    returned: 'Returned',
    waived: 'Written off',
    outstanding: 'Still held',
  } as Record<string, string>,
  returnedOn: (date: string) => `returned ${date}`,
  waivedBy: (name: string) => `written off by ${name}`,
  // FR-018b, stated rather than left to be inferred from the absence of a deduction line.
  noDeduction:
    'No asset value is deducted from the payable. Original cost, book value and replacement cost give three different figures and none has been agreed, so an unreturned asset is written off by name rather than priced by a rule nobody chose.',
  stillHeldWarning: (count: number) =>
    count === 1
      ? 'One asset is still held and not written off.'
      : `${count} assets are still held and not written off.`,
} as const;

export const LETTER_FIELD_COPY = {
  heading: (kind: string) => `Fields for ${kind}`,
  hint: 'What this kind’s templates may use as {{variables}}. Each field says where its value is read from — a field with no source renders blank, and a blank in a signed letter cannot be told apart from a deliberate omission.',
  loading: 'Loading fields…',
  loadFailed: 'Could not load this kind’s fields.',
  // Not a neutral "none yet": a kind with no fields has templates that cannot use a single variable.
  noneYet:
    'This kind declares no fields, so its templates cannot use any variables yet. Add the fields a letter of this kind needs.',
  notEditable: 'Not editable',
  remove: 'Remove',
  removeFailed: 'That field could not be removed.',
  saveFailed: 'That field could not be saved.',
  requiredMark: 'required',
  manualSource: 'typed at issue time',
  addHeading: 'Add a field',
  tokenLabel: 'Variable name',
  tokenHint: 'Used in the template as {{name}}. Letters, digits and underscores only.',
  labelLabel: 'Label',
  labelHint: 'What the template editor calls it — “Site name”, not siteName.',
  sourceLabel: 'Value comes from',
  sourceHint: 'Which record the value is read from when a letter is issued.',
  sourceLabels: {
    employee: 'The employee record',
    candidate: 'The candidate record',
    project: 'The project record',
    company: 'The company record',
    manual: 'Typed when the letter is issued',
  } as Record<string, string>,
  pathLabel: 'Field in that record',
  pathHint: 'A dotted path — designation.name, basic, dateOfJoining. Aadhaar, PAN and bank details are refused: a letter kind grants no way past that.',
  requiredLabel: 'Refuse to issue a letter if this has no value',
  requiredHint:
    'An optional field with no value renders empty, which is often right. A required one stops the letter — use it where a blank would change what the letter says.',
  add: 'Add field',
  adding: 'Adding…',
  // T136. The api does not refuse the removal — an administrator tidying a kind should not be
  // blocked by a draft somebody abandoned — so this warning is the only thing between a tidy-up and
  // a letter that refuses to issue a fortnight later. It names the templates, because "some
  // templates use this" leaves somebody opening every one.
  usageChecking: 'Checking which templates use it…',
  usageNone: (field: string) =>
    `No template uses ${field}. Removing it now breaks nothing.`,
  usageWarning: (field: string, count: number) =>
    count === 1
      ? `One template uses ${field}:`
      : `${count} templates use ${field}:`,
  usageConsequence:
    'Removing it does not change those templates, and they will refuse to issue until the variable is taken out of them or declared again.',
  usageFailed:
    'Could not check which templates use this field. Removing it may break a template that references it.',
  usageActive: 'active',
  usageConfirm: 'Remove anyway',
  usageCancel: 'Keep the field',
} as const;

/**
 * Every word the billing sheets say (018 US1, US2 — `bugs.md` items 11 and 12).
 *
 * Principle III: no string below is written at a call site. The ones that matter most are the
 * explanations — an over-measured line and an unpriced line are both states a biller will meet while
 * typing, and a sheet that only colours them red teaches people to ignore the colour.
 */
export const BILLING_COPY = {
  // --- The BOQ sheet ---
  boqHeading: 'Bill of quantities',
  boqHint:
    'Enter what was measured this period. Line and bill totals follow as you type — nothing is saved until you compose the bill.',
  boqLoading: 'Loading the schedule…',
  boqLoadFailed: 'Could not load this project’s bill of quantities.',
  boqEmpty:
    'This project has no bill of quantities yet, so there is nothing to bill against. Enter the BOQ first — a bill that references nothing cannot be reconciled against anything.',
  columns: {
    boqNo: 'Item',
    task: 'Description',
    unit: 'Unit',
    scopeQty: 'Contracted',
    billedQty: 'Billed to date',
    remainingQty: 'Remaining',
    rate: 'Rate',
    quantity: 'This bill',
    amount: 'Amount',
  },
  /** Both totals, because the quoted figure is the estimated one plus the bidder's percentage. */
  estimatedTotal: 'Schedule total',
  quotedTotal: 'Quoted total',
  quotedPercentageNote: (percent: string) =>
    `The quoted total is the schedule total plus the quoted excess of ${percent}, applied once to the total rather than line by line.`,
  // --- States a biller meets while typing ---
  unpriced: 'No rate',
  unpricedHint:
    'Nobody has priced this line yet, so it cannot be billed. A bill carrying it would be quietly short and would look finished.',
  unpricedCount: (count: number) =>
    count === 1
      ? '1 line has no rate and cannot be billed.'
      : `${count} lines have no rate and cannot be billed.`,
  overQuantity: 'Past contracted',
  /** FR-003: flagged at the line, and the bill is still submittable. */
  overQuantityHint:
    'This measurement goes past the contracted quantity. That is often correct — the bill can still be composed — but submitting it needs a reason.',
  overQuantityReasonLabel: 'Why this goes past the contracted quantity',
  overQuantityReasonMissing:
    'A line past its contracted quantity needs a reason before the bill can be submitted.',
  // --- Deductions, each in its own right ---
  gross: 'Gross',
  retention: 'Retention',
  retentionBasis: (percent: string) => `${percent} of gross, withheld by the client`,
  advanceRecovery: 'Advance recovery',
  /**
   * Said on the sheet where the two inputs used to be (028 FR-004).
   *
   * Silence would be worse than the inputs were. Somebody who recorded a deduction here last month
   * and finds the boxes gone needs to be told where it went, not left to conclude the capability
   * was removed.
   */
  deductionsMovedNote:
    'Recoveries and deductions are recorded on the bill package, which is what the issued document reads. Figures already on this bill are shown below and carried forward.',
  advanceRecoveryBasis: 'Money already advanced, coming back',
  otherDeductions: 'Other deductions',
  deductionTotal: 'Total deductions',
  net: 'Net',
  netPayable: 'Net payable',
  /**
   * The four-way distinction, said on the screen and not only in the code.
   *
   * A reader who drills from the summary's cost figure into a bill lands on a deduction line, and
   * without this would reasonably conclude the project spent it.
   */
  deductionsAreNotCost:
    'Retention is money withheld and an advance recovery is money already paid. Neither is project spend, which is why the summary reads gross rather than net.',
  // --- Composing and submitting ---
  compose: 'Compose bill',
  composing: 'Composing…',
  composeFailed: 'That bill could not be composed.',
  submit: 'Submit bill',
  submitting: 'Submitting…',
  submitFailed: 'That bill could not be submitted.',
  billNumberLabel: 'Bill number',
  /**
   * The subcontractor bill number stopped being typed in 027.
   *
   * It was the only document in the product whose number a person invented, and `RABill.billNumber`
   * carried no unique constraint — so a number typed here could silently duplicate one the bill
   * package path had already minted into the same column. The number is not previewed: deriving it
   * in the web would be a second implementation of a server rule, which is the drift this product
   * has already paid for once.
   */
  billNumberAuto:
    'Numbered automatically when you compose it — RA-01, RA-02 and so on, in sequence on this work order.',
  billingDateLabel: 'Billing date',
  descriptionLabel: 'Description',
  retentionPercentLabel: 'Retention withheld (%)',
  nothingMeasured:
    'Nothing has been measured yet. Enter a quantity against at least one line.',
  // --- A bill read back ---
  billsHeading: 'Bills raised',
  billsEmpty: 'No bills have been raised on this project yet.',
  // --- 027: client bills as master and detail ---
  /**
   * The page used to open on the composing sheet — 231 editable BOQ rows — with the bills raised
   * buried under it. Reading a bill meant scrolling past a form you were not filling in, and the
   * cumulative figures you measure against were the furthest thing from the sheet that needs them.
   *
   * The list is the master now, and composing is a mode that takes over the panel beside it, the
   * way raising a work order does on Subcontractors. No tab strip: a client bill is one document,
   * and four tabs over two sections would be copying that page's shape rather than its point.
   */
  composeNew: 'Compose a bill',
  /**
   * The two routes to a client bill, named for what each is good at (028 FR-007).
   *
   * The package proposes every quantity from approved daily work — the capability has existed since
   * 023 and was reachable only from a different tab, so this screen's manual sheet was the obvious
   * route and the one that reads nothing the site recorded. A bill typed against a 231-line
   * schedule when the application already knows what was built is work done twice, and the second
   * answer is the one nobody can check.
   */
  composeFromWork: 'Compose from approved work',
  composeFromWorkHint:
    'Every quantity proposed from the daily work approved in the period — you review them rather than entering them, and a figure you change carries a reason.',
  composeByHand: 'Enter quantities by hand',
  composeByHandHint:
    'The correction route, for scope measured outside a daily report. Nothing here is proposed, so every figure is typed and nothing checks it against what the site recorded.',
  composeCancel: 'Cancel',
  composeHeading: 'New bill to the client',
  pickBillPrompt: 'Pick a bill to read it, or compose a new one.',
  billLinesHeading: 'Lines billed this period',
  /**
   * A bill shows what was billed; a zero line is the schedule, not the bill (027).
   *
   * 023's package path writes a bill line for **every** schedule line, because its measurement
   * sheet has to let a claim be made against any of them and "no measurement available" is a
   * different fact from zero. The bill inherits all of them, so one with six measured lines was
   * rendering 231 rows and the six were somewhere inside.
   *
   * Hidden rather than dropped, and counted rather than silently filtered: a reader who knows the
   * schedule has 231 lines must be able to tell that the other 225 were considered and carried
   * nothing, instead of wondering whether this screen is showing them everything.
   */
  linesHidden: (hidden: number, shown: number) =>
    `Showing the ${shown} line${shown === 1 ? '' : 's'} billed on this bill. ${hidden} other schedule line${hidden === 1 ? '' : 's'} carried no quantity.`,
  /** Lines exist, none carries a quantity — different from a bill with no lines at all. */
  nothingBilledOnThisBill:
    'No line on this bill carries a quantity. Every schedule line was considered and nothing was billed.',
  showAllLines: 'Show every schedule line',
  showBilledLines: 'Show only what was billed',
  certificationHeading: 'Certification',
  /** Said plainly rather than left as a dash: nobody has answered yet, which is not a shortfall. */
  notCertifiedYet:
    'The client has not certified this bill yet. Record what they certify when it comes back — the gap between billed and certified is the figure worth chasing.',
  billedLabel: 'Billed',
  certifiedMatched: 'Certified in full.',
  draftNotSent: 'This bill is still a draft. It has not been sent to the client.',
  historicalRatesNote:
    'Shown at the rates it was billed at. A rate revised afterwards does not restate a bill that was already sent.',
  certified: 'Certified',
  certifiedShort: (variance: string) =>
    `The client certified ${variance} less than was billed. Both figures are kept — the variance is the thing to chase, and overwriting the billed amount would erase the fact that there was one.`,
  statusLabels: {
    draft: 'Draft',
    submitted: 'Submitted',
    certified: 'Certified',
    approved: 'Approved',
  } as Record<string, string>,
  // --- Drafts recovered locally (FR-005) ---
  draftFound: 'An unsaved draft of this sheet was found on this device.',
  draftFoundHint:
    'It was not sent to the server. Restoring it replaces what is on screen; discarding it cannot be undone.',
  draftRestore: 'Restore draft',
  draftDiscard: 'Discard draft',
  draftSaved: (when: string) => `Draft kept on this device at ${when}`,
  // --- RA bills (US2) ---
  raHeading: 'Subcontractor bill',
  raHint:
    'Measured against what the work order awarded. Each deduction is shown with its basis — a deduction whose basis is hidden is imposed rather than arguable.',
  raColumns: {
    description: 'Awarded item',
    unit: 'Unit',
    awardedQty: 'Awarded',
    toDateQty: 'Measured to date',
    remainingQty: 'Remaining',
    rate: 'Rate',
    thisPeriodQty: 'This bill',
    amount: 'Amount',
  },
  /**
   * Collapsing a section of the composing sheet (027).
   *
   * Sections start **expanded**. This is the screen where money is entered, and a quantity hidden
   * behind a closed section is a quantity nobody checks before composing — so the reader closes
   * what they are done with, rather than opening what they need.
   *
   * A collapsed section that holds measured lines says so, with the count and the amount. That is
   * the whole safety property: whatever is folded away, the total it contributes is still on
   * screen, and the bill's own total below has always counted it either way.
   */
  expandAllSections: 'Expand all',
  collapseAllSections: 'Collapse all',
  sectionLineCount: (lines: number) => `${lines} line${lines === 1 ? '' : 's'}`,
  sectionMeasured: (lines: number, amount: string) =>
    `${lines} measured · ${amount}`,
  raEmpty: 'This work order has no awarded lines to measure against.',
  exceedsAward:
    'This measures more than the work order awarded. Raise a variation to the award first — paying above an award is the company agreeing to work it never ordered, and there is nobody downstream to catch it.',
  // --- Revising a certified bill (FR-009) ---
  reviseHeading: 'Revise measured quantities',
  /** The warning IS the requirement: it comes before the edit, never as a toast after it. */
  reviseWarning:
    'This bill has been certified. Changing its quantities withdraws that certification and sends the bill for approval again — the existing approval is kept as a record of what was signed, and it will not apply to the new figures.',
  reviseWarningPending:
    'This bill is waiting on an approval. Changing its quantities replaces that request with a new one, so nobody is left deciding a version that no longer exists.',
  /**
   * A draft is edited, not revised (027).
   *
   * The sheet showed every non-approved bill the *pending* warning — "this bill is waiting on an
   * approval" — over a draft that was waiting on nobody, and asked for a reason explaining a change
   * to a document no one had seen. Three statuses, three behaviours: a draft is simply edited, a
   * submitted bill replaces its pending request, an approved one withdraws a signature.
   */
  editHeading: 'Edit measured quantities',
  editHint:
    'This bill is still a draft. It has not been sent to anybody, so changing it changes nothing anyone has seen.',
  edit: 'Save changes',
  editing: 'Saving…',
  editDone: 'Saved. The bill is still a draft.',
  reviseReasonLabel: 'Why the quantities changed',
  reviseReasonHint:
    'Required. Somebody has to decide this bill a second time, and “why” is the first thing they will ask.',
  revise: 'Save and re-submit',
  revising: 'Saving…',
  reviseFailed: 'That revision could not be saved.',
  /** FR-009's eventual consistency — see the note beside it in the sheet. */
  reviseDone:
    'Saved and sent for approval again. The approval queue may take a moment to catch up.',
  // --- Reading a bill back (027) ---
  /**
   * A bill could only be opened for editing, so looking at one meant opening the sheet that
   * changes it — and on a submitted bill, reading past a warning about withdrawing an approval.
   */
  viewBill: 'View bill',
  hideBill: 'Hide bill',
  viewColumns: {
    description: 'Item',
    unit: 'Unit',
    quantity: 'Quantity',
    rate: 'Rate',
    amount: 'Amount',
  },
  viewNoLines:
    'This bill has no measured lines. It predates work-order awards, or its lines were removed.',
  viewDeductions: 'Deductions',
  // --- Conflict (FR-014) ---
  conflictHeading: 'Somebody else changed this bill',
  conflictHint:
    'Your entry is still here and has not been sent. Open the bill’s current state in another tab, decide what should stand, and save again — nothing you typed has been discarded.',
  conflictReload: 'Show me the current figures',
  conflictKeep: 'Keep my entry',
  // --- Recording what the client certified (FR-005) ---
  certifyLabel: 'Amount the client certified',
  certifyHint:
    'Kept alongside the billed amount, never instead of it. The variance between the two is the thing to chase, and overwriting the billed figure would erase the fact that there was one.',
  statusHeader: 'Status',
  certifyOpen: 'Record certification',
  certifySave: 'Save certification',
  certifySaving: 'Saving…',
  cancel: 'Cancel',
  loading: 'Loading…',
} as const;

/**
 * Work orders and award capture (018 US2).
 *
 * Separate from `BILLING_COPY` because this surface is **feature 008 User Story 6's**, delivered
 * minimally so an RA bill is reachable at all. When 008 builds it properly these strings move with
 * it, and keeping them in their own block is what makes that a move rather than an extraction.
 */
export const WORK_ORDER_COPY = {
  heading: 'Work orders',
  loading: 'Loading work orders…',
  loadFailed: 'Could not load this project’s work orders.',
  empty:
    'No work order has been raised on this project yet. A subcontractor bill is measured against a work order’s award, so one has to exist first.',
  summary: (retentionPercent: string, awardLines: number, bills: number) =>
    `Retention ${retentionPercent} · ${awardLines} award line${awardLines === 1 ? '' : 's'} · ${bills} bill${bills === 1 ? '' : 's'}`,
  /**
   * A heading above the row, and a label on the field — not one string doing both.
   *
   * It read "New work order — what the subcontractor is doing" as a single label, which wrapped to
   * two lines in its column and pushed that field's input a line below its neighbours'. A label
   * that wraps is a row that does not line up.
   */
  newHeading: 'New work order',
  detailLabel: 'What the subcontractor is doing',
  retentionLabel: 'Retention (%)',
  retentionHint:
    'Cannot be changed once a bill has been raised: the retention on an issued bill is already withheld at the old rate, and moving the basis would make the subcontractor’s copy disagree with ours about money already held.',
  raise: 'Raise work order',
  raising: 'Raising…',
  raiseFailed: 'That work order could not be raised.',
  // --- Award capture ---
  awardHeading: 'Capture the award',
  awardHint:
    'One line per awarded item: description, unit, quantity, rate — separated by a tab or a pipe. Paste it from the order; nothing is saved until you choose to.',
  awardPlaceholder: 'RCC M25 in foundations | Cum | 100 | 4500',
  awardLabel: 'Awarded lines',
  awardSave: 'Save award',
  awardSaving: 'Saving…',
  /** Said rather than silently ignoring unparseable rows — a half-read award is worse than none. */
  awardUnparseable:
    'No usable lines were found. Each line needs a description, a unit, a quantity and a rate, separated by a tab or a pipe.',
  awardMissing:
    'This work order has no award captured yet, so there is nothing to measure against.',
  /**
   * Saving an award replaces it — the server deletes the old lines and writes the new ones. Said
   * before the save, because a person pasting a corrected line expects it to be *added*.
   */
  awardReplaceWarning:
    'Saving replaces the award entirely. Paste every line, not just the ones you are correcting.',
  awardCaptured: (lines: number) =>
    `${lines} line${lines === 1 ? '' : 's'} captured. Bills are measured against these.`,
  /** Refused by the server, so said here rather than discovered on the save. */
  awardLockedByBills:
    'Bills have been raised against this award, so it can no longer be replaced — the remaining quantity on a bill already issued would move, and the subcontractor’s copy would then disagree with ours. Raise a variation instead.',

  // --- 028 FR-009: the award is approved before it commits anything ---
  /**
   * The award approval, which did not exist until 028.
   *
   * A work order committing the company to several crore went `active` the moment one person saved
   * it, while the first bill raised under it needed an approval. The commitment is made when the
   * award is given; a bill only measures against it.
   */
  submitForApproval: 'Send the award for approval',
  submitting: 'Sending…',
  submitHint:
    'A bill cannot be measured against this award until it has been approved. Capture the award lines first — there is nothing to approve in a work order that awards nothing.',
  pendingHint:
    'Waiting for approval. A bill against it is refused until the approval completes — which is a different thing from it never having been sent.',
  activeHint:
    'Approved. Bills may be measured against this award.',
  submitFailed: 'That award could not be sent for approval.',

  // --- 027: the number, the vendor, and the master–detail frame ---
  /** Shown where a code would be, for the work orders raised before 027 numbered them. */
  unnumbered: 'Not numbered',
  unnumberedHint:
    'Raised before work orders carried numbers. It keeps reading by its detail; everything raised since is numbered.',
  vendorLabel: 'Subcontractor',
  vendorHint:
    'From your Partners register. Leave it blank if the vendor is not settled yet — it can be set later under Settings.',
  vendorNone: 'Not chosen yet',
  vendorUnknown: 'Unknown vendor',
  vendorTruncated: (shown: number, total: number) =>
    `Showing ${shown} of ${total} vendors. Narrow the list in Partners if the one you want is missing.`,
  vendorLoading: 'Loading vendors…',

  /** The list is the master; one of these fills the panel beside it. */
  pickPrompt: 'Pick a work order to see its award, its bills and its retention.',
  raiseNew: 'Raise a work order',
  raiseCancel: 'Cancel',
  tabs: {
    award: 'Award',
    bills: 'Bills',
    retention: 'Retention',
    settings: 'Settings',
  },
  /** Each tab says in one line what it is for, so the four names are not guessed at. */
  tabHints: {
    award: 'What this subcontractor was given: the item, the quantity and their rate. Bills are measured against it.',
    bills: 'Running account bills measured against the award — what was done this period, and what is payable after deductions.',
    retention: 'Money withheld from each bill as security, and every release of it back to the subcontractor.',
    settings: 'Correcting the detail, the subcontractor and the retention basis on this work order.',
  },
  settingsHeading: 'Correct this work order',
  settingsSave: 'Save the correction',
  settingsSaved: 'Saved.',
  detailField: 'What the subcontractor is doing',
  // --- 027: the award editor ---
  /** Three ways in, because one award is three different jobs. */
  awardAddFromBoq: 'Add from the BOQ',
  awardAddBlank: 'Add a blank line',
  awardPasteDisclosure: 'Paste several lines at once',
  awardPasteAdd: 'Add these lines',
  awardBoqPickerLabel: 'BOQ line',
  awardBoqPickerPlaceholder: 'Search the BOQ by number, description or unit',
  awardBoqEmpty: 'Choose a BOQ line',
  awardBoqAlreadyAdded: 'already on this award',
  awardBoqLoading: 'Loading the BOQ…',
  awardBoqUnavailable:
    'The project BOQ could not be loaded, so lines cannot be picked from it. Typing and pasting still work.',
  awardNoBoq:
    'This project has no BOQ yet, so there is nothing to pick from. Type the lines or paste them.',
  awardColumns: {
    boq: 'BOQ',
    description: 'Description',
    unit: 'Unit',
    quantity: 'Quantity',
    boqRate: 'BOQ rate',
    rate: 'Their rate',
    amount: 'Amount',
    remove: '',
  },
  awardEmptyRows:
    'No lines yet. Add one from the BOQ, type one, or paste a block of them.',
  awardUnlinked: '—',
  /**
   * Why the subcontractor's rate is never prefilled from the BOQ.
   *
   * The BOQ rate is what the **client** pays. The difference between the two is the margin on the
   * work, and a prefilled field is one somebody accepts — which would make the margin zero without
   * anybody deciding it should be. Shown beside, never in the box.
   */
  awardRateHint:
    'What you pay the subcontractor, which is not the BOQ rate — the BOQ rate is what the client pays you, and the difference is the margin. Shown beside for reference, never filled in for you.',
  awardLinkedHint:
    'A line picked from the BOQ stays tied to it, so work recorded against that BOQ line counts towards this award. A typed line is not tied to anything, which is correct when the subcontract covers work the BOQ itemises differently.',
  awardRowIncomplete: (row: number) =>
    `Line ${row} needs a description, a unit, a quantity and a rate.`,
  awardNothingToSave: 'Add at least one line before saving.',
  awardSaveChanges: 'Save award',
  awardDiscard: 'Discard changes',
  awardRemoveRow: 'Remove this line',
  awardTotal: 'Award total',
  awardLoading: 'Loading the award…',

  /** Bills whose work order was never recorded. Listed rather than hidden by the master–detail. */
  orphanBillsHeading: 'Bills not attached to a work order',
  orphanBillsHint:
    'These were raised against the project rather than a work order, so they appear here instead of under one.',
} as const;

/**
 * Every word the project summary and the P&L board say (018 US3, US4).
 *
 * The two most important strings here are `unavailable` and `notItemised`. A category nobody could
 * ask about and a category with nothing in it are different facts, and a director acts differently on
 * each — the first is a deployment problem, the second is a project running under budget.
 */
export const PNL_COPY = {
  heading: 'Revenue, cost and budget',
  loading: 'Loading the position…',
  loadFailed: 'Could not load this project’s position.',
  monthLabel: 'Month',
  columns: {
    line: 'Line',
    monthly: 'This month',
    cumulative: 'To date',
    budget: 'Budget',
    variance: 'Variance',
  },
  revenue: 'Revenue billed',
  totalCost: 'Total cost',
  margin: 'Margin',
  categories: {
    labour: 'Labour',
    materials: 'Materials',
    machinery: 'Machinery',
    fuel: 'Fuel',
    subcontractors: 'Subcontractors',
    overheads: 'Overheads',
  } as Record<string, string>,
  /** FR-010: named, never reported as zero. */
  unavailable: 'Not available',
  unavailableHint: (categories: string) =>
    `Nobody can say what was spent on ${categories}, so those figures are left out of the totals rather than counted as zero. Counting them as zero is how a project looks profitable because half its costs are invisible.`,
  overScopeWarning:
    'This month’s revenue includes a bill measured past its contracted quantity.',
  // --- Drilling in (FR-011, FR-012) ---
  drillHeading: (figure: string) => `What makes up ${figure}`,
  drillLoading: 'Opening the records…',
  drillFailed: 'Could not open the records behind this figure.',
  drillEmpty: 'Nothing was recorded against this figure in the selected month.',
  /** The spec's edge case: never an empty list where the answer is "we cannot show you". */
  drillNotItemised:
    'This figure is measured, but the module behind it reports a period total without listing the records inside it — so there is nothing to open here yet. The figure on the summary stands.',
  drillRefused:
    'You do not have access to the records behind this figure. It is shown here because it is part of a total you may see; what is inside it is not.',
  drillColumns: {
    reference: 'Reference',
    date: 'Date',
    amount: 'Amount',
    status: 'Status',
    description: 'Note',
  },
  drillTotal: 'Total of these records',
  drillReconciles: 'Adds up to the figure it was opened from.',
  drillDiffers: (difference: string) =>
    `These records come to ${difference} less than the figure they were opened from. Treat both as suspect and report it.`,
  // --- The monthly labour register (FR-010a) ---
  labourHeading: 'Labour wages, by worker',
  labourHint:
    'Every payment sheet overlapping the calendar month, by worker. Read-only — wages are computed and corrected on the payment sheet, and a second place to change them would be a second answer to what somebody was paid.',
  labourLoading: 'Loading the wage register…',
  labourLoadFailed: 'Could not load the month’s wages.',
  labourEmpty: 'No approved payment sheet overlaps this month.',
  labourColumns: {
    worker: 'Worker',
    code: 'Code',
    daysWorked: 'Days',
    rate: 'Rate',
    gross: 'Gross',
    deductions: 'Deductions',
    net: 'Net',
  },
  /** The spec's edge case: a contractor month has no per-worker disbursement to list. */
  labourContractorOnly:
    'This month’s labour was engaged through a contractor, so there is no per-worker disbursement to list. The sheet is the contractor’s basis of payment and its totals are below.',
  labourApportioned: 'Apportioned',
  labourApportionedHint:
    'A payment sheet crossing the month boundary contributes only the days worked inside this month, taken from the approved muster — not a share of elapsed calendar days.',
  labourDraftSheets: (count: number) =>
    count === 1
      ? '1 payment sheet overlapping this month is still in draft and is not counted.'
      : `${count} payment sheets overlapping this month are still in draft and are not counted.`,
  labourSheetsHeading: 'Payment sheets behind these figures',
  // --- Export (FR-010c) ---
  exportLabel: 'Export this month',
  exporting: 'Preparing…',
  exportFailed: 'That export could not be produced.',
  exportHint:
    'The same figures as the screen, carrying the project, the month and the time it was produced. The production time is what tells two exports of the same month apart after a payment sheet is reopened.',
  exportPdf: 'PDF',
  exportExcel: 'Excel',
  // --- The group board (US4) ---
  boardHeading: 'Every project’s position',
  boardLoading: 'Loading positions…',
  boardLoadFailed: 'Could not load the group position.',
  boardEmpty: 'No projects to show for the selected month.',
  boardColumns: {
    project: 'Project',
    revenue: 'Revenue to date',
    cost: 'Cost to date',
    margin: 'Margin',
  },
  boardTotal: 'Company total',
  /** FR-013's visibility rule, said out loud rather than left to be inferred. */
  boardTotalNote:
    'The total is the sum of the rows above it. Projects you may not see appear in neither.',
  boardOpen: 'Open',
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

  // --- Cash entry (019 FR-017a, FR-017d) ---
  // A screen that loses its cash controls must say so (FR-014): a payment form with no cash
  // option and no explanation reads as a broken screen, and the person meeting it cannot tell
  // whether to report a bug or ask for access. Which is why these name the permission — "ask an
  // administrator" sends somebody to ask for they-know-not-what.
  cashEntryUnavailable:
    'Cash is not offered here because your role does not include Cash Entry. Other payment modes are unaffected.',
  cashBreakupHidden:
    'The cash denomination breakup is visible to roles with Cash Entry.',

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
  /**
   * Spec FR-011's cap, surfaced (T048). The API has always returned `truncated`; the screen
   * discarded it, so a list that stopped at 500 looked like a complete one.
   */
  remindersTruncated: (shown: number) =>
    `Showing the ${shown} most urgent. More are due — narrow by module or severity to see the rest.`,
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
  /**
   * Punching now requires a connection (020 Phase 2, FR-013).
   *
   * **A condition, not a malfunction.** A worker who reads this as "the app is broken" stops
   * trusting it and stops using it, and the wording is the only thing deciding which of the two
   * they conclude. So it says what is true of the moment — there is no signal here — rather than
   * anything about the application.
   *
   * The exchange it pays for: a queued punch cannot be refused at the gate. The worker saw a
   * success at 8am and the refusal arrived at 5pm, by which time the day was lost and nobody could
   * tell them why. Immediate refusal is worth more than a success that was not one.
   */
  punchNeedsConnection:
    'Punching needs a connection, and your phone has no signal right now. Move to where you have signal and punch there.',
  /**
   * FR-013b. The way back, named rather than implied.
   *
   * "Nothing you can do" is what makes people abandon a system. A day genuinely worked but never
   * punched is fixed by somebody, and saying who — before the worker has to ask — is the
   * difference between a process and a dead end.
   */
  punchNeedsConnectionRecovery:
    'If you work a day and cannot punch at all, tell your supervisor: they can raise a correction for that day, which is reviewed and then shows in your attendance.',
  punchQueuedCount: (count: number) =>
    `${count} punch${count === 1 ? '' : 'es'} queued on this device from before — syncing now.`,
  punchSyncFailed: (reason: string) => `A queued punch could not be synced: ${reason}`,
  /**
   * The end of the legacy queue, said once.
   *
   * Phase 2 retired offline punching, so this can only ever report punches captured before that
   * shipped. It was an inline template in the layout; here because Principle III puts copy in one
   * place, and because this one is about to stop appearing at all and should be easy to find then.
   */
  punchSyncedCount: (count: number) =>
    `${count} punch${count === 1 ? '' : 'es'} queued on this device ${count === 1 ? 'has' : 'have'} now been sent.`,
  punchExceptionFlagged:
    'Punch recorded, but it needs review — your face or location did not match. Your supervisor has been notified; you do not need to punch again.',
  payrollLocked:
    'This period is closed for payroll. Punches and leave changes dated inside it can no longer be recorded.',

  /**
   * What a refused punch tells the worker (020 FR-013a, T017).
   *
   * **Three actions, not three explanations.** Each says what to do next, because the worker is
   * standing at a gate holding a phone and an explanation they cannot act on is noise.
   *
   * `LOCATION` and `UNLOCATABLE` must never collapse into one. Both are "we could not accept this
   * for location reasons", and the single merged message tells a worker standing in exactly the
   * right place to go somewhere else — which is the failure FR-014 exists to prevent, and the one
   * that destroys trust fastest, because the worker knows they are where they should be.
   *
   * Reviewed as a set here rather than written at three call sites, so the moment two of them start
   * saying the same thing is visible.
   */
  punchRefusedLocation:
    'You are too far from your site for this punch to count. Walk to the site and punch again there.',
  punchRefusedUnlocatable:
    'Your phone could not work out where you are precisely enough. Step into the open, away from walls and roofs, wait a few seconds and punch again.',
  punchRefusedFace:
    'This photo did not match your enrolled face. Take it again in better light, looking straight at the camera.',
  /**
   * Said once, under the message, for every refusal.
   *
   * FR-013d means the day will read as a day with no punch — not as a refused one — so a worker who
   * walks away now has nothing to point at later. Naming the correction here is what stops a refused
   * punch becoming an unpaid day.
   */
  punchRefusedRecovery:
    'Nothing has been recorded for this attempt. If you cannot get a punch accepted today, tell your supervisor — they can raise a correction for the day.',
  /**
   * The third refusal in a row (T019).
   *
   * Escalation belongs to the screen, not to the message table: no single message can know it is
   * being read for the third time, and a worker told the same sentence three times concludes the
   * product is stuck. Three because twice is ordinary — a cloud, a bad photo — and four is somebody
   * who has already given up.
   */
  punchRefusedRepeatedly:
    'That is three attempts in a row. Stop trying for now and tell your supervisor what the screen said — they can record the day for you.',
  /**
   * Shown where a refused attempt would otherwise look like a missing feature (FR-012, T020).
   *
   * There is no photo to show. A face refusal stores none, because keeping an unattributed
   * biometric against a named employee is worse than the record it replaces — so the screen must
   * not offer to show one, and must not read as though the photo were merely unavailable.
   */
  punchRefusedNoPhoto:
    'The photo from a refused attempt is not kept.',
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
  // 025. COMPANY_SETTINGS, matching the backend: these are the statutory rates every bill is
  // computed at, guarded by the same permission as the registration numbers beside them.
  'billing-rates': 'COMPANY_SETTINGS',
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
  // 018. The P&L board is its own section and is a money screen: the backend guards
  // `GET projects/pnl` with `PROJECT_FINANCIALS`, so a `PROJECTS` holder with no
  // financial access would get a page whose every request 403s. The billing and summary
  // screens sit *under* `portfolio/:id/`, so this per-section map cannot reach them —
  // they check `PROJECT_FINANCIALS` on the page, which is the same arrangement the
  // portfolio's document tab already uses.
  pnl: 'PROJECT_FINANCIALS',
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
/**
 * Where each read-only project tab's contents actually come from (027).
 *
 * People, machinery and material all reach a project **through its sites** — an employee posted to
 * one, a machine deployed to one, stock issued from one. The three tabs are mirrors of that, with
 * no way to add from here on purpose: a roster editable from two places is two places for it to
 * disagree.
 *
 * What was missing was any statement of that. The tabs showed an empty list and no indication that
 * the thing to do was somewhere else entirely, so "there is nothing here" and "you add this in HR"
 * looked identical. Naming the source is the whole job; the link saves the hunt.
 */
export const PROJECT_TAB_SOURCES = {
  /** Shown instead of the per-tab note. Without a site, none of the three can ever populate. */
  noSites:
    'This project has no sites yet. People, machinery and material all reach a project through its sites, so nothing can appear on these tabs until one exists.',
  noSitesLink: 'Add a site',
  sitesLabel: (names: string) => `This project’s sites: ${names}.`,

  people:
    'People are not added here. An employee belongs to this project by being posted to one of its sites, which is set on the employee’s Employment tab in HR.',
  peopleLink: 'Open HR → Employees',

  machinery:
    'Machinery is not added here. A machine joins this project when its “Deployed at” site is one of this project’s, which is set on the machine in Plant & Machinery.',
  machineryLink: 'Open Plant → Equipment',

  /**
   * Two steps, and saying so matters: the Store list offers every site, so picking this project's
   * is easy — and the Item list beneath it is then empty, with nothing explaining that the store
   * holds no stock. That dead end is the one worth warning about in advance.
   */
  materials:
    'Material is not added here. It appears once stock is issued from one of this project’s sites. The store has to hold the stock first — receive it on a purchase, or transfer it in — because the issue form offers only what that store actually has.',
  materialsLink: 'Open Inventory → Issue / Consumption material',
  materialsSecondLink: 'Open Inventory → Purchases',
} as const;

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

/**
 * The codes a refused punch can carry (020 FR-013, T015).
 *
 * A closed union, mirroring the backend's `PUNCH_REFUSAL_CODES`. Closed so that a code the server
 * starts sending and this client has never heard of is a type error at the mapping, not an
 * `undefined` reaching a worker's phone as the reason their punch failed.
 *
 * Three codes, four backend reasons: `face_mismatch` and `no_face_detected` both arrive as
 * `PUNCH_REFUSED_FACE` because the advice is identical — retake the photo — and the difference
 * between "no face in the picture" and "a face that is not yours" is worth detecting on our side,
 * not worth explaining to the person holding the camera.
 */
export const PUNCH_REFUSAL_CODES = [
  'PUNCH_REFUSED_LOCATION',
  'PUNCH_REFUSED_UNLOCATABLE',
  'PUNCH_REFUSED_FACE',
] as const;

export type PunchRefusalCode = (typeof PUNCH_REFUSAL_CODES)[number];

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
  /**
   * 021 FR-009. The reason rather than a disabled control.
   *
   * A draft run has no publishable figures, so there is nothing to email — and saying so is what
   * stops somebody waiting for an email that was never going to be sent.
   */
  deliveryNeedsProcessedRun:
    'Payslips can be emailed once this run has been processed. A draft run’s figures are still allowed to move.',
  reconciliationNeedsProcessedRun:
    'A bank sheet can be reconciled once this run has been processed and a transfer has been made against it.',

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

  /**
   * What stands in an Employee column when the name cannot be resolved.
   *
   * Never the employee id. The leave queue rendered a cuid for months because the
   * client-side roster join fell back to it, and an id in a column headed "Employee"
   * reads as data — nobody reports it as a failure, they report it as "the names are
   * wrong". A phrase that admits it is missing gets reported as what it is.
   *
   * Two phrasings because two different things go wrong, and they call for different
   * actions: the roster has not arrived yet, or this person is not in it.
   */
  employeeNameLoading: 'Loading…',
  employeeNameUnavailable: 'Name unavailable',

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
/**
 * The worker's own refused punches (020 FR-012).
 *
 * Its own block rather than entries in `MY_PUNCH_EXCEPTIONS`, because the two lists are opposites
 * and sharing copy would blur them: an exception is a punch that was *recorded* and is being
 * checked by somebody; a refusal is a punch that does not exist and that nobody will check.
 */
/**
 * Where an employee may punch (020 FR-007 – FR-011).
 *
 * The hardest copy in this feature is `noAssignment`. On the day this ships **every** employee has
 * no individual assignment, because the table is empty — so a sentence that reads as a warning
 * marks the entire workforce as misconfigured, and an administrator who sees thirty red flags stops
 * reading all thirty. It states the fallback as the ordinary thing it is.
 */
/**
 * Turning a fuel alert into a decision with a name against it (020 FR-001 – FR-006).
 *
 * Every string here is read by somebody about to cost a vendor or an employee money, which is why
 * the proposal wording is laboured: a recovery raised is not a recovery taken, and a reviewer who
 * believes otherwise either hesitates to raise a correct one or assumes a wrong one is already
 * fixed.
 */
/**
 * Choosing what a role may do (019 FR-018 – FR-021).
 *
 * **Said in terms of records, not of the permission model.** An administrator choosing here is
 * deciding whether somebody can change things; "read" and "write" are this system's words for that,
 * not theirs, and a screen that uses them makes the safer option sound like the technical one.
 */
export const ROLE_LEVELS = {
  legend: 'What this role can do in each area',
  /**
   * The hint that makes the whole control worth having.
   *
   * Until 2026-10-03 every role created here held both levels, because the screen could not express
   * anything else. Somebody arriving now needs to know the choice exists and that it is per area.
   */
  hint: 'Tick an area to give access, then choose whether this role can only look at it or can also change it. Decide per area — a role can be able to change one thing and only view another.',
  viewOnly: 'View only',
  viewOnlyHint: 'Can open and read it. Nothing in it can be added, edited or deleted.',
  viewAndChange: 'View and change',
  viewAndChangeHint: 'Can read it and can add, edit and delete within it.',
  /** FR-020. Not an error message — the control cannot express the state at all. */
  writeImpliesRead:
    'Changing always includes viewing, so there is no "change but not view".',
} as const;

export const FUEL_EXCEPTIONS = {
  heading: 'Fuel exceptions',
  subheading:
    'Machines that burned more than their category benchmark allowed for the hours they ran. Confirming one records who bears it; recovering it is a separate step.',
  empty: 'No fuel exceptions. Nothing has breached its benchmark.',
  loadFailed: 'Fuel exceptions could not be loaded.',

  columnMachine: 'Machine',
  columnDate: 'Date',
  columnActual: 'Actual',
  columnBenchmark: 'Benchmark',
  columnShortfall: 'Excess',
  columnStatus: 'Status',

  /** FR-001's units, stated once so two columns cannot disagree about them. */
  perHour: (value: number) => `${value} l/hr`,
  litres: (value: number) => `${value} l`,
  /**
   * Null actual, said in words.
   *
   * The fuel was issued and the machine's hours were never entered. A dash would read as a missing
   * column; a zero would read as a machine that ran no hours and still burned fuel.
   */
  noReading: 'No logbook reading for that day',
  noBenchmark: 'No benchmark set for this category',

  review: 'Review',
  confirm: 'Confirm',
  dismiss: 'Dismiss',
  decision: 'Decision',
  /** The three states, as a reader sees them. Past tense for the two that are decisions. */
  statusOpen: 'Open',
  statusConfirmed: 'Confirmed',
  statusDismissed: 'Dismissed',
  entryIssued: 'Issued',
  entryRate: 'Rate',
  entryCost: 'Cost',
  entryOverBenchmark: 'Over benchmark',
  cancel: 'Cancel',
  attribution: 'Who bears this',
  attributionHirer: 'The hirer — deduct from their hire bill',
  attributionOperator: 'The operator — recover from their salary',
  attributionBoth: 'Both',
  attributionNeither: 'Nobody — the variance was genuine and is not being pursued',
  /**
   * FR-004, said rather than silently hidden.
   *
   * Offering a hire deduction on a machine the company owns invites a figure nobody can collect.
   * The option is absent and this explains the absence — an option that merely vanishes reads as a
   * bug to the person who used it yesterday on a hired machine.
   */
  ownedNoHirer:
    'This machine is owned, so there is no hirer to deduct from. Only an operator recovery is available.',
  reasonLabel: 'Why',
  reasonRequiredToDismiss:
    'A dismissal needs a reason. Without one an exception register becomes a list everybody clears without reading.',
  attributionRequired: 'Say who bears this before confirming.',
  /**
   * FR-005. The refusal that matters most on this screen.
   *
   * Several people ran the machine that day, and the server refuses to guess — because guessing is
   * how the wrong person's wages get docked. The candidates come back in the refusal itself.
   */
  operatorRequired:
    'Several operators ran this machine that day. Choose the one who bears this — it is never assumed.',
  operatorNoneRecorded:
    'No operator is recorded against this machine for that day. The logbook has to say who ran it before a recovery can name them.',
  operatorLabel: 'Operator',

  recoverHireBill: 'Deduct from hire bill',
  recoverOperator: 'Propose salary recovery',
  recoveredHireBill: (amount: string) => `Deducted from the hire bill: ${amount}`,
  /**
   * FR-006, T045. **Proposed, not applied** — the single most important sentence here.
   *
   * The recovery reaches no payslip until the chain approves it. A reviewer who thinks the money is
   * already taken will tell the operator so, and then either an unapproved recovery never happens
   * or an approved one arrives as a surprise.
   */
  recoveryProposed: (amount: string) =>
    `${amount} proposed as a salary recovery. It is waiting for approval and has not been deducted from anyone's pay.`,
  recoveryAwaitingApproval: 'Awaiting approval — not yet deducted',
  recoveryApproved: 'Approved — applies on the next payroll run',

  /**
   * T047. The pattern worth catching before fifty deductions are raised.
   *
   * When nearly every machine of a category breaches at once, the likely fault is the benchmark,
   * not fifty operators. Stated as a question rather than a verdict — it can also be a genuinely
   * bad batch of fuel, and a screen that announces the benchmark is wrong would get a correct
   * exception dismissed.
   */
  benchmarkSuspect: (count: number, category: string) =>
    `${count} machines in ${category} breached together. That is usually a benchmark that needs correcting rather than ${count} separate recoveries — check the category's benchmark before raising any.`,
} as const;

export const LOCATION_ASSIGNMENT = {
  heading: 'Where this employee punches',
  noAssignment:
    'No individual assignment. Punches are checked against this employee’s own site geofence, which is the normal arrangement.',
  current: 'In force now',
  history: 'Earlier assignments',
  mobile: 'Mobile — exempt from location checks',
  /**
   * FR-014, stated on the control itself rather than in a help page.
   *
   * The confusion it prevents is specific and expensive: an administrator who believes mobility
   * exempts somebody from *all* checks will raise a support ticket the first time that person is
   * refused for a bad photo, and may well disable face checking to "fix" it.
   */
  mobileScope:
    'Mobility covers location only, never the photo check. A mobile employee is still refused if the photo does not match — where someone works and who is holding the phone are different questions.',
  effectiveFrom: 'In force from',
  effectiveFromRequired:
    'Give the date this takes effect — a punch is judged by the assignment in force on its own day.',
  saving: 'Saving…',
  effectiveFromHint:
    'A punch is judged by the assignment in force on the day it was taken, so backdating this changes how past days are read.',
  reason: 'Why',
  reasonRequiredForMobile:
    'A mobility exemption needs a reason — a year from now, nobody can tell whether it was considered or merely convenient.',
  siteRequired: 'Choose a site, or mark the employee mobile.',
  siteLabel: 'Site',
  sitePlaceholder: 'Select a site',
  cancel: 'Cancel',
  close: 'Close',
  bulkCount: (count: number) =>
    `${count} employee${count === 1 ? '' : 's'} in the current list`,
  assign: 'Assign location',
  assignedBy: 'Assigned by',
  bulkHeading: 'Assign a site’s staff together',
  bulkHint:
    'Everyone selected gets the same assignment, from the same date. They are recorded one at a time, so if some fail the rest still stand.',
  bulkNobodySelected: 'Select at least one employee.',
  bulkDone: (ok: number) =>
    `${ok} employee${ok === 1 ? '' : 's'} assigned.`,
  /**
   * Partial failure, named rather than summarised.
   *
   * "28 of 30 saved" tells an administrator that two people are wrong and not which two, which
   * leaves them to check thirty records by hand or — far more likely — to assume it was fine.
   */
  bulkPartial: (ok: number, failed: string[]) =>
    `${ok} assigned. ${failed.length} could not be: ${failed.join(', ')}. Those employees keep their previous arrangement.`,
} as const;

export const REFUSED_ATTEMPTS = {
  heading: 'Refused attempts',
  /**
   * Says the two things a worker needs before reading a single row: nothing was recorded, and there
   * is a way to fix a day. Without the first they assume the attempt counted for something; without
   * the second they assume the day is simply lost.
   */
  subheading:
    'Punches that were not accepted. Nothing was recorded for these attempts — if a day you worked has no punch, ask your supervisor to raise a correction.',
  /** Good news, and said as such: being refused is the exception, not the norm. */
  empty: 'No punches of yours have been refused.',
  loadFailed: 'Your refused attempts could not be loaded.',
  columnWhen: 'When',
  columnType: 'Punch',
  columnReason: 'Why it was not accepted',
  punchIn: 'In',
  punchOut: 'Out',
} as const;

export const MY_PUNCH_EXCEPTIONS = {
  /**
   * Re-labelled in 020 Phase 3 (T021), and **not before**.
   *
   * This list is now history. A punch that fails the fence or the face check is refused outright
   * and creates no exception, so nothing new arrives here — what remains are punches flagged under
   * the old behaviour, still travelling a chain that somebody has to finish. Nothing is deleted:
   * an exception in flight needs the one surface in the product belonging to the person who
   * raised it.
   *
   * The timing was the point. Re-labelling this before the backend's refusal shipped would have
   * been a different lie — exceptions were still being created then, and calling them "earlier"
   * would have hidden the live ones.
   */
  heading: 'Earlier punches being checked',
  subheading:
    'Punches flagged before checks moved to the moment of punching. Nothing new is added here.',
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

  // ── Filing a document against an existing project (FR-008a) ────────────────
  // Added 2026-10-04. Until then this panel named what was outstanding and offered no way to
  // supply it: documents could only be attached while the project was being created, so a
  // project that went live without its insurance could never be brought up to date.
  projectDocumentFileThis: 'Upload',
  projectDocumentAdd: 'Add a document',
  projectDocumentAddHeading: 'File a document',
  projectDocumentOwnerLabel: 'this project',
  projectDocumentUploadHint:
    'Filing a second document of the same kind adds it — it does not replace the first. Both stay on the project.',
  projectDocumentUploaded: (name: string) => `${name} has been filed.`,
  projectDocumentCancel: 'Cancel',

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
   * Where a project's documents live once it exists (028, reported 2026-10-07).
   *
   * The edit form shows no upload controls — an existing project is past the creation gate and its
   * papers are filed on its own Documents tab. Said rather than left as an absence, because the
   * reader's question when the controls are not there is "where did they go", and silence answers
   * it with a hunt through ten tabs.
   */
  editFiledElsewhere: 'Documents for this project are filed on its Documents tab.',
  editFiledElsewhereLink: 'Open Documents',
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

/**
 * BOQ entry, the tree, the alert tabs and the tender import (008 US5, amended 2026-10-03).
 *
 * The refusal strings are the point of this block. Fourteen conditions, fourteen sentences —
 * enumerated against the API contract rather than described, because the first draft of the task
 * named three and left eleven to prose, which ends as three mapped and eleven falling to one
 * generic message. A refusal the reader cannot act on is this whole feature's recurring defect.
 */
/**
 * Every word the project shell and its overview say (008 US4).
 *
 * The one that carries weight is `moduleUnavailable`. `GET /projects/:id` distinguishes "we
 * asked and there is none" from "we could not ask", and the two must not read the same: a
 * project page that says *No machinery on this project* when Plant was never consulted is
 * stating as fact the one thing nobody knows.
 */
/**
 * What the Inventory issue screen is called (028 FR-030).
 *
 * **Labels only. The route stays `/dashboard/inventory/issues` and so does the API.** Renaming a
 * URL breaks every link already sent — a bookmark, a message, a printed note — for no gain a user
 * can see, and the complaint was about the word on the screen.
 *
 * One constant because the word appears in four places: the Inventory tab strip, the Inventory
 * landing tile, the page heading, and the link out of a project's Materials tab. Three of them
 * being renamed is the version of this that looks like a bug.
 */
/**
 * The bill-package composer's subcontractor filter (028 FR-025 to FR-027).
 *
 * The control exists because a project can carry dozens of work orders and the composer offered
 * them as one flat list: finding the right one meant reading every entry. Choosing the
 * subcontractor first narrows it to their contracts, which is how anybody actually thinks about it.
 */
/**
 * Payments against a bill, and the copy that comes back signed (028 FR-020, FR-021).
 *
 * A bill reached certified and stopped: nothing recorded that it had been paid, so what a
 * subcontractor is still owed was answered from a spreadsheet — which is why two people had two
 * answers.
 */
export const SETTLEMENT_COPY = {
  heading: 'Payment and acknowledgement',
  /** Only a certified bill has an agreed figure to be outstanding against. */
  notCertified:
    'This bill has not been certified, so there is no agreed figure to pay against and its quantities can still change. Money paid before certification is an advance — record it as an advance recovery on the bill package.',
  certified: 'Certified',
  paid: 'Paid',
  outstanding: 'Outstanding',
  /** Said once, where somebody might otherwise look for a stored balance. */
  outstandingHint:
    'Certified less paid, computed on this read. No balance is stored anywhere, so correcting a payment corrects the figure.',
  settled: 'Settled in full',

  paymentsHeading: 'Payments',
  paymentsNone: 'Nothing has been paid against this bill yet.',
  paidOnLabel: 'Paid on',
  amountLabel: 'Amount',
  instrumentLabel: 'Instrument',
  referenceLabel: 'Reference',
  referenceHint: 'UTR, cheque number, adjustment memo.',
  remarksLabel: 'Remarks',
  record: 'Record the payment',
  recording: 'Recording…',
  remove: 'Remove',
  removeConfirm:
    'Remove this payment? The outstanding figure moves with it. A payment is never edited — removing and re-recording is the correction route.',
  instrumentLabels: {
    bank_transfer: 'Bank transfer',
    cheque: 'Cheque',
    cash: 'Cash',
    adjustment: 'Adjustment',
  } as Record<string, string>,

  signedHeading: 'Signed copy',
  /** The state, which is the point of FR-020 — not merely a file in a list. */
  acknowledged: (date: string) => `Acknowledged on ${date}`,
  unacknowledged: 'No signed copy has come back yet.',
  receivedOnLabel: 'Received on',
  receivedOnHint:
    'When the copy came back, not when it was scanned. A copy signed on site on Tuesday and scanned on Friday was acknowledged on Tuesday — and that is the date a payment term runs from.',
  fileLabel: 'The signed copy',
  upload: 'File the signed copy',
  uploading: 'Uploading…',
  download: 'Download',
  /** A later scan does not move the acknowledgement date. */
  replaceHint:
    'The first copy sets the acknowledgement date. A later replacement scan is filed beside it and does not move the date.',
  debitNote: 'Download the debit note',
} as const;

export const BILL_PACKAGE_PICKER_COPY = {
  subcontractorLabel: 'Subcontractor',
  subcontractorAll: 'All subcontractors',
  subcontractorHint:
    'Choose the subcontractor first and the work orders narrow to their contracts.',
  /**
   * `WorkOrder.partnerId` is nullable, so some work orders belong to nobody yet.
   *
   * They get **their own entry** rather than being filtered out (FR-027). Filtered, they are
   * unbillable with nothing on screen to say why — and the thing to do about one is to set its
   * subcontractor, which a reader cannot know to do if they cannot see it.
   */
  subcontractorUnassigned: 'No subcontractor set',
  unassignedHint:
    'These work orders have no subcontractor recorded. They can still be billed; set the subcontractor under Subcontractors so they appear under a name.',
  /** Said after the subcontractor changes, because the work order deliberately cleared. */
  selectionCleared:
    'The work order has been cleared because the subcontractor changed. Choose one of theirs.',
  noWorkOrders:
    'This subcontractor has no work order on this project. Raise one under Subcontractors first.',
} as const;

export const INVENTORY_ISSUE_LABEL = 'Issue / Consumption material';

/** The same label where a shorter one is needed — a tab strip, a breadcrumb. */
export const INVENTORY_ISSUE_LABEL_SHORT = 'Issue / Consumption';

export const PROJECT_SHELL_COPY = {
  loading: 'Loading this project…',
  loadFailed: 'This project could not be loaded.',
  breadcrumb: 'Portfolio',
  tabsLabel: 'Project sections',

  overviewHeading: 'Overview',
  contractHeading: 'Contract',
  /**
   * 028 FR-029. Commercial **terms**, in a card of their own.
   *
   * Retention and the quoted percentage are not descriptive facts about a project — they are the
   * terms money is computed under, and both are refusals waiting to happen: a bill to the client
   * is refused until retention is recorded, and the quoted percentage prices every line of the
   * schedule. Mixed into Contract they read as two more fields among twelve.
   */
  commercialHeading: 'Commercial terms',
  detailsHeading: 'Details',
  activityHeading: 'Activity',
  peopleHeading: 'People on this project',
  machineryHeading: 'Machinery deployed here',
  materialsHeading: 'Materials issued to this project',

  peopleEmpty: 'Nobody is assigned to this project yet.',
  machineryEmpty: 'No machinery is deployed to this project.',
  materialsEmpty: 'No materials have been issued to this project.',

  dwrCount: (count: number) =>
    count === 1 ? '1 daily work report' : `${count} daily work reports`,
  dwrNone: 'No daily work reports yet.',
  dwrLatest: (date: string) => `Latest ${date}`,
  billsCount: (count: number) =>
    count === 1 ? '1 bill booked' : `${count} bills booked`,
  revenueReceived: 'Received',
  revenuePending: 'Pending',

  /** Named modules, so the sentence says which answer is missing and why. */
  moduleUnavailable: (modules: string[]) =>
    `${modules.join(' and ')} could not be consulted, so anything they would contribute is missing from this page rather than absent. This is not the same as there being none.`,
  moduleNames: {
    plant: 'Plant & Machinery',
    inventory: 'Inventory',
  } as Record<string, string>,

  locked:
    'This project is locked. Its details cannot be changed until it is unlocked on the edit screen.',

  // --- 028 FR-029: the facts the response held and the page never showed ---
  clientLabel: 'Client',
  managerLabel: 'Project manager',
  locationLabel: 'Location',
  departmentLabel: 'Department',
  projectTypeLabel: 'Project type',
  siteStartLabel: 'Site start',
  cgstLabel: 'CGST',
  cgstApplicable: 'Applicable',
  cgstNotApplicable: 'Not applicable',
  retentionLabel: 'Client retention',
  quotedLabel: 'Quoted percentage',
  /** Null is not zero: a bill to the client is refused until a term is recorded. */
  retentionUnset: 'Not recorded — a bill to the client is refused until it is set',
  quotedAtPar: 'At par',
  /**
   * The sign carried in words as well as in the figure.
   *
   * `−10.79%` and `10.79% below the schedule` say the same thing, and the second cannot be
   * misread. 027's defect was a dropped sign that read a tender quoted *below* the estimate as
   * quoted above it — ₹88.96 lakh on one file — so this page says which way it goes.
   */
  quotedDirection: (fraction: number) =>
    fraction === 0
      ? 'At par with the schedule'
      : `${(Math.abs(fraction) * 100).toFixed(2)}% ${fraction < 0 ? 'below' : 'above'} the schedule`,
  managerUnknown: 'Recorded, but not on this project’s roster',
  notRecorded: 'Not recorded',

  // --- 028 FR-028: changing company while reading a project ---
  /** Shown for the instant between the 404 and the redirect landing. */
  otherCompanyRedirect: 'Taking you back to the portfolio…',
  /**
   * The explanation **on arrival**, which is the half that matters.
   *
   * A silent redirect reads as the application losing your place, and the reader's next move is to
   * click into a project that will do it again. Says what happened, why, and what is in front of
   * them now — without implying they did anything wrong, because they did not.
   */
  otherCompanyExplanation:
    'That project belongs to the company you were in before. You are now looking at the portfolio of the company you have just selected.',
} as const;

/**
 * The query parameter that carries FR-028's explanation to the portfolio.
 *
 * A parameter rather than client state, because the redirect is a navigation: state set before
 * `router.replace` does not survive it, and a reader who reloads the page they landed on should
 * still see why they are there.
 */
export const PROJECT_MOVED_PARAM = 'movedCompany';

export const BOQ_COPY = {
  heading: 'Bill of Quantities',
  loading: 'Loading the schedule…',
  subheading: 'The schedule every bill is measured against.',
  empty: 'No BOQ yet. Enter sections and lines, or import a tender workbook.',
  loadFailed: 'The BOQ could not be loaded.',

  // The tree
  columnBoqNo: 'BOQ No.',
  columnTask: 'Item',
  columnUnit: 'Unit',
  columnScope: 'Scope qty',
  columnDone: 'Done',
  columnPending: 'Pending',
  columnPerDay: 'Per day',
  columnAvgPerDay: 'Avg / day',
  columnDaysLeft: 'Days to finish',
  columnFinish: 'Finish by',
  /**
   * What an unplanned programme column reads (FR-026).
   *
   * The word, not an em dash and not a zero. A 312-line imported tender is entirely unplanned on
   * the day it arrives, so this is the screen's normal state rather than an exception in it — and
   * a zero per-day target reads as "achieving nothing", which is a different claim.
   */
  unplanned: 'Not planned',
  /** A section heading carries no quantity, because it is a title and not a line. */
  sectionLabel: 'Section',
  variation: 'Variation',

  // Entry
  addSection: 'Add section',
  addLine: 'Add line',
  sectionName: 'Section name',
  taskName: 'Item description',
  unitLabel: 'Unit',
  unitHint: 'As it appears on your schedule — it is stored exactly as typed.',
  scopeQty: 'Scope quantity',
  rate: 'Rate',
  rateHint: 'Leave blank and the line stays unpriced; a bill will refuse it rather than bill it free.',
  startDate: 'Start date (optional)',
  finishDate: 'Finish date (optional)',
  duration: 'Working days (optional)',
  perDay: 'Per-day target (optional)',
  programmeHint: 'Dates are optional. A line without them is simply not planned yet.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  deleteLine: 'Delete',
  planLine: 'Plan',
  planHint:
    'Dates only. Leave a box empty to clear what is there — scope, rate and description are edited nowhere near a programme.',
  deleteBlocked: 'This line cannot be deleted because work has been recorded against it.',

  /**
   * The two schedules, kept apart (027).
   *
   * Reported 2026-10-06: a project carrying both a tender workbook and an internal estimate showed
   * one list with every section twice — "Section 2 Centering & shuttering" appearing at (3) and at
   * (9) — and nothing on screen said which was which. They are two documents about the same work
   * and they answer different questions: one is what the client is billed against, the other is
   * what it is expected to cost us. Reading them interleaved is reading neither.
   */
  contractTab: 'Contract schedule',
  estimateTab: 'Internal estimate',
  contractTabHint:
    'What the client is billed against. Every bill, daily report and progress figure measures against these lines.',
  estimateTabHint:
    'Our own costing. Never billed, never alerted on, and no part of what the client has agreed — it exists to be compared with the contract schedule.',
  contractEmpty:
    'No contract schedule yet. Import the tender workbook, or enter sections and lines below.',
  estimateEmpty:
    'No internal estimate yet. Import one to keep your costing beside the contract schedule.',
  columnAmount: 'Amount',
  estimateTotal: 'Estimated cost',

  // Alert tabs — four, not three
  alertsHeading: 'What needs attention',
  tabToday: 'Due today',
  tabDelayed: 'Overdue',
  tabToBeDelayed: 'At risk',
  tabUnplanned: 'Not planned',
  tabEmpty: 'Nothing here.',
  unplannedExplainer:
    'These lines have no finish date, so they are neither on time nor late. Plan them to see them in the other tabs.',

  // Import
  importHeading: 'Import a tender workbook',
  estimateHeading: 'Import an internal estimate',
  importHint: 'Excel (.xls or .xlsx). Nothing is saved until you confirm.',
  importChoose: 'Choose file',
  importReading: 'Reading the workbook…',
  importConfirm: 'Confirm import',
  importConfirming: 'Importing…',
  importDiscard: 'Discard',
  importDone: (groups: number, lines: number) =>
    `Imported ${lines} line${lines === 1 ? '' : 's'} in ${groups} section${groups === 1 ? '' : 's'}.`,

  // The report
  reportHeading: 'What the import understood',
  reportLines: (lines: number, groups: number) =>
    `${lines} line${lines === 1 ? '' : 's'} in ${groups} section${groups === 1 ? '' : 's'}`,
  reportSheet: (sheet: string) => `Read from sheet “${sheet}”`,
  reportScheduleTotal: 'Schedule total',
  reportQuotedTotal: 'Quoted total',
  reportStated: 'Stated in the file',
  reportDifference: 'Difference',
  reportTolerance: (tolerance: string) => `within ${tolerance} allowed`,
  reportReconciles: 'Both totals agree with the figures in your file.',
  reportDoesNotReconcile:
    'The totals do not agree with the figures stated in your file. Check the schedule before confirming.',
  reportPercentage: 'Quoted percentage',
  /**
   * The direction said in words, not left to a minus sign (027).
   *
   * A tender is quoted above the estimate or below it, and which one it is moves every bill on the
   * project for the life of the contract — on this file, by ₹44 lakh. The importer read the
   * magnitude and dropped the direction until 2026-10-06; this is the screen where a person
   * confirms it, and `-10.79%` is one keystroke of rendering away from reading as `10.79%`.
   */
  reportPercentageDirection: (fraction: number) =>
    fraction < 0
      ? 'below the schedule rate'
      : fraction > 0
        ? 'above the schedule rate'
        : 'at par with the schedule rate',
  /**
   * Shown where the percentage was not found (FR-028).
   *
   * A condition to resolve, never a zero. The consequence is named because it is invisible
   * otherwise: on the client's own file the silence is ₹7.37 lakh across the project.
   */
  reportPercentageMissing:
    'Not found in this file. Every bill will be raised at the schedule rate, with no percentage added — on a ₹3 crore tender a missing 2.46% is about ₹7.4 lakh. Set it on the project before billing.',
  reportUnits: 'Units found',
  reportUnitsHint: 'Shown as your file spells them. Matching ignores case, spacing and full stops.',
  reportErrors: (count: number) =>
    `${count} row${count === 1 ? '' : 's'} could not be imported`,
  reportWarnings: (count: number) =>
    `${count} note${count === 1 ? '' : 's'} about rows that were imported`,
  reportColumnRow: 'Row',
  reportColumnColumn: 'Column',
  reportColumnReason: 'Reason',
  reportNothingWritten: 'Nothing has been saved yet.',

  /** One sentence per refusal (FR-029). A generic message here is a refusal nobody can act on. */
  refusals: {
    BOQ_FILE_TOO_LARGE:
      'That file is too large to read. A BOQ schedule is normally well under 1MB — check you have uploaded the schedule and not a folder of drawings.',
    BOQ_WORKBOOK_UNREADABLE:
      'That file is not an Excel workbook. Upload the .xls or .xlsx itself — a PDF, a CSV or a renamed file of another kind cannot be read.',
    BOQ_WORKBOOK_EMPTY:
      'The workbook opened but has no sheets with any content. If it came from a tender portal, open it in Excel and save it again before uploading.',
    BOQ_NO_SCHEDULE_BLOCK:
      'No schedule could be found. The sheet needs a header row naming an item description, a quantity, a unit and a rate.',
    BOQ_NO_SCHEDULE_ROWS: 'The schedule has a header row but no items beneath it.',
    BOQ_NO_IMPORTABLE_ROWS:
      'Every row in the schedule was rejected, so there is nothing to import. The reasons are listed above.',
    BOQ_TOO_MANY_ROWS:
      'This schedule has more rows than one import can take. Import its sections separately.',
    BOQ_TOO_MANY_BATCHES:
      'Too many imports are waiting to be confirmed. Confirm or discard one of them, then try again.',
    // 2026-10-04. The condition existed and had no name: a confirm that outran its transaction
    // budget arrived as a bare 500, which answered neither "what happened" nor the only question
    // that matters at that moment — whether half the tender is now on the project.
    BOQ_IMPORT_WRITE_INTERRUPTED:
      'The database did not finish writing this schedule in time, so nothing was saved and the project is exactly as it was. The import is still held — press Confirm again. If it fails a second time, import the schedule’s sections separately.',
    BOQ_ALREADY_POPULATED:
      'This project already has a BOQ. Importing again would add a second copy rather than replace the first, and the existing lines cannot be removed automatically because bills may already measure against them. Add or revise lines instead.',
    BOQ_BATCH_NOT_FOUND: 'That import is no longer available. Upload the file again.',
    BOQ_BATCH_EXPIRED:
      'This import was prepared a while ago and has expired. Nothing was saved — upload the file again.',
    /** Not a failure: the schedule is on its way in, which is what the person wanted. */
    BOQ_BATCH_IN_PROGRESS: 'This schedule is being imported now. Reload the project in a moment.',
    /** Not a failure either: it already worked. */
    BOQ_BATCH_ALREADY_CONFIRMED: 'Already imported. Nothing further is needed.',
    BOQ_BATCH_NOT_YOURS:
      'This import was prepared by someone else, or for a different project. Upload the file again here.',
  } as const,
  refusalFallback: 'The workbook could not be imported.',
} as const;
