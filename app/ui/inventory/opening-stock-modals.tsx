'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  confirmOpeningStockImport,
  createOpeningStock,
  replaceOpeningStock,
  validateOpeningStockImport,
  type OpeningImportReport,
  type OpeningStock,
} from '@/app/lib/api/inventory';
import { OPENING_STOCK_COPY } from '@/app/lib/constants';
import { fileToBase64 } from '@/app/lib/files';
import { dateLabel, quantity3, rupees, todayIso } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button, SecondaryButton } from '@/app/ui/button';
import { CheckboxField, FormError, TextField } from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { TABLE } from '@/app/ui/table-classes';
import { useToast } from '@/app/ui/toast';
import { searchItems, searchSites } from './inventory-search';

/**
 * Adds an opening entry, or replaces one (051). Replacing keeps the store and item — a different
 * pair is a different entry — and changes the quantity, rate and as-on date.
 */
export function OpeningEntryModal({
  entry,
  onClose,
}: {
  entry?: OpeningStock;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [siteId, setSiteId] = useState(entry?.siteId ?? '');
  const [site, setSite] = useState<SearchableOption | null>(null);
  const [itemId, setItemId] = useState(entry?.itemId ?? '');
  const [item, setItem] = useState<SearchableOption | null>(null);
  const [quantity, setQuantity] = useState(entry ? String(entry.quantity) : '');
  const [rate, setRate] = useState(entry && !entry.noRate ? String(entry.rate) : '');
  const [asOnDate, setAsOnDate] = useState(entry?.asOnDate ?? todayIso());
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        quantity: Number(quantity),
        rate: rate.trim() === '' ? null : Number(rate),
        asOnDate,
      };
      return entry
        ? replaceOpeningStock(entry.id, input)
        : createOpeningStock({ ...input, siteId, itemId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(OPENING_STOCK_COPY.saved);
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.code === 'OPENING_STOCK_EXISTS'
          ? 'This item already has opening stock at this store. Replace that entry from the list instead.'
          : errorMessage(err, 'Could not save the opening stock.'),
      ),
  });

  const pickerLabel = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="font-medium text-gray-700">
      {text} <span className="text-red-600">*</span>
    </label>
  );

  return (
    <Modal
      title={
        entry
          ? OPENING_STOCK_COPY.replaceTitle(entry.itemName, entry.siteName)
          : OPENING_STOCK_COPY.addTitle
      }
      onClose={onClose}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="opening-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="opening-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!entry && (!siteId || !itemId)) {
            setError('Choose the store and the item.');
            return;
          }
          save.mutate();
        }}
      >
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        {!entry && (
          <>
            <div className="flex flex-col gap-1 text-sm">
              {pickerLabel('opening-site', 'Store')}
              <AsyncSelect
                id="opening-site"
                value={siteId}
                onChange={(id, option) => {
                  setSiteId(id);
                  setSite(option);
                }}
                search={searchSites}
                cacheKey={['inventory', 'sites', 'search', companyId]}
                selectedOption={site}
                placeholder="Search stores"
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              {pickerLabel('opening-item', 'Item')}
              <AsyncSelect
                id="opening-item"
                value={itemId}
                onChange={(id, option) => {
                  setItemId(id);
                  setItem(option);
                }}
                search={searchItems}
                cacheKey={['inventory', 'items', 'search', companyId]}
                selectedOption={item}
                placeholder="Search items"
              />
            </div>
          </>
        )}
        <TextField
          id="opening-quantity"
          label={`Quantity${entry ? ` (${entry.unit})` : item?.note ? ` (${item.note})` : ''}`}
          type="number"
          inputMode="decimal"
          min={0.001}
          step="0.001"
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <TextField
          id="opening-rate"
          label="Rate (₹ per unit)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          hint={OPENING_STOCK_COPY.rateHint}
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />
        <TextField
          id="opening-as-on"
          label="As on"
          type="date"
          max={todayIso()}
          required
          hint={OPENING_STOCK_COPY.asOnHint}
          value={asOnDate}
          onChange={(event) => setAsOnDate(event.target.value)}
        />
      </form>
    </Modal>
  );
}

/**
 * Imports the Opening Stock sheet (051): check first, see every row and what is wrong with it,
 * then import all rows in one go. Nothing is written until the report is clean.
 */
export function OpeningImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<OpeningImportReport | null>(null);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose the file first.');
      return validateOpeningStockImport(await fileToBase64(file));
    },
    onSuccess: (data) => {
      setReport(data);
      setReplace(false);
    },
    onError: (err) => setError(errorMessage(err, 'Could not read the file.')),
  });

  const confirm = useMutation({
    mutationFn: async () =>
      confirmOpeningStockImport(await fileToBase64(file as File), replace),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(OPENING_STOCK_COPY.imported(data.created, data.replaced));
      onClose();
    },
    onError: (err) => setError(errorMessage(err, 'Could not import the file.')),
  });

  const blockedByReplace = (report?.summary.replacing ?? 0) > 0 && !replace;

  return (
    <Modal
      title={OPENING_STOCK_COPY.importTitle}
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
              disabled={blockedByReplace}
              loading={confirm.isPending}
              onClick={() => {
                setError(null);
                confirm.mutate();
              }}
            >
              {OPENING_STOCK_COPY.confirm(report.summary.rows)}
            </Button>
          ) : (
            <Button
              type="submit"
              form="opening-import-form"
              disabled={!file}
              loading={check.isPending}
            >
              {OPENING_STOCK_COPY.check}
            </Button>
          )}
        </>
      }
    >
      <form
        id="opening-import-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          check.mutate();
        }}
      >
        <FormError message={error} />
        <p className="text-sm text-gray-600">{OPENING_STOCK_COPY.importHelp}</p>
        <div>
          <label
            htmlFor="opening-import-file"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Workbook (.xlsx)
          </label>
          <input
            id="opening-import-file"
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
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Rows', value: String(report.summary.rows) },
              { label: 'In error', value: String(report.summary.invalid) },
              { label: 'Without a rate', value: String(report.summary.noRate) },
              { label: 'Value', value: rupees(report.summary.value) },
            ].map((fact) => (
              <div
                key={fact.label}
                className="rounded-md border border-gray-200 bg-gray-50 p-3"
              >
                <dt className="text-xs text-gray-500">{fact.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-gray-900">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>

          {(report.unmatched.stores.length > 0 ||
            report.unmatched.items.length > 0) && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {report.unmatched.stores.length > 0 && (
                <p>
                  <span className="font-medium">Stores not found:</span>{' '}
                  {report.unmatched.stores.join(', ')}
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

          {report.canConfirm && report.summary.replacing > 0 && (
            <CheckboxField
              id="opening-import-replace"
              label={OPENING_STOCK_COPY.replaceExisting(report.summary.replacing)}
              checked={replace}
              onChange={(event) => setReplace(event.target.checked)}
            />
          )}

          <div className={clsx(TABLE.wrap, 'max-h-96 overflow-y-auto')}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
                <tr>
                  <th className={TABLE.th}>Row</th>
                  <th className={TABLE.th}>Store</th>
                  <th className={TABLE.th}>Item</th>
                  <th className={clsx(TABLE.th, TABLE.numeric)}>Quantity</th>
                  <th className={clsx(TABLE.th, TABLE.numeric)}>Rate</th>
                  <th className={TABLE.th}>As on</th>
                  <th className={TABLE.th}>Check</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={row.line}
                    className={clsx(TABLE.row, row.errors.length > 0 && 'bg-red-50/60')}
                  >
                    <td className={TABLE.td}>{row.line}</td>
                    <td className={TABLE.td}>{row.siteName ?? row.store ?? '—'}</td>
                    <td className={TABLE.td}>{row.itemName ?? row.item ?? '—'}</td>
                    <td className={clsx(TABLE.td, TABLE.numeric)}>
                      {row.quantity === null
                        ? '—'
                        : `${quantity3(row.quantity)} ${row.unit ?? ''}`}
                    </td>
                    <td className={clsx(TABLE.td, TABLE.numeric)}>
                      {row.noRate ? OPENING_STOCK_COPY.noRate : rupees(row.rate)}
                    </td>
                    <td className={TABLE.td}>
                      {row.asOnDate ? dateLabel(row.asOnDate) : '—'}
                    </td>
                    <td className={TABLE.td}>
                      {row.errors.length > 0 ? (
                        <ul className="list-disc pl-4 text-red-700">
                          {row.errors.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      ) : row.replaces ? (
                        <span className="text-amber-700">Replaces existing</span>
                      ) : (
                        <span className="text-green-700">OK</span>
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
