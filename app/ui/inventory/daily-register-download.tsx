'use client';

import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadDailyIssueRegister,
  type StoreDocumentFormat,
} from '@/app/lib/api/inventory';
import { saveBlob } from '@/app/lib/download-file';
import {
  FieldLabelSpacer,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useSites } from './use-inventory-refs';
import { todayIso } from '@/app/lib/format';

const today = () => todayIso();

/**
 * The Daily Issue Register in the client's format (2026-10-15) — S.No., date, item code,
 * description, issued qty, issued to, received qty, returned on, received by, remarks — for one
 * store and a span of days.
 *
 * Its own store and dates rather than the list's filters: the register is a document for one
 * store's day, while the list above is usually read across every store. The store starts as the
 * list's, when one is chosen, and the dates as today — the register's everyday use.
 */
export default function DailyRegisterDownload({
  defaultSiteId,
}: {
  defaultSiteId?: string;
}) {
  const sites = useSites();
  const [siteChoice, setSiteChoice] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [busy, setBusy] = useState<StoreDocumentFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Follows the list's store until the user picks one here.
  const siteId = siteChoice ?? defaultSiteId ?? '';
  const backwards = Boolean(dateFrom && dateTo && dateTo < dateFrom);
  const ready = Boolean(siteId && dateFrom && !backwards);

  async function get(format: StoreDocumentFormat) {
    setBusy(format);
    setError(null);
    try {
      const { blob, filename } = await downloadDailyIssueRegister(
        { siteId, dateFrom, ...(dateTo ? { dateTo } : {}) },
        format,
      );
      saveBlob(blob, filename ?? `Daily Issue Register ${dateFrom}.${format}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not produce the Daily Issue Register.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-medium text-gray-900">Daily Issue Register</h2>
        <p className="text-xs text-gray-500">
          Every issue from one store over the chosen days, with what came back,
          in the register&apos;s printed format.
        </p>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <SelectField
          id="register-site"
          label="Store"
          value={siteId}
          onChange={(event) => setSiteChoice(event.target.value)}
        >
          <option value="">Select…</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="register-from"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <TextField
          id="register-to"
          label="To"
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(event) => setDateTo(event.target.value)}
          error={backwards ? 'Before the start date.' : undefined}
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <FieldLabelSpacer />
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['pdf', 'PDF'],
                ['xlsx', 'Excel'],
                ['docx', 'Word'],
              ] as const
            ).map(([format, label]) => (
              <SecondaryButton
                key={format}
                type="button"
                disabled={!ready || busy !== null}
                title={!siteId ? 'Choose a store first.' : undefined}
                onClick={() => void get(format)}
              >
                {busy === format ? 'Producing…' : label}
              </SecondaryButton>
            ))}
          </div>
        </div>
      </div>
      <FormError message={error} />
    </section>
  );
}
