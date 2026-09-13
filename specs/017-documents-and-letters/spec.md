# Feature Specification: Documents and Letters (Web)

**Feature Branch**: `017-documents-and-letters`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Client requirements spreadsheet, Notes 1, 3, 19, 20, 21 and 26. Backend counterpart:
`buildcore-api/specs/017-documents-and-letters-backend`.

**Scope**: The screens for filing documents, drafting templates, issuing letters and attaching
payment proof. Storage, rendering and access rules belong to the backend spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The company's papers, and what is missing (Priority: P1)

An administrator opens the company's documents and sees every required kind — GST, PF, ESIC, labour
licence, PAN, TAN, Aadhaar, cancelled cheque — with the present ones openable and the missing ones
named. Uploading is a matter of choosing the kind and the file. Anything with an expiry shows when
it expires and how soon.

**Why this priority**: Nothing exists today, and this is the first note in the client's list.

**Independent Test**: Open a company with no documents, confirm every required kind is listed as
missing, upload one, and confirm the list updates.

**Acceptance Scenarios**:

1. **Given** a company with no documents, **When** its documents screen is opened, **Then** every
   required kind is listed as outstanding.
2. **Given** a document kind that expires, **When** it is uploaded, **Then** an expiry date is
   required before the upload can be submitted.
3. **Given** a document expiring soon, **When** the list is viewed, **Then** its proximity is visually
   distinguishable from one expiring in a year.
4. **Given** a superseded document, **When** the history for that kind is opened, **Then** previous
   versions remain openable.
5. **Given** an upload in progress, **When** the user navigates away, **Then** they are warned rather
   than silently losing it.
6. **Given** a file of an unsupported type, **When** it is chosen, **Then** it is refused before
   upload begins, naming what is accepted.

---

### User Story 2 - Project paperwork readiness, visible from the list (Priority: P1)

A project's required documents — LOI, work order, insurance, mining permission, labour insurance,
BOQ — show as present or outstanding on the project, and the portfolio list shows each project's
readiness without opening it.

**Why this priority**: Note 3. The portfolio-level visibility is the part that changes behaviour;
per-project detail alone still requires somebody to go looking.

**Acceptance Scenarios**:

1. **Given** a project, **When** its documents are opened, **Then** the six required kinds appear with
   their status.
2. **Given** the portfolio list, **When** it is viewed, **Then** each project's document readiness is
   visible in the row.
3. **Given** a document is uploaded, **When** the portfolio is next viewed, **Then** readiness reflects
   it.
4. **Given** a supplementary document, **When** it is uploaded, **Then** it appears without affecting
   required-set readiness.

---

### User Story 3 - Issuing a letter is choosing a recipient (Priority: P1)

A user picks a letter kind, picks who it is for, fills the few fields that vary, previews the result,
and issues it. The fixed terms are not retyped and cannot be accidentally altered.

**Why this priority**: Note 19, and the eight missing commercial kinds — work order, LOI, PO, indent,
service order, service bill, maintenance bill — are the ones that commit money.

**Acceptance Scenarios**:

1. **Given** a letter kind with a template, **When** a letter is composed, **Then** only the variable
   fields are editable and the fixed terms are shown but not editable.
2. **Given** a composed letter, **When** it is previewed, **Then** the preview is what will be issued.
3. **Given** a kind with no template, **When** it is selected, **Then** the missing template is named
   and issue is unavailable.
4. **Given** an issued letter, **When** it is viewed later, **Then** it renders as issued, regardless
   of template changes since.
5. **Given** a letter for a recipient who already has one of that kind, **When** it is issued, **Then**
   the user is told the earlier one will be superseded before they commit.

---

### User Story 4 - Sending, signing and getting the copy back (Priority: P2)

An issued letter can be downloaded with its signature applied, and the countersigned copy returned by
the other party can be uploaded against it. A letter's execution state is visible at a glance.

**Acceptance Scenarios**:

1. **Given** an issued letter of a kind that carries a signature, **When** it is downloaded, **Then**
   the signature is present in the file.
2. **Given** an issued letter, **When** a countersigned copy is uploaded, **Then** both versions are
   listed and distinguishable.
3. **Given** a list of issued letters, **When** it is viewed, **Then** those awaiting a countersigned
   copy are distinguishable from those executed.

---

### User Story 5 - Drafting a kind of letter nobody anticipated (Priority: P2)

An administrator creates a new letter kind, defines its variable fields and fixed terms, and issues
one — without a developer.

**Acceptance Scenarios**:

1. **Given** the template screen, **When** a new kind is defined with its fields and terms, **Then**
   it becomes available when composing a letter.
2. **Given** a template in use, **When** deletion is attempted, **Then** it is refused and the letters
   depending on it are named.
3. **Given** a template being edited, **When** it is saved, **Then** previously issued letters are
   unaffected and the user is told so.

---

### User Story 6 - Letters where the work is (Priority: P3)

Project and vendor letters are reachable from the project's own screens; recruitment letters from
the candidate's.

**Acceptance Scenarios**:

1. **Given** a project detail screen, **When** it is opened, **Then** a letters section lists that
   project's letters and offers the kinds relevant to it.
2. **Given** a letter issued from a project, **When** it is opened from the central list, **Then** it
   is the same letter.

---

### User Story 7 - Proof attached to the payment (Priority: P2)

When a payment is recorded, the RTGS advice is attached to it, and payments lacking proof are
visible in the list.

**Acceptance Scenarios**:

1. **Given** a recorded payment, **When** a proof is attached, **Then** it opens from the payment.
2. **Given** a payment list, **When** it is viewed, **Then** payments without proof are
   distinguishable.

### Edge Cases

- A large scan is uploaded over a slow site connection; progress and failure must both be visible.
- A user uploads the wrong document kind and needs to correct it without losing the file.
- A letter preview is requested for a template with an unfilled required field.
- Two administrators edit the same template concurrently.
- A payment proof is attached to a payment that is subsequently reversed.
- A document list grows past a screenful — it must remain navigable at 320px.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The company documents screen MUST list every required kind with present-or-missing
  status, and MUST allow upload against a chosen kind.
- **FR-002**: The screen MUST require an expiry date for kinds that expire, before submission.
- **FR-003**: The screen MUST distinguish documents expiring soon from those that are not.
- **FR-004**: Superseded versions MUST remain reachable from the kind they belong to.
- **FR-005**: Unsupported file types MUST be refused before upload begins, naming what is accepted.
- **FR-006**: Upload progress MUST be visible, and navigating away mid-upload MUST warn.
- **FR-007**: The project documents screen MUST show the required kinds with status.
- **FR-008**: The project portfolio list MUST show each project's document readiness in the row.
- **FR-009**: The letter composer MUST make only variable fields editable, showing fixed terms as
  non-editable.
- **FR-010**: The composer MUST offer a preview identical to what will be issued.
- **FR-011**: The composer MUST warn before superseding an existing letter for the same recipient
  and kind.
- **FR-012**: Users MUST be able to download an issued letter and upload a countersigned copy against
  it, with both distinguishable afterwards.
- **FR-013**: Letter lists MUST distinguish issued from executed.
- **FR-014**: Administrators MUST be able to define a new letter kind, its variable fields and its
  fixed terms, without a developer.
- **FR-015**: Template deletion MUST be refused while letters reference it, naming them.
- **FR-016**: Project screens MUST surface the letters belonging to that project; candidate screens
  those belonging to that candidate.
- **FR-017**: Payments MUST accept a proof attachment, and payment lists MUST show which lack one.
- **FR-018**: All access MUST go through the typed API modules (Principle V); copy MUST live in the
  constants module (Principle III); no inline styling (Principle II).

### Non-Functional Requirements

- **NFR-001** *(Note 25)*: Document upload MUST be operable on Android and iOS at 320px, because the
  people photographing a licence are on site, not at a desk. **Settled by constitution v2.1.0**: the
  responsive floor for desktop surfaces is now 320px, so these screens must be usable and unbroken
  there without being redesigned phone-first. Upload in particular should be re-examined against
  that floor, since a file picker and progress indicator on a narrow screen is exactly the kind of
  thing the 768px gate never caught. Not verified today.
- **NFR-002**: Upload of a 10 MB file MUST show continuous progress and MUST NOT appear frozen.

### Key Entities

- **Document Kind (view)**: A required or supplementary classification, whether it expires, and its
  current status for the subject.
- **Letter Composition**: The kind, the recipient, the variable field values, and the preview.
- **Issued Letter (view)**: A letter as issued, its version, signature state and countersigned copy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can determine a company's KYC completeness in under 10 seconds from
  one screen.
- **SC-002**: A project's document readiness is visible for every project without opening any.
- **SC-003**: All 15 letter kinds can be composed and issued from the interface.
- **SC-004**: An administrator can create and issue a new letter kind in under 10 minutes, unaided.
- **SC-005**: No payment can be reviewed without its proof status being apparent.

## Assumptions

- Uploads use the existing document-upload mechanism already used for employee and asset documents.
- Letter preview renders the same artifact the backend will issue, rather than a separate
  approximation — a preview that differs from the issued document is worse than no preview.
- The template builder edits structured fields and fixed text, not arbitrary markup.
- No test framework is installed (constitution `TODO(TESTING_STANDARD)`); verification is lint,
  type-check, build and manual passes. **No test-file tasks may be generated.**

### Needing the client's decision

- **[NEEDS CLARIFICATION: is "digital signature" an image or a legal DSC?]** Carried from the backend
  spec because it changes this interface too: an image is applied at issue, whereas a legal
  certificate requires a signing step, a credential and a different user journey.
