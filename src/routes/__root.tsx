import {
  createRootRoute,
  HeadContent,
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
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  }),

  component: RootComponent,
  shellComponent: RootDocument,
  errorComponent: ({ error, reset }) => (
    <GlobalErrorBoundary error={error} reset={reset} />
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
