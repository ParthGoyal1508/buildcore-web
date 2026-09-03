'use client';

import { SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * Page controls for the inventory lists.
 *
 * Every list endpoint here returns `total`, `page` and `pageSize`, and without this
 * the screens showed the first page and silently dropped the rest — a company with
 * thirty purchases could see twenty-five of them and had no way to know. Same shape
 * the vendors and portfolio lists already use.
 *
 * Renders nothing at all when everything fits on one page: controls that can only be
 * disabled are noise.
 */
export default function Pager({
  total,
  page,
  pageSize,
  onPageChange,
  noun,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Singular; pluralised with a bare "s". */
  noun: string;
}) {
  if (total <= pageSize) return null;

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-600" aria-live="polite">
        {total} {noun}
        {total === 1 ? '' : 's'} · page {page} of {lastPage}
      </p>
      <div className="flex gap-2">
        <SecondaryButton
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </SecondaryButton>
      </div>
    </div>
  );
}
