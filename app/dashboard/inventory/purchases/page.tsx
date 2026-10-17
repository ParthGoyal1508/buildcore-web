'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Suspense, useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  deletePurchase,
  downloadInventoryExport,
  downloadStoreDocument,
  getPurchaseBill,
  getPurchasePhoto,
  getPurchases,
  type Purchase,
} from '@/app/lib/api/inventory';
import {
  MESSAGES,
  PURCHASE_BILL_STATUSES,
  inventoryLabel,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel, quantity, rupees, todayIso } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import {
  dateRangeError,
  searchSites,
  searchVendors,
  useSiteOption,
  useVendorOption,
} from '@/app/ui/inventory/inventory-search';
import Pager from '@/app/ui/inventory/pager';
import PurchaseModal from '@/app/ui/inventory/purchase-modal';
import StoreDocumentDownload from '@/app/ui/inventory/store-document-download';
import PageHeader from '@/app/ui/page-header';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { ListSkeleton } from '@/app/ui/skeletons';
import StatusBadge from '@/app/ui/status-badge';
import { useToast } from '@/app/ui/toast';

/**
 * Purchases (009), on the 036 kit (M5, M11, M12, M9):
 * - filters in the URL, so Back and a shared link keep them; store and vendor searched on the
 *   server rather than picked from the first 200;
 * - dates as DD-MM-YYYY, quantities grouped, totals of the whole filter (not the page) and an Excel
 *   download of it;
 * - the PO line a delivery was received against, the delivery photo beside the bill;
 * - a delete refused because the stock has moved on says how much is left (422), per row.
 */
function PurchasesList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();

  const [filters, setFilters, query] = useUrlState(
    {
      siteId: urlString(),
      vendorId: urlString(),
      paymentStatus: urlEnum(['', ...PURCHASE_BILL_STATUSES] as const, ''),
      from: urlString(),
      to: urlString(),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );
  const siteOption = useSiteOption(filters.siteId);
  const vendorOption = useVendorOption(filters.vendorId);
  const rangeError = dateRangeError(filters.from, filters.to);

  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // The vendor's bill reads in the page's own viewer when it is a PDF or a photo (2026-10-14).
  const { show, viewer } = useFileViewer();

  const params = {
    page: query.page,
    siteId: query.siteId || undefined,
    vendorId: query.vendorId || undefined,
    paymentStatus: query.paymentStatus || undefined,
    dateFrom: query.from || undefined,
    dateTo: query.to || undefined,
  };

  const list = useQuery({
    queryKey: ['inventory', 'purchases', companyId, params],
    queryFn: () => getPurchases(params),
    placeholderData: keepPreviousData,
    // A reversed range matches nothing; it is said beside the filter instead of asked.
    enabled: !rangeError,
  });
  const data = list.data;

  /**
   * Opens a stored bill or delivery photo in the page's viewer. Fetched rather than linked: the
   * endpoint needs the bearer token, which lives in memory and never appears in a URL.
   */
  async function openFile(row: Purchase, which: 'bill' | 'photo') {
    setOpening(`${which}:${row.id}`);
    try {
      if (which === 'bill') {
        show(
          { blob: await getPurchaseBill(row.id) },
          `purchase-bill-${row.grnNumber ?? row.id}`,
          'Vendor bill',
        );
      } else {
        show(
          await getPurchasePhoto(row.id),
          `delivery-photo-${row.grnNumber ?? row.id}`,
          'Delivery photo',
        );
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not open this file.'));
    } finally {
      setOpening(null);
    }
  }

  const remove = useMutation({
    mutationFn: (id: string) => deletePurchase(id),
    onSuccess: () => {
      setError(null);
      toast.success('Purchase deleted and its stock reversed');
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.status === 409
          ? MESSAGES.purchaseHasAllocations
          : // 422 (036 M1): the material has been issued or transferred; the server says how much
            // is still in the store.
            errorMessage(err, 'Could not delete this purchase.'),
      ),
  });

  async function exportXlsx() {
    setExporting(true);
    try {
      saveBlob(
        await downloadInventoryExport('purchases', {
          ...params,
          page: undefined,
        }),
        `purchases-${todayIso()}.xlsx`,
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the purchases.'));
    } finally {
      setExporting(false);
    }
  }

  const fileLink = (row: Purchase, which: 'bill' | 'photo') => (
    <button
      type="button"
      onClick={() => void openFile(row, which)}
      disabled={opening === `${which}:${row.id}`}
      className="text-brand-700 underline hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:text-gray-400"
    >
      {opening === `${which}:${row.id}`
        ? 'Opening…'
        : which === 'bill'
          ? 'Bill'
          : 'Photo'}
    </button>
  );

  const columns: Column<Purchase>[] = [
    { key: 'date', header: 'Date', render: (row) => dateLabel(row.date) },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    { key: 'vendor', header: 'Vendor', render: (row) => row.vendorName },
    {
      key: 'quantity',
      header: 'Qty',
      className: 'text-right',
      render: (row) => quantity(row.quantity),
    },
    {
      key: 'rate',
      header: 'Rate',
      hideOnCard: true,
      className: 'text-right',
      render: (row) => rupees(row.rate),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (row) => rupees(row.amount),
    },
    {
      key: 'grn',
      header: 'GRN',
      hideOnCard: true,
      render: (row) => row.grnNumber ?? '—',
    },
    {
      key: 'po',
      header: 'PO',
      hideOnCard: true,
      render: (row) =>
        row.purchaseOrderRef
          ? `${row.purchaseOrderRef} · line ${row.purchaseOrderLineNo}`
          : '—',
    },
    {
      key: 'files',
      header: 'Files',
      hideOnCard: true,
      render: (row) =>
        row.hasBillFile || row.hasPhoto ? (
          <span className="flex gap-3">
            {row.hasBillFile && fileLink(row, 'bill')}
            {row.hasPhoto && fileLink(row, 'photo')}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (row) => (
        <StatusBadge
          status={row.paymentStatus}
          label={inventoryLabel(row.paymentStatus)}
        />
      ),
    },
  ];

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Purchases" />
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            onClick={() => void exportXlsx()}
            disabled={exporting || Boolean(rangeError)}
          >
            {exporting ? 'Preparing…' : 'Export to Excel'}
          </SecondaryButton>
          <Button type="button" onClick={() => setShowModal(true)}>
            New purchase
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1 text-sm">
          <label
            htmlFor="purchases-site"
            className="font-medium text-gray-700"
          >
            Store
          </label>
          <AsyncSelect
            id="purchases-site"
            value={filters.siteId}
            onChange={(id) => setFilters({ siteId: id })}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={siteOption}
            emptyLabel="All stores"
            placeholder="All stores"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label
            htmlFor="purchases-vendor"
            className="font-medium text-gray-700"
          >
            Vendor
          </label>
          <AsyncSelect
            id="purchases-vendor"
            value={filters.vendorId}
            onChange={(id) => setFilters({ vendorId: id })}
            search={searchVendors}
            cacheKey={['inventory', 'vendors', 'search', companyId]}
            selectedOption={vendorOption}
            emptyLabel="All vendors"
            placeholder="All vendors"
          />
        </div>

        <SelectField
          id="purchases-status"
          label="Payment"
          value={filters.paymentStatus}
          onChange={(event) =>
            setFilters({
              paymentStatus: event.target
                .value as (typeof filters)['paymentStatus'],
            })
          }
        >
          <option value="">Any status</option>
          {PURCHASE_BILL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {inventoryLabel(status)}
            </option>
          ))}
        </SelectField>

        <TextField
          id="purchases-from"
          label="From"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => setFilters({ from: event.target.value })}
        />
        <TextField
          id="purchases-to"
          label="To"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => setFilters({ to: event.target.value })}
          error={rangeError}
        />
      </div>

      <FormError message={error} />
      {viewer}

      {totals && (data?.total ?? 0) > 0 && (
        <p className="text-sm text-gray-700">
          {data?.total} purchase{data?.total === 1 ? '' : 's'} ·{' '}
          <span className="font-medium">{rupees(totals.amount)}</span> billed ·{' '}
          {rupees(totals.paidAmount)} paid ·{' '}
          {rupees(totals.amount - totals.paidAmount)} outstanding
          {totals.quantity !== null && <> · {quantity(totals.quantity)} received</>}
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={data?.purchases ?? []}
        rowKey={(row) => row.id}
        isLoading={list.isPending && !rangeError}
        isRefreshing={list.isFetching && !list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        serverPaged
        emptyMessage={MESSAGES.purchasesEmpty}
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            {/* The client's GRN (2026-10-15), filled from the purchase and what the gate counted. */}
            <StoreDocumentDownload
              label="GRN"
              fallbackName={`GRN ${row.grnNumber ?? row.date.slice(0, 10)}`}
              load={(format) => downloadStoreDocument('grn', row.id, format)}
              onError={setError}
            />
            <RowAction
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Delete this purchase?',
                    message: MESSAGES.confirmDeletePurchase,
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                ) {
                  remove.mutate(row.id);
                }
              }}
              loading={remove.isPending && remove.variables === row.id}
              disabled={remove.isPending}
            >
              Delete
            </RowAction>
          </div>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="purchase"
      />

      {showModal && <PurchaseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export default function PurchasesPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Date', 'Store', 'Item', 'Vendor', 'Qty', 'Amount']}
          rows={8}
        />
      }
    >
      <PurchasesList />
    </Suspense>
  );
}
