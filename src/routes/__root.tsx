import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import appCss from '../styles.css?url'
import { AuthProvider } from '@/hooks/use-auth'
import { Toaster } from '@/components/ui/sonner'
import { SkipToContent } from '@/components/ui/accessibility'
import { GlobalCommandPalette } from '@/components/app/global-command-palette'
import { GlobalErrorBoundary } from '@/components/app/global-error-boundary'
import { registerBuiltinWidgets } from '@/app/widgets'

let widgetsRegistered = false

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Dashy — Dashboard Platform',
      },
      {
        name: 'description',
        content: 'Build and manage beautiful dashboards with Dashy.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
  shellComponent: RootDocument,
  errorComponent: ({ error, reset }) => (
    <GlobalErrorBoundary error={error} reset={reset} />
  ),
  notFoundComponent: () => (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link to="/" className="text-primary underline">
        Go home
      </Link>
    </div>
  ),
})

function RootComponent() {
  useEffect(() => {
    if (!widgetsRegistered) {
      registerBuiltinWidgets()
      widgetsRegistered = true
    }
  }, [])

  return (
    <AuthProvider>
      <Outlet />
      <GlobalCommandPalette />
    </AuthProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SkipToContent />
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
