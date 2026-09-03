import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  CreditCardIcon,
  DocumentTextIcon,
  FingerPrintIcon,
  ReceiptPercentIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

import { HR_PERMISSIONS, ROUTES, type HrSection } from '@/app/lib/constants';

/**
 * The sections of HR & Payroll, in the order both the index tiles and the in-module
 * tab strip present them.
 *
 * One definition, two presentations: `section-grid.tsx` renders the tiles a user
 * lands on and `hr-nav.tsx` the tabs they move between afterwards. Declaring the
 * list twice is how a section ends up in one and not the other.
 */
export const HR_SECTIONS: {
  key: HrSection;
  href: string;
  title: string;
  description: string;
  icon: typeof UserGroupIcon;
}[] = [
  {
    key: 'employees',
    href: ROUTES.hrEmployees,
    title: 'Employees',
    description: 'Records, documents, transfers and offboarding.',
    icon: UserGroupIcon,
  },
  {
    key: 'attendance',
    href: ROUTES.hrAttendance,
    title: 'Attendance',
    description: 'Daily register, exceptions, holidays, bulk import.',
    icon: CalendarDaysIcon,
  },
  {
    key: 'leave',
    href: ROUTES.hrLeave,
    title: 'Leave',
    description: 'Review applications and check balances.',
    icon: ClipboardDocumentCheckIcon,
  },
  {
    key: 'payroll',
    href: ROUTES.hrPayroll,
    title: 'Payroll',
    description: 'Monthly runs, salary register and bank sheet.',
    icon: BanknotesIcon,
  },
  {
    key: 'challans',
    href: ROUTES.hrChallans,
    title: 'Challans',
    description: 'PF, ESIC, professional tax and TDS filings.',
    icon: DocumentTextIcon,
  },
  {
    key: 'tds',
    href: ROUTES.hrTds,
    title: 'TDS',
    description: 'Tax slabs, employee declarations and quarterly returns.',
    icon: ReceiptPercentIcon,
  },
  {
    key: 'loans',
    href: ROUTES.hrLoans,
    title: 'Loans',
    description: 'Issue loans and track EMI recovery schedules.',
    icon: CreditCardIcon,
  },
  {
    key: 'advances',
    href: ROUTES.hrAdvances,
    title: 'Salary Advances',
    description: 'Advances recovered in full from the next run.',
    icon: ArrowsRightLeftIcon,
  },
  {
    key: 'reimbursements',
    href: ROUTES.hrReimbursements,
    title: 'Reimbursements',
    description: 'Review, approve and pay employee claims.',
    icon: ReceiptPercentIcon,
  },
  {
    key: 're-enrolment',
    href: ROUTES.hrReEnrolment,
    title: 'Biometric Re-enrolment',
    description: 'Decide requests to re-enrol a face.',
    icon: FingerPrintIcon,
  },
];

/**
 * The sections this user may actually open.
 *
 * Shared by the tiles and the tabs so neither can offer a section the layout guard
 * would then refuse — a visible dead link is the failure feature 014 exists to
 * prevent, and it is no less dead for being a tab.
 */
export function visibleHrSections(
  user: { permissions: readonly string[] } | undefined,
): typeof HR_SECTIONS {
  if (!user) return [];
  return HR_SECTIONS.filter((section) =>
    user.permissions.includes(HR_PERMISSIONS[section.key]),
  );
}
