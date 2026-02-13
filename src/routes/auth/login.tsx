/**
 * Login Page
 *
 * Glassmorphism-styled login form with validation and error handling.
 * Route: /auth/login
 */
import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { loginFn } from '@server/api/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Icon } from '@/components/ui/icon'
import {
  InformationCircleIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, Array<string> | undefined>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const result = await loginFn({ data: { email, password } })

      if (result.success) {
        navigate({ to: redirectTo ?? '/' })
      } else if (result.error) {
        setError(result.error.message)
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors)
        }
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="mb-4 flex justify-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="40"
                  height="40"
                  rx="12"
                  fill="url(#logo-gradient)"
                />
                <path
                  d="M12 14h6v12h-6V14zm10 0h6v12h-6V14z"
                  fill="white"
                  opacity="0.9"
                />
                <defs>
                  <linearGradient
                    id="logo-gradient"
                    x1="0"
                    y1="0"
                    x2="40"
                    y2="40"
                  >
                    <stop className="[stop-color:var(--primary)]" />
                    <stop offset="1" className="[stop-color:var(--chart-5)]" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Sign in to your Dashy account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-6">
              {error && (
                <Alert variant="destructive">
                  <Icon icon={InformationCircleIcon} size="sm" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="login-email">Email address</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className={
                    fieldErrors.email
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }
                />
                {fieldErrors.email?.map((msg, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {msg}
                  </p>
                ))}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="login-password">Password</Label>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className={
                      fieldErrors.password
                        ? 'border-destructive focus-visible:ring-destructive pr-10'
                        : 'pr-10'
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10 px-3 hover:bg-transparent text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    tabIndex={-1}
                  >
                    <Icon
                      icon={showPassword ? ViewOffIcon : ViewIcon}
                      size="lg"
                    />
                  </Button>
                </div>
                {fieldErrors.password?.map((msg, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {msg}
                  </p>
                ))}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{' '}
              <Link
                to="/auth/register"
                className="underline underline-offset-4"
              >
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
