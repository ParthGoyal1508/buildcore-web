'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  getPurchaseOrder,
  PO_STATUS_LABELS,
  type PurchaseOrderDetail,
} from '@/app/lib/api/inventory';
import { ROUTES, inventoryLabel } from '@/app/lib/constants';
import { dateLabel, quantity, rupees } from '@/app/lib/format';
import PageHeader, { Breadcrumbs } from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import StatusBadge from '@/app/ui/status-badge';

/**
 * One purchase order, traced (036 M9, 2026-10-17): every line the PO printed, what was received
 * against it (each GRN, its store and date), what those receipts were billed at, and the payments
 * that settled the bills — PO → GRN → bill → payment, in one place.
 *
 * Read-only, and beside the PO rather than instead of it: the PO is still the letter, downloaded
 * from the Purchase orders list exactly as before. A row typed on the PO rather than picked from
 * the item master is shown, so the PO reads whole, but nothing can be received against it.
 */
export default function PurchaseOrderTracePage() {
  const { letterId } = useParams<{ letterId: string }>();
  const companyId = useSelectedCompanyId();
  const po = useQuery({
    queryKey: ['inventory', 'purchase-orders', companyId, letterId],
    queryFn: () => getPurchaseOrder(letterId),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* The trail on its own, above the states, so it is there while the order loads or fails too. */}
      <Breadcrumbs
        items={[{ label: 'Purchase orders', href: ROUTES.inventoryPurchaseOrders }]}
      />
      {po.isPending ? (
        <ListSkeleton
          headers={['Line', 'Item', 'Ordered', 'Received', 'Billed', 'Paid']}
          rows={4}
        />
      ) : po.isError ? (
        <QueryError error={po.error} onRetry={() => void po.refetch()} />
      ) : (
        <Trace po={po.data} />
      )}
    </div>
  );
}

function Trace({ po }: { po: PurchaseOrderDetail }) {
  const outstanding = Math.max(0, po.billedAmount - po.paidAmount);
  return (
    <>
      <PageHeader
        title={`Purchase order ${po.referenceNo ?? ''}`.trim()}
        description={`${po.vendorName ?? 'No vendor'} · issued ${dateLabel(po.issuedAt)}${
          po.version > 1 ? ` · version ${po.version}` : ''
        }`}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Status', PO_STATUS_LABELS[po.status]],
          [
            'Ordered',
            `${rupees(po.orderedValue)} + GST ${quantity(po.gstPercent)}% = ${rupees(po.orderedTotal)}`,
          ],
          ['Received', rupees(po.receivedValue)],
          ['Billed', rupees(po.billedAmount)],
          [
            'Paid',
            `${rupees(po.paidAmount)}${outstanding > 0 ? ` (${rupees(outstanding)} due)` : ''}`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-gray-200 p-3">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      <ol className="flex flex-col gap-4">
        {po.lines.map((line) => (
          <li
            key={line.id}
            className="rounded-md border border-gray-200 p-4 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-gray-900">
                {line.lineNo}. {line.description}
              </p>
              <p className="text-gray-700">
                {quantity(line.receivedQuantity)} of {quantity(line.quantity)}{' '}
                {line.unit} received
                {line.remainingQuantity > 0 &&
                  ` · ${quantity(line.remainingQuantity)} to come`}
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Ordered at {rupees(line.rate)} = {rupees(line.amount)} · billed{' '}
              {rupees(line.billedAmount)} · paid {rupees(line.paidAmount)}
              {!line.itemId && ' · typed on the PO, not an item-master item'}
            </p>

            {line.deliveries.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">Nothing received yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 pr-3 font-medium">GRN</th>
                      <th className="py-1 pr-3 font-medium">Date</th>
                      <th className="py-1 pr-3 font-medium">Store</th>
                      <th className="py-1 pr-3 text-right font-medium">Qty</th>
                      <th className="py-1 pr-3 text-right font-medium">
                        Billed
                      </th>
                      <th className="py-1 pr-3 font-medium">Bill</th>
                      <th className="py-1 font-medium">Payments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {line.deliveries.map((delivery) => (
                      <tr key={delivery.purchaseId}>
                        <td className="py-1.5 pr-3">
                          {delivery.grnNumber ?? '—'}
                        </td>
                        <td className="py-1.5 pr-3">
                          {dateLabel(delivery.date)}
                        </td>
                        <td className="py-1.5 pr-3">{delivery.siteName}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {quantity(delivery.quantity)}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {rupees(delivery.billedAmount)}
                        </td>
                        <td className="py-1.5 pr-3">
                          <StatusBadge
                            status={delivery.paymentStatus}
                            label={inventoryLabel(delivery.paymentStatus)}
                          />
                        </td>
                        <td className="py-1.5">
                          {delivery.payments.length === 0
                            ? '—'
                            : delivery.payments.map((payment) => (
                                <span key={payment.paymentId} className="block">
                                  {dateLabel(payment.date)} ·{' '}
                                  {inventoryLabel(payment.paymentMode)}
                                  {payment.referenceNumber
                                    ? ` ${payment.referenceNumber}`
                                    : ''}{' '}
                                  · {rupees(payment.allocatedAmount)}
                                </span>
                              ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        ))}
      </ol>
      {po.lines.length === 0 && (
        <p className="text-sm text-gray-600">
          This purchase order has no item lines to trace.
        </p>
      )}
    </>
  );
}
