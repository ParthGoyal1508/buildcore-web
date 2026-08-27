# Contract Reference: Projects Frontend → Backend API

This file documents the API calls this frontend feature makes. The authoritative endpoint
definitions live in `buildcore-api/specs/008-projects-backend/contracts/projects-api.md`.

All calls are made through `app/lib/api/projects.ts`. Auth headers are injected by the shared
API client wrapper.

## Clients

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getClients(params)` | GET | `/projects/clients?search=&status=&page=` | ClientsPage |
| `createClient(data)` | POST | `/projects/clients` | ClientModal |
| `updateClient(id, data)` | PATCH | `/projects/clients/:id` | ClientModal |
| `deleteClient(id)` | DELETE | `/projects/clients/:id` | ClientsPage |

## Sites

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getSites(params)` | GET | `/projects/sites?projectId=&status=&page=` | SitesPage |
| `createSite(data)` | POST | `/projects/sites` | SiteModal |
| `updateSite(id, data)` | PATCH | `/projects/sites/:id` | SiteModal |

## Portfolio

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getProjects(params)` | GET | `/projects?search=&status=&clientId=&page=` | PortfolioPage |
| `createProject(data)` | POST | `/projects` | NewProjectPage |
| `getProject(id)` | GET | `/projects/:id` | ProjectDetailPage |
| `updateProject(id, data)` | PATCH | `/projects/:id` | EditProjectPage, lock toggle |
| `deleteProject(id)` | DELETE | `/projects/:id` | PortfolioPage |

## BOQ

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getBOQ(projectId)` | GET | `/projects/:id/boq` | BOQTree |
| `createBOQGroup(projectId, data)` | POST | `/projects/:id/boq/groups` | BOQTree |
| `createBOQItem(projectId, data)` | POST | `/projects/:id/boq/items` | BOQTree |
| `importBOQ(projectId, file)` | POST | `/projects/:id/boq/import` | BOQImportButton |
| `getBOQAlerts(projectId)` | GET | `/projects/:id/boq/alerts` | BOQAlertTabs |

## DWR

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getDWRs(params)` | GET | `/projects/dwr?projectId=&dateFrom=&dateTo=&status=&page=` | DWRPage, DWRTab |
| `createDWR(data)` | POST | `/projects/dwr` | DWRModal |
| `getDWR(id)` | GET | `/projects/dwr/:id` | DWR detail view |
| `updateDWR(id, data)` | PATCH | `/projects/dwr/:id` | DWRModal, submit action |
| `approveDWR(id)` | PATCH | `/projects/dwr/:id/approve` | DWRListTable |

## Revenue & Billing

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getRevenue(projectId)` | GET | `/projects/:id/revenue` | RevenueTab |
| `createRevenue(projectId, data)` | POST | `/projects/:id/revenue` | RevenueModal |
| `getRABills(projectId)` | GET | `/projects/:id/ra-bills` | RevenueTab |
| `createRABill(projectId, data)` | POST | `/projects/:id/ra-bills` | RevenueTab |
| `submitRABill(projectId, billId)` | PATCH | `/projects/:id/ra-bills/:billId/submit` | RABillCard |
| `approveRABill(projectId, billId)` | PATCH | `/projects/:id/ra-bills/:billId/approve` | RABillCard |
| `rejectRABill(projectId, billId, remark)` | PATCH | `/projects/:id/ra-bills/:billId/reject` | RABillCard |
| `getWorkOrders(projectId)` | GET | `/projects/:id/work-orders` | BillsExpensesTab |
| `createWorkOrder(projectId, data)` | POST | `/projects/:id/work-orders` | WorkOrderModal |

## Budget & P&L

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getBudget(projectId)` | GET | `/projects/:id/budget` | BudgetForm, CostingTab |
| `upsertBudget(projectId, data)` | PUT | `/projects/:id/budget` | BudgetForm |
| `getPnl(projectId, period, params)` | GET | `/projects/:id/pnl?period=&month=&year=` | PnlTab |

## Documents

| Function | Method | Endpoint | Used by |
|---|---|---|---|
| `getDocuments(projectId)` | GET | `/projects/:id/documents` | ProjectDetailPage (docs section) |
| `uploadDocument(projectId, formData)` | POST | `/projects/:id/documents` | document upload widget |
| `deleteDocument(projectId, docId)` | DELETE | `/projects/:id/documents/:docId` | document list |

## Error handling conventions

| HTTP Status | UI behaviour |
|---|---|
| `423 Locked` | Show locked project banner (already visible); briefly re-show "Project is locked" toast |
| `409 Conflict` | Show inline error message (e.g. "Client has linked projects — cannot delete") |
| `400` | Show field-level validation errors from response body on the relevant form field |
| `403` | Redirect to `/dashboard` with "Access denied" toast |
| `404` | Show "Not found" empty state in the relevant section |
| `5xx` | Show generic error toast; do not expose server error details to the user |
