'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  importEquipmentMasterList,
  type EquipmentImportResult,
} from '@/app/lib/api/plant';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';
import { usePlantCompanyId } from './use-plant-refs';

/** Strips the `data:...;base64,` prefix a FileReader result carries. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * The one-time import of the client's Equipment Master List (2026-10-15).
 *
 * The result stays on screen rather than closing the modal: what was created and, above all,
 * which rows were skipped and why is the point of running it, and a toast would lose the list.
 */
export default function EquipmentImportModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EquipmentImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose the master list first.');
      return importEquipmentMasterList(
        await toBase64(file),
        file.name,
        companyId ?? undefined,
      );
    },
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : (err as Error).message),
  });

  return (
    <Modal
      title="Import the equipment master list"
      onClose={onClose}
      footer={
        result ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <SecondaryButton type="button" onClick={onClose}>
              Cancel
            </SecondaryButton>
            <Button
              type="submit"
              form="equipment-import-form"
              disabled={run.isPending || !file}
            >
              {run.isPending ? 'Importing…' : 'Import'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-4" role="status">
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: 'Categories created', value: result.categoriesCreated },
              {
                label: 'Already there',
                value: result.categoriesExisting,
              },
              { label: 'Machines registered', value: result.equipmentCreated },
            ].map((fact) => (
              <div
                key={fact.label}
                className="rounded-md border border-gray-200 bg-gray-50 p-3"
              >
                <dt className="text-xs text-gray-500">{fact.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-gray-900">
                  {fact.value.toLocaleString('en-IN')}
                </dd>
              </div>
            ))}
          </dl>
          {result.skipped.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                {result.skipped.length}{' '}
                {result.skipped.length === 1 ? 'row was' : 'rows were'} skipped
              </h3>
              <ul className="mt-2 max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 text-sm">
                {result.skipped.map((row) => (
                  <li key={`${row.row}-${row.name}`} className="px-3 py-2">
                    <span className="font-medium text-gray-900">
                      Row {row.row}
                      {row.name ? ` · ${row.name}` : ''}
                    </span>
                    <span className="block text-gray-600">{row.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No rows were skipped.</p>
          )}
        </div>
      ) : (
        <form
          id="equipment-import-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            run.mutate();
          }}
        >
          <FormError message={error} />
          <p className="text-sm text-gray-600">
            Every machine type listed becomes a category under its family, and a
            row that describes an actual machine (make, registration no.,
            operator…) registers it. Running it again changes nothing.
          </p>
          <div>
            <label
              htmlFor="equipment-import-file"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Master list (.xlsx)
            </label>
            <input
              id="equipment-import-file"
              type="file"
              required
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-md border border-gray-200 p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
