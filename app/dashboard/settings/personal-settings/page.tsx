import { redirect } from 'next/navigation';

import { ROUTES } from '@/app/lib/constants';

/** Renamed to App Settings on 2026-11-01; an old bookmark lands there. */
export default function PersonalSettingsRedirect() {
  redirect(ROUTES.settingsApp);
}
