'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import {
  getDeploymentReport,
  type DeploymentReport,
} from '@/app/lib/api/labour';
import { getProjects } from '@/app/lib/api/projects';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { TABLE } from '@/app/ui/table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import PageHeader from '@/app/ui/page-header';

type DeploymentGroup = DeploymentReport['groups'][number];

// Keys match the group's own fields, so each column sorts by the raw figure.
const COLUMNS: Column<DeploymentGroup>[] = [
  { key: 'key', header: 'Group', render: (g) => g.key },
  {
    key: 'headcount',
    header: 'Headcount',
    numeric: true,
    render: (g) => g.headcount,
  },
  {
    key: 'manDays',
    header: 'Man-days',
    numeric: true,
    render: (g) => g.manDays,
  },
];

export default function DeploymentReportPage() {
  const [projectId, setProjectId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [groupBy, setGroupBy] = useState('skill');
  const [submitted, setSubmitted] = useState(false);

  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getProjects({ pageSize: 200 }),
  });
  const report = useQuery({
    queryKey: ['report-deployment', projectId, periodFrom, periodTo, groupBy],
    queryFn: () =>
      getDeploymentReport({ projectId, periodFrom, periodTo, groupBy }),
    enabled: submitted && !!projectId && !!periodFrom && !!periodTo,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Deployment Report" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <SelectField
          id="dep-project"
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Select…</option>
          {projects.data?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="dep-from"
          label="From"
          type="date"
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
        />
        <TextField
          id="dep-to"
          label="To"
          type="date"
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
        />
        <SelectField
          id="dep-group"
          label="Group by"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
        >
          <option value="skill">Skill</option>
          <option value="site">Site</option>
          <option value="contractor">Contractor</option>
        </SelectField>
        <div className="flex items-end">
          <Button intent="read"
            className="w-full justify-center"
            onClick={() => setSubmitted(true)}
            disabled={!projectId || !periodFrom || !periodTo}
          >
            Run
          </Button>
        </div>
      </div>

      {/* The shared table: sortable by any column; the total stays below the rows (2026-10-15). */}
      {report.data && (
        <DataTable<DeploymentGroup>
          caption="Deployment by group"
          rows={report.data.groups}
          rowKey={(g) => g.key}
          columns={COLUMNS}
          emptyMessage="No approved musters in this period."
          footer={
            <tr>
              <td className={TABLE.td}>Total</td>
              <td className={TABLE.td} />
              <td className={clsx(TABLE.td, TABLE.numeric)}>
                {report.data.totalManDays}
              </td>
            </tr>
          }
        />
      )}
    </div>
  );
}
