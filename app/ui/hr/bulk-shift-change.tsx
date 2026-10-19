'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  bulkSetShift,
  getShiftRoster,
  listSites,
  type ShiftRosterRow,
} from '@/app/lib/api/hr-payroll';
import { listDepartments, listShifts } from '@/app/lib/api/settings';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import {
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

const nameOf = (row: ShiftRosterRow) =>
  [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
  row.employeeCode;

const CHECKBOX =
  'h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-accent-500';

/**
 * Moves many employees onto one shift in one action (036) — the client rotates crews between Day
 * and Night every week or ten days, and used to open each employee's form to do it.
 *
 * The whole active roster is loaded once, so search, filters and "select all" are instant and
 * work on every employee, not one page of them. The selection survives a filter change: an
 * administrator can tick the Civil department, switch to Electrical and tick that too. What is
 * selected but filtered out of view is said beside the count, so nobody moves people they
 * cannot see without being told.
 */
export default function BulkShiftChange() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [targetShiftId, setTargetShiftId] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [currentShiftId, setCurrentShiftId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const roster = useQuery({
    queryKey: ['hr', 'employees', 'shift-roster'],
    queryFn: getShiftRoster,
  });
  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => listShifts(),
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites });

  const shiftName = (id: string) => shifts?.find((s) => s.id === id)?.name ?? '—';
  const departmentName = (id: string | null) =>
    departments?.find((d) => d.id === id)?.name ?? '—';
  const siteName = (id: string) => sites?.find((s) => s.id === id)?.name ?? '—';

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (roster.data ?? []).filter(
      (row) =>
        (!departmentId || row.departmentId === departmentId) &&
        (!siteId || row.siteId === siteId) &&
        (!currentShiftId || row.shiftId === currentShiftId) &&
        (!term ||
          row.employeeCode.toLowerCase().includes(term) ||
          nameOf(row).toLowerCase().includes(term)),
    );
  }, [roster.data, search, departmentId, siteId, currentShiftId]);

  const visibleSelected = visible.filter((row) => selected.has(row.id)).length;
  const hiddenSelected = selected.size - visibleSelected;
  const allVisibleSelected = visible.length > 0 && visibleSelected === visible.length;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = visibleSelected > 0 && !allVisibleSelected;
    }
  }, [visibleSelected, allVisibleSelected]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of visible) {
        if (allVisibleSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });

  const apply = useMutation({
    mutationFn: () =>
      bulkSetShift({ shiftId: targetShiftId, employeeIds: [...selected] }),
    onSuccess: ({ updated }) => {
      toast.success(
        `Moved ${updated} employee${updated === 1 ? '' : 's'} to the ${shiftName(targetShiftId)} shift.`,
      );
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not change the shifts.')),
  });

  const onApply = async () => {
    const target = shiftName(targetShiftId);
    const alreadyOn = (roster.data ?? []).filter(
      (row) => selected.has(row.id) && row.shiftId === targetShiftId,
    ).length;
    const ok = await confirmDialog({
      title: `Move ${selected.size} employee${selected.size === 1 ? '' : 's'} to ${target}?`,
      message: [
        hiddenSelected > 0
          ? `${hiddenSelected} of them are hidden by the current filters.`
          : '',
        alreadyOn > 0 ? `${alreadyOn} are already on ${target} and stay there.` : '',
        'Attendance already recorded keeps the shift it was worked on.',
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Change shifts',
      tone: 'default',
    });
    if (ok) apply.mutate();
  };

  const columns: Column<ShiftRosterRow>[] = [
    {
      key: 'select',
      header: 'Select',
      sortable: false,
      render: (row) => (
        <input
          type="checkbox"
          className={CHECKBOX}
          checked={selected.has(row.id)}
          onChange={() => toggle(row.id)}
          aria-label={`Select ${row.employeeCode} ${nameOf(row)}`}
        />
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortValue: (row) => row.employeeCode,
      render: (row) => row.employeeCode,
    },
    { key: 'name', header: 'Name', sortValue: nameOf, render: nameOf },
    {
      key: 'department',
      header: 'Department',
      sortValue: (row) => departmentName(row.departmentId),
      render: (row) => departmentName(row.departmentId),
    },
    {
      key: 'site',
      header: 'Site',
      sortValue: (row) => siteName(row.siteId),
      render: (row) => siteName(row.siteId),
    },
    {
      key: 'shift',
      header: 'Current shift',
      sortValue: (row) => shiftName(row.shiftId),
      render: (row) => shiftName(row.shiftId),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="sm:w-72">
          <SelectField
            id="bulk-shift-target"
            label="Move to shift"
            value={targetShiftId}
            onChange={(event) => setTargetShiftId(event.target.value)}
          >
            <option value="">Choose a shift</option>
            {shifts?.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3 sm:justify-end">
          <p className="text-sm text-gray-700" role="status">
            <span className="font-semibold">{selected.size}</span> selected
            {hiddenSelected > 0 && (
              <span className="text-gray-500">
                {' '}
                ({hiddenSelected} hidden by filters)
              </span>
            )}
          </p>
          {selected.size > 0 && (
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </SecondaryButton>
          )}
          <Button
            type="button"
            loading={apply.isPending}
            disabled={!targetShiftId || selected.size === 0}
            onClick={() => void onApply()}
          >
            {targetShiftId && selected.size > 0
              ? `Move ${selected.size} to ${shiftName(targetShiftId)}`
              : 'Change shifts'}
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="bulk-shift-search"
          label="Search"
          placeholder="Code or name"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          id="bulk-shift-department"
          label="Department"
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
        >
          <option value="">All departments</option>
          {departments?.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="bulk-shift-site"
          label="Site"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">All sites</option>
          {sites?.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="bulk-shift-current"
          label="Current shift"
          value={currentShiftId}
          onChange={(event) => setCurrentShiftId(event.target.value)}
        >
          <option value="">All shifts</option>
          {shifts?.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.name}
            </option>
          ))}
        </SelectField>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-gray-700">
        <input
          ref={selectAllRef}
          type="checkbox"
          className={CHECKBOX}
          checked={allVisibleSelected}
          disabled={visible.length === 0}
          onChange={toggleAllVisible}
        />
        Select all {visible.length} shown
      </label>

      <DataTable
        caption="Employees to move"
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        isLoading={roster.isPending}
        error={roster.isError ? roster.error : null}
        onRetry={() => roster.refetch()}
        stickyHeader
        emptyMessage={
          roster.data?.length
            ? 'No employee matches these filters.'
            : 'No active employees.'
        }
      />
    </div>
  );
}
