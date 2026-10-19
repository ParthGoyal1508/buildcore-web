'use client';

import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  downloadDailyIssueRegister,
  type StoreDocumentFormat,
} from '@/app/lib/api/inventory';
import { saveBlob } from '@/app/lib/download-file';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import {
  FieldLabelSpacer,
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { searchSites } from './inventory-search';
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
 *
 * 036 M5 (2026-10-17): the store is a server search, not one page of 200 stores.
 */
export default function DailyRegisterDownload({
  defaultSiteId,
  defaultSiteLabel,
}: {
  defaultSiteId?: string;
  /** The list's store name, so the picker can show it before anything is searched. */
  defaultSiteLabel?: string;
}) {
  const companyId = useSelectedCompanyId();
  const [siteChoice, setSiteChoice] = useState<string | null>(null);
  const [chosen, setChosen] = useState<SearchableOption | null>(null);
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
      setError(errorMessage(err, 'Could not produce the Daily Issue Register.'));
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
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="register-site" className="font-medium text-gray-700">
            Store <span className="text-red-600">*</span>
          </label>
          <AsyncSelect
            id="register-site"
            value={siteId}
            onChange={(id, option) => {
              setSiteChoice(id);
              setChosen(option);
            }}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={
              chosen ??
              (defaultSiteId && defaultSiteLabel
                ? { id: defaultSiteId, label: defaultSiteLabel }
                : null)
            }
            placeholder="Search stores"
          />
        </div>
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
                disabled={!ready || (busy !== null && busy !== format)}
                loading={busy === format}
                title={!siteId ? 'Choose a store first.' : undefined}
                onClick={() => void get(format)}
              >
                {label}
              </SecondaryButton>
            ))}
          </div>
        </div>
      </div>
      <FormError message={error} />
    </section>
  );
}
