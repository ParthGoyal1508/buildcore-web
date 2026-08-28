# Data Model: Projects Frontend (component tree, page structure, API types)

## Route & Component Tree

```text
app/dashboard/projects/
├── layout.tsx                          # projects shell (breadcrumb, sub-nav)
├── clients/
│   └── page.tsx                        # ClientsPage (US1)
├── sites/
│   └── page.tsx                        # SitesPage (US2)
├── portfolio/
│   ├── page.tsx                        # PortfolioPage — project list (US3)
│   ├── new/
│   │   └── page.tsx                    # NewProjectPage — create form (US3)
│   └── [id]/
│       ├── page.tsx                    # ProjectDetailPage — tabbed (US4)
│       ├── edit/
│       │   └── page.tsx                # EditProjectPage — edit form (US3)
│       └── tabs/
│           ├── OverviewTab.tsx
│           ├── EmployeesTab.tsx
│           ├── MachineryTab.tsx
│           ├── MaterialsTab.tsx
│           ├── DWRTab.tsx              # links out to /dwr filtered by project
│           ├── BillsExpensesTab.tsx    # sub-tabs: Bills, Expenses, WorkOrders
│           ├── RevenueTab.tsx          # Revenue entries + RA Bills (US7)
│           ├── CostingTab.tsx          # cost breakdown table
│           └── PnlTab.tsx             # P&L statement + period selector (US8)
├── dwr/
│   └── page.tsx                        # DWRPage — DWR list (US6)
└── boq/                                # BOQ management within project detail (US5)
    (no top-level route — accessed via ProjectDetailPage tabs or project context)

app/ui/projects/
├── ClientModal.tsx                     # Add/Edit client modal
├── SiteModal.tsx                       # Add/Edit site modal
├── ProjectForm.tsx                     # Shared form for new/edit project
├── ProjectListTable.tsx                # Portfolio table with lock badge
├── BOQTree.tsx                         # Collapsible group/item tree
├── BOQAlertTabs.tsx                    # Today Task / Delayed / To Be Delayed
├── BOQImportButton.tsx                 # Upload trigger + result display
├── DWRModal.tsx                        # Add/Edit DWR modal with task section
├── DWRTaskRow.tsx                      # Single task entry with live Actual Qty
├── DWRListTable.tsx
├── RevenueModal.tsx
├── RABillCard.tsx                      # Bill row with state-action buttons
├── WorkOrderModal.tsx                  # Tabbed modal (6 sub-tabs)
├── BudgetForm.tsx                      # Five-category budget entry
├── PnlSummaryCards.tsx                 # 5 summary cards
├── PnlCostBreakdown.tsx               # Budget vs Actual table with overrun highlights
└── PnlStatement.tsx                   # Full P&L equation display

app/lib/api/
└── projects.ts                         # All typed API functions for this feature
```

## TypeScript API Types (mirroring backend contracts)

```typescript
// Clients
interface Client { id: string; name: string; contactPerson: string; phone: string;
  email: string; address: string; gstin?: string; projectCount: number;
  status: 'active' | 'inactive'; }

// Sites
interface Site { id: string; name: string; projectId?: string; address?: string;
  latitude?: number; longitude?: number; geofenceRadius?: number;
  status: 'active' | 'inactive'; }

// Projects
type ProjectStatus = 'planning' | 'ongoing' | 'on_hold' | 'completed';
interface Project { id: string; code: string; name: string; client: { id: string; name: string };
  location: string; contractValue: number; status: ProjectStatus; startDate: string;
  expectedEndDate?: string; isLocked: boolean; }

interface ProjectDetail extends Project {
  tabs: {
    employees: EmployeeRef[];
    machinery: MachineryRef[];
    materials: MaterialRef[];
    dwrSummary: { count: number; latestDate?: string };
    billSummary: { totalBills: number; totalExpenses: number };
    revenueSummary: { totalReceived: number; totalPending: number };
  };
}

// BOQ
interface BOQTaskGroup { id: string; boqNo: string; name: string; scopeQty: number;
  isEstimate: boolean; items: BOQTaskItem[]; }
interface BOQTaskItem { id: string; boqNo: string; taskName: string; unit: string;
  scopeQty: number; doneQty: number; pendingQty: number;
  perDayQty: number; avgQtyPerDay: number; daysToComplete?: number; }

// DWR
type DWRStatus = 'draft' | 'submitted' | 'approved';
interface DWR { id: string; projectId: string; workDate: string; dprNumber: string;
  supervisorName: string; weather: string; status: DWRStatus;
  workerCount: number; machineryCount: number; progress: number; }
interface DWRTaskInput { boqItemId?: string; paymentMode: 'work_basis' | 'day_basis';
  nos1: number; nos2: number; length: number; breadth: number; depth: number; density: number;
  remark?: string; }

// Revenue & RA Bills
type RABillStatus = 'draft' | 'submitted' | 'approved';
interface Revenue { id: string; description: string; amount: number; date: string;
  status: 'received' | 'pending'; }
interface RABill { id: string; billNumber: string; amount: number; billingDate: string;
  status: RABillStatus; rejectionRemark?: string; }

// P&L
type PnlCategory = 'labour' | 'materials' | 'machinery' | 'fuel' | 'subcontractors' | 'overheads';
type PnlPeriod = 'monthly' | 'quarterly' | 'yearly' | 'cumulative';
interface PnlCostRow { category: PnlCategory; budget: number; actual: number;
  variance: number; variancePct: number; costOverrunAlert: boolean; }
interface ProjectPnl { contractValue: number; revenueBooked: number;
  costBreakdown: PnlCostRow[];  // 6 rows: labour, materials, machinery, fuel, subcontractors, overheads
  grossProfit: number; marginPct: number;
  period: PnlPeriod; unavailableModules: string[]; }
```

## Key Form Schemas (zod)

```typescript
// Project create/edit — all fields validated client-side
const projectSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
  location: z.string().min(1),
  contractValue: z.number().positive(),
  startDate: z.string(), // ISO date
  status: z.enum(['planning', 'ongoing', 'on_hold', 'completed']),
  division: z.enum(['contract', 'own']),
  // optional fields
  code: z.string().optional(),
  expectedEndDate: z.string().optional(),
  projectManagerEmployeeId: z.string().uuid().optional(),
  // ...other optional fields
});

// DWR task row — live Actual Qty computed from these
const dwrTaskSchema = z.object({
  nos1: z.number().min(0), nos2: z.number().min(0),
  length: z.number().min(0), breadth: z.number().min(0),
  depth: z.number().min(0), density: z.number().min(0),
  paymentMode: z.enum(['work_basis', 'day_basis']),
  boqItemId: z.string().uuid().optional(),
});
// actualQty = nos1 * nos2 * length * breadth * depth * density (client-side watch)
```

## State Management Notes

- All server state (lists, detail, P&L) via `@tanstack/react-query` with project-scoped query
  keys, e.g. `['project', id, 'pnl', period]`.
- DWR form state (measurement fields → live Actual Qty) via `react-hook-form` `watch`.
- P&L period selector state in URL query param via `useSearchParams` (research.md §6).
- Project lock state read from `ProjectDetail.isLocked`; propagated to all tab action buttons via
  React context or prop drilling within the detail page layout.
- BOQ tree expand/collapse state is local component state (no server round-trip needed).
