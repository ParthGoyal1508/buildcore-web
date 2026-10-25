"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/app/lib/api/client";
import {
  type CompanyBranch,
  type CompanyBranchInput,
  INDIAN_STATES,
  createCompanyBranch,
  listCompanyBranches,
  makeHeadOffice,
  updateCompanyBranch,
} from "@/app/lib/api/company-branches";
import { Button } from "@/app/ui/button";
import StatusBadge from "@/app/ui/status-badge";
import { TABLE } from "@/app/ui/table-classes";
import { toast } from "@/app/ui/toast";
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from "@/app/ui/settings/form-fields";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const FIELDS = [
  "label",
  "gstin",
  "address",
  "city",
  "state",
  "pinCode",
  "phone",
  "email",
  "website",
  "pfEstablishmentCode",
  "esicCode",
  "professionalTaxRegNumber",
  "tradeName",
] as const;
type Draft = Record<(typeof FIELDS)[number], string>;

const blank: Draft = Object.fromEntries(FIELDS.map((f) => [f, ""])) as Draft;
const draftOf = (b: CompanyBranch): Draft =>
  Object.fromEntries(FIELDS.map((f) => [f, b[f] ?? ""])) as Draft;

/**
 * A company's branches — one per GST registration (041). Lists them head office first, adds and
 * edits them, moves the head office, and deactivates one that is no longer used. The API checks a
 * GSTIN against its state and the company's PAN; its message is shown beside the form.
 *
 * Its own form, not part of the company form around it: a branch is saved on its own, the moment
 * it is added, the way the logo is.
 */
export default function CompanyBranchesPanel({
  companyId,
}: {
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const key = ["companies", companyId, "branches"];
  const {
    data: branches,
    isLoading,
    error,
  } = useQuery({
    queryKey: key,
    queryFn: () => listCompanyBranches(companyId),
  });
  /** null: no form open; 'new': adding; otherwise the branch being edited. */
  const [editing, setEditing] = useState<CompanyBranch | "new" | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    // The company's own GSTIN / address mirror the head office.
    await queryClient.invalidateQueries({ queryKey: ["companies"] });
    await queryClient.invalidateQueries({ queryKey: ["company-branches"] });
  };

  const headOffice = useMutation({
    mutationFn: (b: CompanyBranch) => makeHeadOffice(companyId, b.id),
    onSuccess: async (_rows, b) => {
      await refresh();
      toast.success(`${b.displayLabel} is now the head office.`);
    },
    onError: (e) =>
      toast.error(errorMessage(e, "Could not change the head office.")),
  });
  const active = useMutation({
    mutationFn: (b: CompanyBranch) =>
      updateCompanyBranch(companyId, b.id, { isActive: !b.isActive }),
    onSuccess: async (saved) => {
      await refresh();
      toast.success(
        `${saved.displayLabel} ${saved.isActive ? "reactivated" : "deactivated"}.`,
      );
    },
    onError: (e) =>
      toast.error(errorMessage(e, "Could not change the branch.")),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        One branch per GST registration. Projects bill from a branch and
        employees are filed under one; the head office is used wherever none is
        chosen. The GSTIN, address and codes on the other tabs are the head
        office&apos;s.
      </p>

      {isLoading ? (
        <div className={TABLE.empty}>Loading branches…</div>
      ) : error ? (
        <div className={TABLE.failed}>
          {errorMessage(error, "Could not load the branches.")}
        </div>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>Branch</th>
                <th className={TABLE.th}>GSTIN / PF code</th>
                <th className={TABLE.th}>Status</th>
                <th className={TABLE.th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(branches ?? []).map((b) => (
                <tr key={b.id} className={TABLE.row}>
                  <td className={`${TABLE.td} min-w-[12rem]`}>
                    <div className="font-medium">{b.displayLabel}</div>
                    <div
                      className="line-clamp-2 text-xs text-gray-500"
                      title={b.address ?? undefined}
                    >
                      {[b.address, b.pinCode].filter(Boolean).join(" – ") ||
                        "—"}
                    </div>
                  </td>
                  <td className={`${TABLE.td} text-xs`}>
                    <div className="font-mono">{b.gstin ?? "—"}</div>
                    <div className="whitespace-nowrap text-gray-500">
                      PF {b.pfEstablishmentCode ?? "—"}
                    </div>
                  </td>
                  <td className={TABLE.td}>
                    {b.isHeadOffice ? (
                      <StatusBadge label="Head office" tone="info" />
                    ) : (
                      <StatusBadge
                        label={b.isActive ? "Active" : "Inactive"}
                        tone={b.isActive ? "success" : "neutral"}
                      />
                    )}
                  </td>
                  <td className={`${TABLE.td} text-right`}>
                    {/* Stacked, so three actions fit beside the branch in a modal's width. */}
                    <div className="flex flex-col items-end gap-1">
                      <RowAction type="button" onClick={() => setEditing(b)}>
                        Edit
                      </RowAction>
                      {!b.isHeadOffice && b.isActive && (
                        <RowAction
                          type="button"
                          icon={null}
                          loading={
                            headOffice.isPending &&
                            headOffice.variables?.id === b.id
                          }
                          onClick={() => headOffice.mutate(b)}
                        >
                          Make head office
                        </RowAction>
                      )}
                      {!b.isHeadOffice && (
                        <RowAction
                          type="button"
                          icon={null}
                          loading={
                            active.isPending && active.variables?.id === b.id
                          }
                          onClick={() => active.mutate(b)}
                        >
                          {b.isActive ? "Deactivate" : "Reactivate"}
                        </RowAction>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <BranchForm
          key={editing === "new" ? "new" : editing.id}
          companyId={companyId}
          branch={editing === "new" ? null : editing}
          onDone={async (saved) => {
            setEditing(null);
            if (saved) {
              await refresh();
              toast.success(`${saved.displayLabel} saved.`);
            }
          }}
        />
      ) : (
        <Button type="button" onClick={() => setEditing("new")}>
          Add branch
        </Button>
      )}
    </div>
  );
}

function BranchForm({
  companyId,
  branch,
  onDone,
}: {
  companyId: string;
  branch: CompanyBranch | null;
  onDone: (saved: CompanyBranch | null) => void;
}) {
  const [draft, setDraft] = useState<Draft>(branch ? draftOf(branch) : blank);
  const [problems, setProblems] = useState<
    Partial<Record<keyof Draft, string>>
  >({});
  const [serverError, setServerError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (values: Draft) => {
      // A blank optional field clears the value on an edit and is simply left out on an add.
      const input: CompanyBranchInput = Object.fromEntries(
        FIELDS.map((f) => [
          f,
          values[f].trim() === ""
            ? branch
              ? null
              : undefined
            : values[f].trim(),
        ]),
      );
      return branch
        ? updateCompanyBranch(companyId, branch.id, input)
        : createCompanyBranch(companyId, input);
    },
    onSuccess: (saved) => onDone(saved),
    onError: (e) => {
      const message = errorMessage(e, "Could not save the branch.");
      // The GSTIN checks are the likely refusals; put them on the field.
      if (/gstin/i.test(message)) setProblems({ gstin: message });
      else setServerError(message);
    },
  });

  const set =
    (field: keyof Draft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [field]: event.target.value }));

  const submit = () => {
    const found: Partial<Record<keyof Draft, string>> = {};
    const gstin = draft.gstin.trim().toUpperCase();
    if (gstin && !GSTIN.test(gstin)) found.gstin = "Not a valid GSTIN";
    for (const f of ["address", "city", "state"] as const) {
      if (!draft[f].trim()) found[f] = "Required";
    }
    if (!/^[0-9]{6}$/.test(draft.pinCode.trim()))
      found.pinCode = "Must be 6 digits";
    setProblems(found);
    setServerError(null);
    if (Object.keys(found).length === 0) {
      const cleaned = { ...draft, gstin };
      setDraft(cleaned);
      save.mutate(cleaned);
    }
  };

  const id = (f: string) => `branch-${f}`;
  return (
    <fieldset className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-800">
        {branch ? `Edit ${branch.displayLabel}` : "Add a branch"}
      </legend>
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={id("gstin")}
          label="GSTIN"
          hint="Its first two digits must match the state"
          value={draft.gstin}
          onChange={set("gstin")}
          error={problems.gstin}
        />
        <SelectField
          id={id("state")}
          label="State"
          aria-required="true"
          value={draft.state}
          onChange={set("state")}
          error={problems.state}
        >
          <option value="">Choose a state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextField
            id={id("address")}
            label="Address"
            aria-required="true"
            value={draft.address}
            onChange={set("address")}
            error={problems.address}
          />
        </div>
        <TextField
          id={id("city")}
          label="City"
          aria-required="true"
          value={draft.city}
          onChange={set("city")}
          error={problems.city}
        />
        <TextField
          id={id("pinCode")}
          label="PIN code"
          aria-required="true"
          inputMode="numeric"
          value={draft.pinCode}
          onChange={set("pinCode")}
          error={problems.pinCode}
        />
        <TextField
          id={id("label")}
          label="Short name"
          hint='Shown where a branch is chosen; defaults to "City (State)"'
          value={draft.label}
          onChange={set("label")}
        />
        <TextField
          id={id("tradeName")}
          label="Printed name"
          hint="Defaults to the company name"
          value={draft.tradeName}
          onChange={set("tradeName")}
        />
        <TextField
          id={id("phone")}
          label="Phone"
          value={draft.phone}
          onChange={set("phone")}
        />
        <TextField
          id={id("email")}
          label="Email"
          type="email"
          value={draft.email}
          onChange={set("email")}
        />
        <TextField
          id={id("website")}
          label="Website"
          value={draft.website}
          onChange={set("website")}
        />
        <TextField
          id={id("pfEstablishmentCode")}
          label="PF establishment code"
          value={draft.pfEstablishmentCode}
          onChange={set("pfEstablishmentCode")}
        />
        <TextField
          id={id("esicCode")}
          label="ESIC code"
          value={draft.esicCode}
          onChange={set("esicCode")}
        />
        <TextField
          id={id("professionalTaxRegNumber")}
          label="Professional tax registration number"
          value={draft.professionalTaxRegNumber}
          onChange={set("professionalTaxRegNumber")}
        />
      </div>
      <div className="flex justify-end gap-2">
        <SecondaryButton
          type="button"
          onClick={() => onDone(null)}
          disabled={save.isPending}
        >
          Cancel
        </SecondaryButton>
        <Button type="button" onClick={submit} loading={save.isPending}>
          {branch ? "Save branch" : "Add branch"}
        </Button>
      </div>
    </fieldset>
  );
}
