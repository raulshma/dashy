/**
 * Dashboard Settings Page
 *
 * Allows editing dashboard name, slug, description, and visibility.
 * Route: /dashboards/:slug/settings
 */
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  deleteDashboardFn,
  getDashboardFn,
  updateDashboardFn,
} from '@server/api/dashboards'
import type { DashboardDetail } from '@server/api/dashboards'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const Route = createFileRoute('/_authed/dashboards/$slug/settings')({
  component: DashboardSettingsPage,
})

function DashboardSettingsPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()

  const [dashboard, setDashboard] = useState<DashboardDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slugInput, setSlugInput] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getDashboardFn({ data: { identifier: slug } })

      if (result.success && result.data) {
        setDashboard(result.data)
        setName(result.data.name)
        setSlugInput(result.data.slug)
        setDescription(result.data.description ?? '')
        setIsPublic(result.data.isPublic)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchDashboard()
  }, [slug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!dashboard) return

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await updateDashboardFn({
        data: {
          id: dashboard.id,
          name: name.trim(),
          slug: slugInput.trim() || undefined,
          description: description.trim() || undefined,
          isPublic,
        },
      })

      if (result.success && result.data) {
        setDashboard(result.data)
        setSuccess('Dashboard updated successfully')
        if (result.data.slug !== slug) {
          void navigate({
            to: '/dashboards/$slug/settings',
            params: { slug: result.data.slug },
          })
        }
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to update dashboard')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!dashboard || deleteConfirm !== dashboard.name) return

    try {
      const result = await deleteDashboardFn({
        data: { id: dashboard.id, permanent: false },
      })

      if (result.success) {
        void navigate({ to: '/dashboards' })
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to delete dashboard')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground space-y-4">
        <svg
          className="animate-spin h-8 w-8 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p>Loading settings...</p>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Dashboard not found
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {error ??
              'This dashboard does not exist or you do not have access to it.'}
          </p>
        </div>
        <Link to="/dashboards" className={buttonVariants()}>
          Go to Dashboards
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboards/$slug"
          params={{ slug: dashboard.slug }}
          className="shrink-0 rounded-md p-1.5 hover:bg-muted transition-colors"
          aria-label="Back to dashboard"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard Settings
          </h1>
          <p className="text-muted-foreground">{dashboard.name}</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <AlertDescription className="text-green-700 dark:text-green-400">
            {success}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>
              Basic settings for your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">
                  /dashboards/
                </span>
                <Input
                  id="slug"
                  value={slugInput}
                  onChange={(e) =>
                    setSlugInput(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '-')
                        .replace(/-+/g, '-'),
                    )
                  }
                  maxLength={100}
                  placeholder="my-dashboard"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Use lowercase letters, numbers, and
                hyphens.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="A brief description of your dashboard"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="public">Public</Label>
                <p className="text-xs text-muted-foreground">
                  Allow anyone with the link to view this dashboard.
                </p>
              </div>
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Info</CardTitle>
          <CardDescription>Dashboard metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs break-all">{dashboard.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pages</dt>
              <dd>{dashboard.pages.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(dashboard.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{new Date(dashboard.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for this dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger>
              <Button variant="destructive">Delete Dashboard</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{dashboard.name}"? This
                  action can be undone within 30 days by an administrator.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="delete-confirm">
                  Type <strong>{dashboard.name}</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="mt-2"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirm('')}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteConfirm !== dashboard.name}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
