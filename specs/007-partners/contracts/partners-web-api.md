# Contract Reference: Partners Frontend → Backend API

All calls through `app/lib/api/partners.ts`. Auth headers injected by shared wrapper.
Authoritative endpoint definitions: `buildcore-api/specs/007-partners-backend/contracts/partners-api.md`.

## Vendor Categories

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getVendorCategories()` | GET | `/partners/vendor-categories` | CategoriesPage, VendorDetailsTab |
| `createVendorCategory(data)` | POST | `/partners/vendor-categories` | VendorCategoryModal |
| `updateVendorCategory(id, data)` | PATCH | `/partners/vendor-categories/:id` | VendorCategoryModal |
| `deleteVendorCategory(id)` | DELETE | `/partners/vendor-categories/:id` | CategoriesPage |

## Vendors

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getVendors(params)` | GET | `/partners/vendors?search=&type=&active=&page=` | VendorsPage |
| `createVendor(data)` | POST | `/partners/vendors` | VendorModal |
| `getVendor(id)` | GET | `/partners/vendors/:id` | VendorModal (edit mode) |
| `updateVendor(id, data)` | PATCH | `/partners/vendors/:id` | VendorModal |
| `toggleVendorActive(id, active)` | PATCH | `/partners/vendors/:id` | VendorListTable (active toggle) |

## Contractors

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getContractors(params)` | GET | `/partners/contractors?complianceStatus=&page=` | ContractorsPage |
| `createContractor(data)` | POST | `/partners/contractors` | ContractorModal |
| `getContractor(id)` | GET | `/partners/contractors/:id` | ContractorDetailPage |
| `updateContractor(id, data)` | PATCH | `/partners/contractors/:id` | ContractorDetailPage |
| `uploadContractorDocument(id, formData)` | POST | `/partners/contractors/:id/documents` | ContractorDetailPage |
| `deleteContractorDocument(id, docId)` | DELETE | `/partners/contractors/:id/documents/:docId` | ContractorDocumentRow |

## Monthly Compliance

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getCompliance(params)` | GET | `/partners/compliance?contractorId=&month=&status=&page=` | CompliancePage |
| `createCompliance(data)` | POST | `/partners/compliance` | ComplianceModal |
| `updateCompliance(id, data)` | PATCH | `/partners/compliance/:id` | ComplianceModal (edit) |
| `verifyCompliance(id)` | PATCH | `/partners/compliance/:id/verify` | ComplianceTable (verify action) |

## RAG Matrix

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getRagMatrix(fy)` | GET | `/partners/rag?fy=YYYY-YY` | RagMatrixPage |

## BOCW Cess

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getBOCW(params)` | GET | `/partners/bocw?page=` | BOCWPage |
| `recordBOCWPayment(projectId, data)` | POST | `/partners/bocw/:projectId/payments` | BOCWPaymentModal |

## Error handling conventions

| HTTP Status | UI behaviour |
|---|---|
| `409 Conflict` | Inline error (e.g. "Category has linked vendors", "Record already verified") |
| `400` | Field-level validation errors surfaced on the relevant form field |
| `403` | Redirect to `/dashboard` with "Access denied" toast |
| `404` | "Not found" empty state |
| `5xx` | Generic error toast; no server error details exposed |
