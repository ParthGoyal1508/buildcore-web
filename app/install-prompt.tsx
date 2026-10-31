'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { promptInstall, useInstallState } from '@/app/lib/pwa-install';
import { SITE_PATHS } from '@/app/lib/site-content';
import { Button, SecondaryButton } from '@/app/ui/button';

/**
 * The floating install offer, shown when the browser has one. "Later" only hides this card: the
 * offer itself stays in `pwa-install`, where the Install App card in Settings can still use it.
 *
 * Never on the public website (053): the app is for staff, not for a visitor reading about the company.
 */
export default function InstallPrompt() {
  const state = useInstallState();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (state.kind !== 'promptable' || dismissed || SITE_PATHS.includes(pathname)) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 md:bottom-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg md:left-auto md:right-4 md:max-w-sm">
      <p className="text-sm font-semibold text-slate-900">Install Tirupati Groups</p>
      <p className="mt-1 text-sm text-slate-600">
        Add it to your home screen for faster access and offline use.
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <SecondaryButton
          type="button"
          size="sm"
          onClick={() => setDismissed(true)}
        >
          Later
        </SecondaryButton>
        <Button
          type="button"
          intent="read"
          size="sm"
          onClick={() => void promptInstall()}
        >
          Install
        </Button>
      </div>
    </div>
  );
}
