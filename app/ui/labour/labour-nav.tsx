'use client';

import {
  BanknotesIcon,
  CameraIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Labour. Every operational tab needs
 * `DAILY_WORKER_REGISTRY`, which `ModuleGuard` has already established for the whole
 * subtree; Reports additionally needs `REPORTS`, filtered here so a user without it
 * never sees a tab they cannot open (spec FR-002).
 *
 * Capture is first because it is the daily action — the same order the module's tile
 * grid uses — and it is the one tab whose route is outside `/dashboard`: capture is a
 * field surface (spec FR-001), not a back-office section. It is in the strip anyway,
 * because leaving it out meant the screen you were standing on had no tab of its own
 * and no way back to itself from anywhere else in the module. `SectionTabs` matches on
 * the full path, so the shorter `/labour/muster` cannot be confused with
 * `/dashboard/labour/musters` in either direction.
 */
export default function LabourNav({
  canSeeReports,
  className,
  stripHidden = false,
}: {
  canSeeReports: boolean;
  className?: string;
  stripHidden?: boolean;
}) {
  const tabs = [
    { name: 'Capture Muster', href: ROUTES.musterCapture, icon: CameraIcon },
    { name: 'Wage Rates', href: ROUTES.labourWageRates, icon: BanknotesIcon },
    { name: 'Workers', href: ROUTES.labourWorkers, icon: UserGroupIcon },
    { name: 'Gangs', href: ROUTES.labourGangs, icon: UsersIcon },
    {
      name: 'Musters',
      href: ROUTES.labourMusters,
      icon: ClipboardDocumentCheckIcon,
    },
    {
      name: 'Payment Sheets',
      href: ROUTES.labourPaymentSheets,
      icon: DocumentTextIcon,
    },
    { name: 'Advances', href: ROUTES.labourAdvances, icon: CreditCardIcon },
    ...(canSeeReports
      ? [
          {
            name: 'Reports',
            href: ROUTES.labourReportsDeployment,
            match: '/dashboard/labour/reports',
            icon: ChartBarIcon,
          },
        ]
      : []),
  ];
  return (
    <SectionTabs
      label="Labour sections"
      tabs={tabs}
      className={className}
      mobile
      stripHidden={stripHidden}
    />
  );
}
