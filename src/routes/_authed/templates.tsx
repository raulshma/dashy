/**
 * Templates Gallery Page
 *
 * Browse and apply dashboard templates.
 * Route: /templates
 */
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  applyTemplateFn,
  deleteTemplateFn,
  getTemplateFn,
  listCategoriesFn,
  listTemplatesFn,
} from '@server/api/templates'
import type { TemplateDetail, TemplateSummary } from '@server/api/templates'
import type { ApiResponse } from '@shared/types'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TemplatePreview } from '@/components/dashboard/template-preview'

function asApiResponse<T>(value: unknown): ApiResponse<T> {
  return value as ApiResponse<T>
}

export const Route = createFileRoute('/_authed/templates')({
  component: TemplatesPage,
})

function TemplatesPage() {
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt'>(
    'createdAt',
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [applyTemplateId, setApplyTemplateId] = useState<string | null>(null)
  const [newDashboardName, setNewDashboardName] = useState('')
  const [isApplying, setIsApplying] = useState(false)

  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [previewTemplate, setPreviewTemplate] = useState<TemplateDetail | null>(
    null,
  )
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = asApiResponse<{
        items: TemplateSummary[]
        total: number
      }>(
        await listTemplatesFn({
          data: {
            search: search || undefined,
            category: selectedCategory || undefined,
            sortBy,
            sortDir,
            page: 1,
            limit: 100,
          },
        }),
      )

      if (result.success && result.data) {
        setTemplates(result.data.items)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }, [search, selectedCategory, sortBy, sortDir])

  const fetchCategories = useCallback(async () => {
    try {
      const result = asApiResponse<string[]>(
        await listCategoriesFn({ data: {} }),
      )
      if (result.success && result.data) {
        setCategories(result.data)
      }
    } catch {
      // Ignore category fetch errors
    }
  }, [])

  useEffect(() => {
    void fetchTemplates()
    void fetchCategories()
  }, [fetchTemplates, fetchCategories])

  function openApplyDialog(template: TemplateSummary) {
    setApplyTemplateId(template.id)
    setNewDashboardName(`From ${template.name}`)
  }

  async function openPreviewDialog(template: TemplateSummary) {
    setIsLoadingPreview(true)
    try {
      const result = asApiResponse<TemplateDetail>(
        await getTemplateFn({ data: { id: template.id } }),
      )
      if (result.success && result.data) {
        setPreviewTemplate(result.data)
      } else if (result.error) {
        toast.error(result.error.message)
      }
    } catch {
      toast.error('Failed to load template preview')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function handleApplyTemplate() {
    if (!applyTemplateId) return

    setIsApplying(true)
    try {
      const result = asApiResponse<{ id: string; slug: string }>(
        await applyTemplateFn({
          data: {
            templateId: applyTemplateId,
            name: newDashboardName.trim() || undefined,
          },
        }),
      )

      if (result.success && result.data) {
        toast.success('Dashboard created from template')
        void navigate({
          to: '/dashboards/$slug',
          params: { slug: result.data.slug },
        })
      } else if (result.error) {
        toast.error(result.error.message)
      }
    } catch {
      toast.error('Failed to apply template')
    } finally {
      setIsApplying(false)
      setApplyTemplateId(null)
    }
  }

  async function handleDeleteTemplate() {
    if (!deleteTemplateId) return

    setIsDeleting(true)
    try {
      const result = asApiResponse<{ deleted: boolean }>(
        await deleteTemplateFn({ data: { id: deleteTemplateId } }),
      )

      if (result.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== deleteTemplateId))
        toast.success('Template deleted')
      } else if (result.error) {
        toast.error(result.error.message)
      }
    } catch {
      toast.error('Failed to delete template')
    } finally {
      setIsDeleting(false)
      setDeleteTemplateId(null)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Start with a pre-built dashboard layout.
          </p>
        </div>
        <Link
          to="/dashboards"
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Dashboards
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'name' | 'createdAt' | 'updatedAt')
            }
            className="h-9 rounded-xl border bg-input/30 px-3 text-sm"
          >
            <option value="createdAt">Newest</option>
            <option value="updatedAt">Recently Updated</option>
            <option value="name">Name</option>
          </select>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
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
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 mb-4 text-muted-foreground opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
          <h3 className="text-lg font-medium mb-1">No templates found</h3>
          <p className="text-muted-foreground">
            {search || selectedCategory
              ? 'Try adjusting your search or filters.'
              : 'Save a dashboard as a template to see it here.'}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="group">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {template.name}
                    </CardTitle>
                    {template.category && (
                      <Badge variant="secondary" className="mt-1">
                        {template.category}
                      </Badge>
                    )}
                  </div>
                </div>
                {template.description && (
                  <CardDescription className="line-clamp-2">
                    {template.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span>{template.pageCount} page(s)</span>
                  <span>{template.widgetCount} widget(s)</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openPreviewDialog(template)}
                >
                  Preview Layout
                </Button>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(template.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTemplateId(template.id)}
                  >
                    Delete
                  </Button>
                  <Button size="sm" onClick={() => openApplyDialog(template)}>
                    Use Template
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!applyTemplateId}
        onOpenChange={(open) => !open && setApplyTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Dashboard from Template</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for your new dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="dashboard-name">Dashboard Name</Label>
            <Input
              id="dashboard-name"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              className="mt-2"
              placeholder="My Dashboard"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setApplyTemplateId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApplyTemplate}
              disabled={isApplying || !newDashboardName.trim()}
            >
              {isApplying ? 'Creating...' : 'Create Dashboard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={(open) => !open && setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTemplateId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            {previewTemplate?.description && (
              <DialogDescription>
                {previewTemplate.description}
              </DialogDescription>
            )}
          </DialogHeader>
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-12">
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
            </div>
          ) : previewTemplate ? (
            <div className="flex-1 overflow-auto space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{previewTemplate.pageCount} page(s)</span>
                <span>{previewTemplate.widgetCount} widget(s)</span>
                {previewTemplate.category && (
                  <Badge variant="secondary">{previewTemplate.category}</Badge>
                )}
              </div>
              <TemplatePreview schema={previewTemplate.schema} />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPreviewTemplate(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const t = previewTemplate
                    setPreviewTemplate(null)
                    openApplyDialog({
                      id: t.id,
                      name: t.name,
                      description: t.description,
                      category: t.category,
                      thumbnailUrl: t.thumbnailUrl,
                      pageCount: t.pageCount,
                      widgetCount: t.widgetCount,
                      createdBy: t.createdBy,
                      createdAt: t.createdAt,
                      updatedAt: t.updatedAt,
                    })
                  }}
                >
                  Use Template
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
