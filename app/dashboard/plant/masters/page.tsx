'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteEquipmentCategory,
  deleteHireRate,
  getEquipmentCategories,
  getEquipmentDocTypes,
  getHireRates,
  type EquipmentCategory,
  type EquipmentDocType,
  type HireRate,
} from '@/app/lib/api/plant';
import { MESSAGES, plantLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import {
  CategoryModal,
  DocTypeModal,
  HireRateModal,
} from '@/app/ui/plant/masters-modal';
import { usePlantCompanyId } from '@/app/ui/plant/use-plant-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

type Tab = 'categories' | 'doc-types' | 'rates';

/**
 * The three machinery masters (006 US1, web FR-008).
 *
 * A screen rather than a modal, unlike Inventory's item master: there are three of
 * them and one carries an effective-dated history, which does not fit in a dialog.
 *
 * The tabs are local state rather than routes. `SectionTabs` is route-driven and the
 * module strip above already owns this path, so a second route-driven strip here
 * would fight it — and three tables behind one URL is not something a user needs to
 * bookmark separately.
 */
export default function MastersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('categories');
  const [editingCategory, setEditingCategory] =
    useState<EquipmentCategory | null>(null);
  const [showCategory, setShowCategory] = useState(false);
  const [editingDocType, setEditingDocType] = useState<EquipmentDocType | null>(
    null,
  );
  const [showDocType, setShowDocType] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scoped to the company `CompanyProvider` selected in the layout above. A
  // cross-company administrator otherwise sees every tenant's masters in one list,
  // which reads as the same ten categories repeated once per company.
  const companyId = usePlantCompanyId();

  const categories = useQuery({
    queryKey: ['plant', 'categories', 'all', companyId],
    queryFn: () => getEquipmentCategories(companyId ?? undefined),
  });
  const docTypes = useQuery({
    queryKey: ['plant', 'doc-types', 'all', companyId],
    queryFn: () => getEquipmentDocTypes(companyId ?? undefined),
  });
  const rates = useQuery({
    queryKey: ['plant', 'rates', 'all', companyId],
    queryFn: () => getHireRates(undefined, companyId ?? undefined),
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => deleteEquipmentCategory(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete that category.',
      ),
  });

  const removeRate = useMutation({
    mutationFn: (id: string) => deleteHireRate(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete that rate.',
      ),
  });

  const categoryColumns: Column<EquipmentCategory>[] = [
    {
      key: 'name',
      header: 'Category',
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.name}</span>
          {!row.active && (
            <span className="text-xs text-gray-500">Retired</span>
          )}
        </span>
      ),
    },
    {
      key: 'meter',
      header: 'Meter',
      render: (row) => plantLabel(row.meterType),
    },
    {
      key: 'benchmark',
      header: 'Fuel benchmark',
      render: (row) =>
        row.fuelBenchmark === null
          ? 'Not set'
          : `${row.fuelBenchmark} L per ${row.meterType === 'km' ? 'km' : 'hour'}`,
    },
    {
      key: 'threshold',
      header: 'Variance threshold',
      render: (row) => `${row.fuelVarianceThresholdPercent}%`,
    },
    {
      key: 'target',
      header: 'Target hours',
      hideOnCard: true,
      render: (row) => `${row.targetHoursPerMonth} per month`,
    },
    {
      key: 'count',
      header: 'Machines',
      render: (row) => row.equipmentCount,
    },
  ];

  const docTypeColumns: Column<EquipmentDocType>[] = [
    {
      key: 'name',
      header: 'Type',
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.name}</span>
          {!row.active && (
            <span className="text-xs text-gray-500">Retired</span>
          )}
        </span>
      ),
    },
    {
      key: 'alert',
      header: 'Alert window',
      render: (row) =>
        `${row.alertDays} ${row.alertDays === 1 ? 'day' : 'days'} before expiry`,
    },
  ];

  const rateColumns: Column<HireRate>[] = [
    { key: 'category', header: 'Category', render: (row) => row.categoryName },
    {
      key: 'rate',
      header: 'Rate per unit',
      render: (row) => formatRupees(row.ratePerUnit),
    },
    {
      key: 'from',
      header: 'Effective from',
      render: (row) => row.effectiveFrom.slice(0, 10),
    },
    {
      key: 'to',
      header: 'Effective to',
      // A null end is the rate in force now, and saying so beats an em dash the
      // reader has to interpret.
      render: (row) =>
        row.effectiveTo === null ? (
          <span className="font-medium text-green-800">Current</span>
        ) : (
          row.effectiveTo.slice(0, 10)
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className={`${lusitana.className} text-2xl`}>Machinery Masters</h1>

      {/* Local tabs rather than routes — see the note on this component. */}
      <nav aria-label="Masters sections" className="overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-gray-200">
          {(
            [
              ['categories', 'Categories'],
              ['doc-types', 'Document Types'],
              ['rates', 'Hire Rates'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <li key={value}>
              <button
                type="button"
                aria-current={tab === value ? 'page' : undefined}
                onClick={() => setTab(value)}
                className={
                  tab === value
                    ? '-mb-px block whitespace-nowrap border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
                    : '-mb-px block whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
                }
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <FormError message={error} />

      {tab === 'categories' && (
        <>
          <div className="flex justify-end">
            <SecondaryButton
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setShowCategory(true);
              }}
            >
              Add a category
            </SecondaryButton>
          </div>
          <ResponsiveList
            columns={categoryColumns}
            rows={categories.data ?? []}
            rowKey={(row) => row.id}
            isLoading={categories.isPending}
            error={categories.isError ? MESSAGES.plantLoadFailed : undefined}
            emptyMessage="No equipment categories yet."
            actions={(row) => (
              <>
                <RowAction
                  onClick={() => {
                    setEditingCategory(row);
                    setShowCategory(true);
                  }}
                >
                  Edit
                </RowAction>
                <RowAction
                  // Offered only when nothing references it. The backend refuses
                  // either way; hiding the control keeps the list from advertising
                  // an action that cannot succeed.
                  disabled={row.equipmentCount > 0}
                  title={
                    row.equipmentCount > 0
                      ? 'Machines are registered under this category. Retire it instead.'
                      : undefined
                  }
                  onClick={() => {
                    if (window.confirm(`Delete ${row.name}?`)) {
                      removeCategory.mutate(row.id);
                    }
                  }}
                >
                  Delete
                </RowAction>
              </>
            )}
          />
        </>
      )}

      {tab === 'doc-types' && (
        <>
          <div className="flex justify-end">
            <SecondaryButton
              type="button"
              onClick={() => {
                setEditingDocType(null);
                setShowDocType(true);
              }}
            >
              Add a document type
            </SecondaryButton>
          </div>
          <ResponsiveList
            columns={docTypeColumns}
            rows={docTypes.data ?? []}
            rowKey={(row) => row.id}
            isLoading={docTypes.isPending}
            error={docTypes.isError ? MESSAGES.plantLoadFailed : undefined}
            emptyMessage="No document types yet."
            actions={(row) => (
              <RowAction
                onClick={() => {
                  setEditingDocType(row);
                  setShowDocType(true);
                }}
              >
                Edit
              </RowAction>
            )}
          />
          <p className="text-xs text-gray-500">
            Document types cannot be deleted: every document already attached to a
            machine takes its expiry window from one. Retire a type instead.
          </p>
        </>
      )}

      {tab === 'rates' && (
        <>
          <div className="flex justify-end">
            <SecondaryButton type="button" onClick={() => setShowRate(true)}>
              Add a rate
            </SecondaryButton>
          </div>
          <ResponsiveList
            columns={rateColumns}
            rows={rates.data ?? []}
            rowKey={(row) => row.id}
            isLoading={rates.isPending}
            error={rates.isError ? MESSAGES.plantLoadFailed : undefined}
            emptyMessage="No hire rates yet. Add one before raising a hire bill."
            actions={(row) => (
              <RowAction
                // Only the open-ended rate can go, and removing it reopens its
                // predecessor. Deleting from the middle would leave a gap no bill
                // could resolve, which the backend refuses.
                disabled={row.effectiveTo !== null}
                title={
                  row.effectiveTo !== null
                    ? 'Only the current rate can be removed — deleting one from the middle of the timeline would leave a gap.'
                    : undefined
                }
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove this rate? The previous one becomes current again.`,
                    )
                  ) {
                    removeRate.mutate(row.id);
                  }
                }}
              >
                Delete
              </RowAction>
            )}
          />
          <p className="text-xs text-gray-500">
            Rates are a timeline, not a setting. A new rate closes the one before it
            the day before it starts, so a hire bill for an earlier period still
            resolves the rate that was in force then.
          </p>
        </>
      )}

      {showCategory && (
        <CategoryModal
          category={editingCategory ?? undefined}
          onClose={() => {
            setShowCategory(false);
            setEditingCategory(null);
          }}
        />
      )}
      {showDocType && (
        <DocTypeModal
          docType={editingDocType ?? undefined}
          onClose={() => {
            setShowDocType(false);
            setEditingDocType(null);
          }}
        />
      )}
      {showRate && <HireRateModal onClose={() => setShowRate(false)} />}
    </div>
  );
}
