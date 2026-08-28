# Contract Reference: Inventory Frontend → Backend API

All calls through `app/lib/api/inventory.ts`. Vendor/site dropdowns reuse existing
`app/lib/api/partners.ts` and `app/lib/api/projects.ts` respectively.

## Masters

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getCategories()` | GET | `/inventory/categories` | CategoryTab, ItemTab (filter) |
| `createCategory(data)` | POST | `/inventory/categories` | CategoryTab |
| `updateCategory(id, data)` | PATCH | `/inventory/categories/:id` | CategoryTab |
| `deleteCategory(id)` | DELETE | `/inventory/categories/:id` | CategoryTab |
| `getItems(params)` | GET | `/inventory/items?search=&categoryId=&page=` | ItemTab, Purchase/Issue/Transfer dropdowns |
| `createItem(data)` | POST | `/inventory/items` | ItemTab |
| `updateItem(id, data)` | PATCH | `/inventory/items/:id` | ItemTab |
| `deleteItem(id)` | DELETE | `/inventory/items/:id` | ItemTab |

## Stock

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getStock(params)` | GET | `/inventory/stock?siteId=&categoryId=&search=&page=` | StockTable |
| `getStockHint(itemId, siteId)` | GET | `/inventory/stock/:itemId/:siteId` | IssueModal, TransferModal |

## Purchases

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getPurchases(params)` | GET | `/inventory/purchases?siteId=&vendorId=&paymentStatus=&dateFrom=&dateTo=&page=` | PurchasesPage |
| `createPurchase(formData)` | POST | `/inventory/purchases` (multipart) | PurchaseModal |
| `deletePurchase(id)` | DELETE | `/inventory/purchases/:id` | PurchaseListTable |

## Issues

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getIssues(params)` | GET | `/inventory/issues?siteId=&itemId=&dateFrom=&dateTo=&page=` | IssuesPage |
| `createIssue(data)` | POST | `/inventory/issues` | IssueModal |
| `deleteIssue(id)` | DELETE | `/inventory/issues/:id` | IssueListTable |

## Transfers

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getTransfers(params)` | GET | `/inventory/transfers?fromSiteId=&toSiteId=&itemId=&dateFrom=&dateTo=&page=` | TransfersPage |
| `createTransfer(data)` | POST | `/inventory/transfers` | TransferModal |
| `deleteTransfer(id)` | DELETE | `/inventory/transfers/:id` | TransferListTable |

## Payments

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getPayments(params)` | GET | `/inventory/payments?vendorId=&dateFrom=&dateTo=&paymentMode=&page=` | PaymentsPage |
| `getOutstandingBills(vendorId)` | GET | `/inventory/bills?vendorId=&paymentStatus=unpaid,part_paid` | PaymentModal |
| `createPayment(data)` | POST | `/inventory/payments` | PaymentModal |
| `deletePayment(id)` | DELETE | `/inventory/payments/:id` | PaymentListTable |

## Error handling conventions

| HTTP Status | UI behaviour |
|---|---|
| `422` + `{ availableStock: N }` | Inline "Insufficient stock (available: N)" on Quantity field — no navigation |
| `400` (over-allocation) | Unallocated balance turns red before submit (client-side guard); if backend returns 400, show toast |
| `409` (delete blocked) | Inline error message (e.g. "Bill has allocated payments — unallocate before deleting") |
| `400` (same-site transfer) | Inline "Source and destination cannot be the same" — client-side validation fires first |
| `403` | Redirect to `/dashboard` with toast |
| `5xx` | Generic error toast |
