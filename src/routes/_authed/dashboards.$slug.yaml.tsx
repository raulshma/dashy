/**
 * Dashboard YAML Editor
 *
 * Route: /dashboards/:slug/yaml
 *
 * Features:
 * - CodeMirror YAML editor
 * - Live schema/parse validation
 * - Split view with structural preview
 * - Sync status indicator and conflict-aware save
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { yaml as yamlLanguage } from '@codemirror/lang-yaml'
import CodeMirror from '@uiw/react-codemirror'
import { Group, Panel, Separator } from 'react-resizable-panels'
import {
  applyDashboardYamlFn,
  exportDashboardYamlFn,
  validateDashboardYamlFn,
} from '@server/api/yaml'
import type {
  DashboardYamlExportPayload,
  DashboardYamlValidationPayload,
} from '@server/api/yaml'
import type { DashboardYaml } from '@shared/schemas'
import type { ApiResponse } from '@shared/types'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type SyncStatus =
  | 'loading'
  | 'synced'
  | 'editing'
  | 'saving'
  | 'conflict'
  | 'error'

interface ValidationIssue {
  level: 'error' | 'warning'
  source: 'yaml-parse' | 'yaml-schema'
  code: string
  message: string
  path?: string
  line?: number
  column?: number
}

function asApiResponse<T>(value: unknown): ApiResponse<T> {
  return value as ApiResponse<T>
}

export const Route = createFileRoute('/_authed/dashboards/$slug/yaml')({
  component: DashboardYamlEditorPage,
})

function DashboardYamlEditorPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dashboardId, setDashboardId] = useState<string | null>(null)
  const [dashboardName, setDashboardName] = useState<string>('')
  const [dashboardSlug, setDashboardSlug] = useState<string>(slug)
  const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<string>('')

  const [yamlValue, setYamlValue] = useState<string>('')
  const [lastSyncedYaml, setLastSyncedYaml] = useState<string>('')

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [validationIssues, setValidationIssues] = useState<
    Array<ValidationIssue>
  >([])
  const [previewDocument, setPreviewDocument] = useState<DashboardYaml | null>(
    null,
  )

  const [isValidating, setIsValidating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)

  const hasUnsavedChanges = yamlValue !== lastSyncedYaml
  const hasErrors = validationIssues.some((issue) => issue.level === 'error')
  const validationSummary = useMemo(() => {
    const errors = validationIssues.filter((issue) => issue.level === 'error')
    const warnings = validationIssues.filter(
      (issue) => issue.level === 'warning',
    )

    return {
      errors: errors.length,
      warnings: warnings.length,
    }
  }, [validationIssues])

  const loadYaml = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setSyncStatus('loading')
    setHasConflict(false)

    try {
      const result = asApiResponse<DashboardYamlExportPayload>(
        await exportDashboardYamlFn({
          data: { identifier: slug },
        }),
      )

      if (!result.success || !result.data) {
        setError(result.error?.message ?? 'Failed to load YAML')
        setSyncStatus('error')
        return
      }

      setDashboardId(result.data.dashboardId)
      setDashboardName(result.data.name)
      setDashboardSlug(result.data.slug)
      setDashboardUpdatedAt(result.data.updatedAt)
      setYamlValue(result.data.yaml)
      setLastSyncedYaml(result.data.yaml)
      setSyncStatus('synced')
    } catch {
      setError('Failed to load dashboard YAML')
      setSyncStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  const validateYaml = useCallback(async (content: string) => {
    setIsValidating(true)

    try {
      const result = asApiResponse<DashboardYamlValidationPayload>(
        await validateDashboardYamlFn({
          data: { yamlContent: content },
        }),
      )

      if (!result.success || !result.data) {
        setValidationIssues([])
        setPreviewDocument(null)
        return
      }

      setValidationIssues(result.data.issues as Array<ValidationIssue>)
      setPreviewDocument(result.data.preview ?? null)
    } finally {
      setIsValidating(false)
    }
  }, [])

  useEffect(() => {
    void loadYaml()
  }, [loadYaml])

  useEffect(() => {
    if (!yamlValue.trim()) {
      setValidationIssues([
        {
          level: 'error',
          source: 'yaml-schema',
          code: 'EMPTY_YAML',
          message: 'YAML cannot be empty',
          path: 'root',
        },
      ])
      setPreviewDocument(null)
      return
    }

    const timer = setTimeout(() => {
      void validateYaml(yamlValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [yamlValue, validateYaml])

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (syncStatus === 'saving' || syncStatus === 'loading') {
      return
    }

    if (hasConflict) {
      setSyncStatus('conflict')
      return
    }

    if (error) {
      setSyncStatus('error')
      return
    }

    setSyncStatus(hasUnsavedChanges ? 'editing' : 'synced')
  }, [error, hasConflict, hasUnsavedChanges, isLoading, syncStatus])

  const applyYaml = useCallback(
    async (force = false) => {
      if (!dashboardId) {
        setError('Dashboard context missing. Reload and try again.')
        return
      }

      setError(null)
      setIsSaving(true)
      setSyncStatus('saving')

      try {
        const result = asApiResponse<{
          dashboardId: string
          slug: string
          name: string
          updatedAt: string
          yaml: string
          warnings: Array<string>
        }>(
          await applyDashboardYamlFn({
            data: {
              dashboardId,
              yamlContent: yamlValue,
              expectedUpdatedAt: dashboardUpdatedAt,
              force,
            },
          }),
        )

        if (!result.success || !result.data) {
          const isConflict =
            result.error?.code === 'ALREADY_EXISTS' &&
            result.error.message
              .toLowerCase()
              .includes('updated after yaml load')

          if (isConflict) {
            setHasConflict(true)
            setSyncStatus('conflict')
          } else {
            setSyncStatus('error')
          }

          setError(result.error?.message ?? 'Failed to apply YAML')
          return
        }

        setHasConflict(false)
        setDashboardName(result.data.name)
        setDashboardSlug(result.data.slug)
        setDashboardUpdatedAt(result.data.updatedAt)
        setYamlValue(result.data.yaml)
        setLastSyncedYaml(result.data.yaml)
        setSyncStatus('synced')

        if (result.data.slug !== slug) {
          void navigate({
            to: '/dashboards/$slug/yaml',
            params: { slug: result.data.slug },
            replace: true,
          })
        }

        if (result.data.warnings.length > 0) {
          setError(
            `Saved with warnings: ${result.data.warnings.slice(0, 2).join('; ')}`,
          )
        }
      } catch {
        setSyncStatus('error')
        setError('Failed to apply YAML changes')
      } finally {
        setIsSaving(false)
      }
    },
    [dashboardId, dashboardUpdatedAt, navigate, slug, yamlValue],
  )

  const syncStatusBadge = (
    <Badge
      variant={
        syncStatus === 'synced'
          ? 'secondary'
          : syncStatus === 'saving'
            ? 'outline'
            : syncStatus === 'conflict' || syncStatus === 'error'
              ? 'destructive'
              : 'outline'
      }
      className="text-[11px]"
    >
      {syncStatus === 'loading' && 'Loading'}
      {syncStatus === 'synced' && 'Synced'}
      {syncStatus === 'editing' && 'Unsaved changes'}
      {syncStatus === 'saving' && 'Saving...'}
      {syncStatus === 'conflict' && 'Conflict detected'}
      {syncStatus === 'error' && 'Error'}
    </Badge>
  )

  return (
    <div className="flex h-[calc(100vh-var(--header-height,64px))] flex-col">
      {error && (
        <Alert
          variant={hasConflict ? 'destructive' : 'default'}
          className="mb-3"
        >
          <AlertTitle>{hasConflict ? 'Sync conflict' : 'Notice'}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <header className="flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/dashboards/$slug"
            params={{ slug: dashboardSlug || slug }}
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
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">
              YAML Editor · {dashboardName || slug}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Secure DB ↔ YAML editing with validation and conflict checks.
            </p>
          </div>
          {syncStatusBadge}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboards/$slug/settings"
            params={{ slug: dashboardSlug || slug }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Settings
          </Link>
          {hasConflict && (
            <Button
              variant="destructive"
              size="sm"
              disabled={isSaving || hasErrors || !hasUnsavedChanges}
              onClick={() => void applyYaml(true)}
            >
              Force apply
            </Button>
          )}
          <Button
            variant="glass-primary"
            size="sm"
            disabled={
              isLoading ||
              isSaving ||
              hasErrors ||
              !hasUnsavedChanges ||
              !dashboardId
            }
            onClick={() => void applyYaml(false)}
          >
            {isSaving ? 'Applying...' : 'Apply YAML'}
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading YAML editor...
          </div>
        ) : (
          <Group orientation="horizontal" className="h-full gap-2">
            <Panel defaultSize={56} minSize={35}>
              <GlassCard variant="heavy" className="h-full overflow-hidden">
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Source YAML
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {isValidating ? 'Validating…' : 'Live validation enabled'}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <CodeMirror
                      value={yamlValue}
                      height="100%"
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        searchKeymap: true,
                        history: true,
                        autocompletion: true,
                        bracketMatching: true,
                      }}
                      extensions={[yamlLanguage()]}
                      onChange={(value) => {
                        setHasConflict(false)
                        setYamlValue(value)
                      }}
                    />
                  </div>
                </div>
              </GlassCard>
            </Panel>

            <Separator className="w-1 rounded bg-border/60 transition-colors hover:bg-primary/50" />

            <Panel defaultSize={44} minSize={30}>
              <GlassCard variant="default" className="h-full">
                <div className="flex h-full flex-col gap-3 p-4">
                  <section className="rounded-xl border border-border/60 bg-muted/10 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Validation</h2>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            validationSummary.errors > 0
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-[11px]"
                        >
                          {validationSummary.errors} error
                          {validationSummary.errors === 1 ? '' : 's'}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          {validationSummary.warnings} warning
                          {validationSummary.warnings === 1 ? '' : 's'}
                        </Badge>
                      </div>
                    </div>

                    {validationIssues.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No validation issues.
                      </p>
                    ) : (
                      <ScrollArea className="max-h-48 pr-2">
                        <ul className="space-y-1.5">
                          {validationIssues.map((issue, index) => (
                            <li
                              key={`${issue.code}-${index}`}
                              className={cn(
                                'rounded-md border px-2 py-1.5 text-xs',
                                issue.level === 'error'
                                  ? 'border-destructive/40 bg-destructive/5'
                                  : 'border-border/70 bg-background/70',
                              )}
                            >
                              <p className="font-medium">{issue.message}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {issue.source}
                                {issue.path ? ` · ${issue.path}` : ''}
                                {issue.line
                                  ? ` · Ln ${issue.line}${issue.column ? `, Col ${issue.column}` : ''}`
                                  : ''}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    )}
                  </section>

                  <section className="min-h-0 flex-1 rounded-xl border border-border/60 bg-muted/10 p-3">
                    <h2 className="mb-2 text-sm font-semibold">Live Preview</h2>
                    {!previewDocument ? (
                      <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                        Fix YAML errors to render preview.
                      </div>
                    ) : (
                      <ScrollArea className="h-full pr-2">
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Dashboard
                            </p>
                            <p className="font-medium">
                              {previewDocument.dashboard.name}
                            </p>
                            {previewDocument.dashboard.description && (
                              <p className="text-xs text-muted-foreground">
                                {previewDocument.dashboard.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[11px]">
                              {previewDocument.pages.length} page
                              {previewDocument.pages.length === 1 ? '' : 's'}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              {previewDocument.pages.reduce(
                                (acc, page) => acc + page.widgets.length,
                                0,
                              )}{' '}
                              widgets
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            {previewDocument.pages.map((page, pageIndex) => (
                              <div
                                key={`${page.name}-${pageIndex}`}
                                className="rounded-lg border border-border/60 bg-background/70 p-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-medium">
                                    {page.name}
                                  </p>
                                  <span className="text-[11px] text-muted-foreground">
                                    {page.widgets.length} widget
                                    {page.widgets.length === 1 ? '' : 's'}
                                  </span>
                                </div>
                                {page.widgets.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {page.widgets
                                      .slice(0, 8)
                                      .map((widget, widgetIndex) => (
                                        <Badge
                                          key={`${widget.type}-${widgetIndex}`}
                                          variant="ghost"
                                          className="h-5 rounded-md px-1.5 text-[10px]"
                                        >
                                          {widget.title ?? widget.type}
                                        </Badge>
                                      ))}
                                    {page.widgets.length > 8 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{page.widgets.length - 8} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </ScrollArea>
                    )}
                  </section>
                </div>
              </GlassCard>
            </Panel>
          </Group>
        )}
      </main>
    </div>
  )
}
