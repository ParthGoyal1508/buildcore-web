'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  Shift,
  createShift,
  deleteShift,
  listShifts,
  updateShift,
} from '@/app/lib/api/settings';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { useCompanyContext } from '@/app/ui/settings/company-context';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

interface FormState {
  name: string;
  inTime: string;
  outTime: string;
  graceMinutes: number;
}

const EMPTY: FormState = {
  name: '',
  inTime: '09:00',
  outTime: '18:00',
  graceMinutes: 0,
};

export default function ShiftTab() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Shift | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirming, setConfirming] = useState<Shift | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shifts', companyId],
    queryFn: () => listShifts(companyId ?? undefined),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateShift(editing.id, form)
        : createShift({ ...(companyId ? { companyId } : {}), ...form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      close();
    },
    onError: (error: unknown) =>
      setFormError(error instanceof ApiError ? error.message : MESSAGES.saveFailed),
  });

  const removal = useMutation({
    mutationFn: (shift: Shift) => deleteShift(shift.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setConfirming(null);
    },
    // 409 means an employee is still on this shift (spec FR-018).
    onError: (error: unknown) =>
      setDeleteError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      ),
  });

  function openCreate() {
    setForm(EMPTY);
    setFormError(null);
    setIsCreating(true);
  }

  function openEdit(shift: Shift) {
    setForm({
      name: shift.name,
      inTime: shift.inTime,
      outTime: shift.outTime,
      graceMinutes: shift.graceMinutes,
    });
    setFormError(null);
    setEditing(shift);
  }

  function close() {
    setIsCreating(false);
    setEditing(null);
    setForm(EMPTY);
  }

  const columns: Column<Shift>[] = [
    { key: 'name', header: 'Shift', render: (s) => s.name },
    { key: 'inTime', header: 'In', render: (s) => s.inTime },
    { key: 'outTime', header: 'Out', render: (s) => s.outTime },
    { key: 'grace', header: 'Grace (min)', render: (s) => s.graceMinutes },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openCreate}>
          Add shift
        </Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No shifts for this company yet."
        actions={(shift) => (
          <>
            <RowAction type="button" onClick={() => openEdit(shift)}>
              Edit
            </RowAction>
            <RowAction
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirming(shift);
              }}
              className="text-red-600"
            >
              Delete
            </RowAction>
          </>
        )}
      />

      {(isCreating || editing) && (
        <Modal
          title={editing ? `Edit ${editing.name}` : 'Add shift'}
          onClose={close}
          footer={
            <>
              <SecondaryButton type="button" onClick={close}>
                Cancel
              </SecondaryButton>
              <Button type="submit" form="shift-form" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <form
            id="shift-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              if (!form.name.trim()) {
                setFormError('Shift name is required.');
                return;
              }
              save.mutate();
            }}
          >
            <FormError message={formError} />
            <TextField
              id="shift-name"
              label="Shift name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {/* Native time inputs — keyboard-operable and locale-aware for free. */}
            <TextField
              id="shift-in"
              label="In time"
              type="time"
              value={form.inTime}
              onChange={(e) => setForm({ ...form, inTime: e.target.value })}
            />
            <TextField
              id="shift-out"
              label="Out time"
              type="time"
              value={form.outTime}
              onChange={(e) => setForm({ ...form, outTime: e.target.value })}
            />
            <TextField
              id="shift-grace"
              label="Grace period (minutes)"
              type="number"
              min={0}
              max={240}
              value={form.graceMinutes}
              onChange={(e) =>
                setForm({ ...form, graceMinutes: Number(e.target.value) })
              }
            />
          </form>
        </Modal>
      )}

      {confirming && (
        <Modal
          title="Delete shift"
          onClose={() => setConfirming(null)}
          footer={
            <>
              <SecondaryButton type="button" onClick={() => setConfirming(null)}>
                Cancel
              </SecondaryButton>
              <Button
                type="button"
                onClick={() => removal.mutate(confirming)}
                disabled={removal.isPending}
                className="bg-red-600 hover:bg-red-500 focus-visible:outline-red-600 active:bg-red-700"
              >
                {removal.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <FormError message={deleteError} />
            <p className="text-sm text-gray-700">
              {MESSAGES.confirmDelete('shift', confirming.name)}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
