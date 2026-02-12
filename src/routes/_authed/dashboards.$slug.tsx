/**
 * Dashboard View Page
 *
 * Displays a single dashboard with page tabs and widget content.
 * Route: /dashboards/:slug
 */
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getDashboardFn } from '@server/api/dashboards'
import {
  addPageFn,
  deletePageFn,
  renamePageFn,
  reorderPagesFn,
} from '@server/api/pages'
import type { DashboardDetail } from '@server/api/dashboards'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageTabs } from '@/components/dashboard/page-tabs'
import { VersionHistory } from '@/components/dashboard/version-history'

export const Route = createFileRoute('/_authed/dashboards/$slug')({
  component: DashboardViewPage,
})

interface PageSummary {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  widgetCount: number
}

interface PageWithWidgets extends PageSummary {
  widgets: Array<{
    id: string
    type: string
    title: string | null
    x: number
    y: number
    w: number
    h: number
  }>
}

function DashboardViewPage() {
  const { slug } = Route.useParams()

  const [dashboard, setDashboard] = useState<DashboardDetail | null>(null)
  const [pages, setPages] = useState<Array<PageWithWidgets>>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddPageDialog, setShowAddPageDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newPageName, setNewPageName] = useState('')
  const [pageToEdit, setPageToEdit] = useState<PageWithWidgets | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getDashboardFn({ data: { identifier: slug } })

      if (result.success && result.data) {
        setDashboard(result.data)
        const pagesWithWidgets: Array<PageWithWidgets> = result.data.pages.map(
          (p) => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            sortOrder: p.sortOrder,
            widgetCount: p.widgetCount,
            widgets: [],
          }),
        )
        setPages(pagesWithWidgets)
        if (pagesWithWidgets.length > 0 && !activePageId) {
          setActivePageId(pagesWithWidgets[0].id)
        }
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [slug, activePageId])

  useEffect(() => {
    fetchDashboard()
  }, [slug])

  const activePage = pages.find((p) => p.id === activePageId) ?? null

  async function handleAddPage(e: React.FormEvent) {
    e.preventDefault()
    if (!dashboard || !newPageName.trim()) return

    setIsSubmitting(true)

    try {
      const result = await addPageFn({
        data: {
          dashboardId: dashboard.id,
          name: newPageName.trim(),
        },
      })

      if (result.success && result.data) {
        const newPage: PageWithWidgets = {
          id: result.data.id,
          name: result.data.name,
          icon: result.data.icon,
          sortOrder: result.data.sortOrder,
          widgetCount: result.data.widgetCount,
          widgets: [],
        }
        setPages((prev) => [...prev, newPage])
        setActivePageId(newPage.id)
        setShowAddPageDialog(false)
        setNewPageName('')
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to add page')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRenamePage(e: React.FormEvent) {
    e.preventDefault()
    if (!pageToEdit || !newPageName.trim()) return

    setIsSubmitting(true)

    try {
      const result = await renamePageFn({
        data: {
          id: pageToEdit.id,
          name: newPageName.trim(),
        },
      })

      if (result.success && result.data) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageToEdit.id ? { ...p, name: result.data!.name } : p,
          ),
        )
        setShowRenameDialog(false)
        setPageToEdit(null)
        setNewPageName('')
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to rename page')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeletePage() {
    if (!pageToEdit) return

    setIsSubmitting(true)

    try {
      const result = await deletePageFn({ data: { id: pageToEdit.id } })

      if (result.success) {
        setPages((prev) => prev.filter((p) => p.id !== pageToEdit.id))
        if (activePageId === pageToEdit.id) {
          const remaining = pages.filter((p) => p.id !== pageToEdit.id)
          setActivePageId(remaining[0]?.id ?? null)
        }
        setShowDeleteDialog(false)
        setPageToEdit(null)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to delete page')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReorderPages(newOrder: Array<{ id: string }>) {
    if (!dashboard) return

    const pageIds = newOrder.map((p) => p.id)

    try {
      const result = await reorderPagesFn({
        data: {
          dashboardId: dashboard.id,
          pageIds,
        },
      })

      if (result.success) {
        setPages((prev) => {
          const orderMap = new Map(pageIds.map((id, i) => [id, i]))
          return [...prev].sort(
            (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
          )
        })
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to reorder pages')
    }
  }

  function openRenameDialog(page: { id: string; name: string }) {
    const fullPage = pages.find((p) => p.id === page.id)
    if (fullPage) {
      setPageToEdit(fullPage)
      setNewPageName(fullPage.name)
      setShowRenameDialog(true)
    }
  }

  function openDeleteDialog(page: { id: string }) {
    const fullPage = pages.find((p) => p.id === page.id)
    if (fullPage) {
      setPageToEdit(fullPage)
      setShowDeleteDialog(true)
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
        <p>Loading dashboard...</p>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
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
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))]">
      {error && (
        <Alert variant="destructive" className="mb-4">
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

      <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboards"
            className="shrink-0 rounded-md p-1.5 hover:bg-muted transition-colors"
            aria-label="Back to dashboards"
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
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground truncate">
                {dashboard.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {dashboard.isPublic && (
              <Badge variant="outline" className="text-xs">
                Public
              </Badge>
            )}
            {dashboard.isDefault && (
              <Badge variant="secondary" className="text-xs">
                Default
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <VersionHistory
            dashboardId={dashboard.id}
            dashboardName={dashboard.name}
            onVersionRestored={fetchDashboard}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            >
              <span className="sr-only">Dashboard options</span>
              <svg
                width="18"
                height="18"
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
              <DropdownMenuItem>
                <Link
                  to="/dashboards/$slug/settings"
                  params={{ slug: dashboard.slug }}
                  className="flex items-center w-full"
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
                    <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <PageTabs
        pages={pages}
        activePageId={activePageId}
        onPageSelect={setActivePageId}
        onAddPage={() => {
          setNewPageName('')
          setShowAddPageDialog(true)
        }}
        onRenamePage={openRenameDialog}
        onDeletePage={openDeleteDialog}
        onReorder={handleReorderPages}
      />

      <main className="flex-1 overflow-auto p-4">
        {activePage ? (
          <PageContent page={activePage} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p>No page selected</p>
          </div>
        )}
      </main>

      <Dialog open={showAddPageDialog} onOpenChange={setShowAddPageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Page</DialogTitle>
            <DialogDescription>
              Create a new page in this dashboard.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleAddPage}
            id="add-page-form"
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="page-name">Page Name</Label>
              <Input
                id="page-name"
                type="text"
                placeholder="New Page"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                maxLength={100}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddPageDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-page-form"
              disabled={isSubmitting || !newPageName.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
            <DialogDescription>
              Enter a new name for this page.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleRenamePage}
            id="rename-page-form"
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="rename-page-name">Page Name</Label>
              <Input
                id="rename-page-name"
                type="text"
                placeholder="Page name"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                maxLength={100}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="rename-page-form"
              disabled={isSubmitting || !newPageName.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{pageToEdit?.name}"? All widgets
              on this page will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeletePage}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PageContent({ page }: { page: PageWithWidgets }) {
  if (page.widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-20">
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
            <path d="M14 14h7M14 17h7M14 20h4" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            No widgets yet
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Add widgets to this page to start building your dashboard.
          </p>
        </div>
        <Button>
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
          Add Widget
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {page.widgets.map((widget) => (
        <div
          key={widget.id}
          className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
        >
          <h3 className="font-medium">{widget.title ?? widget.type}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Widget: {widget.type} ({widget.w}×{widget.h})
          </p>
        </div>
      ))}
    </div>
  )
}
