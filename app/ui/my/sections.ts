import {
  ArrowRightStartOnRectangleIcon,
  BanknotesIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClockIcon,
  CreditCardIcon,
  FaceSmileIcon,
  InboxStackIcon,
  ReceiptPercentIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

import { ROUTES } from '@/app/lib/constants';

/**
 * The sections of My Workspace, in the order all three of its navigations present
 * them: the index tiles, the desktop tab strip, and the mobile bottom bar.
 *
 * One definition, three presentations — the same arrangement `app/ui/hr/sections.ts`
 * uses, and for the same reason.
 *
 * Unlike HR, Settings and Partners there is nothing to filter: `MY_WORKSPACE` is a
 * single permission covering every section, so a user who reaches this module
 * reaches all of it.
 */
export const MY_SECTIONS = [
  {
    // "Punch", not "Attendance": it is the verb the worker came to perform.
    name: 'Punch',
    href: ROUTES.myPunch,
    icon: ClockIcon,
    description: 'Clock in and out, and check this month’s attendance.',
  },
  {
    name: 'Leave',
    href: ROUTES.myLeave,
    icon: CalendarDaysIcon,
    description: 'Apply for leave and see what your balance is.',
  },
  {
    // 2026-10-16: one place to see where everything you asked for stands.
    name: 'Requests',
    href: ROUTES.myRequests,
    icon: InboxStackIcon,
    description:
      'Leave, claims, attendance corrections and approvals you raised — and where each stands.',
  },
  {
    // Added 2026-10-15: "as a user I don't have any option to see the holiday list".
    name: 'Holidays',
    href: ROUTES.myHolidays,
    icon: CalendarIcon,
    description: 'The year’s holidays for your company and site.',
  },
  {
    name: 'Salary',
    href: ROUTES.mySalary,
    icon: BanknotesIcon,
    description: 'Payslips month by month, with the deductions itemised.',
  },
  {
    // "Claims", not "Reimbursements": six targets share the width of a phone in the
    // bottom bar, and the full word would either wrap or force the label smaller
    // than the others.
    name: 'Claims',
    href: ROUTES.myReimbursements,
    icon: ReceiptPercentIcon,
    description: 'Submit expense claims and track what has been approved.',
  },
  {
    name: 'Face',
    href: ROUTES.myFaceEnrol,
    icon: FaceSmileIcon,
    description: 'Enrol the face your punches are matched against.',
  },
  // Added 2026-10-16 — the rest of an employee's own records.
  {
    name: 'Loans',
    href: ROUTES.myLoans,
    icon: CreditCardIcon,
    description: 'Your loans and salary advances, and what is left to repay.',
  },
  {
    name: 'Tax',
    href: ROUTES.myTax,
    icon: CalculatorIcon,
    description: 'Declare your investments for the year’s TDS.',
  },
  {
    name: 'Profile',
    href: ROUTES.myProfile,
    icon: UserCircleIcon,
    description: 'Your employee record and the documents on file.',
  },
  {
    name: 'Resignation',
    href: ROUTES.myResignation,
    icon: ArrowRightStartOnRectangleIcon,
    description: 'Resign, and follow it through to your last working day.',
  },
];
