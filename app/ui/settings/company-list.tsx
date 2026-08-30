'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Company, listCompanies, updateCompany } from '@/app/lib/api/settings';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import CompanyModal from '@/app/ui/settings/company-modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { RowAction } from '@/app/ui/settings/form-fields';

function StatusBadge({ status }: { status: Company['status'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs ${
        status === 'active'
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-200 text-gray-600'
      }`}
    >
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function CompanyList() {
  const [editing, setEditing] = useState<Company | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });

  /** Companies are never hard-deleted — historical data has to stay intact — so
   * deactivating is the delete-equivalent action (FR-001, FR-005). */
  const toggleStatus = useMutation({
    mutationFn: (company: Company) =>
      updateCompany(company.id, {
        status: company.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      // Any company-selector elsewhere reads the active-only list, which this
      // change alters.
      queryClient.invalidateQueries({ queryKey: ['companies', 'active'] });
    },
  });

  const columns: Column<Company>[] = [
    { key: 'name', header: 'Name', render: (c) => c.name },
    { key: 'shortCode', header: 'Short code', render: (c) => c.shortCode },
    { key: 'address', header: 'Address', render: (c) => c.address ?? '—', hideOnCard: true },
    { key: 'gstin', header: 'GSTIN', render: (c) => c.gstin ?? '—' },
    { key: 'pan', header: 'PAN', render: (c) => c.pan ?? '—', hideOnCard: true },
    { key: 'pf', header: 'PF code', render: (c) => c.pfEstablishmentCode ?? '—', hideOnCard: true },
    { key: 'esic', header: 'ESIC code', render: (c) => c.esicCode ?? '—', hideOnCard: true },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setIsCreating(true)}>
          Add company
        </Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No companies yet."
        actions={(company) => (
          <>
            <RowAction type="button" onClick={() => setEditing(company)}>
              Edit
            </RowAction>
            <RowAction
              type="button"
              onClick={() => toggleStatus.mutate(company)}
              disabled={toggleStatus.isPending}
              className={company.status === 'active' ? 'text-red-600' : undefined}
            >
              {company.status === 'active' ? 'Deactivate' : 'Activate'}
            </RowAction>
          </>
        )}
      />

      {(isCreating || editing) && (
        <CompanyModal
          company={editing}
          onClose={() => {
            setIsCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
