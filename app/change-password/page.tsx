import type { Metadata } from 'next';
import ChangePasswordScreen from '@/app/ui/change-password-screen';

export const metadata: Metadata = { title: 'Change Password' };

/**
 * Changing your own password (001 FR-007, 010 FR-017c, 029 FR-005 to FR-008) — both the
 * mandatory step after an administrator chose the password, and the voluntary change offered
 * from the user menu. `ChangePasswordScreen` tells the two apart from the live account.
 */
export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
