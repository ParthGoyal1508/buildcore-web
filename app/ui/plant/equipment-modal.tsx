'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createEquipment,
  getNextEquipmentCode,
  updateEquipment,
  uploadEquipmentDocument,
  PLANT_OWNERSHIPS,
  REGISTRATION_KINDS,
  REGISTRATION_KIND_LABELS,
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_LABELS,
  type Equipment,
  type EquipmentDocType,
  type EquipmentInput,
  type RegistrationKind,
  type RegistrationPaperInput,
} from '@/app/lib/api/plant';
import {
  MESSAGES,
  POWER_SOURCES,
  SETTABLE_EQUIPMENT_STATUSES,
  plantLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
  fieldClass,
  selectClass,
} from '@/app/ui/settings/form-fields';
import CategoryOptions from './category-options';
import { toBase64 } from './document-modal';
import {
  usePlantCategories,
  usePlantCompanyId,
  usePlantDocTypes,
  usePlantSites,
  usePlantVendors,
} from './use-plant-refs';

/**
 * Add or edit a machine.
 *
 * Two things are deliberately absent. `code` is never typed (2026-10-15): it is built from
 * the name and the manufacturing year in the company's format, shown before saving, and never
 * renamed afterwards — every logbook entry, fuel entry and hire bill hangs off it.
 * `under_maintenance` is not in the status list at all: the backend refuses it
 * (006 FR-002), and offering an option that always fails is worse than not offering
 * it. The hint under the field says so rather than leaving it a mystery.
 *
 * Since 2026-10-15 it is the client's vehicle registration form: the fields sit in the sections
 * their paper form has — identity, ownership, meter and service, the six registration papers,
 * remarks — so a long form reads as five short ones.
 */
export default function EquipmentModal({
  equipment,
  onClose,
}: {
  equipment?: Equipment;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const categories = usePlantCategories();
  const vendors = usePlantVendors();
  const sites = usePlantSites();
  const docTypes = usePlantDocTypes();
  // Set once a new machine is saved (2026-10-15). If a paper's file then fails to upload, the
  // form stays open, and saving again must update that machine rather than register a second.
  const [savedId, setSavedId] = useState<string | null>(null);
  const isEdit = equipment !== undefined;

  const [manufacturingYear, setManufacturingYear] = useState(
    equipment?.manufacturingYear?.toString() ?? '',
  );
  const [name, setName] = useState(equipment?.name ?? '');
  const [categoryId, setCategoryId] = useState(equipment?.categoryId ?? '');
  const [make, setMake] = useState(equipment?.make ?? '');
  const [model, setModel] = useState(equipment?.model ?? '');
  const [registrationNo, setRegistrationNo] = useState(
    equipment?.registrationNo ?? '',
  );
  const [engineNo, setEngineNo] = useState(equipment?.engineNo ?? '');
  const [chassisNo, setChassisNo] = useState(equipment?.chassisNo ?? '');
  const [ownership, setOwnership] = useState<string>(
    equipment?.ownership ?? 'owned',
  );
  const [vendorId, setVendorId] = useState(equipment?.vendorId ?? '');
  const [supplierName, setSupplierName] = useState(
    equipment?.supplierName ?? '',
  );
  const [registeredOwner, setRegisteredOwner] = useState(
    equipment?.registeredOwner ?? '',
  );
  const [operatorName, setOperatorName] = useState(
    equipment?.operatorName ?? '',
  );
  const [powerSource, setPowerSource] = useState<string>(
    equipment?.powerSource ?? 'diesel',
  );
  const [purchaseDate, setPurchaseDate] = useState(
    equipment?.purchaseDate?.slice(0, 10) ?? '',
  );
  const [purchaseCost, setPurchaseCost] = useState(
    equipment?.purchaseCost?.toString() ?? '',
  );
  const [depreciationRate, setDepreciationRate] = useState(
    equipment?.depreciationRate?.toString() ?? '',
  );
  const [deployedSiteId, setDeployedSiteId] = useState(
    equipment?.deployedSiteId ?? '',
  );
  const [currentReading, setCurrentReading] = useState('');
  const [lastServiceDate, setLastServiceDate] = useState(
    equipment?.lastServiceDate?.slice(0, 10) ?? '',
  );
  const [serviceInterval, setServiceInterval] = useState('');
  const [papers, setPapers] = useState<Record<RegistrationKind, PaperDraft>>(
    () => papersOf(equipment),
  );
  // The scan for each paper, uploaded under its document type once the machine is saved.
  const [files, setFiles] = useState<Partial<Record<RegistrationKind, File>>>(
    {},
  );
  const [remarks, setRemarks] = useState(equipment?.remarks ?? '');
  const [status, setStatus] = useState<string>(
    equipment?.status === 'under_maintenance'
      ? 'active'
      : (equipment?.status ?? 'active'),
  );
  const [error, setError] = useState<string | null>(null);

  const isHired = ownership === 'hired';
  const isOwned = ownership === 'owned';
  const underMaintenance = equipment?.status === 'under_maintenance';
  // The service interval's unit follows the category's meter, as the API reads it (2026-10-15).
  const meterUnit =
    (categories.data ?? []).find((category) => category.id === categoryId)
      ?.meterType === 'km'
      ? 'km'
      : 'hours';
  // A paper already on record can be changed but not un-recorded: leaving a kind out of the
  // save keeps it, so "Not recorded" is offered only for a paper never recorded (2026-10-15).
  const recordedKinds = new Set(
    (equipment?.registration ?? []).map((paper) => paper.kind),
  );
  // Papers whose scan is already uploaded — the register's "Doc" column.
  const recordedDocs = new Set(
    (equipment?.registration ?? [])
      .filter((paper) => paper.hasDocument)
      .map((paper) => paper.kind),
  );

  // The code this machine will be given, from the server's own builder (2026-10-15).
  const previewName = useDeferredValue(name.trim());
  const previewYear = useDeferredValue(
    /^\d{4}$/.test(manufacturingYear)
      ? Number(manufacturingYear)
      : purchaseDate
        ? Number(purchaseDate.slice(0, 4))
        : undefined,
  );
  const nextCode = useQuery({
    queryKey: ['plant', 'next-code', previewName, previewYear],
    queryFn: () => getNextEquipmentCode(previewName, previewYear),
    enabled: !isEdit && previewName.length > 0,
  });

  const save = useMutation({
    mutationFn: async (input: EquipmentInput) => {
      const targetId = equipment?.id ?? savedId;
      const saved = targetId
        ? await updateEquipment(targetId, input)
        : await createEquipment(input, companyId ?? undefined);
      setSavedId(saved.id);
      // Each attached paper goes up under its own document type, with the expiry typed in its
      // row, so the register's "Doc" column and the expiry agree (2026-10-15).
      const failed: string[] = [];
      for (const kind of REGISTRATION_KINDS) {
        const file = files[kind];
        if (!file) continue;
        const docType = docTypeForPaper(kind, docTypes.data ?? []);
        const paper = papers[kind];
        try {
          if (!docType) throw new Error('no document type');
          await uploadEquipmentDocument(saved.id, {
            docTypeId: docType.id,
            file: await toBase64(file),
            fileName: file.name,
            contentType: file.type || undefined,
            ...(paper.status === 'held' && paper.expiresAt
              ? { expiresAt: paper.expiresAt }
              : {}),
          });
          setFiles((current) => ({ ...current, [kind]: undefined }));
        } catch {
          failed.push(REGISTRATION_KIND_LABELS[kind]);
        }
      }
      return failed;
    },
    onSuccess: (failed) => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      if (failed.length > 0) {
        setError(
          `The machine is saved, but ${failed.join(', ')} could not be attached. ` +
            'Check the file (a PDF or image under 10 MB) and save again, or attach it from ' +
            'the machine’s page.',
        );
        return;
      }
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed,
      ),
  });

  function setPaper(kind: RegistrationKind, patch: Partial<PaperDraft>) {
    setPapers((current) => ({
      ...current,
      [kind]: { ...current[kind], ...patch },
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    // On edit the text details are always sent, so emptying one clears it; on create a blank
    // is simply left out (2026-10-15).
    const text = (value: string) =>
      isEdit ? value.trim() : value.trim() || undefined;
    const registration: RegistrationPaperInput[] = REGISTRATION_KINDS.flatMap(
      (kind) => {
        const paper = papers[kind];
        if (paper.status === '') return [];
        return [
          {
            kind,
            status: paper.status,
            ...(paper.status === 'held' && paper.expiresAt
              ? { expiresAt: paper.expiresAt }
              : {}),
            ...(paper.number.trim() ? { number: paper.number.trim() } : {}),
          },
        ];
      },
    );
    save.mutate({
      ...(/^\d{4}$/.test(manufacturingYear)
        ? { manufacturingYear: Number(manufacturingYear) }
        : {}),
      name: name.trim(),
      categoryId,
      ownership,
      ...(!isOwned && vendorId ? { vendorId } : {}),
      powerSource,
      ...(purchaseDate ? { purchaseDate } : {}),
      ...(isOwned && purchaseCost
        ? { purchaseCost: Number(purchaseCost) }
        : {}),
      ...(isOwned && depreciationRate
        ? { depreciationRate: Number(depreciationRate) }
        : {}),
      ...(deployedSiteId ? { deployedSiteId } : {}),
      ...(!isEdit && currentReading
        ? { currentReading: Number(currentReading) }
        : {}),
      make: text(make),
      model: text(model),
      registrationNo: text(registrationNo),
      engineNo: text(engineNo),
      chassisNo: text(chassisNo),
      supplierName: text(supplierName),
      registeredOwner: text(registeredOwner),
      operatorName: text(operatorName),
      remarks: text(remarks),
      ...(lastServiceDate ? { lastServiceDate } : {}),
      ...(registration.length > 0 ? { registration } : {}),
      ...(!isEdit && serviceInterval
        ? { serviceInterval: Number(serviceInterval) }
        : {}),
      ...(isEdit && !underMaintenance ? { status } : {}),
    });
  }

  const noCategories = categories.data?.length === 0;

  return (
    <Modal
      title={isEdit ? `Edit ${equipment.code}` : 'Register a machine'}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="equipment-form"
            disabled={save.isPending || noCategories}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="equipment-form"
        onSubmit={submit}
        className="flex flex-col gap-6"
      >
        <FormError message={error} />
        {noCategories && <FormError message={MESSAGES.plantNoCategories} />}

        <Section title="Identity">
          {/* Never typed (2026-10-15): built from the name and the manufacturing year in the
              company's format from Settings → Numbering — `JCB01/2027`. */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Code
            </span>
            <p className="flex min-h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900">
              {isEdit
                ? equipment.code
                : (nextCode.data ?? (name.trim() ? '…' : 'Enter the name'))}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {isEdit
                ? 'Given when the machine was registered; it does not change.'
                : 'Assigned automatically: letters from the name, a serial, the manufacturing year.'}
            </p>
          </div>

          <TextField
            id="equipment-name"
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <SelectField
            id="equipment-category"
            label="Category"
            required
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Select a category</option>
            <CategoryOptions categories={categories.data ?? []} />
          </SelectField>

          <TextField
            id="equipment-year"
            label="Manufacturing year"
            inputMode="numeric"
            maxLength={4}
            value={manufacturingYear}
            onChange={(event) =>
              setManufacturingYear(event.target.value.replace(/\D/g, ''))
            }
            placeholder={String(new Date().getFullYear())}
            hint={
              isEdit
                ? undefined
                : 'The last part of the code. Blank uses the purchase year, else this year.'
            }
          />

          <TextField
            id="equipment-make"
            label="Make / brand"
            value={make}
            onChange={(event) => setMake(event.target.value)}
            placeholder="JCB, TATA, Ashok Leyland"
          />
          <TextField
            id="equipment-model"
            label="Model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="JCB3DX, CP30, EXC140, 125 KVA DG"
          />
          <TextField
            id="equipment-registration-no"
            label="Registration / vehicle no."
            value={registrationNo}
            onChange={(event) => setRegistrationNo(event.target.value)}
            placeholder="RJ26-SD-6986"
            hint="Or the serial number, for a machine that is not registered."
          />
          <TextField
            id="equipment-engine-no"
            label="Engine no."
            value={engineNo}
            onChange={(event) => setEngineNo(event.target.value)}
          />
          <TextField
            id="equipment-chassis-no"
            label="Chassis no."
            value={chassisNo}
            onChange={(event) => setChassisNo(event.target.value)}
          />
        </Section>

        <Section title="Ownership & deployment">
          <SelectField
            id="equipment-ownership"
            label="Ownership"
            required
            value={ownership}
            onChange={(event) => {
              setOwnership(event.target.value);
              // Clearing here rather than in an effect: a machine changed from
              // hired to owned keeping a vendor would raise hire bills against a
              // machine nobody rents.
              if (event.target.value === 'owned') setVendorId('');
            }}
          >
            {PLANT_OWNERSHIPS.map((value) => (
              <option key={value} value={value}>
                {plantLabel(value)}
              </option>
            ))}
          </SelectField>

          {!isOwned && (
            <SelectField
              id="equipment-vendor"
              label={isHired ? 'Hire vendor' : 'Lessor'}
              required={isHired}
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
            >
              <option value="">
                {isHired ? 'Select a vendor' : 'Not recorded'}
              </option>
              {(vendors.data ?? []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </SelectField>
          )}

          <TextField
            id="equipment-supplier"
            label="Supplier name"
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            hint="Who sold or supplied it."
          />
          <TextField
            id="equipment-firm"
            label="Firm (registered owner)"
            value={registeredOwner}
            onChange={(event) => setRegisteredOwner(event.target.value)}
            hint="Whose name the RC stands in."
          />

          <SelectField
            id="equipment-site"
            label="Deployed at"
            value={deployedSiteId}
            onChange={(event) => setDeployedSiteId(event.target.value)}
          >
            <option value="">Not deployed</option>
            {(sites.data ?? []).map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </SelectField>
          <TextField
            id="equipment-operator"
            label="Operator / in-charge"
            value={operatorName}
            onChange={(event) => setOperatorName(event.target.value)}
          />

          <SelectField
            id="equipment-power"
            label="Power source"
            required
            value={powerSource}
            onChange={(event) => setPowerSource(event.target.value)}
          >
            {POWER_SOURCES.map((value) => (
              <option key={value} value={value}>
                {plantLabel(value)}
              </option>
            ))}
          </SelectField>
          <TextField
            id="equipment-purchase-date"
            label={isOwned ? 'Purchase date' : 'Hire date'}
            type="date"
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
          />

          {isOwned && (
            <>
              <TextField
                id="equipment-purchase-cost"
                label="Purchase cost (₹)"
                type="number"
                min={0}
                step="0.01"
                value={purchaseCost}
                onChange={(event) => setPurchaseCost(event.target.value)}
              />
              <TextField
                id="equipment-depreciation"
                label="Depreciation rate (% p.a.)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={depreciationRate}
                onChange={(event) => setDepreciationRate(event.target.value)}
                hint="Straight-line. Feeds the machinery cost a project reports."
              />
            </>
          )}
        </Section>

        <Section title="Meter & service">
          {!isEdit && (
            <TextField
              id="equipment-reading"
              label="Opening meter reading"
              type="number"
              min={0}
              step="0.001"
              value={currentReading}
              onChange={(event) => setCurrentReading(event.target.value)}
              hint="Where the meter stands today. Defaults to 0."
            />
          )}
          <TextField
            id="equipment-last-service"
            label="Last service date"
            type="date"
            value={lastServiceDate}
            onChange={(event) => setLastServiceDate(event.target.value)}
          />
          {/* Create only (2026-10-15): afterwards a machine's schedules are kept under
              Services, where there may be several. */}
          {!isEdit && (
            <TextField
              id="equipment-service-interval"
              label={`Service every (${meterUnit})`}
              type="number"
              min={1}
              step="1"
              value={serviceInterval}
              onChange={(event) => setServiceInterval(event.target.value)}
              hint={`A periodic service every this many ${meterUnit}, from the opening reading. Blank sets none.`}
            />
          )}
        </Section>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 w-full border-b border-gray-200 pb-1 text-sm font-semibold text-gray-900">
            Registration papers
          </legend>
          <div
            aria-hidden="true"
            className="hidden gap-3 text-xs font-medium uppercase tracking-wide text-gray-500 sm:grid sm:grid-cols-[6rem_repeat(3,minmax(0,1fr))_8rem]"
          >
            <span>Paper</span>
            <span>Status</span>
            <span>Expires</span>
            <span>Number</span>
            <span>Document</span>
          </div>
          {REGISTRATION_KINDS.map((kind) => {
            const paper = papers[kind];
            const label = REGISTRATION_KIND_LABELS[kind];
            return (
              <div
                key={kind}
                className="grid grid-cols-2 items-center gap-2 border-b border-gray-100 pb-3 last:border-b-0 sm:grid-cols-[6rem_repeat(3,minmax(0,1fr))_8rem] sm:gap-3 sm:border-b-0 sm:pb-0"
              >
                <span className="col-span-2 text-sm font-medium text-gray-700 sm:col-span-1">
                  {label}
                </span>
                <select
                  aria-label={`${label} status`}
                  className={`${selectClass} col-span-2 sm:col-span-1`}
                  value={paper.status}
                  onChange={(event) =>
                    setPaper(kind, {
                      status: event.target.value as PaperDraft['status'],
                    })
                  }
                >
                  {!recordedKinds.has(kind) && (
                    <option value="">Not recorded</option>
                  )}
                  {REGISTRATION_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value === 'not_applicable'
                        ? 'Not applicable'
                        : REGISTRATION_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
                {/* Only a held paper lapses; N/A and life-time ones have no date. */}
                <input
                  type="date"
                  aria-label={`${label} expiry date`}
                  className={`${fieldClass} disabled:bg-gray-50 disabled:text-gray-400`}
                  disabled={paper.status !== 'held'}
                  value={paper.status === 'held' ? paper.expiresAt : ''}
                  onChange={(event) =>
                    setPaper(kind, { expiresAt: event.target.value })
                  }
                />
                <input
                  type="text"
                  aria-label={`${label} number`}
                  placeholder="Number"
                  maxLength={60}
                  className={`${fieldClass} disabled:bg-gray-50`}
                  disabled={paper.status === ''}
                  value={paper.number}
                  onChange={(event) =>
                    setPaper(kind, { number: event.target.value })
                  }
                />
                <PaperFile
                  label={label}
                  file={files[kind]}
                  onFile={(file) =>
                    setFiles((current) => ({ ...current, [kind]: file }))
                  }
                  onRecord={recordedDocs.has(kind)}
                />
              </div>
            );
          })}
          <p className="text-xs text-gray-500">
            Attach the scanned paper on its row; it is uploaded when you save,
            with the expiry above. Attached papers are listed, opened and
            removed on the machine&apos;s page, under Documents.
          </p>
        </fieldset>

        <div>
          <label
            htmlFor="equipment-remarks"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Remarks
          </label>
          <textarea
            id="equipment-remarks"
            rows={2}
            className={fieldClass}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Where it is, who has it"
          />
        </div>

        {isEdit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="equipment-status"
              label="Status"
              value={underMaintenance ? 'under_maintenance' : status}
              disabled={underMaintenance}
              onChange={(event) => setStatus(event.target.value)}
              hint={
                underMaintenance
                  ? 'Close the open maintenance job to return this machine to service.'
                  : MESSAGES.plantStatusLocked
              }
            >
              {underMaintenance ? (
                <option value="under_maintenance">Under Maintenance</option>
              ) : (
                SETTABLE_EQUIPMENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {plantLabel(value)}
                  </option>
                ))
              )}
            </SelectField>
          </div>
        )}
      </form>
    </Modal>
  );
}

/** One registration paper as the form holds it; `''` is "Not recorded". */
interface PaperDraft {
  status: RegistrationPaperInput['status'] | '';
  expiresAt: string;
  number: string;
}

function papersOf(
  equipment: Equipment | undefined,
): Record<RegistrationKind, PaperDraft> {
  const byKind = new Map(
    (equipment?.registration ?? []).map((paper) => [paper.kind, paper]),
  );
  return Object.fromEntries(
    REGISTRATION_KINDS.map((kind) => {
      const paper = byKind.get(kind);
      return [
        kind,
        {
          status: paper?.status ?? '',
          expiresAt: paper?.expiresAt?.slice(0, 10) ?? '',
          number: paper?.number ?? '',
        },
      ];
    }),
  ) as Record<RegistrationKind, PaperDraft>;
}

/** A titled block of the form, two columns from `sm` up. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 w-full border-b border-gray-200 pb-1 text-sm font-semibold text-gray-900">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * The words that find a paper's document type among the company's own (2026-10-15) — the same
 * matching the API uses for the register's "Doc" column, so a file attached here is the one that
 * column then reports.
 */
const PAPER_DOC_WORDS: Record<RegistrationKind, string[]> = {
  rc: ['REGISTRATION', 'RC'],
  insurance: ['INSURANCE'],
  fitness: ['FITNESS'],
  road_tax: ['ROAD TAX', 'TAX'],
  permit: ['PERMIT'],
  pollution: ['POLLUTION', 'PUC'],
};

function docTypeForPaper(
  kind: RegistrationKind,
  docTypes: EquipmentDocType[],
): EquipmentDocType | undefined {
  return docTypes.find((docType) => {
    const upper = docType.name.toUpperCase();
    const words = upper.split(/[^A-Z]+/).filter(Boolean);
    return PAPER_DOC_WORDS[kind].some((word) =>
      word.includes(' ') ? upper.includes(word) : words.includes(word),
    );
  });
}

/** Ten megabytes — the API's ceiling for an equipment document. */
const MAX_PAPER_BYTES = 10 * 1024 * 1024;

/** A paper row's file: "Attach", the chosen file's name with a way to drop it, or "On file". */
function PaperFile({
  label,
  file,
  onFile,
  onRecord,
}: {
  label: string;
  file: File | undefined;
  onFile: (file: File | undefined) => void;
  onRecord: boolean;
}) {
  const [tooBig, setTooBig] = useState(false);
  if (file) {
    return (
      <div className="flex min-w-0 items-center gap-1 text-xs">
        <span className="truncate text-gray-800" title={file.name}>
          {file.name}
        </span>
        <button
          type="button"
          aria-label={`Remove the ${label} file`}
          className="shrink-0 rounded px-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          onClick={() => onFile(undefined)}
        >
          ×
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <label className="inline-flex w-fit cursor-pointer items-center rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-within:outline focus-within:outline-2 focus-within:outline-blue-500">
        Attach
        <input
          type="file"
          accept="application/pdf,image/*"
          aria-label={`Attach the ${label} scan`}
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = '';
            if (!chosen) return;
            const big = chosen.size > MAX_PAPER_BYTES;
            setTooBig(big);
            if (!big) onFile(chosen);
          }}
        />
      </label>
      {tooBig ? (
        <span className="mt-0.5 text-xs text-red-700">Over 10 MB</span>
      ) : (
        onRecord && (
          <span className="mt-0.5 text-xs text-green-700">On file</span>
        )
      )}
    </div>
  );
}
