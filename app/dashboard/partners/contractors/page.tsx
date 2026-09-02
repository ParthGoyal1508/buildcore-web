'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Contractor, getContractors } from '@/app/lib/api/partners';
import {
  CONTRACTOR_COMPLIANCE_STATUSES,
  MESSAGES,
  ROUTES,
  partnersLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import ContractorModal from '@/app/ui/partners/contractor-modal';
import { Field, SelectInput } from '@/app/ui/partners/form-controls';

export default function ContractorsPage() {
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ['partners', 'contractors', status],
    queryFn: () => getContractors(status ? { complianceStatus: status } : {}),
  });

  const columns: Column<Contractor>[] = [
    {
      key: 'name',
      header: 'Contractor',
      sticky: true,
      render: (row) => (
        <Link
          href={ROUTES.partnersContractor(row.id)}
          className="font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {row.vendorName ?? row.vendorId}
        </Link>
      ),
    },
    { key: 'code', header: 'Code', render: (row) => row.vendorCode ?? '—' },
    {
      key: 'type',
      header: 'Vendor type',
      render: (row) => partnersLabel(row.vendorType),
    },
    {
      key: 'status',
      header: 'Compliance',
      render: (row) => <StatusBadge status={row.complianceStatus} />,
    },
    {
      key: 'licence',
      header: 'Licence',
      render: (row) => row.licenceNumber ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'documents',
      header: 'Documents',
      numeric: true,
      render: (row) => row.documentCount ?? 0,
    },
  ];

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} mb-2 text-2xl`}>Contractors</h1>
          <p className="text-sm text-gray-600">
            Compliance status reflects the most recently concluded month, not the
            whole history — a contractor who stopped filing is not compliant today.
            Contractors of deactivated vendors are not listed.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Add contractor</Button>
      </div>

      <div className="mb-4 max-w-xs">
        <Field id="contractor-status" label="Compliance status">
          <SelectInput
            id="contractor-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {CONTRACTOR_COMPLIANCE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {partnersLabel(value)}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No contractors yet. Add one from a subcontractor or labour-contractor vendor."
      />

      {modalOpen && <ContractorModal onClose={() => setModalOpen(false)} />}
    </main>
  );
}
