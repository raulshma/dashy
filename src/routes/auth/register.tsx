/**
 * Registration Page
 *
 * Glassmorphism-styled registration form with validation and password strength.
 * Route: /auth/register
 */
import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { registerFn } from '@server/api/auth'
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

export const Route = createFileRoute('/auth/register')({
  component: RegisterPage,
})

/** Simple password strength calculator */
function getPasswordStrength(password: string): {
  score: number
  label: string
  colorClass: string
} {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak', colorClass: 'bg-destructive' }
  if (score <= 2) return { score, label: 'Fair', colorClass: 'bg-warning' }
  if (score <= 3) return { score, label: 'Good', colorClass: 'bg-success' }
  return { score, label: 'Strong', colorClass: 'bg-info' }
}

function RegisterPage() {
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, Array<string> | undefined>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const strength = useMemo(
    () => (password.length > 0 ? getPasswordStrength(password) : null),
    [password],
  )

  const passwordsMatch =
    confirmPassword.length === 0 || password === confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: ['Passwords do not match'] })
      return
    }

    setIsSubmitting(true)

    try {
      const result = await registerFn({
        data: { email, password, displayName },
      })

      if (result.success) {
        navigate({ to: '/' })
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
            <CardTitle className="text-2xl text-center">
              Create your account
            </CardTitle>
            <CardDescription className="text-center">
              Get started with Dashy in seconds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-6">
              {error && (
                <Alert variant="destructive">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8 5v3.5M8 10.5v.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="register-name">Display name</Label>
                <Input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  required
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isSubmitting}
                  maxLength={50}
                  className={
                    fieldErrors.displayName
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }
                />
                {fieldErrors.displayName?.map((msg, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {msg}
                  </p>
                ))}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="register-email">Email address</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
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
                  <Label htmlFor="register-password">Password</Label>
                </div>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    minLength={8}
                    maxLength={128}
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
                    {showPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </Button>
                </div>

                {/* Password Strength */}
                {strength && (
                  <div className="space-y-1">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${strength.colorClass} transition-all duration-300`}
                        style={{
                          width: `${(strength.score / 5) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password strength:{' '}
                      <span className="font-medium">{strength.label}</span>
                    </p>
                  </div>
                )}

                {fieldErrors.password?.map((msg, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {msg}
                  </p>
                ))}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="register-confirm">Confirm password</Label>
                <Input
                  id="register-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className={
                    !passwordsMatch
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }
                />
                {!passwordsMatch && (
                  <p className="text-sm text-destructive">
                    Passwords do not match
                  </p>
                )}
                {fieldErrors.confirmPassword?.map((msg, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {msg}
                  </p>
                ))}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !passwordsMatch}
              >
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <Link to="/auth/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
