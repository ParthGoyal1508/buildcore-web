import {
  BanknotesIcon,
  CalendarDaysIcon,
  ClockIcon,
  FaceSmileIcon,
  ReceiptPercentIcon,
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
];
