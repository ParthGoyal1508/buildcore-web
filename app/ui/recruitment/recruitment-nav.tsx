'use client';

import {
  ArrowRightStartOnRectangleIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Recruitment. Operational tabs need `RECRUITMENT`, which
 * `ModuleGuard` has already established for the subtree; Reports additionally needs
 * `REPORTS`, filtered here (spec FR-002).
 */
export default function RecruitmentNav({
  canSeeReports,
  stripHidden = false,
}: {
  canSeeReports: boolean;
  stripHidden?: boolean;
}) {
  const tabs = [
    {
      name: 'Requisitions',
      href: ROUTES.recruitmentRequisitions,
      icon: ClipboardDocumentListIcon,
    },
    { name: 'Pipeline', href: ROUTES.recruitmentPipeline, icon: FunnelIcon },
    {
      name: 'Interviews',
      href: ROUTES.recruitmentInterviews,
      icon: CalendarDaysIcon,
    },
    {
      name: 'Templates',
      href: ROUTES.recruitmentLetterTemplates,
      icon: DocumentDuplicateIcon,
    },
    { name: 'Letters', href: ROUTES.recruitmentLetters, icon: EnvelopeIcon },
    {
      name: 'Resignations',
      href: ROUTES.recruitmentResignations,
      icon: ArrowRightStartOnRectangleIcon,
    },
    ...(canSeeReports
      ? [
          {
            name: 'Reports',
            href: ROUTES.recruitmentReportsFunnel,
            icon: ChartBarIcon,
          },
        ]
      : []),
  ];
  return (
    <SectionTabs
      label="Recruitment sections"
      tabs={tabs}
      mobile
      stripHidden={stripHidden}
    />
  );
}
