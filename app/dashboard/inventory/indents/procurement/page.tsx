'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { getProcurementNeeded } from '@/app/lib/api/inventory';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import PurchaseModal from '@/app/ui/inventory/purchase-modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

type Demand = Awaited<
  ReturnType<typeof getProcurementNeeded>
>['indentDemand'][number];
type Shortfall = Awaited<
  ReturnType<typeof getProcurementNeeded>
>['reorderShortfall'][number];

/**
 * What needs buying — as two lists, never one.
 *
 * The same item can appear in both: a site indented 500 bags *and* the store is
 * below its reorder level. They are different claims about different quantities, and
 * a single combined figure would order the material twice. The backend returns them
 * separately for that reason (009 FR-027) and this screen keeps them apart, with the
 * reason said out loud rather than left as a layout choice someone later "tidies".
 */
export default function ProcurementNeededPage() {
  const [buyingFor, setBuyingFor] = useState<{
    siteId: string;
    itemId: string;
    indentLineId?: string;
  } | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'procurement-needed'],
    queryFn: getProcurementNeeded,
  });

  const demandColumns: Column<Demand>[] = [
    {
      key: 'indent',
      header: 'Indent',
      render: (row) => (
        <Link
          href={ROUTES.inventoryIndent(row.indentId)}
          className="font-medium text-blue-700 hover:underline"
        >
          {row.indentNumber}
        </Link>
      ),
    },
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (row) => row.outstandingQuantity,
    },
    {
      key: 'requiredBy',
      header: 'Required by',
      render: (row) => row.requiredByDate.slice(0, 10),
    },
  ];

  const shortfallColumns: Column<Shortfall>[] = [
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    { key: 'inStock', header: 'In stock', render: (row) => row.inStock },
    {
      key: 'reorderLevel',
      header: 'Reorder level',
      render: (row) => row.reorderLevel,
    },
    {
      key: 'shortfall',
      header: 'Short by',
      render: (row) => (
        <span className="font-medium text-red-700">{row.shortfall}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className={`${lusitana.className} text-2xl`}>Procurement needed</h1>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {MESSAGES.procurementNotSummed}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-gray-900">Indent demand</h2>
        <p className="text-sm text-gray-600">
          Approved indent lines a storekeeper has flagged as needing purchase.
        </p>
        <ResponsiveList
          columns={demandColumns}
          rows={data?.indentDemand ?? []}
          rowKey={(row) => row.lineId}
          isLoading={isPending}
          error={isError ? MESSAGES.inventoryLoadFailed : undefined}
          emptyMessage="No indent lines are waiting on a purchase."
          actions={(row) => (
            <SecondaryButton
              type="button"
              onClick={() =>
                setBuyingFor({
                  siteId: row.siteId,
                  itemId: row.itemId,
                  indentLineId: row.lineId,
                })
              }
            >
              Buy for this
            </SecondaryButton>
          )}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-gray-900">Reorder shortfall</h2>
        <p className="text-sm text-gray-600">
          Stores holding less than the item&apos;s own reorder level, whether or not
          anyone has indented it.
        </p>
        <ResponsiveList
          columns={shortfallColumns}
          rows={data?.reorderShortfall ?? []}
          rowKey={(row) => `${row.itemId}:${row.siteId}`}
          isLoading={isPending}
          error={isError ? MESSAGES.inventoryLoadFailed : undefined}
          emptyMessage="Nothing is below its reorder level."
          actions={(row) => (
            <SecondaryButton
              type="button"
              onClick={() =>
                setBuyingFor({ siteId: row.siteId, itemId: row.itemId })
              }
            >
              Buy for this
            </SecondaryButton>
          )}
        />
      </section>

      {buyingFor && (
        <PurchaseModal
          onClose={() => setBuyingFor(null)}
          indentLineId={buyingFor.indentLineId}
          defaults={{ siteId: buyingFor.siteId, itemId: buyingFor.itemId }}
        />
      )}
    </div>
  );
}
