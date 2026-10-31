'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Sends the installed app on from the website to sign-in (053).
 *
 * The manifest now starts the app at `/login`, but iOS keeps the start URL a phone had when the app
 * was added to its home screen, so every iPhone installed before the website existed still opens
 * `/` — and would land on the company website instead of the ERP.
 */
export default function InstalledAppRedirect() {
  const router = useRouter();
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) router.replace('/login');
  }, [router]);
  return null;
}
