'use client';

import { useQuery } from '@tanstack/react-query';

import {
  getGroupCompanies,
  getStatutoryCalendar,
} from '@/app/lib/api/dashboard';
import EmployeeSearch from '@/app/ui/dashboard/employee-search';
import WidgetRenderer from '@/app/ui/dashboard/widget-renderer';
import PageHeader from '@/app/ui/page-header';

export default function GroupDashboardPage() {
  const companies = useQuery({
    queryKey: ['group-companies'],
    queryFn: getGroupCompanies,
  });
  const statutory = useQuery({
    queryKey: ['group-statutory-calendar'],
    queryFn: getStatutoryCalendar,
  });

  return (
    <main>
      <PageHeader
        title="Group Dashboard"
        description="Every company you can access, plus a group total."
        className="mb-4"
      />

      <div className="mb-6">
        <EmployeeSearch />
      </div>

      {companies.isPending && (
        <p className="text-sm text-gray-500" role="status">
          Loading companies…
        </p>
      )}
      {companies.isError && (
        <p className="text-sm text-red-600" role="alert">
          Could not load the group dashboard.
        </p>
      )}

      {companies.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.data.map((w) => (
            <WidgetRenderer key={w.id} widget={w} />
          ))}
          {statutory.data && (
            <WidgetRenderer widget={statutory.data} />
          )}
        </div>
      )}
    </main>
  );
}
