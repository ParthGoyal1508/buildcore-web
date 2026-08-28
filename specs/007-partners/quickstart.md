# Quickstart: Validating the Partners Frontend

## Prerequisites

- `buildcore-api` running with partners backend migrations applied.
- Admin session active. At least one project seeded (for BOCW cess).

---

## Scenario 1 — Vendor Categories (US1)

1. Navigate to `/dashboard/partners/vendors`, click "Manage Categories".
   **Expected**: categories table with 6 seeded defaults (Material, Fuel, Hire, Service,
   Transport, Subcontractor) and their vendor counts.
2. Add a new category "Earthwork". **Expected**: appears in table.
3. Edit it to "Earthworks". **Expected**: table row updates.
4. Delete it (no linked vendors). **Expected**: row removed.
5. Attempt to delete "Material" (linked to a vendor). **Expected**: inline "Category has linked
   vendors — cannot delete" error.

---

## Scenario 2 — Vendors 4-tab modal (US2)

1. Navigate to `/dashboard/partners/vendors`. Click "Add Vendor".
2. Fill Details tab: Name "ABC Contractors", Type "Subcontractor", Deals In: select "Material"
   + "Subcontractor", GSTIN, TDS Section "194C", TDS Rate 2%.
3. Switch to Address tab (fill city). Switch back to Details. **Expected**: all Details fields
   still populated (single form instance — FR-011).
4. Open Contacts tab. Add two contacts via "+ Add Contact". Remove one. **Expected**: one row
   remains.
5. Open Work Detail tab. **Expected**: tab is enabled (Subcontractor type). Fill Hire Type and
   Rate.
6. Save. **Expected**: vendor appears in list with Deals In tags and Contact person.
7. Directly toggle the Active switch in the list row. **Expected**: confirmation dialog appears
   before the API call is made.

---

## Scenario 3 — Contractor Vault (US3)

1. Navigate to `/dashboard/partners/contractors`. Click "Add Contractor".
2. Select the "ABC Contractors" vendor. Fill licence number. Save.
   **Expected**: contractor appears with `complianceStatus = Non-compliant` (red badge).
3. Open the contractor detail. Click "Upload Document" for Labour License, upload a PDF with
   expiry 15 days from today. **Expected**: document row shows expiry warning badge.

---

## Scenario 4 — Monthly Compliance (US4)

1. Navigate to `/dashboard/partners/contractors/compliance`. Click "Record Compliance".
2. Select "ABC Contractors", current month minus 1 (e.g. July 2026). Fill PF data only.
   **Expected**: status badge = "Partial" (yellow).
3. Edit the record, add ESIC data. **Expected**: status badge = "Submitted" (blue).
4. Click "Verify". Confirmation dialog appears. Confirm.
   **Expected**: status = "Verified" (green). "Verified by [admin] on [date]" label shown.
   Verify action hidden.
5. Go to Contractor list. **Expected**: "ABC Contractors" compliance status updated.

---

## Scenario 5 — RAG Matrix (US5)

1. Navigate to `/dashboard/partners/contractors/rag`. **Expected**: table with contractor rows,
   12 month columns for current FY, dots coloured per compliance status.
2. Future months. **Expected**: gray dots, not clickable.
3. Click a non-gray dot. **Expected**: navigates to
   `/dashboard/partners/contractors/compliance?contractorId=X&month=YYYY-MM`.
4. Change FY selector to previous year. **Expected**: URL updates `?fy=`, month columns shift,
   dots refresh.
5. Deactivate ABC Contractors vendor. Return to RAG Matrix.
   **Expected**: ABC Contractors row no longer appears.

---

## Scenario 6 — BOCW Cess (US6)

1. Navigate to `/dashboard/partners/bocw`. **Expected**: projects listed with Cess Liability =
   Contract Value × 1%, `formatCurrency` formatting on all amounts (₹ + Indian grouping).
2. Click "Record Payment" for a project. Fill Amount, Date, Reference. Submit.
   **Expected**: table row updates — Paid amount shows, Status = Partial.
3. Record a payment for the full balance. **Expected**: Status = Paid (green), Record Payment
   button disabled.
