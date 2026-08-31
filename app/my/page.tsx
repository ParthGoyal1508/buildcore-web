import { redirect } from 'next/navigation';
import { ROUTES } from '@/app/lib/constants';

/** `/my` has no screen of its own — Punch is the tab a site worker opens the app
 * for, so it is what the bare route resolves to. */
export default function MyWorkspaceIndex() {
  redirect(ROUTES.myPunch);
}
