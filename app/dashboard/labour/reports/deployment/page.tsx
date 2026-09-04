'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getDeploymentReport } from '@/app/lib/api/labour';
import { getProjects } from '@/app/lib/api/projects';
import { Button } from '@/app/ui/button';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

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
      <h1 className="text-xl font-semibold text-gray-900">Deployment Report</h1>
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
          <Button
            className="w-full justify-center"
            onClick={() => setSubmitted(true)}
            disabled={!projectId || !periodFrom || !periodTo}
          >
            Run
          </Button>
        </div>
      </div>

      {report.data && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          {report.data.groups.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              No approved musters in this period.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Headcount</th>
                  <th className="px-3 py-2">Man-days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.data.groups.map((g) => (
                  <tr key={g.key}>
                    <td className="px-3 py-2">{g.key}</td>
                    <td className="px-3 py-2">{g.headcount}</td>
                    <td className="px-3 py-2">{g.manDays}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2">{report.data.totalManDays}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
