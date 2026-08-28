# Data Model: Inventory Frontend (component tree, page structure, API types)

## Route & Component Tree

```text
app/dashboard/inventory/
├── layout.tsx                          # Inventory shell (breadcrumb, sub-nav)
├── stock/page.tsx                      # StockPage — primary dashboard (US2)
├── purchases/page.tsx                  # PurchasesPage (US3)
├── issues/page.tsx                     # IssuesPage (US4)
├── transfers/page.tsx                  # TransfersPage (US5)
└── payments/page.tsx                   # PaymentsPage (US6)

app/ui/inventory/
├── MastersModal.tsx                    # Two-tab modal: Categories + Items (US1)
├── CategoryTab.tsx                     # Category table + add form
├── ItemTab.tsx                         # Item table + add/edit form
├── StockTable.tsx                      # Stock balance table with quick-action buttons
├── PurchaseModal.tsx                   # New/Edit Purchase modal
├── IssueModal.tsx                      # New Issue modal with stock hint
├── TransferModal.tsx                   # New Transfer modal with stock hint
├── PaymentModal.tsx                    # New Payment modal with allocation table
├── AllocationRow.tsx                   # Single bill allocation row (useFieldArray)
├── PurchaseListTable.tsx               # Purchase list with payment status badge
├── IssueListTable.tsx
├── TransferListTable.tsx
└── PaymentListTable.tsx

app/lib/api/
└── inventory.ts                        # All typed API functions
```

## TypeScript API Types

```typescript
// Masters
interface ItemCategory { id: string; name: string; itemCount: number; }
interface Item { id: string; code: string; name: string; category: string;
  unit: 'BAG'|'CUM'|'KG'|'NOS'|'MT'|'LTR'; description?: string; }

// Stock
interface StockRow { itemId: string; itemName: string; itemCode: string;
  siteId: string; siteName: string; category: string; unit: string;
  received: number; issued: number; transferIn: number; transferOut: number;
  inStock: number; avgRate: number; stockValue: number; }
interface StockHint { inStock: number; avgRate: number; }

// Purchases
type PaymentStatus = 'unpaid' | 'part_paid' | 'paid';
interface Purchase { id: string; date: string; siteName: string; itemName: string;
  vendorName: string; quantity: number; unit: string; rate: number; amount: number;
  billFileUrl?: string; paymentStatus: PaymentStatus; deleted: boolean; }

// Issues
interface Issue { id: string; date: string; siteName: string; itemName: string;
  issuedTo: string; quantity: number; unit: string; remarks?: string; }

// Transfers
interface Transfer { id: string; date: string; fromSiteName: string; toSiteName: string;
  itemName: string; quantity: number; unit: string; remarks?: string; }

// Payments
interface Payment { id: string; date: string; vendorName: string; amount: number;
  paymentMode: string; referenceNumber: string; allocatedAmount: number;
  allocatedBillCount: number; }
interface PurchaseBill { id: string; purchaseId: string; vendorId: string;
  totalAmount: number; paidAmount: number; remainingAmount: number;
  paymentStatus: PaymentStatus; itemName: string; date: string; }
```

## Key Form Schemas (zod)

```typescript
const purchaseSchema = z.object({
  siteId: z.string().uuid(),
  itemId: z.string().uuid(),
  vendorId: z.string().uuid(),
  date: z.string(),
  quantity: z.number().positive(),
  rate: z.number().positive(),
  // amount is derived: quantity * rate — not in DTO, shown as read-only
});

const issueSchema = z.object({
  siteId: z.string().uuid(),
  itemId: z.string().uuid(),
  date: z.string(),
  quantity: z.number().positive(),
  issuedTo: z.string().min(1),
  remarks: z.string().optional(),
});

const paymentSchema = z.object({
  vendorId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string(),
  paymentMode: z.enum(['upi','bank_transfer','cash','cheque']),
  referenceNumber: z.string().min(1),
  allocations: z.array(z.object({
    billId: z.string().uuid(),
    allocatedAmount: z.number().min(0),
  })),
}).refine(data => data.allocations.reduce((s, a) => s + a.allocatedAmount, 0) <= data.amount,
  { message: 'Allocated amount exceeds payment amount' });
```

## State Management Notes

- All server state via `@tanstack/react-query`. Stock query key: `['inventory', 'stock', { siteId, categoryId, search }]`.
- Stock hint: `['inventory', 'stock-hint', itemId, siteId]` — fetched on item+site change in Issue/Transfer modals.
- After Purchase/Issue/Transfer modal save: invalidate `['inventory', 'stock', ...]` to refresh.
- Payment allocation table: `useFieldArray` on `allocations` field; `watch('amount')` + `watch('allocations')` drive live `unallocated` counter.
- Issue modal item dropdown: derived from stock query filtered to `inStock > 0` for selected site; resets on site change.
