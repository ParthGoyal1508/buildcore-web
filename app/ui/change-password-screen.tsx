'use client';

import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { homeRoute } from '@/app/lib/permissions';
import AuthNotice from '@/app/ui/auth-notice';
import ChangePasswordForm from '@/app/ui/change-password-form';

/**
 * One page, two situations (029 FR-016): sent here because an administrator chose the password
 * in force, or come from the user menu to change it by choice. Until 029 it always said the
 * first, which told everyone who opened it from their profile that they were locked out.
 */
export default function ChangePasswordScreen() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const required = user?.mustChangePassword === true;
  const home = (user && homeRoute(user)) ?? ROUTES.dashboard;

  return (
    <AuthNotice
      title={required ? 'Password change required' : 'Change your password'}
      // While it is required the rest of the app refuses this account, so the only way out
      // offered is signing in as someone else.
      backLabel={required ? 'Back to login' : 'Cancel'}
      backHref={required ? ROUTES.login : home}
    >
      {required ? (
        <p>
          Your administrator set the password you just used. Choose your own before
          continuing — until you do, the rest of the app is unavailable.
        </p>
      ) : (
        <p>Any other device signed in to your account will be signed out.</p>
      )}
      <ChangePasswordForm home={home} />
    </AuthNotice>
  );
}
