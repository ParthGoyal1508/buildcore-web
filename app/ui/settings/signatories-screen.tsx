'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getSignatories, upsertSignatory } from '@/app/lib/api/letters';
import { Button } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

const QUERY_KEY = ['signatories'];

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Named signatories and their signature graphics (017 US4, FR-016).
 *
 * The 2026-09-15 clarification settled what "digital signature" means in this product:
 * an authorised signature **image** applied to a rendered letter, not a legally
 * recognised Digital Signature Certificate under the IT Act. Those differ in cost,
 * workflow and legal effect, and this screen implements the first.
 *
 * Note what is not here: the graphic is never displayed back. The server exposes no route
 * returning it, and it should not — a signature a browser can fetch is a signature anyone
 * with the link can paste onto a letter of their own.
 */
export function SignatoriesScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * No company segment any more (019 FR-005).
   *
   * The hazard this guarded against is real — react-query answering a switch from cache
   * shows the previous company's rows under the new company's name, the failure that looks
   * exactly like success. It is now handled once, centrally: the switcher clears the whole
   * cache, so no screen has to remember to key on a company it no longer knows.
   */
  const queryKey = [...QUERY_KEY];

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => getSignatories(),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a signature image.');
      return upsertSignatory(
        {
          name,
          title,
          signature: await readAsBase64(file),
          contentType: file.type || 'image/png',
        },
        undefined,
      );
    },
    onSuccess: () => {
      setName('');
      setTitle('');
      setFile(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string } | null)?.code;
      setError(
        code && err instanceof Error
          ? err.message
          : 'The signatory could not be saved.',
      );
    },
  });

  if (isPending) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !data) {
    return <FormError message="Signatories could not be loaded." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError message={error} />

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {data.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-gray-500">
            No signatories yet. A letter kind that carries a signature cannot be
            issued until one exists.
          </li>
        )}
        {data.map((signatory) => (
          <li key={signatory.id} className="px-3 py-2">
            <p className="text-sm text-gray-900">{signatory.name}</p>
            <p className="text-xs text-gray-500">
              {signatory.title}
              {signatory.isActive ? '' : ' · inactive'}
            </p>
          </li>
        ))}
      </ul>

      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-900">
          Add a signatory
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="signatory-name"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            id="signatory-title"
            label="Title"
            hint="Printed beneath the signature."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <label
            htmlFor="signatory-image"
            className="mb-1 block text-sm font-medium text-gray-900"
          >
            Signature image
          </label>
          <input
            id="signatory-image"
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Replacing this later changes what future letters carry. Letters
            already issued keep the signature applied at the time.
          </p>
        </div>
        <Button
          type="button"
          className="mt-4"
          disabled={!name.trim() || !title.trim() || !file || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Saving…' : 'Add signatory'}
        </Button>
      </section>
    </div>
  );
}
