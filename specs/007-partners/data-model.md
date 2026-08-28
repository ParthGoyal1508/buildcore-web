# Data Model: Partners Frontend (component tree, page structure, API types)

## Route & Component Tree

```text
app/dashboard/partners/
├── layout.tsx                          # Partners shell (breadcrumb, sub-nav)
├── vendors/
│   ├── page.tsx                        # VendorsPage — vendor list (US2)
│   └── categories/
│       └── page.tsx                    # CategoriesPage (US1)
├── contractors/
│   ├── page.tsx                        # ContractorsPage — contractor vault (US3)
│   ├── [id]/
│   │   └── page.tsx                    # ContractorDetailPage (US3)
│   ├── compliance/
│   │   └── page.tsx                    # CompliancePage (US4)
│   └── rag/
│       └── page.tsx                    # RagMatrixPage (US5)
└── bocw/
    └── page.tsx                        # BOCWPage (US6)

app/ui/partners/
├── VendorCategoryModal.tsx             # Add/Edit category modal
├── VendorModal.tsx                     # 4-tab vendor modal
├── VendorDetailsTab.tsx                # Tab 1: name, type, deals-in, gstin, pan, tds
├── VendorAddressTab.tsx                # Tab 2: address fields
├── VendorContactsTab.tsx               # Tab 3: useFieldArray contact rows
├── VendorWorkDetailTab.tsx             # Tab 4: hire/contract fields (conditional)
├── VendorListTable.tsx                 # Vendor table with active toggle
├── ContractorModal.tsx                 # Add contractor modal (vendor picker)
├── ContractorDocumentRow.tsx           # Document row with expiry warning badge
├── ComplianceModal.tsx                 # Record submission modal
├── ComplianceTable.tsx                 # Compliance list table with verify action
├── RagMatrix.tsx                       # Sticky CSS table with coloured dots
├── RagDot.tsx                          # Single dot (colour, click handler)
├── BOCWTable.tsx                       # BOCW cess table
└── BOCWPaymentModal.tsx                # Record Payment modal

app/lib/api/
└── partners.ts                         # All typed API functions
```

## TypeScript API Types

```typescript
// Vendor Categories
interface VendorCategory { id: string; name: string; description?: string;
  vendorCount: number; isDefault: boolean; }

// Vendors
type VendorType = 'material' | 'fuel' | 'hire' | 'service' | 'subcontractor' | 'labour_contractor';
interface VendorListItem { id: string; code: string; name: string; city?: string;
  dealsIn: string[]; primaryContact?: { name: string; phone?: string };
  type: VendorType; gstin?: string; tdsSection?: string; tdsRate?: number; active: boolean; }
interface VendorContact { id?: string; name: string; phone?: string; email?: string; }
interface VendorDetail extends VendorListItem {
  pan?: string; address?: string; state?: string; pinCode?: string;
  contacts: VendorContact[]; categories: VendorCategory[];
  hireDetail?: VendorHireDetail; contractorProfile?: ContractorProfileRef; }

// Contractors
type ComplianceStatus = 'compliant' | 'non_compliant' | 'partially_compliant';
interface ContractorListItem { id: string; vendorId: string; vendorName: string;
  contactPerson?: string; licenceNumber?: string; pfRegistration?: string;
  esicRegistration?: string; bocwRegistration?: string; complianceStatus: ComplianceStatus; }
interface ContractorDocument { id: string; documentType: string; fileRef: string;
  expiresAt?: string; expiryWarning: boolean; uploadedAt: string; }
interface ContractorDetail extends ContractorListItem { documents: ContractorDocument[]; }

// Monthly Compliance
type MonthlyComplianceStatus = 'missing' | 'partial' | 'submitted' | 'verified';
interface MonthlyCompliance { id: string; contractorId: string; contractorName: string;
  month: string; pfChallanNumber?: string; pfAmount?: number; pfDate?: string;
  esicChallanNumber?: string; esicAmount?: number; esicDate?: string;
  status: MonthlyComplianceStatus; verifiedByName?: string; verifiedAt?: string; }

// RAG Matrix
type RagCellStatus = 'verified' | 'submitted' | 'partial' | 'missing' | 'gray';
interface RagRow { contractorProfileId: string; contractorName: string;
  cells: Array<{ month: string; status: RagCellStatus; complianceId: string | null; }>; }
interface RagMatrix { fy: string; months: string[]; rows: RagRow[]; }

// BOCW
type BOCWStatus = 'pending' | 'partial' | 'paid';
interface BOCWRow { projectId: string; projectName: string; contractValue: number;
  cessRate: number; cessLiability: number; totalPaid: number; balance: number;
  lastPaymentDate?: string; status: BOCWStatus; }
```

## Key Form Schemas (zod)

```typescript
const vendorSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['material','fuel','hire','service','subcontractor','labour_contractor']),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  tdsSection: z.string().optional(),
  tdsRate: z.number().min(0).max(100).optional(),
  active: z.boolean().default(true),
  categoryIds: z.array(z.string().uuid()),
  contacts: z.array(z.object({
    name: z.string().min(1), phone: z.string().optional(), email: z.string().email().optional()
  })),
  // address tab
  address: z.string().optional(), city: z.string().optional(),
  state: z.string().optional(), pinCode: z.string().optional(),
  // hire detail (conditional — only validated when type = subcontractor/hire)
  hireDetail: z.object({ hireType: z.enum(['taken','given']), /* ...rest */ }).optional(),
});

const complianceSchema = z.object({
  contractorId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),  // YYYY-MM, max = current month
  pfChallanNumber: z.string().optional(), pfAmount: z.number().optional(),
  pfDate: z.string().optional(),
  esicChallanNumber: z.string().optional(), esicAmount: z.number().optional(),
  esicDate: z.string().optional(),
});
```

## State Management Notes

- All server state via `@tanstack/react-query` with module-scoped query keys, e.g.
  `['partners', 'vendors', params]`, `['partners', 'rag', fy]`.
- RAG Matrix FY stored as URL query param `?fy=` via `useSearchParams` (research.md §4).
- Vendor modal form state: single `react-hook-form` instance, `useFieldArray` for contacts.
- Compliance month picker: controlled `<input type="month">` with `max` attribute set to
  current YYYY-MM, validated via zod `refine` before submission.
- Contractor document upload: `FormData` multipart POST, no special state management needed.
