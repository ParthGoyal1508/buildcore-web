'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteHireOrder,
  downloadHireOrder,
  getHireBillsFull,
  getHireOrder,
} from '@/app/lib/api/plant-hire';
import { ROUTES, plantLabel } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { formatRupees } from '@/app/lib/utils';
import { confirmDialog } from '@/app/ui/dialogs';
import NocPanel from '@/app/ui/nocs/noc-panel';
import PageHeader from '@/app/ui/page-header';
import DocumentDownloads from '@/app/ui/plant/document-downloads';
import HireOrderModal from '@/app/ui/plant/hire-order-modal';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList from '@/app/ui/settings/responsive-list';
import { LoadingText } from '@/app/ui/spinner';
import StatusBadge from '@/app/ui/status-badge';

/**
 * One vehicle work/hire order, opened from its row (2026-10-15) — the client: "how can I open a
 * hire order, there is no click on the row". Everything the order holds, read-only: who it is
 * with, for which project and where, the PART-A lines and totals; with its documents, its NOCs,
 * Edit and Delete, and the hire bills raised under it.
 */
export default function HireOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order = useQuery({
    queryKey: ['plant', 'hire-orders', id],
    queryFn: () => getHireOrder(id),
  });
  // The bills raised under this order: the supplier's, narrowed to this order.
  const bills = useQuery({
    queryKey: ['plant', 'hire-bills', 'for-order', id, order.data?.vendorId],
    queryFn: () =>
      getHireBillsFull({ vendorId: order.data!.vendorId, pageSize: 100 }),
    enabled: !!order.data,
    select: (page) => page.items.filter((bill) => bill.hireOrderId === id),
  });

  const remove = useMutation({
    mutationFn: () => deleteHireOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      router.push(ROUTES.plantHireOrders);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete that order.',
      ),
  });

  if (order.isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (order.isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        This work order could not be loaded.
      </p>
    );
  }
  const o = order.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeader title={`Work order ${o.code}`} />
          <p className="mt-1 text-sm text-gray-600">
            {o.vendorName} · {dateLabel(o.date)}
            {o.referenceNo && ` · Ref ${o.referenceNo}`}
          </p>
        </div>
        <Link
          href={ROUTES.plantHireOrders}
          className="text-sm text-brand-700 underline hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          Back to hire orders
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <DocumentDownloads
          load={(format) => downloadHireOrder(o, format)}
          onError={setError}
        />
        <RowAction onClick={() => setEditing(true)}>Edit</RowAction>
        <RowAction
          disabled={remove.isPending}
          onClick={async () => {
            if (
              await confirmDialog({
                title: `Delete work order ${o.code}?`,
                message:
                  'An order a hire bill has been raised against cannot be deleted.',
                confirmLabel: 'Delete',
              })
            ) {
              remove.mutate();
            }
          }}
        >
          Delete
        </RowAction>
      </div>
      <FormError message={error} />

      <dl className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Supplier', o.vendorName],
          ['Project', o.projectName ?? '—'],
          ['Point of delivery', o.pointOfDelivery ?? '—'],
          ['Order date', dateLabel(o.date)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {label}
            </dt>
            <dd className="mt-0.5 text-gray-900">{value}</dd>
          </div>
        ))}
        {o.remarks && (
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              Remarks
            </dt>
            <dd className="mt-0.5 text-gray-900">{o.remarks}</dd>
          </div>
        )}
      </dl>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">PART-A</h2>
        <ResponsiveList
          columns={[
            {
              key: 'sr',
              header: 'Sr.',
              render: (line) => String(line.position * 10).padStart(3, '0'),
            },
            {
              key: 'description',
              header: 'Description of equipment',
              render: (line) => (
                <div>
                  <div className="font-medium text-gray-900">{line.title}</div>
                  <div className="text-xs text-gray-600">
                    {line.description}
                  </div>
                </div>
              ),
            },
            {
              key: 'sac',
              header: 'SAC',
              render: (line) => line.sacCode ?? '—',
            },
            {
              key: 'tax',
              header: 'GST %',
              render: (line) => `${line.taxRate}%`,
            },
            {
              key: 'qty',
              header: 'Quantity',
              render: (line) => `${line.quantity} ${line.uom}`,
            },
            {
              key: 'rate',
              header: 'Unit rate',
              render: (line) => formatRupees(line.rate),
            },
            {
              key: 'amount',
              header: 'Amount',
              render: (line) => formatRupees(line.amount),
            },
          ]}
          rows={o.lines}
          rowKey={(line) => line.id}
          emptyMessage="No lines."
        />
        <dl className="ml-auto grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-600">Total taxable amount</dt>
          <dd className="text-right text-gray-900">
            {formatRupees(o.taxableAmount)}
          </dd>
          <dt className="text-gray-600">GST</dt>
          <dd className="text-right text-gray-900">
            {formatRupees(o.taxAmount)}
          </dd>
          <dt className="font-semibold text-gray-900">Total order value</dt>
          <dd className="text-right font-semibold text-gray-900">
            {formatRupees(o.totalAmount)}
          </dd>
        </dl>
      </section>

      <NocPanel
        subjectType="hire_order"
        subjectId={o.id}
        hint="The supplier's No Objection Certificate for this order."
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Hire bills under this order
        </h2>
        <ResponsiveList
          columns={[
            {
              key: 'machine',
              header: 'Vehicle',
              render: (bill) => bill.registrationNo ?? bill.equipmentCode,
            },
            {
              key: 'period',
              header: 'Period',
              render: (bill) =>
                `${dateLabel(bill.billingPeriodFrom)} – ${dateLabel(bill.billingPeriodTo)}`,
            },
            {
              key: 'invoice',
              header: 'Invoice',
              render: (bill) => bill.invoiceNo ?? '—',
            },
            {
              key: 'net',
              header: 'Net payable',
              render: (bill) => formatRupees(bill.netPayable),
            },
            {
              key: 'status',
              header: 'Status',
              render: (bill) => (
                <StatusBadge
                  status={bill.status}
                  label={plantLabel(bill.status)}
                />
              ),
            },
          ]}
          rows={bills.data ?? []}
          rowKey={(bill) => bill.id}
          isLoading={bills.isPending}
          error={bills.isError ? 'Could not load the hire bills.' : undefined}
          emptyMessage="No hire bill has been raised under this order yet."
        />
      </section>

      {editing && (
        <HireOrderModal order={o} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
