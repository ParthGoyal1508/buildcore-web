'use client';

import { useQuery } from '@tanstack/react-query';

import { getDocumentRequirements } from '@/app/lib/api/project-documents';
import { FormError } from '@/app/ui/settings/form-fields';

/**
 * Which documents every project must hold (017 US2, FR-007).
 *
 * Read-only for now, deliberately. The backend accepts a `PUT` that replaces the whole
 * set, and wiring an editor here without the "which document types exist" picker beside
 * it would produce a screen where the only way to add a requirement is to know a type id.
 * What this screen does do is make the current answer — and the gaps in it — visible,
 * which is what FR-007 asks for and what the project list depends on.
 */
export function ProjectDocumentsScreen() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['project-document-requirements'],
    queryFn: getDocumentRequirements,
  });

  if (isPending) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !data) {
    return <FormError message="The requirements could not be loaded." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        {data.usingDefaults
          ? 'Using the document set BuildCore provides. Every project is measured against these.'
          : 'Using the set this company configured.'}
      </p>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {data.requirements.map((requirement) => (
          <li
            key={requirement.documentTypeId}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span className="truncate text-sm text-gray-900">
              {requirement.name}
            </span>
            <span className="text-xs text-gray-500">
              {requirement.isMandatory ? 'Required' : 'Optional'}
            </span>
          </li>
        ))}
      </ul>

      {data.undefinedCodes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <p className="text-sm text-amber-900">
            No document type is defined for:{' '}
            {data.undefinedCodes.join(', ')}
          </p>
          {/* Named rather than silently dropped. Without this, a missing type quietly
              shrinks the required set from six to five and nobody sees the sixth kind
              disappear — every project then reports itself complete without it. */}
          <p className="mt-1 text-xs text-amber-800">
            Projects are not measured against these until the type exists. Create
            it in Employee Setup → Document Types.
          </p>
        </div>
      )}
    </div>
  );
}
