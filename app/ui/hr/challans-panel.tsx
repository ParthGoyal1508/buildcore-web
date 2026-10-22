'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { exportChallan, getChallan, saveBlob } from '@/app/lib/api/hr-payroll';
import { CHALLAN_TYPES, MESSAGES, hrLabel, type ChallanType } from '@/app/lib/constants';
import { currentPeriod, money, periodLabel } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { branchOptionText, listBranchOptions } from '@/app/lib/api/company-branches';

type Row = Record<string, unknown>;

/** A cell value that may be a number, a decimal string, or anything else. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return money(value);
  if (typeof value === 'string') {
    const asNumber = Number(value);
    // A numeric string is a Decimal off the wire; format it as money rather than
    // printing "1234.50" next to a column of "1,234.50".
    if (value.trim() !== '' && !Number.isNaN(asNumber) && /[\d.]/.test(value)) {
      return money(asNumber);
    }
    return value;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/**
 * A statutory challan for one period.
 *
 * Columns are derived from the response rather than hardcoded: the four challan
 * types have genuinely different shapes (PF carries EPS/EDLI/admin splits, PT
 * carries slab bands), and four hand-written column sets would drift from the
 * backend one filing season at a time. The keys the API returns *are* the
 * contract here.
 */
function ChallanView({
  type,
  period,
  branchId,
}: {
  type: ChallanType;
  period: string;
  /** 041: one establishment; blank → the whole company. */
  branchId: string;
}) {
  const [exportError, setExportError] = useState<string | null>(null);

  const download = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await exportChallan(type, period, branchId || undefined);
      saveBlob(blob, filename);
    },
    onError: (err: Error) => setExportError(err.message),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['hr', 'challan', type, period, branchId],
    queryFn: () => getChallan(type, period, branchId || undefined),
    enabled: period.length > 0,
    // A 404 here means "no payroll run for that period", which is a normal state
    // for any month not yet run — retrying it four times just delays the answer.
    retry: (count, err) =>
      err instanceof ApiError && err.status === 404 ? false : count < 2,
  });

  /**
   * The backend answers 404 for a period with no payroll run, and 400 while that
   * run is still a draft. Neither is a failure — both are the accurate answer to
   * "show me this month's challan", and rendering them as "could not load" tells
   * the user something is broken when nothing is. Only a genuinely unexpected
   * status gets the red treatment.
   */
  const expected =
    error instanceof ApiError && (error.status === 404 || error.status === 400)
      ? error.message
      : null;

  const rows = (data?.rows ?? data?.items ?? []) as Row[];
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];

  const columns: Column<Row>[] = keys.map((key, index) => ({
    key,
    header: hrLabel(key.replace(/([a-z])([A-Z])/g, '$1 $2')),
    sticky: index === 0,
    numeric: typeof rows[0][key] === 'number',
    // A UAN or ESIC number is all digits, and `cell` would print it as rupees.
    render: (row) =>
      key === 'statutoryNumber' ? String(row[key] ?? '—') : cell(row[key]),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <SecondaryButton
          type="button"
          onClick={() => download.mutate()}
          disabled={rows.length === 0 || download.isPending}
        >
          {download.isPending ? 'Preparing…' : `Export ${hrLabel(type)}`}
        </SecondaryButton>
      </div>
      <FormError message={exportError} />
      {data?.branch && (
        <p className="text-sm text-gray-700">
          {data.branch.label}
          {data.branch.establishmentCode && (
            <>
              {' — '}
              <span className="font-mono">{data.branch.establishmentCode}</span>
            </>
          )}
        </p>
      )}
      {data?.warnings?.map((warning) => (
        <p key={warning} role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warning}
        </p>
      ))}
      {expected ? (
        <p className="rounded-lg bg-brand-50 px-4 py-6 text-sm text-brand-800">
          {expected}
        </p>
      ) : (
        <DataTable
          caption={`${hrLabel(type)} challan`}
          columns={columns}
          rows={rows}
          rowKey={(row) =>
            String(row.employeeId ?? row.employeeCode ?? JSON.stringify(row))
          }
          isLoading={isLoading}
          error={isError ? MESSAGES.loadFailed : null}
          emptyMessage={`No ${hrLabel(type)} contributions for ${periodLabel(period)}.`}
        />
      )}
      {data?.totals && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-gray-50 p-3 text-sm">
          {Object.entries(data.totals).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="text-gray-600">
                {hrLabel(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}
              </dt>
              <dd className="font-medium tabular-nums">{cell(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function ChallansPanel() {
  const [type, setType] = useState<ChallanType>('pf');
  const [period, setPeriod] = useState(currentPeriod());
  const [branchId, setBranchId] = useState('');
  // 041: each GST registration is its own PF / ESIC / PT establishment, filed separately. Inactive
  // branches are listed too: last year's challan for a closed site is still filed.
  const { data: branches } = useQuery({
    queryKey: ['company-branches', 'options', 'all'],
    queryFn: () => listBranchOptions(null, true),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-full max-w-xs">
          <TextField
            id="challan-period"
            label="Period"
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          />
        </div>
        {(branches?.length ?? 0) > 1 && (
          <div className="w-full max-w-sm">
            <SelectField
              id="challan-branch"
              label="Establishment"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">All branches (whole company)</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {branchOptionText(b)}
                  {b.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </div>

      <TabStrip
        tabs={CHALLAN_TYPES.map((value) => ({ id: value, label: hrLabel(value) }))}
        active={type}
        onChange={setType}
        idPrefix="challan"
      />

      {CHALLAN_TYPES.map((value) => (
        <TabPanel key={value} id={value} idPrefix="challan" active={type}>
          <ChallanView type={value} period={period} branchId={branchId} />
        </TabPanel>
      ))}
    </div>
  );
}
