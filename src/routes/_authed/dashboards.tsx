/**
 * Dashboard List Page
 *
 * Displays all dashboards owned by the authenticated user.
 * Supports search/filter, create new, and navigation to individual dashboards.
 * Route: /_authed/dashboards (rendered at /dashboards)
 */
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  createDashboardFn,
  deleteDashboardFn,
  duplicateDashboardFn,
  listDashboardsFn,
} from '@server/api/dashboards'
import type { DashboardSummary } from '@server/api/dashboards'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const Route = createFileRoute('/_authed/dashboards')({
  component: DashboardsPage,
})

function DashboardsPage() {
  const navigate = useNavigate()

  const [dashboards, setDashboards] = useState<Array<DashboardSummary>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [totalCount, setTotalCount] = useState(0)

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboards = useCallback(async (searchQuery = '') => {
    setIsLoading(true)
    try {
      const result = await listDashboardsFn({
        data: {
          page: 1,
          limit: 50,
          search: searchQuery || undefined,
          sortBy: 'updatedAt',
          sortDir: 'desc',
        },
      })
      if (result.success && result.data) {
        setDashboards(result.data.items)
        setTotalCount(result.data.total)
      }
    } catch {
      setError('Failed to fetch dashboards')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboards()
  }, [fetchDashboards])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboards(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, fetchDashboards])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      const result = await createDashboardFn({
        data: {
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        },
      })

      if (result.success && result.data) {
        setShowCreateDialog(false)
        setNewName('')
        setNewDescription('')
        // Navigate to the new dashboard (will be /dashboards/$slug when route exists)
        void navigate({ to: '/dashboards' as string })
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to create dashboard')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This action can be undone.`)) return

    try {
      const result = await deleteDashboardFn({ data: { id, permanent: false } })
      if (result.success) {
        await fetchDashboards(search)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to delete dashboard')
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const result = await duplicateDashboardFn({ data: { id } })
      if (result.success) {
        await fetchDashboards(search)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to duplicate dashboard')
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground">
            {totalCount} dashboard{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            id="settings-link"
            className={buttonVariants({ variant: 'outline', size: 'icon' })}
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
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>

          <Button onClick={() => setShowCreateDialog(true)}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Dashboard
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg
          className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <Input
          type="text"
          className="pl-9"
          placeholder="Search dashboards…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="search-dashboards"
        />
      </div>

      {/* Error */}
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
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 -mr-2"
              onClick={() => setError(null)}
            >
              <span className="sr-only">Dismiss</span>×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
          {/* Simple Spinner */}
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p>Loading dashboards…</p>
        </div>
      ) : dashboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="p-4 rounded-full bg-muted/50">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {search ? 'No dashboards found' : 'No dashboards yet'}
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {search
                ? 'Try a different search term'
                : 'Create your first dashboard to get started'}
            </p>
          </div>
          {!search && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Dashboard
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <DashboardCard
              key={d.id}
              dashboard={d}
              onDelete={() => handleDelete(d.id, d.name)}
              onDuplicate={() => handleDuplicate(d.id)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dashboard</DialogTitle>
            <DialogDescription>
              Enter a name for your new dashboard.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreate}
            id="create-dashboard-form"
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="dash-name">Name</Label>
              <Input
                id="dash-name"
                type="text"
                placeholder="My Dashboard"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isCreating}
                autoFocus
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dash-desc">
                Description{' '}
                <span className="text-muted-foreground text-xs font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="dash-desc"
                placeholder="A brief description of your dashboard"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={isCreating}
                maxLength={500}
                rows={3}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-dashboard-form"
              disabled={isCreating || !newName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Dashboard Card Component ──────────────────────

function DashboardCard({
  dashboard,
  onDelete,
  onDuplicate,
}: {
  dashboard: DashboardSummary
  onDelete: () => void
  onDuplicate: () => void
}) {
  const timeAgo = getTimeAgo(dashboard.updatedAt)

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <Link
          to="/dashboards/$slug"
          params={{ slug: dashboard.slug }}
          className="absolute inset-0 z-0"
          aria-label={`View ${dashboard.name}`}
        />
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center text-lg">
          {dashboard.icon ? (
            dashboard.icon
          ) : (
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
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          )}
        </div>
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={
                buttonVariants({ variant: 'ghost', size: 'icon' }) +
                ' h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground'
              }
            >
              <span className="sr-only">Actions</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <CardTitle className="line-clamp-1 group-hover:text-primary transition-colors">
          {dashboard.name}
        </CardTitle>
        {dashboard.description && (
          <CardDescription className="line-clamp-2 mt-1">
            {dashboard.description}
          </CardDescription>
        )}
      </CardContent>
      <CardFooter className="pt-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span>
            {dashboard.pageCount} page{dashboard.pageCount !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>
            {dashboard.widgetCount} widget
            {dashboard.widgetCount !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          {dashboard.isDefault && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              Default
            </Badge>
          )}
          {dashboard.isPublic && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              Public
            </Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

// ─── Helpers ───────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}
