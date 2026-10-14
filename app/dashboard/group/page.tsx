'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

import { listSelectableCompanies } from '@/app/lib/api/company-selection';
import {
  getGroupCompanies,
  getStatutoryCalendar,
} from '@/app/lib/api/dashboard';
import {
  CompanyCard,
  GroupTotalCard,
  StatutoryCalendarCard,
} from '@/app/ui/dashboard/group-cards';
import PageHeader from '@/app/ui/page-header';
import { LoadingText } from '@/app/ui/spinner';
import { TABLE } from '@/app/ui/table-classes';

export default function GroupDashboardPage() {
  const companies = useQuery({
    queryKey: ['group-companies'],
    queryFn: getGroupCompanies,
  });
  const statutory = useQuery({
    queryKey: ['group-statutory-calendar'],
    queryFn: getStatutoryCalendar,
  });
  // The logos. Same key the sidebar's company logo and switcher use, so this is normally
  // already cached and costs nothing; a company missing from it shows its initials.
  const selectable = useQuery({
    queryKey: ['companies', 'selectable'],
    queryFn: listSelectableCompanies,
  });
  const logos = new Map((selectable.data ?? []).map((c) => [c.id, c]));

  return (
    <main className="flex flex-col gap-4">
      <PageHeader
        title="Group Dashboard"
        description="Every company you can access, plus a group total."
      />

      {/* The "Search Employees" box sat here until 2026-10-15. The client asked for it
          to go: this page is the group at a glance, and looking somebody up is what HR
          → Employees is for. */}

      {companies.isPending && (
        <p className={TABLE.empty} role="status">
          <LoadingText>Loading companies…</LoadingText>
        </p>
      )}
      {companies.isError && (
        <p className={TABLE.failed} role="alert">
          Could not load the group dashboard.
        </p>
      )}

      {companies.data && (
        <>
          {companies.data.total && (
            <GroupTotalCard total={companies.data.total} />
          )}
          {/* As many columns as there are companies, up to three (2026-10-15): two companies
              on a wide screen sat in a three-column grid with the third left empty. */}
          <div
            className={clsx(
              'grid gap-4',
              companies.data.companies.length >= 2 && 'md:grid-cols-2',
              companies.data.companies.length >= 3 && '2xl:grid-cols-3',
            )}
          >
            {companies.data.companies.map((card) => (
              <CompanyCard
                key={card.companyId}
                card={card}
                logo={logos.get(card.companyId)}
              />
            ))}
          </div>
        </>
      )}

      {statutory.isPending && (
        <p className={TABLE.empty} role="status">
          <LoadingText>Loading statutory calendar…</LoadingText>
        </p>
      )}
      {statutory.isError && (
        <p className={TABLE.failed} role="alert">
          Could not load the statutory calendar.
        </p>
      )}
      {statutory.data && <StatutoryCalendarCard calendar={statutory.data} />}
    </main>
  );
}
