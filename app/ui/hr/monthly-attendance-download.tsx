'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { downloadMonthlyAttendance, listSites } from '@/app/lib/api/hr-payroll';
import { getProjects } from '@/app/lib/api/projects';
import { listDepartments } from '@/app/lib/api/settings';
import { saveBlob } from '@/app/lib/download-file';
import {
  CompanyMonthFields,
  thisMonth,
  yearMonthOf,
} from '@/app/ui/hr/company-month-fields';
import {
  FormError,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';

/**
 * Download Monthly Attendance (2026-10-17): the month's staff attendance in the client's own sheet
 * layout — one tab per site, P / A / W/O / H / L for every day, then present, absent, payable days,
 * salary, rate and amount. Salary columns are filled only for someone with payroll access.
 */
export default function MonthlyAttendanceDownload() {
  const [month, setMonth] = useState(thisMonth);
  const [companyId, setCompanyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sites = useQuery({ queryKey: ['hr', 'sites'], queryFn: listSites });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });
  // Projects need the Projects permission; without it the filter is simply not offered.
  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getProjects({ pageSize: 200 }),
    retry: false,
  });

  const download = useMutation({
    mutationFn: () =>
      downloadMonthlyAttendance({
        ...yearMonthOf(month),
        ...(companyId ? { companyId } : {}),
        ...(siteId ? { siteId } : projectId ? { projectId } : {}),
        ...(departmentId ? { departmentId } : {}),
      }),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Could not create the attendance sheet. Try again.',
      ),
  });

  return (
    <section
      aria-labelledby="monthly-attendance"
      className="mb-6 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 id="monthly-attendance" className="text-sm font-semibold text-gray-900">
        Download Monthly Attendance
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        The month in your staff attendance format, one sheet per site.
      </p>
      <FormError message={error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <CompanyMonthFields
          idPrefix="mad"
          month={month}
          onMonth={setMonth}
          companyId={companyId}
          onCompany={(v) => {
            setCompanyId(v);
            setSiteId('');
            setProjectId('');
          }}
        />
        {projects.isSuccess && (
          <SelectField
            id="mad-project"
            label="Project (optional)"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSiteId('');
            }}
          >
            <option value="">All projects</option>
            {projects.data.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          id="mad-site"
          label="Site (optional)"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">All sites</option>
          {sites.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="mad-department"
          label="Department (optional)"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">All departments</option>
          {(departments.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <div className="flex items-end">
          <SecondaryButton
            className="w-full justify-center"
            disabled={!month || download.isPending}
            onClick={() => {
              setError(null);
              download.mutate();
            }}
          >
            {download.isPending ? 'Excel…' : 'Excel'}
          </SecondaryButton>
        </div>
      </div>
    </section>
  );
}
