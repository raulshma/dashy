/**
 * Auth Layout Route
 *
 * Routes nested under `/auth` (login, register) are only accessible
 * to unauthenticated users. Authenticated users are redirected to home.
 */
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getCurrentUserFn } from '@server/api/auth';

export const Route = createFileRoute('/auth')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();

    if (user) {
      throw redirect({ to: '/' });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="auth-layout">
      <Outlet />
    </div>
  );
}
