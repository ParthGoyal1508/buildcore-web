'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/app/lib/api/client';
import { Company, listCompanies, updateCompany } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import { toast } from '@/app/ui/toast';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import CompanyBranchRows from '@/app/ui/settings/company-branch-rows';
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
  // 041: companies whose branches are shown beneath their row.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
    {
      key: 'name',
      header: 'Name',
      sortValue: (c) => c.name,
      render: (c) => {
        const open = expanded.has(c.id);
        return (
          <button
            type="button"
            onClick={() => toggleExpanded(c.id)}
            aria-expanded={open}
            aria-controls={`company-branches-${c.id}`}
            className="flex items-start gap-1.5 text-left hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className={clsx(
                'mt-0.5 h-5 w-5 shrink-0 text-gray-500 transition-transform',
                open && 'rotate-90',
              )}
            />
            <span>
              {c.name}
              {c.branchCount !== undefined && (
                <span className="block text-xs font-normal text-gray-500">
                  {c.branchCount === 1 ? '1 branch' : `${c.branchCount} branches`}
                </span>
              )}
            </span>
          </button>
        );
      },
    },
    { key: 'shortCode', header: 'Short code', render: (c) => c.shortCode },
    // The head office's — every other registration is in the expanded row.
    {
      key: 'address',
      header: 'Head office address',
      render: (c) => c.address ?? '—',
      hideOnCard: true,
    },
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
        detail={(company) =>
          expanded.has(company.id) ? (
            <div id={`company-branches-${company.id}`}>
              <CompanyBranchRows companyId={company.id} />
            </div>
          ) : null
        }
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
