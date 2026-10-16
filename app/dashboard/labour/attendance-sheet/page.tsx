'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadLabourAttendanceSheet,
  getMyLabourSites,
} from '@/app/lib/api/labour';
import { saveBlob } from '@/app/lib/download-file';
import PageHeader from '@/app/ui/page-header';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * The month-end consolidated labour attendance sheet (031): every labour at the site, one column
 * per day — P for a full day (punched in and out), H for a half day (in only) — with totals, and
 * a second tab of punch times. Supervisors get their own sites; the HR office gets every site.
 */
export default function AttendanceSheetPage() {
  const [month, setMonth] = useState(thisMonth);
  const [siteId, setSiteId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sites = useQuery({
    queryKey: ['labour', 'my-sites'],
    queryFn: getMyLabourSites,
  });

  const download = useMutation({
    mutationFn: () => {
      const [year, m] = month.split('-').map(Number);
      return downloadLabourAttendanceSheet({
        ...(siteId ? { siteId } : {}),
        year,
        month: m,
      });
    },
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status !== 500
          ? e.message
          : 'Could not create the sheet. Try again.',
      ),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Sheet"
        description="The month's attendance for every labour, ready for checking and the payment sheet."
      />
      <FormError message={error} />
      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField
          id="sheet-month"
          label="Month"
          type="month"
          value={month}
          max={thisMonth()}
          onChange={(e) => setMonth(e.target.value)}
        />
        <SelectField
          id="sheet-site"
          label="Site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          disabled={sites.isPending}
        >
          <option value="">
            {sites.data && sites.data.length === 1 ? sites.data[0].name : 'All my sites'}
          </option>
          {sites.data && sites.data.length > 1
            ? sites.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            : null}
        </SelectField>
        <div className="flex items-end">
          <SecondaryButton
            className="w-full justify-center"
            onClick={() => {
              setError(null);
              download.mutate();
            }}
            disabled={!month || download.isPending || sites.data?.length === 0}
          >
            {download.isPending ? 'Excel…' : 'Excel'}
          </SecondaryButton>
        </div>
      </div>
      {sites.data?.length === 0 && (
        <p className="text-sm text-gray-600">
          No sites are assigned to you yet. Ask the HR office to assign your site.
        </p>
      )}
      <p className="text-xs text-gray-500">
        P = full day (punched in and out) · H = half day (punched in only) · blank = absent.
      </p>
    </div>
  );
}
