import clsx from 'clsx';

import type {
  CompanyDocument,
  MissingKind,
} from '@/app/lib/api/company-documents';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import { RestrictedBadge } from '@/app/ui/documents/restricted-badge';

interface CompletenessPanelProps {
  present: CompanyDocument[];
  missing: MissingKind[];
  expiringSoon?: CompanyDocument[];
  /** Rendered beside a present document — download, replace, history. */
  actionsFor?: (document: CompanyDocument) => React.ReactNode;
  /** Rendered beside a missing kind — usually "Upload". */
  actionForMissing?: (kind: MissingKind) => React.ReactNode;
}

const dateText = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : '—';

/**
 * What is on file and what is not (017 FR-003).
 *
 * **Missing kinds are named, never counted.** "7 of 8 complete" makes the reader diff two
 * lists by eye to find the one that matters, and the whole value of this panel is that
 * nobody has to.
 *
 * The lists come from the server and are rendered, not derived. The required set is
 * company configuration that can change without a release here, so a browser computing
 * "what is missing" would be wrong the first time somebody changed it.
 */
export function CompletenessPanel({
  present,
  missing,
  expiringSoon = [],
  actionsFor,
  actionForMissing,
}: CompletenessPanelProps) {
  const expiringIds = new Set(expiringSoon.map((d) => d.id));

  return (
    <div className="flex flex-col gap-6">
      {missing.length > 0 && (
        <section aria-labelledby="documents-missing">
          <h3
            id="documents-missing"
            className="mb-2 text-sm font-medium text-gray-900"
          >
            {DOCUMENT_COPY.missingHeading} ({missing.length})
          </h3>
          <ul className="divide-y divide-gray-100 rounded-lg border border-amber-200 bg-amber-50/40">
            {missing.map((kind) => (
              <li
                key={kind.code}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-900">{kind.label}</p>
                  {kind.documentTypeId === null && (
                    // "Never defined" and "defined but not uploaded" have different next
                    // steps, so they read differently rather than both saying "missing".
                    <p className="text-xs text-amber-800">
                      {DOCUMENT_COPY.typeNotDefined}
                    </p>
                  )}
                </div>
                {actionForMissing?.(kind)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="documents-present">
        <h3
          id="documents-present"
          className="mb-2 text-sm font-medium text-gray-900"
        >
          {DOCUMENT_COPY.presentHeading} ({present.length})
        </h3>
        {present.length === 0 ? (
          <p className="rounded-lg border border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
            Nothing on file yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {present.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
                    <span className="truncate">{doc.name}</span>
                    {doc.isRestricted && <RestrictedBadge />}
                  </p>
                  <p className="text-xs text-gray-500">
                    {doc.documentNumber ? `${doc.documentNumber} · ` : ''}
                    {doc.expiresAt ? (
                      <span
                        className={clsx(
                          expiringIds.has(doc.id) && 'font-medium text-amber-800',
                        )}
                      >
                        Expires {dateText(doc.expiresAt)}
                      </span>
                    ) : (
                      'No expiry'
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {actionsFor?.(doc)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
