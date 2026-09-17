'use client';

import { useState } from 'react';

import { uploadCountersigned } from '@/app/lib/api/letters';
import { Button } from '@/app/ui/button';
import { FormError } from '@/app/ui/settings/form-fields';

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
 * The executed copy that comes back signed by the other party (017 FR-012, backend FR-017).
 *
 * The issued copy keeps its own file and is not replaced. "We sent this" and "they signed
 * it" are different claims about the world, and a screen that overwrote the first with
 * the second would lose the ability to show what was actually sent — which is the half
 * that matters when the two disagree.
 */
export function CountersignUpload({
  letterId,
  onUploaded,
}: {
  letterId: string;
  onUploaded?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await uploadCountersigned(letterId, {
        data: await readAsBase64(file),
        contentType: file.type || 'application/pdf',
      });
      setFile(null);
      onUploaded?.();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError(
        code && err instanceof Error
          ? err.message
          : 'The executed copy could not be attached.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        aria-label="Executed copy"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
      />
      <FormError message={error} />
      <Button type="button" disabled={!file || busy} onClick={() => void submit()}>
        {busy ? 'Attaching…' : 'Attach executed copy'}
      </Button>
    </div>
  );
}
