/**
 * Version History Component
 *
 * Displays a timeline of dashboard versions with restore functionality.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  getVersionFn,
  listVersionsFn,
  restoreVersionFn,
} from '@server/api/versions'
import type { VersionDetail, VersionSummary } from '@server/api/versions'
import type { DashboardSnapshot } from '@server/db/schema'
import type { ApiResponse } from '@shared/types'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { Clock01Icon } from '@hugeicons/core-free-icons'

interface VersionHistoryProps {
  dashboardId: string
  dashboardName: string
  onVersionRestored?: () => void
  trigger?: React.ReactNode
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SnapshotPreview({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="text-muted-foreground">Name:</span>{' '}
        <span className="font-medium">{snapshot.name}</span>
      </div>
      {snapshot.description && (
        <div>
          <span className="text-muted-foreground">Description:</span>{' '}
          <span>{snapshot.description}</span>
        </div>
      )}
      <div>
        <span className="text-muted-foreground">Pages:</span>{' '}
        <span className="font-medium">{snapshot.pages.length}</span>
      </div>
      <div className="space-y-2">
        {snapshot.pages.map((page, idx) => (
          <div key={idx} className="pl-3 border-l-2 border-muted-foreground/20">
            <div className="font-medium">{page.name}</div>
            <div className="text-xs text-muted-foreground">
              {page.widgets.length} widget{page.widgets.length !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VersionTimelineItem({
  version,
  isLatest,
  isSelected,
  onSelect,
  onRestore,
  isRestoring,
}: {
  version: VersionSummary
  isLatest: boolean
  isSelected: boolean
  onSelect: () => void
  onRestore: () => void
  isRestoring: boolean
}) {
  return (
    <div className="relative pl-6 pb-6 last:pb-0">
      <div
        className={cn(
          'absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 transition-colors',
          isLatest
            ? 'bg-primary border-primary'
            : 'bg-background border-muted-foreground/30',
          isSelected &&
            'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      />
      {!isLatest && (
        <div className="absolute left-[5px] top-5 w-0.5 h-full bg-muted-foreground/20" />
      )}

      <div
        className={cn(
          'rounded-lg border p-3 transition-colors cursor-pointer',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/30',
        )}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">v{version.version}</span>
              {isLatest && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatRelativeTime(version.createdAt)}
            </p>
            {version.changeDescription && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {version.changeDescription}
              </p>
            )}
          </div>
          {!isLatest && (
            <Button
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                onRestore()
              }}
              disabled={isRestoring}
            >
              {isRestoring ? 'Restoring...' : 'Restore'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function VersionListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative pl-6 pb-6">
          <Skeleton className="absolute left-0 top-1.5 w-3 h-3 rounded-full" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function VersionHistory({
  dashboardId,
  dashboardName,
  onVersionRestored,
  trigger,
}: VersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [versions, setVersions] = useState<Array<VersionSummary>>([])
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    if (!isOpen) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await listVersionsFn({
        data: { dashboardId, page: 1, limit: 50 },
      })

      if (result.success && result.data) {
        setVersions(result.data.items)
        if (result.data.items.length > 0 && !selectedVersion) {
          fetchVersionDetail(result.data.items[0].id)
        }
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load version history')
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, dashboardId, selectedVersion])

  const fetchVersionDetail = useCallback(async (versionId: string) => {
    setIsLoadingDetail(true)

    try {
      const result = (await getVersionFn({
        data: { versionId },
      })) as ApiResponse<VersionDetail>

      if (result.success && result.data) {
        setSelectedVersion(result.data)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load version details')
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    fetchVersions()
  }, [isOpen, dashboardId])

  async function handleRestore() {
    if (!restoreVersionId) return

    setIsRestoring(true)
    setError(null)

    try {
      const result = await restoreVersionFn({
        data: { versionId: restoreVersionId },
      })

      if (result.success) {
        setRestoreVersionId(null)
        await fetchVersions()
        onVersionRestored?.()
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to restore version')
    } finally {
      setIsRestoring(false)
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Icon icon={Clock01Icon} size="sm" className="mr-1.5" />
      History
    </Button>
  )

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger>{trigger ?? defaultTrigger}</SheetTrigger>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>
              View and restore previous versions of {dashboardName}
            </SheetDescription>
          </SheetHeader>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-4 h-[calc(100vh-12rem)]">
            <ScrollArea className="flex-1 sm:flex-none sm:w-64">
              {isLoading ? (
                <VersionListSkeleton />
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon
                    icon={Clock01Icon}
                    size="2xl"
                    className="mx-auto mb-3 opacity-50"
                  />
                  <p className="text-sm">No versions yet</p>
                  <p className="text-xs mt-1">
                    Versions are created automatically when you make changes
                  </p>
                </div>
              ) : (
                <div className="pr-4">
                  {versions.map((version, idx) => (
                    <VersionTimelineItem
                      key={version.id}
                      version={version}
                      isLatest={idx === 0}
                      isSelected={selectedVersion?.id === version.id}
                      onSelect={() => fetchVersionDetail(version.id)}
                      onRestore={() => setRestoreVersionId(version.id)}
                      isRestoring={isRestoring}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex-1 border-l-0 sm:border-l pl-0 sm:pl-4">
              {isLoadingDetail ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : selectedVersion ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">
                      Version {selectedVersion.version}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedVersion.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedVersion.changeDescription && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedVersion.changeDescription}
                    </p>
                  )}
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3">
                      Snapshot Preview
                    </h4>
                    <SnapshotPreview snapshot={selectedVersion.snapshot} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Select a version to preview
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!restoreVersionId}
        onOpenChange={(open) => !open && setRestoreVersionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this version? A new version will
              be created with the restored state. The current state will be
              saved to history before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={isRestoring}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isRestoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
