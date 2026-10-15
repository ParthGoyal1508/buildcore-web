import { PageSkeleton } from '@/app/ui/page-skeleton';

/**
 * Shown by Next while a screen's code is still on its way — the slow part of a first visit to a
 * module in production — inside the shell, so the top bar and sidebar stay (2026-10-15).
 */
export default function Loading() {
  return <PageSkeleton />;
}
