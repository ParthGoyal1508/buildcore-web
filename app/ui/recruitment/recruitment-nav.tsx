'use client';

import { ROUTES } from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Recruitment. Operational tabs need `RECRUITMENT`, which
 * `ModuleGuard` has already established for the subtree; Reports additionally needs
 * `REPORTS`, filtered here (spec FR-002).
 */
export default function RecruitmentNav({
  canSeeReports,
}: {
  canSeeReports: boolean;
}) {
  const tabs = [
    { name: 'Requisitions', href: ROUTES.recruitmentRequisitions },
    { name: 'Pipeline', href: ROUTES.recruitmentPipeline },
    { name: 'Interviews', href: ROUTES.recruitmentInterviews },
    { name: 'Templates', href: ROUTES.recruitmentLetterTemplates },
    { name: 'Letters', href: ROUTES.recruitmentLetters },
    { name: 'Resignations', href: ROUTES.recruitmentResignations },
    ...(canSeeReports
      ? [{ name: 'Reports', href: ROUTES.recruitmentReportsFunnel }]
      : []),
  ];
  return <SectionTabs label="Recruitment sections" tabs={tabs} />;
}
