'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type LetterKind,
  composeLetter,
  downloadLetter,
  getLetterKindFields,
  getLetterKinds,
  getLetters,
} from '@/app/lib/api/letters';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import StatusBadge from '@/app/ui/status-badge';

/**
 * The letters a project issues (025 FR-033).
 *
 * ## What was missing, exactly
 *
 * The letters module has permitted `letter_work_order`, `letter_loi` and
 * `letter_purchase_order` since feature 017, each mapped to `PROJECT_FINANCIALS` rather than
 * `PROJECTS` — because issuing a work order is a spending decision. Templates, signatories,
 * versioning and countersigned uploads were all built. **Nothing anywhere called `composeLetter`**,
 * so none of it could be reached, and the only letters surface in the application was recruitment's,
 * which uses a different and older API.
 *
 * ## The subject pair is opaque, deliberately
 *
 * A letter addresses `subjectType` + `subjectId` and the letters module never resolves the pair.
 * That is what lets a letter address a project without that module knowing what a project is — so
 * this screen passes `project` and the id, and asks for nothing else.
 *
 * ## The fields come from the kind, not from here
 *
 * Each kind declares its own tokens, and a field that renders blank in a signed letter is
 * indistinguishable from a deliberate omission. So the form is built from what the kind declares
 * rather than from a list typed here, and a kind whose fields change needs no change to this file.
 */
const PROJECT_KINDS = [
  'letter_work_order',
  'letter_loi',
  'letter_purchase_order',
];

export default function ProjectLetters({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState<LetterKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kinds = useQuery({
    queryKey: ['letter-kinds'],
    queryFn: () => getLetterKinds(),
  });

  const letters = useQuery({
    queryKey: ['letters', 'project', projectId],
    queryFn: () =>
      getLetters({ subjectType: 'project', subjectId: projectId }),
  });

  const projectKinds = (kinds.data ?? []).filter(
    (kind) => PROJECT_KINDS.includes(kind.key) && kind.isActive,
  );

  const download = async (letterId: string, label: string) => {
    try {
      const blob = await downloadLetter(letterId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${label}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('That letter could not be downloaded.');
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">Letters</h2>
        <p className="text-sm text-gray-600">
          Work orders, letters of intent and purchase orders issued on this
          project. Each is versioned: reissuing supersedes rather than replaces,
          so what was sent stays readable.
        </p>
      </header>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {projectKinds.length === 0 ? (
          <p className="text-sm text-gray-600">
            No project letter kind is defined. They are configured in settings
            rather than released.
          </p>
        ) : (
          projectKinds.map((kind) => (
            <Button key={kind.id} onClick={() => setComposing(kind)}>
              Issue a {kind.label.toLowerCase()}
            </Button>
          ))
        )}
      </div>

      {composing && (
        <ComposeLetter
          kind={composing}
          projectId={projectId}
          onClose={() => setComposing(null)}
          onIssued={() => {
            setComposing(null);
            void queryClient.invalidateQueries({
              queryKey: ['letters', 'project', projectId],
            });
          }}
        />
      )}

      {letters.isLoading ? (
        <p className="text-sm text-gray-500">Loading letters…</p>
      ) : (letters.data ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          No letter has been issued on this project.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2 text-right">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(letters.data ?? []).map((letter) => (
                <tr key={letter.id}>
                  <td className="px-3 py-2">{letter.letterKindKey}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={letter.status} />
                  </td>
                  <td className="px-3 py-2">
                    {letter.issuedAt
                      ? dateLabel(String(letter.issuedAt))
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      onClick={() =>
                        void download(letter.id, letter.letterKindKey)
                      }
                    >
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * One letter being composed.
 *
 * **A gated kind comes back `composed` rather than `issued`, and that is not an error.** The letter
 * is waiting on a person; rendering it as a failure would send somebody to raise it again.
 */
function ComposeLetter({
  kind,
  projectId,
  onClose,
  onIssued,
}: {
  kind: LetterKind;
  projectId: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fields = useQuery({
    queryKey: ['letter-kind-fields', kind.id],
    queryFn: () => getLetterKindFields(kind.id),
  });

  // Only the manual ones: everything else the server reads from its own source, and offering a box
  // for a value the server will overwrite teaches people their typing does not matter.
  const manual = (fields.data ?? []).filter(
    (field) => field.sourceType === 'manual',
  );

  const compose = useMutation({
    mutationFn: () =>
      composeLetter({
        letterKindKey: kind.key,
        subjectType: 'project',
        subjectId: projectId,
        variables: values,
      }),
    onSuccess: (letter) => {
      setError(null);
      if (letter.status === 'issued') {
        onIssued();
      } else {
        setNotice(
          'Composed, and waiting on an approval. It is not issued yet, and raising it again would make a second one.',
        );
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-gray-200 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        compose.mutate();
      }}
    >
      <h3 className="text-sm font-semibold text-gray-900">{kind.label}</h3>

      {fields.isLoading ? (
        <p className="text-sm text-gray-500">Reading the kind&rsquo;s fields…</p>
      ) : manual.length === 0 ? (
        <p className="text-sm text-gray-600">
          This kind fills itself from the project and needs nothing typed.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {manual.map((field) => (
            <label key={field.token} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">
                {field.label}
                {field.isRequired && <span className="text-red-600"> *</span>}
              </span>
              <input
                required={field.isRequired}
                value={values[field.token] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.token]: event.target.value,
                  }))
                }
                className="rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900" role="status">
          {notice}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={compose.isPending}>
          {compose.isPending ? 'Issuing…' : 'Issue'}
        </Button>
        <Button type="button" intent="write" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
