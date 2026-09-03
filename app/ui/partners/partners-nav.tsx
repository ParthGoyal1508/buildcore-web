'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Partners, shown inside a section but not on the index.
 *
 * Feature 014 made the sidebar itself role-filtered but scoped that to top-level
 * modules, so this tier carries only the one check the module tier cannot know
 * about: vendor categories are a Settings-owned master, gated on `SETTINGS` rather
 * than `PARTNERS` (007 FR-015). Without the filter the tab is a visible dead link —
 * `app/dashboard/partners/layout.tsx` refuses that route, so a user with `PARTNERS`
 * alone would click it and be told no. Same rule the HR and Settings strips follow.
 *
 * The active-tab rule lives in `SectionTabs`; see it for why longest match rather
 * than a prefix test, which lit Contractors and Compliance together.
 */
const TABS = [
  { name: 'Vendors', href: ROUTES.partnersVendors },
  { name: 'Categories', href: ROUTES.partnersVendorCategories, needsSettings: true },
  { name: 'Contractors', href: ROUTES.partnersContractors },
  { name: 'Compliance', href: ROUTES.partnersCompliance },
  { name: 'RAG matrix', href: ROUTES.partnersRag },
  { name: 'BOCW cess', href: ROUTES.partnersBocw },
];

export default function PartnersNav() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  // Until the answer is known, show the tabs that need no extra permission rather
  // than flashing Categories and withdrawing it (014 FR-011).
  const tabs = TABS.filter(
    (tab) => !tab.needsSettings || (user?.permissions.includes('SETTINGS') ?? false),
  );

  return <SectionTabs label="Partners sections" tabs={tabs} />;
}
