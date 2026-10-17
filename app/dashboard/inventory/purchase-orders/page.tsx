'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Link from 'next/link';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  getPurchaseOrders,
  PO_STATUS_LABELS,
  type PurchaseOrderSummary,
} from '@/app/lib/api/inventory';
import { getLetters } from '@/app/lib/api/letters';
import { getVendor } from '@/app/lib/api/partners';
import { getCurrentUser } from '@/app/lib/api/users';
import { rupees } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { searchVendors } from '@/app/ui/inventory/inventory-search';
import {
  LetterComposer,
  LetterTable,
  useLetterKinds,
} from '@/app/ui/letters/letters-panel';
import PageHeader from '@/app/ui/page-header';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { NocModal } from '@/app/ui/nocs/noc-panel';
import {
  filterByNoc,
  NocFilterField,
  NocStatusBadge,
  useNocStatuses,
  type NocFilter,
} from '@/app/ui/nocs/noc-status';

/**
 * Purchase orders (2026-10-15).
 *
 * The client: "Purchase Order is not project specific — it's generic in nature." A PO was one of
 * the three letters on a project's Letters tab, with its items picked from that project's BOQ — the
 * client's schedule of work, which is not what a PO buys. Here it is what the client described:
 * pick the vendor from Partners, pick the items from the inventory item master and type the
 * quantity and rate, type the delivery address, payment terms, warranty and the rest; it goes
 * through its approval and is issued as a PDF in the client's format.
 *
 * The PO is a letter addressed to the vendor (`subjectType: 'vendor'`), so it shares the composer,
 * preview, approval and download with the LOI and work order. The list is every purchase order the
 * caller may see, across vendors — including any raised on a project before this page existed.
 */
const PURCHASE_ORDER = 'letter_purchase_order';

export default function PurchaseOrdersPage() {
  const [vendorId, setVendorId] = useState('');
  const [chosen, setChosen] = useState<SearchableOption | null>(null);
  const companyId = useSelectedCompanyId();
  const [nocFor, setNocFor] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [starting, setStarting] = useState(false);

  const kinds = useLetterKinds([PURCHASE_ORDER]);
  const kind = kinds.offered[0];
  const vendor = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: () => getVendor(vendorId),
    enabled: vendorId !== '',
    retry: false,
  });
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const orders = useQuery({
    queryKey: ['letters', 'kind', PURCHASE_ORDER],
    queryFn: () => getLetters({ letterKindKey: PURCHASE_ORDER }),
  });
  // An issued order is open until the supplier's NOC is uploaded, then closed (2026-10-17).
  const [nocFilter, setNocFilter] = useState<NocFilter>('');
  const issuedIds = (orders.data ?? [])
    .filter((letter) => letter.status !== 'composed')
    .map((letter) => letter.id);
  const nocStatuses = useNocStatuses('purchase_order', issuedIds);

  // 036 M9: what each issued PO has had delivered, billed and paid against it — the structure
  // behind the letter, read back by the letter's id. The letter, its list and its PDF are unchanged.
  const structured = useQuery({
    queryKey: ['inventory', 'purchase-orders', companyId],
    queryFn: () => getPurchaseOrders(),
    enabled: issuedIds.length > 0,
  });
  const traceOf = new Map<string, PurchaseOrderSummary>(
    (structured.data ?? []).map((po) => [po.letterId, po]),
  );

  /** The vendor's details and the person raising it, as the PO prints them. */
  const initialValues = (): Record<string, string> => {
    const detail = vendor.data;
    const place = [detail?.address, detail?.city, detail?.state]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', ');
    const contact = detail?.contacts[0];
    const me = user.data;
    return {
      vendorName: detail?.name ?? chosen?.label ?? '',
      vendorAddress: detail?.pinCode
        ? `${place}${place ? ' - ' : ''}${detail.pinCode}`
        : place,
      vendorCode: detail?.code ?? '',
      vendorAttention: contact
        ? [contact.name, contact.phone].filter(Boolean).join(', ')
        : '',
      buyerName: me
        ? [me.firstname, me.lastname].filter(Boolean).join(' ') || me.username
        : '',
      buyerEmail: me?.email ?? '',
    };
  };

  const close = () => {
    setStarting(false);
    setVendorId('');
    setChosen(null);
  };

  // The composer opens once the vendor's record is read (or could not be), because the item and
  // address boxes take their opening values once, when they mount.
  const ready = vendorId !== '' && !vendor.isLoading && !user.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Purchase orders"
        description="Orders placed on a vendor for items from the item master. Each is approved before it is issued, and downloads in your format."
        actions={
          kind && !starting ? (
            <Button type="button" onClick={() => setStarting(true)}>
              New purchase order
            </Button>
          ) : null
        }
      />

      {kinds.isSuccess && !kind && (
        <p className="text-sm text-gray-600">
          No purchase order letter is set up. It is configured in Settings →
          Letters.
        </p>
      )}

      {starting && kind && (
        <section className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:max-w-md">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Vendor
              </span>
              {/* Searched on the server, active vendors only (036 M5): the 201st vendor was not
                  offered at all when this loaded one page. */}
              <AsyncSelect
                value={vendorId}
                onChange={(id, option) => {
                  setVendorId(id);
                  setChosen(option);
                }}
                search={searchVendors}
                cacheKey={['inventory', 'vendors', 'search', companyId]}
                selectedOption={chosen}
                placeholder="Search the Partners register"
                disabled={vendorId !== ''}
                aria-label="Vendor"
              />
            </div>
            <SecondaryButton type="button" onClick={close}>
              {vendorId ? 'Start over' : 'Cancel'}
            </SecondaryButton>
          </div>
          {vendor.isError && (
            <p className="text-xs text-gray-500">
              The vendor&rsquo;s address could not be read — type it below.
            </p>
          )}

          {ready && (
            <LetterComposer
              key={vendorId}
              kind={kind}
              title={`Purchase order — ${chosen?.label ?? 'vendor'}`}
              subjectType="vendor"
              subjectId={vendorId}
              itemsSource="items"
              initialValues={initialValues()}
              onClose={close}
              onIssued={close}
            />
          )}
        </section>
      )}

      {orders.isError ? (
        <p className="text-sm text-red-700" role="alert">
          The purchase orders could not be loaded.
        </p>
      ) : (
        <>
          {issuedIds.length > 0 && (
            <div className="w-full sm:max-w-xs">
              <NocFilterField
                id="po-filter-noc"
                value={nocFilter}
                onChange={setNocFilter}
              />
            </div>
          )}
          <LetterTable
            letters={
              nocFilter
                ? filterByNoc(
                    (orders.data ?? []).filter((l) => l.status !== 'composed'),
                    nocFilter,
                    nocStatuses,
                    (letter) => letter.id,
                  )
                : (orders.data ?? [])
            }
            statusExtra={(letter) => {
              const trace = traceOf.get(letter.id);
              return (
                <>
                  <NocStatusBadge
                    status={nocStatuses?.get(letter.id)}
                    labelled
                  />
                  {trace && (
                    <span className="block text-xs text-gray-600">
                      {PO_STATUS_LABELS[trace.status]} ·{' '}
                      {rupees(trace.receivedValue)} of{' '}
                      {rupees(trace.orderedValue)} received ·{' '}
                      {rupees(trace.paidAmount)} paid
                    </span>
                  )}
                </>
              );
            }}
            isLoading={orders.isLoading}
            emptyMessage="No purchase order has been raised yet."
            // The supplier's NOC against an issued purchase order (2026-10-15).
            extraActions={(letter) => (
              <>
                {traceOf.has(letter.id) && (
                  // Ordered → received (GRNs) → billed → paid, line by line (036 M9).
                  <Link
                    href={`/dashboard/inventory/purchase-orders/${letter.id}`}
                    className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    Trace
                  </Link>
                )}
                <Button
                  onClick={() =>
                    setNocFor({
                      id: letter.id,
                      label: letter.referenceNo ?? letter.letterKindLabel,
                    })
                  }
                >
                  NOC
                </Button>
              </>
            )}
          />
        </>
      )}
      {nocFor && (
        <NocModal
          subjectType="purchase_order"
          subjectId={nocFor.id}
          title={`NOC — ${nocFor.label}`}
          onClose={() => setNocFor(null)}
        />
      )}
    </div>
  );
}
