import { redirect } from 'next/navigation';

import { ROUTES } from '@/app/lib/constants';

/**
 * The pre-031 muster wizard's address. Face punch in/out replaced the wizard; an installed app or
 * a bookmark that still opens here lands on the screen that does the same job now.
 */
export default function MusterCaptureRedirect() {
  redirect(ROUTES.labourAttendance);
}
