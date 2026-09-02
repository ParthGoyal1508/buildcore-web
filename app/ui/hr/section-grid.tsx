'use client';

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
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getCurrentUser } from '@/app/lib/api/users';
import { HR_PERMISSIONS, ROUTES, type HrSection } from '@/app/lib/constants';

const SECTIONS: {
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

/** Shows only the areas the signed-in user can open, so nobody is invited into a
 * page that would immediately refuse them — same rule the Settings index follows. */
export default function HrSectionGrid() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const visible = SECTIONS.filter(
    (section) => user?.permissions.includes(HR_PERMISSIONS[section.key]) ?? false,
  );

  if (user && visible.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Your role doesn&apos;t include access to any HR &amp; Payroll area.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((section) => {
        const Icon = section.icon;
        return (
          <Link
            key={section.key}
            href={section.href}
            className="flex gap-3 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <Icon className="w-6 shrink-0 text-gray-500" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-medium text-gray-900">{section.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{section.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
