'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  deleteOpeningStock,
  downloadOpeningStockTemplate,
  getOpeningStock,
  type OpeningStock,
} from '@/app/lib/api/inventory';
import { OPENING_STOCK_COPY } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel, quantity3, rupees } from '@/app/lib/format';
import { useCanWrite } from '@/app/lib/write-access';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button, RowAction, SecondaryButton } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import {
  OpeningEntryModal,
  OpeningImportModal,
} from '@/app/ui/inventory/opening-stock-modals';
import { searchSites } from '@/app/ui/inventory/inventory-search';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import { TABLE } from '@/app/ui/table-classes';
import { useToast } from '@/app/ui/toast';

type Open = { kind: 'add' } | { kind: 'replace'; row: OpeningStock } | { kind: 'import' } | null;

/**
 * Opening stock (051): what each store already held when the company started recording it here.
 *
 * One entry per item per store, added here or imported from the client's Opening Stock sheet. It
 * counts as stock received at its rate, with no purchase or bill behind it. An entry stays
 * replaceable until stock of that item moves at that store; after that it is shown locked.
 */
export default function OpeningStockPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const canWrite = useCanWrite();
  const [siteId, setSiteId] = useState('');
  const [site, setSite] = useState<SearchableOption | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [downloading, setDownloading] = useState(false);

  const list = useQuery({
    queryKey: ['inventory', 'opening-stock', companyId, siteId],
    queryFn: () => getOpeningStock(siteId || undefined),
  });

  const remove = useMutation({
    mutationFn: (row: OpeningStock) => deleteOpeningStock(row.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(OPENING_STOCK_COPY.deleted);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not delete it.')),
  });

  const template = async () => {
    setDownloading(true);
    try {
      saveBlob(await downloadOpeningStockTemplate(), 'Opening stock template.xlsx');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the template.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={OPENING_STOCK_COPY.title}
        description={OPENING_STOCK_COPY.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={template} loading={downloading}>
              {OPENING_STOCK_COPY.template}
            </SecondaryButton>
            {canWrite && (
              <>
                <SecondaryButton onClick={() => setOpen({ kind: 'import' })}>
                  {OPENING_STOCK_COPY.import}
                </SecondaryButton>
                <Button onClick={() => setOpen({ kind: 'add' })}>
                  {OPENING_STOCK_COPY.add}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex w-full flex-col gap-1 text-sm sm:w-72">
        <label htmlFor="opening-store" className="font-medium text-gray-700">
          Store
        </label>
        <AsyncSelect
          id="opening-store"
          value={siteId}
          onChange={(id, option) => {
            setSiteId(id);
            setSite(option);
          }}
          search={searchSites}
          cacheKey={['inventory', 'sites', 'search', companyId]}
          selectedOption={site}
          emptyLabel="All stores"
          placeholder="All stores"
        />
      </div>

      {list.isPending ? (
        <ListSkeleton
          headers={['Store', 'Item', 'Quantity', 'Rate', 'Value', 'As on']}
        />
      ) : list.isError ? (
        <QueryError error={list.error} onRetry={list.refetch} />
      ) : list.data.rows.length === 0 ? (
        <p className={TABLE.empty}>{OPENING_STOCK_COPY.empty}</p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>Store</th>
                <th className={TABLE.th}>Item</th>
                <th className={clsx(TABLE.th, TABLE.numeric)}>Quantity</th>
                <th className={clsx(TABLE.th, TABLE.numeric)}>Rate (₹)</th>
                <th className={clsx(TABLE.th, TABLE.numeric)}>Value (₹)</th>
                <th className={TABLE.th}>As on</th>
                <th className={TABLE.th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((row) => (
                <tr key={row.id} className={TABLE.row}>
                  <td className={TABLE.td}>{row.siteName}</td>
                  <td className={TABLE.td}>
                    <p className="font-medium text-gray-900">{row.itemName}</p>
                    <p className="text-xs text-gray-500">{row.itemCode}</p>
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {quantity3(row.quantity)} {row.unit}
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {row.noRate ? (
                      <span
                        className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800"
                        title={OPENING_STOCK_COPY.noRateHint}
                      >
                        {OPENING_STOCK_COPY.noRate}
                      </span>
                    ) : (
                      rupees(row.rate)
                    )}
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {rupees(row.value)}
                  </td>
                  <td className={TABLE.td}>{dateLabel(row.asOnDate)}</td>
                  <td className={clsx(TABLE.td, 'text-right')}>
                    {row.editable ? (
                      <div className="flex justify-end gap-2">
                        <RowAction
                          onClick={() => setOpen({ kind: 'replace', row })}
                        >
                          Replace
                        </RowAction>
                        <RowAction
                          loading={remove.isPending && remove.variables?.id === row.id}
                          onClick={async () => {
                            if (
                              await confirmDialog(
                                OPENING_STOCK_COPY.confirmDelete(
                                  row.itemName,
                                  row.siteName,
                                ),
                              )
                            ) {
                              remove.mutate(row);
                            }
                          }}
                        >
                          Delete
                        </RowAction>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500" title={OPENING_STOCK_COPY.locked}>
                        Locked
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className={TABLE.tfoot}>
              <tr>
                <td className={TABLE.td} colSpan={4}>
                  {list.data.rows.length} entr
                  {list.data.rows.length === 1 ? 'y' : 'ies'}
                  {list.data.totals.noRate > 0 &&
                    ` · ${list.data.totals.noRate} without a rate`}
                </td>
                <td className={clsx(TABLE.td, TABLE.numeric)}>
                  {rupees(list.data.totals.value)}
                </td>
                <td className={TABLE.td} colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {open?.kind === 'add' && <OpeningEntryModal onClose={() => setOpen(null)} />}
      {open?.kind === 'replace' && (
        <OpeningEntryModal entry={open.row} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'import' && (
        <OpeningImportModal onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
