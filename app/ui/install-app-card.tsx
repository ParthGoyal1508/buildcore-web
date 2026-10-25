'use client';

import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

import { promptInstall, useInstallState } from '@/app/lib/pwa-install';
import { Button } from '@/app/ui/button';

const STEPS = {
  ios: [
    'Tap the Share button (the square with an arrow pointing up) — at the bottom of Safari, or in Chrome’s address bar.',
    'Scroll down and tap “Add to Home Screen”.',
    'Tap “Add”.',
  ],
  'mac-safari': ['In the menu bar, choose File → Add to Dock.', 'Click “Add”.'],
  other: [
    'Open the browser menu (⋮ or ⋯).',
    'Choose “Install app”, “Install Tirupati Groups” or “Add to Home screen”.',
    'If neither is listed, open this page in Chrome or Edge and try again.',
  ],
} as const;

/**
 * Install the app on demand (036), for when the browser's own popup never appeared or was
 * dismissed. Chrome, Edge and Android get the install dialog from a button; Safari, which offers
 * no such dialog to a page, gets the steps instead; an installed app says so.
 */
export default function InstallAppCard() {
  const state = useInstallState();
  if (state.kind === 'unknown') return null;

  return (
    <section
      aria-labelledby="install-app-heading"
      className="max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {state.kind === 'installed' ? (
            <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="install-app-heading" className="text-base font-semibold text-gray-900">
            {state.kind === 'installed' ? 'App installed' : 'Install App'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {state.kind === 'installed'
              ? 'Tirupati Groups is installed on this device. Open it from your home screen or app list.'
              : 'Add Tirupati Groups to your home screen for faster access, full-screen use and offline pages.'}
          </p>

          {state.kind === 'promptable' && (
            <Button
              type="button"
              className="mt-4"
              onClick={() => void promptInstall()}
            >
              Install App
            </Button>
          )}

          {state.kind === 'manual' && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700">
              {STEPS[state.platform].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
