import { redirect } from 'next/navigation';

import { ROUTES } from '@/app/lib/constants';

/**
 * The 031 attendance sheet's address. Its Excel download moved to Muster Attendance (034), which
 * also shows the month on screen; a bookmark that still opens here lands there.
 */
export default function AttendanceSheetRedirect() {
  redirect(ROUTES.labourMusterAttendance);
}
