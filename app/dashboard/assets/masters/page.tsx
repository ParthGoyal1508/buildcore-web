'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteAssetCategory,
  deleteAssetDocType,
  deleteConditionGrade,
  getAssetCategories,
  getAssetDocTypes,
  getConditionGrades,
  type AssetCategory,
  type AssetDocType,
  type ConditionGrade,
} from '@/app/lib/api/assets';
import { MESSAGES, assetsLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import {
  CategoryModal,
  ConditionGradeModal,
  DocTypeModal,
} from '@/app/ui/assets/masters-modal';
import { useAssetsCompanyId } from '@/app/ui/assets/use-asset-refs';
import { lusitana } from '@/app/ui/fonts';
import {
  FormError,
  RowAction,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

type Tab = 'categories' | 'doc-types' | 'grades';

/**
 * The three asset masters (012 US1).
 *
 * A screen rather than a modal, the same choice Plant's masters made and for the same
 * reason: three tables with behaviour attached to their rows is not a dialog. The
 * tasks name a `masters-modal.tsx` "composing all three tabs"; that file exists and
 * holds the three *forms*, which is the part a dialog is right for.
 *
 * The tabs are local state rather than routes. `SectionTabs` is route-driven and the
 * module strip above already owns this path, so a second route-driven strip here
 * would fight it.
 */
export default function AssetMastersPage() {
  const queryClient = useQueryClient();
  const companyId = useAssetsCompanyId();
  const [tab, setTab] = useState<Tab>('categories');
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(
    null,
  );
  const [showCategory, setShowCategory] = useState(false);
  const [editingDocType, setEditingDocType] = useState<AssetDocType | null>(
    null,
  );
  const [showDocType, setShowDocType] = useState(false);
  const [editingGrade, setEditingGrade] = useState<ConditionGrade | null>(null);
  const [showGrade, setShowGrade] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scoped to the company `CompanyProvider` selected in the layout above. A
  // cross-company administrator otherwise sees every tenant's masters in one list.
  const categories = useQuery({
    queryKey: ['assets', 'categories', 'all', companyId],
    queryFn: () => getAssetCategories(companyId ?? undefined),
  });
  const docTypes = useQuery({
    queryKey: ['assets', 'doc-types', 'all', companyId],
    queryFn: () => getAssetDocTypes(companyId ?? undefined),
  });
  const grades = useQuery({
    queryKey: ['assets', 'condition-grades', 'all', companyId],
    queryFn: () => getConditionGrades(companyId ?? undefined),
  });

  function onRemoveError(err: unknown) {
    setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed);
  }
  function onRemoved() {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ['assets'] });
  }

  const removeCategory = useMutation({
    mutationFn: deleteAssetCategory,
    onSuccess: onRemoved,
    onError: onRemoveError,
  });
  const removeDocType = useMutation({
    mutationFn: deleteAssetDocType,
    onSuccess: onRemoved,
    onError: onRemoveError,
  });
  const removeGrade = useMutation({
    mutationFn: deleteConditionGrade,
    onSuccess: onRemoved,
    onError: onRemoveError,
  });

  const categoryColumns: Column<AssetCategory>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    {
      key: 'mode',
      header: 'Tracking',
      render: (row) => assetsLabel(row.trackingMode),
    },
    {
      key: 'assets',
      header: 'Assets',
      render: (row) => row.assetCount.toLocaleString('en-IN'),
    },
    {
      key: 'value',
      header: 'Book value',
      render: (row) => formatRupees(row.totalBookValue),
    },
    {
      key: 'rules',
      header: 'Rules',
      hideOnCard: true,
      render: (row) => (
        <span className="text-sm text-gray-600">
          {[
            row.custodyRequired ? 'Custody' : null,
            row.inspectionRequired
              ? `Inspection every ${row.inspectionIntervalDays} days`
              : null,
            `${row.depreciationRatePercent}% / year`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (row.active ? 'Active' : 'Retired'),
    },
  ];

  const docTypeColumns: Column<AssetDocType>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    {
      key: 'alert',
      header: 'Notice',
      render: (row) => `${row.alertDays} days before expiry`,
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (row.active ? 'Active' : 'Retired'),
    },
  ];

  const gradeColumns: Column<ConditionGrade>[] = [
    { key: 'sequence', header: '#', render: (row) => row.sequence },
    { key: 'name', header: 'Name', render: (row) => row.name },
    {
      key: 'effect',
      header: 'A return at this grade',
      render: (row) =>
        row.isScrap
          ? 'Condemns the asset'
          : row.isDamaged
            ? 'Sends it for repair'
            : 'Returns it to the shelf',
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (row.active ? 'Active' : 'Retired'),
    },
  ];

  const TABS: { id: Tab; name: string }[] = [
    { id: 'categories', name: 'Categories' },
    { id: 'doc-types', name: 'Document types' },
    { id: 'grades', name: 'Condition grades' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Asset Masters</h1>
        <SecondaryButton
          type="button"
          onClick={() => {
            setError(null);
            if (tab === 'categories') {
              setEditingCategory(null);
              setShowCategory(true);
            } else if (tab === 'doc-types') {
              setEditingDocType(null);
              setShowDocType(true);
            } else {
              setEditingGrade(null);
              setShowGrade(true);
            }
          }}
        >
          {tab === 'categories'
            ? 'Add a category'
            : tab === 'doc-types'
              ? 'Add a document type'
              : 'Add a condition grade'}
        </SecondaryButton>
      </div>

      <nav aria-label="Asset masters" className="overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-gray-200">
          {TABS.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-current={tab === entry.id ? 'page' : undefined}
                onClick={() => setTab(entry.id)}
                className={`-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                  tab === entry.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                {entry.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <FormError message={error} />

      {tab === 'categories' && (
        <ResponsiveList
          columns={categoryColumns}
          rows={categories.data ?? []}
          rowKey={(row) => row.id}
          isLoading={categories.isPending}
          error={categories.isError ? MESSAGES.loadFailed : undefined}
          emptyMessage="No asset categories yet."
          actions={(row) => (
            <div className="flex gap-2">
              <RowAction
                onClick={() => {
                  setEditingCategory(row);
                  setShowCategory(true);
                }}
              >
                Edit
              </RowAction>
              {/*
                Delete is offered only while the category is empty. The backend
                refuses it with a 409 once anything is registered, and the count is
                already on the row — so the control simply is not there rather than
                being there to fail.
              */}
              {row.assetCount === 0 && (
                <RowAction
                  onClick={() => removeCategory.mutate(row.id)}
                  disabled={removeCategory.isPending}
                >
                  Delete
                </RowAction>
              )}
            </div>
          )}
        />
      )}

      {tab === 'doc-types' && (
        <ResponsiveList
          columns={docTypeColumns}
          rows={docTypes.data ?? []}
          rowKey={(row) => row.id}
          isLoading={docTypes.isPending}
          error={docTypes.isError ? MESSAGES.loadFailed : undefined}
          emptyMessage="No document types yet."
          actions={(row) => (
            <div className="flex gap-2">
              <RowAction
                onClick={() => {
                  setEditingDocType(row);
                  setShowDocType(true);
                }}
              >
                Edit
              </RowAction>
              <RowAction
                onClick={() => removeDocType.mutate(row.id)}
                disabled={removeDocType.isPending}
              >
                Delete
              </RowAction>
            </div>
          )}
        />
      )}

      {tab === 'grades' && (
        <ResponsiveList
          columns={gradeColumns}
          rows={grades.data ?? []}
          rowKey={(row) => row.id}
          isLoading={grades.isPending}
          error={grades.isError ? MESSAGES.loadFailed : undefined}
          emptyMessage={MESSAGES.assetsNoGrades}
          actions={(row) => (
            <div className="flex gap-2">
              <RowAction
                onClick={() => {
                  setEditingGrade(row);
                  setShowGrade(true);
                }}
              >
                Edit
              </RowAction>
              <RowAction
                onClick={() => removeGrade.mutate(row.id)}
                disabled={removeGrade.isPending}
              >
                Delete
              </RowAction>
            </div>
          )}
        />
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
      {showGrade && (
        <ConditionGradeModal
          grade={editingGrade ?? undefined}
          onClose={() => {
            setShowGrade(false);
            setEditingGrade(null);
          }}
        />
      )}
    </div>
  );
}
