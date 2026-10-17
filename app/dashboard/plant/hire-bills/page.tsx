'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  downloadHireBillsExport,
  getEquipmentDetail,
  verifyHireBill,
} from '@/app/lib/api/plant';
import {
  downloadHireBill,
  getHireBillsFull,
  type HireBillFull,
} from '@/app/lib/api/plant-hire';
import { getCurrentUser } from '@/app/lib/api/users';
import { HIRE_BILL_STATUSES, MESSAGES, plantLabel } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel, quantity3, rupees } from '@/app/lib/format';
import { urlNumber, urlString, useUrlState } from '@/app/lib/use-url-state';
import { confirmDialog } from '@/app/ui/dialogs';
import Pager from '@/app/ui/inventory/pager';
import PageHeader from '@/app/ui/page-header';
import DocumentDownloads from '@/app/ui/plant/document-downloads';
import HireBillModal, {
  HireBillCorrectionModal,
} from '@/app/ui/plant/hire-bill-modal';
import PayHireBillModal from '@/app/ui/plant/pay-hire-bill-modal';
import {
  EquipmentPicker,
  VendorPicker,
  equipmentOption,
} from '@/app/ui/plant/pickers';
import { usePlantCompanyId } from '@/app/ui/plant/use-plant-refs';
import {
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import { useToast } from '@/app/ui/toast';

/** `+12.5 h`, `−3 km` — a variance with its sign and unit (036 K9). */
function signed(value: number, unit: string): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${quantity3(Math.abs(value))} ${unit}`;
}
const unitOf = (bill: HireBillFull) => (bill.meterType === 'km' ? 'km' : 'h');

/**
 * Hire bills.
 *
 * 036: filters (machine, vendor, status and, new, the billing period) live in the URL; machine and
 * vendor are server-searched pickers; the filtered list downloads as Excel (K9); figures carry
 * their units; Verify is hidden from the bill's own creator, whom the API refuses (K8); Pay asks
 * for the payment date as well as the reference.
 */
export default function HireBillsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filters, setFilters, query] = useUrlState(
    {
      equipmentId: urlString(),
      vendorId: urlString(),
      status: urlString(),
      periodFrom: urlString(),
      periodTo: urlString(),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );
  const [showModal, setShowModal] = useState(false);
  const [correcting, setCorrecting] = useState<HireBillFull | null>(null);
  const [paying, setPaying] = useState<HireBillFull | null>(null);
  const [exporting, setExporting] = useState(false);

  const companyId = usePlantCompanyId();
  const me = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  const filterQuery = {
    ...(companyId ? { companyId } : {}),
    ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.periodFrom ? { periodFrom: query.periodFrom } : {}),
    ...(query.periodTo ? { periodTo: query.periodTo } : {}),
  };
  const listQuery = { ...filterQuery, page: query.page };

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['plant', 'hire-bills', listQuery],
    // The fuller row (2026-10-15): basis, readings, deduction and hold for the client's
    // VEHICLE HIRING BILL, read from the same list endpoint.
    queryFn: () => getHireBillsFull(listQuery),
    placeholderData: keepPreviousData,
  });

  const machine = useQuery({
    queryKey: ['plant', 'equipment', query.equipmentId],
    queryFn: () => getEquipmentDetail(query.equipmentId),
    enabled: Boolean(query.equipmentId),
  });

  const verify = useMutation({
    mutationFn: (id: string) => verifyHireBill(id),
    onSuccess: (bill) => {
      toast.success(`${bill.equipmentCode}: bill verified.`);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not verify that bill.')),
  });

  async function exportList() {
    setExporting(true);
    try {
      const { blob, filename } = await downloadHireBillsExport(filterQuery);
      saveBlob(blob, filename);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the hire bills.'));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<HireBillFull>[] = [
    {
      key: 'equipment',
      header: 'Machine',
      render: (row) => `${row.equipmentCode} · ${row.equipmentName}`,
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.vendorName}</span>
          {row.hireOrderCode && (
            <span className="text-xs text-gray-500">
              Work order {row.hireOrderCode}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'basis',
      header: 'Basis / rate',
      // The rate folded in here (2026-10-15): on a monthly bill it is the month's rent, which
      // read as an hourly rate in a column of its own.
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.basis === 'monthly' ? 'Monthly rent' : 'By hours'}</span>
          <span className="text-xs text-gray-500">
            {rupees(row.monthlyRate ?? row.rate)}
            {row.basis === 'monthly' ? ' / month' : ` / ${unitOf(row)}`}
          </span>
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (row) => (
        <span className="whitespace-nowrap">
          {dateLabel(row.billingPeriodFrom)} →<br />
          {dateLabel(row.billingPeriodTo)}
        </span>
      ),
    },
    {
      key: 'hours',
      header: 'Billed / logged',
      // Both figures side by side, because the whole point of verification is
      // comparing them. A variance is recorded, never blocked — an admin decides.
      render: (row) => (
        <span className="flex flex-col">
          <span className="tabular-nums">
            {quantity3(row.billedHours)} / {quantity3(row.logbookHours)}{' '}
            {unitOf(row)}
          </span>
          {row.variance !== 0 && (
            <span
              className={
                row.variance > 0
                  ? 'text-xs text-orange-700'
                  : 'text-xs text-gray-500'
              }
            >
              {signed(row.variance, unitOf(row))} vs logbook
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'gross',
      header: 'Gross',
      hideOnCard: true,
      render: (row) => rupees(row.grossAmount),
    },
    {
      key: 'tds',
      header: 'TDS',
      hideOnCard: true,
      render: (row) =>
        row.tdsRate === null
          ? '—'
          : `${rupees(row.tdsAmount)} (${row.tdsRate}%)`,
    },
    {
      key: 'deductions',
      header: 'Deduction / hold',
      hideOnCard: true,
      render: (row) =>
        `${rupees(row.deductionAmount ?? 0)} / ${rupees(row.holdAmount ?? 0)}`,
    },
    {
      key: 'net',
      header: 'Net payable',
      render: (row) => rupees(row.netPayable),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={plantLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Hire Bills" />
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            loading={exporting}
            onClick={() => void exportList()}
          >
            Excel
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setShowModal(true)}>
            Raise a bill
          </SecondaryButton>
        </div>
      </div>

      {data && (
        <p className="text-sm text-gray-600">
          {data.pendingVerificationCount} awaiting verification ·{' '}
          {rupees(data.unpaidTotal)} unpaid
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <EquipmentPicker
          id="hire-filter-equipment"
          label="Machine"
          emptyLabel="All machines"
          value={filters.equipmentId}
          selectedOption={machine.data ? equipmentOption(machine.data) : null}
          onChange={(id) => setFilters({ equipmentId: id })}
        />
        <VendorPicker
          id="hire-filter-vendor"
          label="Vendor"
          emptyLabel="All vendors"
          value={filters.vendorId}
          onChange={(id) => setFilters({ vendorId: id })}
        />
        <SelectField
          id="hire-filter-status"
          label="Status"
          value={filters.status}
          onChange={(event) => setFilters({ status: event.target.value })}
        >
          <option value="">Any status</option>
          {HIRE_BILL_STATUSES.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="hire-filter-from"
          label="Period from"
          type="date"
          max={filters.periodTo || undefined}
          value={filters.periodFrom}
          onChange={(event) => setFilters({ periodFrom: event.target.value })}
        />
        <TextField
          id="hire-filter-to"
          label="Period to"
          type="date"
          min={filters.periodFrom || undefined}
          value={filters.periodTo}
          onChange={(event) => setFilters({ periodTo: event.target.value })}
          hint="Bills whose period overlaps these dates."
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        isRefreshing={isFetching && !isPending}
        error={isError ? error : undefined}
        onRetry={refetch}
        serverPaged
        emptyMessage={MESSAGES.plantHireBillsEmpty}
        actions={(row) => (
          // Wrapping, so the three downloads and the row's own actions fit a phone card —
          // the list's action strip does not wrap on its own (2026-10-15).
          <div className="flex flex-wrap justify-end gap-2">
            <DocumentDownloads
              load={(format) => downloadHireBill(row, format)}
              onError={(message) => toast.error(message)}
            />
            {/* Correctable only until verified: after that the figures are what was approved. */}
            {row.status === 'pending_verification' && (
              <RowAction onClick={() => setCorrecting(row)}>Edit</RowAction>
            )}
            {/* 036 K8: never offered to the person who raised the bill — the API refuses
                them (403), and someone else must check it. */}
            {row.status === 'pending_verification' &&
              row.createdByUserId !== me.data?.id && (
              <RowAction
                loading={verify.isPending && verify.variables === row.id}
                onClick={async () => {
                  // The variance is surfaced in the confirmation rather than
                  // blocking: verification is an admin decision, not a gate.
                  const confirmed =
                    row.variance === 0 ||
                    (await confirmDialog({
                      title: 'Verify this hire bill?',
                      message: MESSAGES.plantConfirmVerifyHireBill(
                        signed(row.variance, unitOf(row)),
                      ),
                      confirmLabel: 'Verify',
                      tone: 'default',
                    }));
                  if (confirmed) verify.mutate(row.id);
                }}
              >
                Verify
              </RowAction>
            )}
            {row.status === 'pending_verification' &&
              row.createdByUserId !== null &&
              row.createdByUserId === me.data?.id && (
                <span className="self-center text-xs text-gray-500">
                  Raised by you — someone else verifies
                </span>
              )}
            {row.status !== 'paid' && (
              <RowAction
                disabled={row.status !== 'verified'}
                title={
                  row.status !== 'verified'
                    ? MESSAGES.plantUnverifiedPay
                    : undefined
                }
                onClick={() => setPaying(row)}
              >
                Pay
              </RowAction>
            )}
          </div>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="bill"
      />

      {showModal && <HireBillModal onClose={() => setShowModal(false)} />}
      {paying && (
        <PayHireBillModal bill={paying} onClose={() => setPaying(null)} />
      )}
      {correcting && (
        <HireBillCorrectionModal
          bill={correcting}
          onClose={() => setCorrecting(null)}
        />
      )}
    </div>
  );
}
