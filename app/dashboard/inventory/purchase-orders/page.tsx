'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getLetters } from '@/app/lib/api/letters';
import { getVendor } from '@/app/lib/api/partners';
import { getCurrentUser } from '@/app/lib/api/users';
import { inventoryLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { useVendors } from '@/app/ui/inventory/use-inventory-refs';
import {
  LetterComposer,
  LetterTable,
  useLetterKinds,
} from '@/app/ui/letters/letters-panel';
import PageHeader from '@/app/ui/page-header';
import SearchableSelect from '@/app/ui/searchable-select';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

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
  const [starting, setStarting] = useState(false);

  const kinds = useLetterKinds([PURCHASE_ORDER]);
  const kind = kinds.offered[0];
  const vendors = useVendors();
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

  const chosen = (vendors.data ?? []).find((v) => v.id === vendorId);

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
      vendorName: detail?.name ?? chosen?.name ?? '',
      vendorAddress: detail?.pinCode
        ? `${place}${place ? ' - ' : ''}${detail.pinCode}`
        : place,
      vendorCode: detail?.code ?? chosen?.code ?? '',
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
              <SearchableSelect
                value={vendorId}
                onChange={setVendorId}
                options={(vendors.data ?? []).map((v) => ({
                  id: v.id,
                  label: v.name,
                  sublabel: v.city ?? undefined,
                  note: `${v.code} · ${inventoryLabel(v.type)}`,
                }))}
                placeholder={
                  vendors.isLoading
                    ? 'Loading vendors…'
                    : 'Search the Partners register'
                }
                disabled={vendors.isLoading || vendorId !== ''}
              />
            </div>
            <SecondaryButton type="button" onClick={close}>
              {vendorId ? 'Start over' : 'Cancel'}
            </SecondaryButton>
          </div>
          {vendors.isError && (
            <p className="text-sm text-red-700" role="alert">
              The vendors could not be loaded.
            </p>
          )}
          {vendor.isError && (
            <p className="text-xs text-gray-500">
              The vendor&rsquo;s address could not be read — type it below.
            </p>
          )}

          {ready && (
            <LetterComposer
              key={vendorId}
              kind={kind}
              title={`Purchase order — ${chosen?.name ?? 'vendor'}`}
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
        <LetterTable
          letters={orders.data ?? []}
          isLoading={orders.isLoading}
          emptyMessage="No purchase order has been raised yet."
        />
      )}
    </div>
  );
}
