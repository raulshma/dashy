/**
 * Account Settings Page
 *
 * Allows authenticated users to update their profile and change password.
 * Route: /_authed/settings (rendered at /settings for users)
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { logoutFn, updateAccountFn } from '@server/api/auth'

import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Icon } from '@/components/ui/icon'

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = Route.useRouteContext()

  const [displayName, setDisplayName] = useState(user.displayName)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const data: Record<string, string> = {}

      if (displayName !== user.displayName) data.displayName = displayName
      if (email !== user.email) data.email = email

      if (Object.keys(data).length === 0) {
        setError('No changes to save')
        setIsSubmitting(false)
        return
      }

      const result = await updateAccountFn({ data })

      if (result.success) {
        setSuccess('Profile updated successfully')
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await updateAccountFn({
        data: { currentPassword, newPassword },
      })

      if (result.success) {
        setSuccess('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logoutFn()
    } catch {
      // logoutFn throws redirect — expected
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile, email, and password
        </p>
      </div>

      {/* Feedback */}
      {success && (
        <Alert className="border-success/50 text-success [&>svg]:text-success">
          <Icon icon={CheckmarkCircle02Icon} size="sm" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <Icon icon={InformationCircleIcon} size="sm" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your public display name and email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="profile-form"
            onSubmit={handleProfileUpdate}
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="settings-name">Display name</Label>
              <Input
                id="settings-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isSubmitting}
                maxLength={50}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-email">Email address</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            form="profile-form"
            type="submit"
            disabled={isSubmitting}
            id="save-profile"
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </CardFooter>
      </Card>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Ensure your account is using a long, random password to stay secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="password-form"
            onSubmit={handlePasswordChange}
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="settings-current-pw">Current password</Label>
              <Input
                id="settings-current-pw"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-new-pw">New password</Label>
              <Input
                id="settings-new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-confirm-pw">Confirm new password</Label>
              <Input
                id="settings-confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            form="password-form"
            type="submit"
            disabled={isSubmitting}
            id="change-password"
          >
            {isSubmitting ? 'Changing...' : 'Change password'}
          </Button>
        </CardFooter>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Session</CardTitle>
          <CardDescription>
            Sign out of your account on this device.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t border-destructive/10 px-6 py-4 bg-destructive/5 rounded-b-xl">
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
            id="logout-btn"
          >
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
