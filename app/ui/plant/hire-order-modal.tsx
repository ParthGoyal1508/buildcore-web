'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createHireOrder,
  updateHireOrder,
  type HireOrder,
  type HireOrderInput,
} from '@/app/lib/api/plant-hire';
import { getProjects } from '@/app/lib/api/projects';
import { MESSAGES } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import {
  usePlantCompanyId,
  usePlantEquipment,
  usePlantVendors,
} from './use-plant-refs';
import VendorOptions from './vendor-options';
import { todayIso } from '@/app/lib/format';

interface LineDraft {
  key: number;
  title: string;
  description: string;
  sacCode: string;
  taxRate: string;
  quantity: string;
  uom: string;
  rate: string;
  equipmentId: string;
}

let nextKey = 1;

function blankLine(): LineDraft {
  return {
    key: nextKey++,
    title: '',
    description: '',
    sacCode: '',
    taxRate: '18',
    quantity: '',
    uom: 'MON',
    rate: '',
    equipmentId: '',
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Raise or edit a vehicle work/hire order in the client's WORK/HIRE ORDER format (2026-10-15).
 *
 * The form follows the document's order: the head (Ref No., Date, Supplier, Project, Point of
 * Delivery), then PART-A's lines. Each line is the format's two-row pair — a heading such as
 * "Hiring of Bolero Camper ZX for Toll plaza" over its service line "LMV hire services-Months" —
 * with SAC, GST, quantity, unit and rate beside it. These are the yellow, per-document parts;
 * PART-C's general terms are fixed and printed by the server, so they are not editable here.
 *
 * The order number is the work-order series' next value and is only known once saved, so a new
 * order shows none and an edit shows it read-only. Amounts and totals are a preview of the
 * server's arithmetic, never sent.
 */
export default function HireOrderModal({
  order,
  onClose,
}: {
  order: HireOrder | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const vendors = usePlantVendors();
  const equipment = usePlantEquipment();
  const projects = useQuery({
    queryKey: ['plant', 'projects'],
    queryFn: () => getProjects({ pageSize: 200 }),
    select: (page) => page.items,
  });

  const [date, setDate] = useState(
    order?.date.slice(0, 10) ?? todayIso(),
  );
  const [referenceNo, setReferenceNo] = useState(order?.referenceNo ?? '');
  const [vendorId, setVendorId] = useState(order?.vendorId ?? '');
  const [projectId, setProjectId] = useState(order?.projectId ?? '');
  const [pointOfDelivery, setPointOfDelivery] = useState(
    order?.pointOfDelivery ?? '',
  );
  const [remarks, setRemarks] = useState(order?.remarks ?? '');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    order && order.lines.length > 0
      ? order.lines.map((line) => ({
          key: nextKey++,
          title: line.title,
          description: line.description,
          sacCode: line.sacCode ?? '',
          taxRate: String(line.taxRate),
          quantity: String(line.quantity),
          uom: line.uom,
          rate: String(line.rate),
          equipmentId: line.equipmentId ?? '',
        }))
      : [blankLine()],
  );
  const [error, setError] = useState<string | null>(null);

  const patchLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const amountOf = (line: LineDraft) =>
    line.quantity !== '' && line.rate !== ''
      ? round2(Number(line.quantity) * Number(line.rate))
      : 0;
  const taxable = round2(lines.reduce((sum, l) => sum + amountOf(l), 0));
  const tax = round2(
    lines.reduce(
      (sum, l) => sum + (amountOf(l) * Number(l.taxRate || 0)) / 100,
      0,
    ),
  );

  const save = useMutation({
    mutationFn: () => {
      const input: HireOrderInput = {
        date,
        vendorId,
        referenceNo: referenceNo.trim(),
        pointOfDelivery: pointOfDelivery.trim(),
        remarks: remarks.trim(),
        // `''` on an edit clears a project the order used to name; on a create it is simply
        // left out, as the server would read it the same way.
        ...(projectId || order ? { projectId } : {}),
        lines: lines.map((l) => ({
          title: l.title.trim(),
          description: l.description.trim(),
          ...(l.sacCode.trim() ? { sacCode: l.sacCode.trim() } : {}),
          ...(l.taxRate !== '' ? { taxRate: Number(l.taxRate) } : {}),
          quantity: Number(l.quantity),
          uom: l.uom.trim(),
          rate: Number(l.rate),
          ...(l.equipmentId ? { equipmentId: l.equipmentId } : {}),
        })),
      };
      return order
        ? updateHireOrder(order.id, input)
        : createHireOrder(input, companyId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['plant', 'hire-orders'],
      });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed,
      ),
  });

  return (
    <Modal
      title={order ? `Work order ${order.code}` : 'New work order'}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="hire-order-form"
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="hire-order-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="ho-code"
            label="Order No."
            value={order?.code ?? ''}
            placeholder="Assigned on save"
            readOnly
            disabled
            hint="From the work-order series in Settings → Numbering."
          />
          <TextField
            id="ho-ref"
            label="Ref No."
            maxLength={60}
            value={referenceNo}
            onChange={(event) => setReferenceNo(event.target.value)}
          />
          <TextField
            id="ho-date"
            label="Date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="ho-vendor"
            label="Supplier"
            required
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
          >
            <option value="">Select the supplier</option>
            <VendorOptions vendors={vendors.data ?? []} />
          </SelectField>
          <SelectField
            id="ho-project"
            label="Project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {(projects.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectField>
        </div>

        <TextField
          id="ho-delivery"
          label="Point of Delivery"
          maxLength={300}
          value={pointOfDelivery}
          onChange={(event) => setPointOfDelivery(event.target.value)}
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold text-gray-900">
            PART-A — Schedule of items
          </legend>
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Item {index + 1}
                </span>
                {lines.length > 1 && (
                  <RowAction
                    type="button"
                    onClick={() =>
                      setLines((rows) => rows.filter((r) => r.key !== line.key))
                    }
                  >
                    Remove
                  </RowAction>
                )}
              </div>
              <TextField
                id={`ho-title-${line.key}`}
                label="Heading"
                required
                maxLength={200}
                placeholder="Hiring of Bolero Camper ZX for Toll plaza"
                value={line.title}
                onChange={(event) =>
                  patchLine(line.key, { title: event.target.value })
                }
              />
              <TextField
                id={`ho-desc-${line.key}`}
                label="Service line"
                required
                maxLength={200}
                placeholder="LMV hire services-Months"
                value={line.description}
                onChange={(event) =>
                  patchLine(line.key, { description: event.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <TextField
                  id={`ho-sac-${line.key}`}
                  label="SAC code"
                  maxLength={12}
                  placeholder="9966"
                  value={line.sacCode}
                  onChange={(event) =>
                    patchLine(line.key, { sacCode: event.target.value })
                  }
                />
                <TextField
                  id={`ho-tax-${line.key}`}
                  label="GST %"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={line.taxRate}
                  onChange={(event) =>
                    patchLine(line.key, { taxRate: event.target.value })
                  }
                />
                <TextField
                  id={`ho-qty-${line.key}`}
                  label="Quantity"
                  type="number"
                  required
                  min={0}
                  step="0.001"
                  value={line.quantity}
                  onChange={(event) =>
                    patchLine(line.key, { quantity: event.target.value })
                  }
                />
                <TextField
                  id={`ho-uom-${line.key}`}
                  label="UOM"
                  required
                  maxLength={12}
                  list="ho-uoms"
                  value={line.uom}
                  onChange={(event) =>
                    patchLine(line.key, { uom: event.target.value })
                  }
                />
                <TextField
                  id={`ho-rate-${line.key}`}
                  label="Unit rate (₹)"
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  value={line.rate}
                  onChange={(event) =>
                    patchLine(line.key, { rate: event.target.value })
                  }
                />
                <div>
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Amount
                  </span>
                  <p className="min-h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                    {formatRupees(amountOf(line))}
                  </p>
                </div>
              </div>
              <SelectField
                id={`ho-machine-${line.key}`}
                label="Machine (optional)"
                value={line.equipmentId}
                onChange={(event) =>
                  patchLine(line.key, { equipmentId: event.target.value })
                }
              >
                <option value="">Not linked to a registered machine</option>
                {(equipment.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} · {row.name}
                  </option>
                ))}
              </SelectField>
            </div>
          ))}
          <datalist id="ho-uoms">
            {['MON', 'DAY', 'HRS', 'KM', 'TRIP', 'NOS'].map((uom) => (
              <option key={uom} value={uom} />
            ))}
          </datalist>
          {lines.length < 50 && (
            <div>
              <SecondaryButton
                type="button"
                onClick={() => setLines((rows) => [...rows, blankLine()])}
              >
                Add an item
              </SecondaryButton>
            </div>
          )}
        </fieldset>

        <dl className="grid grid-cols-3 gap-3 rounded-md border border-gray-200 p-3 text-sm">
          <div>
            <dt className="text-gray-500">Taxable</dt>
            <dd className="font-medium text-gray-900">
              {formatRupees(taxable)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">GST</dt>
            <dd className="font-medium text-gray-900">{formatRupees(tax)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Total</dt>
            <dd className="font-semibold text-gray-900">
              {formatRupees(round2(taxable + tax))}
            </dd>
          </div>
        </dl>

        <TextField
          id="ho-remarks"
          label="Remarks"
          maxLength={1000}
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />

        <p className="text-xs text-gray-500">
          The general terms and conditions (PART-C) are fixed and printed on the
          document as they stand; they are not edited per order.
        </p>
      </form>
    </Modal>
  );
}
