/**
 * Protected Route Layout
 *
 * All routes nested under `/_authed` require authentication.
 * Unauthenticated users are redirected to `/auth/login`.
 *
 * Usage: Place route files in `routes/_authed/` directory.
 */
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getCurrentUserFn } from '@server/api/auth';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn();

    if (!user) {
      throw redirect({
        to: '/auth/login',
        search: { redirect: location.href },
      });
    }

    return { user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return <Outlet />;
}
