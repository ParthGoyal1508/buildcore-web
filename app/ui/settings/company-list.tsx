'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/app/lib/api/client';
import { Company, listCompanies, updateCompany } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import { toast } from '@/app/ui/toast';
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });
  const { data: me } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  // 036 C9: adding a company, and activating or deactivating one, are a group administrator's
  // (CROSS_COMPANY_ACCESS). The API refused a company administrator every time; the controls now
  // are not offered rather than offered and refused.
  const isGroupAdmin = me?.permissions.includes('CROSS_COMPANY_ACCESS') ?? false;

  /** Companies are never hard-deleted — historical data has to stay intact — so
   * deactivating is the delete-equivalent action (FR-001, FR-005). */
  const toggleStatus = useMutation({
    mutationFn: (company: Company) =>
      updateCompany(company.id, {
        status: company.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: (saved) => {
      // Covers `['companies', 'active']` and `['companies', 'selectable']`, which every
      // company-selector reads and this change alters.
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success(
        saved.status === 'active'
          ? `${saved.name} activated.`
          : `${saved.name} deactivated.`,
      );
    },
    // It used to fail silently (036 C8).
    onError: (err: unknown) =>
      toast.error(errorMessage(err, 'The company status could not be changed.')),
  });

  /** Deactivating hides a company from every selector, so it is confirmed first (036 C8). */
  const changeStatus = async (company: Company) => {
    if (company.status === 'active') {
      const ok = await confirmDialog({
        title: `Deactivate ${company.name}?`,
        message:
          'It will no longer be offered in company selectors, and nobody can switch to it. Its records are kept, and it can be activated again.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
    }
    toggleStatus.mutate(company);
  };

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
      {isGroupAdmin && (
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={() => setIsCreating(true)}>
            Add company
          </Button>
        </div>
      )}

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        error={isError ? error : null}
        onRetry={refetch}
        emptyMessage="No companies yet."
        actions={(company) => (
          <>
            <RowAction type="button" onClick={() => setEditing(company)}>
              Edit
            </RowAction>
            {isGroupAdmin && (
              <RowAction
                type="button"
                onClick={() => void changeStatus(company)}
                loading={
                  toggleStatus.isPending &&
                  toggleStatus.variables?.id === company.id
                }
                disabled={toggleStatus.isPending}
                className={company.status === 'active' ? 'text-red-600' : undefined}
              >
                {company.status === 'active' ? 'Deactivate' : 'Activate'}
              </RowAction>
            )}
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
