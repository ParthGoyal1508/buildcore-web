'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser, isSuperAdmin } from './api/users';

/**
 * Whether the signed-in person may delete a record: Super Admin only (client, 2026-11-07). The
 * server refuses everyone else (`DELETE_SUPER_ADMIN_ONLY`); this hides the button so nobody is
 * offered an action that can only fail.
 *
 * Removing a part of something being edited — a BOQ line, a photo, an attachment, a document —
 * is not a record delete and stays with whoever may edit it, so those buttons do not use this.
 */
export function useCanDelete(): boolean {
  const me = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  return isSuperAdmin(me.data);
}
