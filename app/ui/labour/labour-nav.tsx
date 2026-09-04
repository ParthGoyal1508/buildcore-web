'use client';

import { ROUTES } from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Labour. Every operational tab needs
 * `DAILY_WORKER_REGISTRY`, which `ModuleGuard` has already established for the whole
 * subtree; Reports additionally needs `REPORTS`, filtered here so a user without it
 * never sees a tab they cannot open (spec FR-002).
 */
export default function LabourNav({
  canSeeReports,
}: {
  canSeeReports: boolean;
}) {
  const tabs = [
    { name: 'Wage Rates', href: ROUTES.labourWageRates },
    { name: 'Workers', href: ROUTES.labourWorkers },
    { name: 'Gangs', href: ROUTES.labourGangs },
    { name: 'Musters', href: ROUTES.labourMusters },
    { name: 'Payment Sheets', href: ROUTES.labourPaymentSheets },
    { name: 'Advances', href: ROUTES.labourAdvances },
    ...(canSeeReports
      ? [{ name: 'Reports', href: ROUTES.labourReportsDeployment }]
      : []),
  ];
  return <SectionTabs label="Labour sections" tabs={tabs} />;
}
