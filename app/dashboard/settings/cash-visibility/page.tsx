import { redirect } from 'next/navigation';

import { ROUTES } from '@/app/lib/constants';

/** Renamed to Personal Settings on 2026-10-15; an old bookmark lands there. */
export default function CashVisibilityRedirect() {
  redirect(ROUTES.settingsPersonal);
}
