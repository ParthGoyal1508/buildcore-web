'use client';

import {
  PROJECT_SHELL_COPY,
  PROJECT_TAB_SOURCES,
  ROUTES,
} from '@/app/lib/constants';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';
import TabSourceNote from '@/app/ui/projects/tab-source-note';

type Person = ReturnType<typeof useProjectShell>['tabs']['employees'][number];

/**
 * Who is assigned to this project (008 US4, T024).
 *
 * Read-only, and from the shell's own aggregate — no request of its own. Assignment happens in
 * HR, where an employee's site and project are set; a roster that could be edited from two
 * places would be two places for it to disagree.
 *
 * `designationId` arrives as an id and is not shown. Rendering a cuid under a column headed
 * "Designation" would be worse than omitting it, and resolving it needs the designations master
 * — a second request for one column, on a page that currently makes none.
 */
export default function ProjectPeoplePage() {
  const { project, tabs } = useProjectShell();

  const columns: Column<Person>[] = [
    {
      key: 'employeeCode',
      header: 'Code',
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {row.employeeCode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        {PROJECT_SHELL_COPY.peopleHeading}
      </h2>
      <TabSourceNote
        projectId={project.id}
        explanation={PROJECT_TAB_SOURCES.people}
        linkLabel={PROJECT_TAB_SOURCES.peopleLink}
        href={ROUTES.hrEmployees}
      />
      <ResponsiveList
        columns={columns}
        rows={tabs.employees}
        rowKey={(row) => row.id}
        emptyMessage={PROJECT_SHELL_COPY.peopleEmpty}
      />
    </section>
  );
}
