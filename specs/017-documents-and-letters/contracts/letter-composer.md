# Contract: Document and Letter interfaces (017, web)

**Date**: 2026-09-15 · Backend contract:
`buildcore-api/specs/017-documents-and-letters-backend/contracts/documents-and-letters.md`

---

## `DocumentUpload` — shared by company and project screens

```ts
interface DocumentUploadProps {
  /** Kinds this owner may upload, WITH their labels — from the server, never a client constant. */
  kinds: { documentTypeId: string; name: string; expires: boolean; isRestricted: boolean }[];
  onUpload: (input: { documentTypeId: string; file: File; expiresAt?: string;
                      documentNumber?: string }) => Promise<unknown>;
  /** "this company" / "this project" — used in prompts. No module identity beyond that. */
  ownerLabel: string;
}
```

**Why `kinds` is a prop and not an import.** The required set is company configuration; two companies
may differ, and FR-011 lets new kinds appear without a release. A client-side list would be wrong the
first time somebody added one.

**`expires` drives a required field.** When the selected kind expires, the expiry input is mandatory
*before* submit — the server refuses it with `DOCUMENT_EXPIRY_REQUIRED` regardless, and asking first
means nobody is told off for something the form could have requested. Same reasoning as 016's reason
box for reject and return.

---

## `CompletenessPanel`

```ts
interface CompletenessPanelProps {
  present: { documentTypeId: string; name: string; expiresAt: string | null }[];
  missing: { documentTypeId: string; name: string }[];
  expiringSoon: { documentTypeId: string; name: string; expiresAt: string }[];
}
```

**Missing kinds are named, never counted.** "7 of 8" makes the reader diff two lists by eye. The
server computes present/missing (backend FR-003) and this component renders that answer — it does not
derive it, because deriving it in the browser means the browser needs the required set, which is the
thing that changes.

---

## `LetterComposer` — the gated one

```ts
interface LetterComposerProps {
  kind: { key: string; label: string; requiresApproval: boolean; requiresSignature: boolean };
  fields: { name: string; label: string; required: boolean }[];   // data-driven (FR-011)
  /** Present only when `kind.requiresApproval`. Feeds 016's control unchanged. */
  approval?: ActionReviewState;
  onPreview: (values: Record<string, string>) => Promise<Blob>;
  onIssue: (values: Record<string, string>, signatoryId?: string) => Promise<unknown>;
}
```

### Rules this component must obey

1. **When `requiresApproval` and the chain is incomplete, Issue is not offered.** Not disabled with a
   tooltip — absent, with 016's `ActionReview` rendering *why* in its place. The four inert reasons
   already say four different things, and `already_decided` in particular is knowable only
   server-side.
2. **`ActionReview` is imported, not reimplemented.** `app/ui/approvals/action-review.tsx`. A second
   approval display diverges the first time either changes, which is the failure 016 FR-001 exists to
   prevent.
3. **Preview comes from the server.** `onPreview` returns a `Blob` rendered through the same path as
   the real document. The spec says an approximation is worse than no preview, and a browser-side
   re-render is an approximation by construction.
4. **Restricted document types never appear in `fields`.** The server omits them (backend FR-024);
   this component additionally must not offer them even if a malformed response includes one — belt
   and braces, because the cost here is legal.

---

## `app/lib/api` modules

| Module | Exports |
|---|---|
| `company-documents.ts` | `getCompanyDocuments()`, `uploadCompanyDocument()`, `downloadCompanyDocument()`, `supersedeCompanyDocument()` |
| `project-documents.ts` | `getDocumentRequirements()`, `putDocumentRequirements()`, `getProjectReadiness(projectIds)` |
| `letters.ts` | `getLetterKinds()`, `upsertLetterKind()`, `deleteLetterKind()`, `getSignatories()`, `upsertSignatory()`, `issueLetter()`, `reissueLetter()`, `uploadCountersigned()`, `getLetters()`, `downloadLetter()` |

Every response parses through a zod schema before reaching a component. Every refusal surfaces as an
`ApiError` carrying the backend's `code`, and callers branch on the code — never on the message.

> **One inherited lesson.** 016 shipped `ActionReview` showing the thrown error's own message
> whenever one existed, and quickstart Pass 3 caught it displaying "Internal Server Error" to
> somebody who had just typed a paragraph. The fix was to show the error's message only when it
> carries a `code`. New surfaces here should follow that from the start rather than rediscover it.

---

## What this contract deliberately excludes

- **No client-side approval logic.** Not even "the user has SETTINGS so they can probably issue".
  Authority resolves from role-slot mappings the browser cannot see.
- **No client-side required-kind list.** It is server configuration.
- **No inline Aadhaar rendering.** FR-013a: an explicit, permission-checked, audit-logged download is
  the only path, and the type never appears in a field picker or preview.
