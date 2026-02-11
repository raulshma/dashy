import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUserFn } from '@server/api/auth';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (user) {
      throw redirect({ to: '/dashboards' as string });
    } else {
      throw redirect({ to: '/auth/login' as string });
    }
  },
  component: () => null,
});