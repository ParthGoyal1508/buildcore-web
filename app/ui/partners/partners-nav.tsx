import SectionTabs from '@/app/ui/section-tabs';
import { ROUTES } from '@/app/lib/constants';

/**
 * Sub-navigation within Partners.
 *
 * Feature 014 made the sidebar itself role-filtered but scoped that to top-level
 * modules only, so this tier is plain navigation with no permission logic of its
 * own — everything here is reachable by anyone who reached the module, except
 * Categories, which the layout guards.
 *
 * The active-tab rule lives in `SectionTabs`; see it for why longest match rather
 * than a prefix test, which lit Contractors and Compliance together.
 */
const TABS = [
  { name: 'Vendors', href: ROUTES.partnersVendors },
  { name: 'Categories', href: ROUTES.partnersVendorCategories },
  { name: 'Contractors', href: ROUTES.partnersContractors },
  { name: 'Compliance', href: ROUTES.partnersCompliance },
  { name: 'RAG matrix', href: ROUTES.partnersRag },
  { name: 'BOCW cess', href: ROUTES.partnersBocw },
];

export default function PartnersNav() {
  return <SectionTabs label="Partners sections" tabs={TABS} />;
}
