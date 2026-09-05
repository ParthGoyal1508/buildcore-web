'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { returnAllocation, type Allocation } from '@/app/lib/api/assets';
import { ApiError } from '@/app/lib/api/client';
import { MESSAGES, assetsLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import { useConditionGrades } from './use-asset-refs';

/**
 * Record the return of an allocated asset (spec US4, FR-012).
 *
 * The consequence of the chosen grade is shown *before* it is applied, not after: a
 * scrap grade condemns the asset and a damaged one sends it for repair, and both are
 * awkward to undo — a scrapped asset is terminal by design on the backend. Nobody
 * should discover that from the row that comes back.
 *
 * The mapping is read from the grade's own `isDamaged` / `isScrap` flags rather than
 * hardcoded here, so a company that renames its ladder does not have to change this
 * screen.
 */
function statusFor(grade?: { isDamaged: boolean; isScrap: boolean }): string {
  if (!grade) return 'idle';
  if (grade.isScrap) return 'scrapped';
  if (grade.isDamaged) return 'under_repair';
  return 'idle';
}

export default function ReturnModal({
  allocation,
  onClose,
}: {
  allocation: Allocation;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const grades = useConditionGrades();

  const [actualReturnDate, setActualReturnDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [conditionOnReturnId, setConditionOnReturnId] = useState('');
  const [remarks, setRemarks] = useState(allocation.remarks ?? '');
  const [error, setError] = useState<string | null>(null);

  const grade = (grades.data ?? []).find(
    (entry) => entry.id === conditionOnReturnId,
  );
  const resultingStatus = statusFor(grade);

  const submit = useMutation({
    mutationFn: () =>
      returnAllocation(allocation.id, {
        actualReturnDate,
        conditionOnReturnId,
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  const noGrades = grades.data?.length === 0;

  return (
    <Modal
      title={`Return ${allocation.assetCode}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="return-form"
            disabled={submit.isPending || !conditionOnReturnId}
          >
            {submit.isPending ? 'Recording…' : 'Record return'}
          </Button>
        </>
      }
    >
      <form
        id="return-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          submit.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />
        {noGrades && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {MESSAGES.assetsNoGrades}
          </p>
        )}

        <p className="text-sm text-gray-600">
          {allocation.assetName} — out at {allocation.siteName} since{' '}
          {allocation.allocatedFrom.slice(0, 10)}
          {allocation.custodianName ? `, held by ${allocation.custodianName}` : ''}.
        </p>

        <TextField
          id="return-date"
          label="Returned on"
          type="date"
          value={actualReturnDate}
          onChange={(event) => setActualReturnDate(event.target.value)}
          required
        />

        <SelectField
          id="return-condition"
          label="Condition it came back in"
          value={conditionOnReturnId}
          onChange={(event) => setConditionOnReturnId(event.target.value)}
          required
        >
          <option value="">Select a grade</option>
          {(grades.data ?? []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </SelectField>

        {grade && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <p className="flex flex-wrap items-center gap-2">
              <span>Recording this return will set the asset to</span>
              <StatusBadge
                status={resultingStatus}
                label={assetsLabel(resultingStatus)}
              />
            </p>
            {resultingStatus === 'scrapped' && (
              <p className="mt-1 text-xs text-red-700">
                A scrapped asset leaves the register for good and its quantity does
                not go back on the shelf. This cannot be undone here.
              </p>
            )}
            {resultingStatus === 'under_repair' && (
              <p className="mt-1 text-xs text-gray-600">
                It will not be available to allocate until the repair is closed.
              </p>
            )}
          </div>
        )}

        <TextField
          id="return-remarks"
          label="Remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          maxLength={500}
        />
      </form>
    </Modal>
  );
}
