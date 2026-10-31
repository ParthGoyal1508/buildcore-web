'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  confirmVendorRateImport,
  downloadVendorRateTemplate,
  getAgreedRates,
  validateVendorRateImport,
  type VendorRateImportReport,
} from '@/app/lib/api/inventory';
import { AGREED_RATE_COPY } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { fileToBase64 } from '@/app/lib/files';
import { dateLabel, rupees } from '@/app/lib/format';
import { useCanWrite } from '@/app/lib/write-access';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button, SecondaryButton } from '@/app/ui/button';
import { searchVendors } from '@/app/ui/inventory/inventory-search';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { FormError } from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { ListSkeleton } from '@/app/ui/skeletons';
import { TABLE } from '@/app/ui/table-classes';
import { useToast } from '@/app/ui/toast';

/**
 * Agreed vendor rates (028, 051): the rate each vendor is held to for each item, whether a first
 * purchase set it or it was imported up front from the client's Vendor Rates sheet. Read-only here:
 * a rate in force changes only through an approved rate change, never by import.
 */
export default function AgreedRatesPage() {
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const canWrite = useCanWrite();
  const [vendorId, setVendorId] = useState('');
  const [vendor, setVendor] = useState<SearchableOption | null>(null);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const rates = useQuery({
    queryKey: ['inventory', 'agreed-rates', companyId, vendorId],
    queryFn: () => getAgreedRates(vendorId || undefined),
  });

  const template = async () => {
    setDownloading(true);
    try {
      saveBlob(await downloadVendorRateTemplate(), 'Vendor rates template.xlsx');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the template.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={AGREED_RATE_COPY.title}
        description={AGREED_RATE_COPY.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={template} loading={downloading}>
              {AGREED_RATE_COPY.template}
            </SecondaryButton>
            {canWrite && (
              <Button onClick={() => setImporting(true)}>
                {AGREED_RATE_COPY.import}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex w-full flex-col gap-1 text-sm sm:w-80">
        <label htmlFor="agreed-vendor" className="font-medium text-gray-700">
          {AGREED_RATE_COPY.vendorFilter}
        </label>
        <AsyncSelect
          id="agreed-vendor"
          value={vendorId}
          onChange={(id, option) => {
            setVendorId(id);
            setVendor(option);
          }}
          search={searchVendors}
          cacheKey={['inventory', 'vendors', 'search', companyId]}
          selectedOption={vendor}
          emptyLabel={AGREED_RATE_COPY.allVendors}
          placeholder={AGREED_RATE_COPY.allVendors}
        />
      </div>

      {rates.isPending ? (
        <ListSkeleton headers={['Vendor', 'Item', 'Rate', 'From', 'Set by']} />
      ) : rates.isError ? (
        <QueryError error={rates.error} onRetry={rates.refetch} />
      ) : rates.data.length === 0 ? (
        <p className={TABLE.empty}>{AGREED_RATE_COPY.empty}</p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>Vendor</th>
                <th className={TABLE.th}>Item</th>
                <th className={clsx(TABLE.th, TABLE.numeric)}>Rate (₹)</th>
                <th className={TABLE.th}>From</th>
                <th className={TABLE.th}>Set by</th>
              </tr>
            </thead>
            <tbody>
              {rates.data.map((row) => (
                <tr key={row.id} className={TABLE.row}>
                  <td className={TABLE.td}>{row.vendorName}</td>
                  <td className={TABLE.td}>
                    <p className="font-medium text-gray-900">{row.itemName}</p>
                    <p className="text-xs text-gray-500">{row.itemCode}</p>
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {rupees(row.rate)}
                    {row.unit && (
                      <span className="block text-xs text-gray-500">per {row.unit}</span>
                    )}
                  </td>
                  <td className={TABLE.td}>{dateLabel(row.effectiveFrom)}</td>
                  <td className={TABLE.td}>{AGREED_RATE_COPY.source[row.source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importing && <VendorRateImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}

const STATUS_CLASS: Record<VendorRateImportReport['rows'][number]['status'], string> = {
  create: 'text-green-700',
  unchanged: 'text-gray-600',
  conflict: 'text-amber-700',
  daily: 'text-gray-600',
  error: 'text-red-700',
};

/** Check the Vendor Rates sheet, read what each row would do, then record the new rates. */
function VendorRateImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<VendorRateImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose the file first.');
      return validateVendorRateImport(await fileToBase64(file));
    },
    onSuccess: setReport,
    onError: (err) => setError(errorMessage(err, 'Could not read the file.')),
  });

  const confirm = useMutation({
    mutationFn: async () => confirmVendorRateImport(await fileToBase64(file as File)),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(AGREED_RATE_COPY.imported(data.created, data.conflicts));
      onClose();
    },
    onError: (err) => setError(errorMessage(err, 'Could not import the file.')),
  });

  return (
    <Modal
      title={AGREED_RATE_COPY.importTitle}
      onClose={onClose}
      wide
      pending={check.isPending || confirm.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          {report?.canConfirm ? (
            <Button
              type="button"
              disabled={report.summary.create === 0}
              loading={confirm.isPending}
              onClick={() => {
                setError(null);
                confirm.mutate();
              }}
            >
              {AGREED_RATE_COPY.confirm(report.summary.create)}
            </Button>
          ) : (
            <Button
              type="submit"
              form="vendor-rate-import-form"
              disabled={!file}
              loading={check.isPending}
            >
              {AGREED_RATE_COPY.check}
            </Button>
          )}
        </>
      }
    >
      <form
        id="vendor-rate-import-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          check.mutate();
        }}
      >
        <FormError message={error} />
        <p className="text-sm text-gray-600">{AGREED_RATE_COPY.importHelp}</p>
        <div>
          <label
            htmlFor="vendor-rate-import-file"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Workbook (.xlsx)
          </label>
          <input
            id="vendor-rate-import-file"
            type="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setReport(null);
            }}
            className="block w-full rounded-md border border-gray-200 p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          />
        </div>
      </form>

      {report && (
        <div className="mt-4 flex flex-col gap-3" role="status">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(['create', 'unchanged', 'conflict', 'daily', 'error'] as const).map(
              (status) => (
                <div
                  key={status}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <dt className="text-xs text-gray-500">
                    {AGREED_RATE_COPY.status[status]}
                  </dt>
                  <dd className="mt-0.5 text-lg font-semibold text-gray-900">
                    {report.summary[status]}
                  </dd>
                </div>
              ),
            )}
          </dl>

          {(report.unmatched.vendors.length > 0 ||
            report.unmatched.items.length > 0) && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {report.unmatched.vendors.length > 0 && (
                <p>
                  <span className="font-medium">Vendors not found:</span>{' '}
                  {report.unmatched.vendors.join(', ')}
                </p>
              )}
              {report.unmatched.items.length > 0 && (
                <p>
                  <span className="font-medium">Items not found:</span>{' '}
                  {report.unmatched.items.join(', ')}
                </p>
              )}
            </div>
          )}

          <div className={clsx(TABLE.wrap, 'max-h-96 overflow-y-auto')}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
                <tr>
                  <th className={TABLE.th}>Row</th>
                  <th className={TABLE.th}>Vendor</th>
                  <th className={TABLE.th}>Item</th>
                  <th className={clsx(TABLE.th, TABLE.numeric)}>Rate</th>
                  <th className={TABLE.th}>From</th>
                  <th className={TABLE.th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={row.line}
                    className={clsx(TABLE.row, row.status === 'error' && 'bg-red-50/60')}
                  >
                    <td className={TABLE.td}>{row.line}</td>
                    <td className={TABLE.td}>{row.vendorName ?? row.vendor ?? '—'}</td>
                    <td className={TABLE.td}>{row.itemName ?? row.item ?? '—'}</td>
                    <td className={clsx(TABLE.td, TABLE.numeric)}>
                      {row.rate === null ? '—' : rupees(row.rate)}
                    </td>
                    <td className={TABLE.td}>
                      {row.validFrom ? dateLabel(row.validFrom) : '—'}
                    </td>
                    <td className={clsx(TABLE.td, STATUS_CLASS[row.status])}>
                      <p className="font-medium">{AGREED_RATE_COPY.status[row.status]}</p>
                      {row.status === 'error' ? (
                        <ul className="list-disc pl-4">
                          {row.errors.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs">
                          {row.status === 'conflict' && row.current
                            ? AGREED_RATE_COPY.statusHint.conflict(
                                rupees(row.current.rate),
                                dateLabel(row.current.effectiveFrom),
                              )
                            : AGREED_RATE_COPY.statusHint[
                                row.status as 'create' | 'unchanged' | 'daily'
                              ]}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
