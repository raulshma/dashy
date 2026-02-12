/**
 * Share Links Manager Component
 *
 * UI for managing share links for a dashboard.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createShareLinkFn,
  deleteShareLinkFn,
  listShareLinksFn,
  updateShareLinkFn,
  type ShareLinkDetail,
} from '@server/api/share-links'
import type { ApiResponse } from '@shared/types'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GlassCard } from '@/components/ui/glass-card'

interface ShareLinksManagerProps {
  dashboardId: string
}

function asApiResponse<T>(value: unknown): ApiResponse<T> {
  return value as ApiResponse<T>
}

export function ShareLinksManager({ dashboardId }: ShareLinksManagerProps) {
  const [links, setLinks] = useState<Array<ShareLinkDetail>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<ShareLinkDetail | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [newLinkMode, setNewLinkMode] = useState<'read-only' | 'embed'>(
    'read-only',
  )
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkExpires, setNewLinkExpires] = useState('')

  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const fetchLinks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = asApiResponse<Array<ShareLinkDetail>>(
        await listShareLinksFn({ data: { dashboardId } }),
      )

      if (result.success && result.data) {
        setLinks(result.data)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load share links')
    } finally {
      setIsLoading(false)
    }
  }, [dashboardId])

  useEffect(() => {
    void fetchLinks()
  }, [fetchLinks])

  const copyToClipboard = async (token: string) => {
    const url = `${window.location.origin}/share/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopiedToken(null), 2000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  const copyEmbedCode = async (token: string) => {
    const embedUrl = `${window.location.origin}/embed/${token}`
    const code = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`
    try {
      await navigator.clipboard.writeText(code)
      setCopiedToken(`embed-${token}`)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopiedToken(null), 2000)
    } catch {
      setError('Failed to copy embed code')
    }
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = asApiResponse<ShareLinkDetail>(
        await createShareLinkFn({
          data: {
            dashboardId,
            mode: newLinkMode,
            label: newLinkLabel.trim() || undefined,
            expiresAt: newLinkExpires || undefined,
          },
        }),
      )

      if (result.success && result.data) {
        setLinks((prev) => [...prev, result.data!])
        setShowCreateDialog(false)
        setNewLinkMode('read-only')
        setNewLinkLabel('')
        setNewLinkExpires('')
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to create share link')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleActive(link: ShareLinkDetail) {
    try {
      const result = asApiResponse<ShareLinkDetail>(
        await updateShareLinkFn({
          data: {
            id: link.id,
            isActive: !link.isActive,
          },
        }),
      )

      if (result.success && result.data) {
        setLinks((prev) =>
          prev.map((l) => (l.id === link.id ? result.data! : l)),
        )
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to update share link')
    }
  }

  async function handleDeleteLink() {
    if (!linkToDelete) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = asApiResponse<{ deleted: boolean }>(
        await deleteShareLinkFn({ data: { id: linkToDelete.id } }),
      )

      if (result.success) {
        setLinks((prev) => prev.filter((l) => l.id !== linkToDelete.id))
        setShowDeleteDialog(false)
        setLinkToDelete(null)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to delete share link')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading share links...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Share Links</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage shareable links to this dashboard.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>Create Link</Button>
      </div>

      {links.length === 0 ? (
        <GlassCard className="p-6 text-center text-muted-foreground">
          <p>No share links yet</p>
          <p className="text-sm mt-1">
            Create a share link to allow others to view this dashboard.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <GlassCard key={link.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {link.label || 'Untitled Link'}
                    </span>
                    <Badge
                      variant={link.mode === 'embed' ? 'secondary' : 'outline'}
                    >
                      {link.mode}
                    </Badge>
                    {!link.isActive && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                    {link.expiresAt &&
                      new Date(link.expiresAt) < new Date() && (
                        <Badge variant="destructive">Expired</Badge>
                      )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-xs">
                      {link.token}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => void copyToClipboard(link.token)}
                    >
                      {copiedToken === link.token ? 'Copied!' : 'Copy URL'}
                    </Button>
                    {link.mode === 'embed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => void copyEmbedCode(link.token)}
                      >
                        {copiedToken === `embed-${link.token}`
                          ? 'Copied!'
                          : 'Copy Embed'}
                      </Button>
                    )}
                  </div>
                  {link.expiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(link.expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="sm">
                        Actions
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => void handleToggleActive(link)}
                    >
                      {link.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setLinkToDelete(link)
                        setShowDeleteDialog(true)
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Share Link</DialogTitle>
            <DialogDescription>
              Create a new shareable link for this dashboard.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLink} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="link-mode">Access Mode</Label>
              <Select
                value={newLinkMode}
                onValueChange={(v) =>
                  setNewLinkMode(v as 'read-only' | 'embed')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read-only">
                    Read-only (share page)
                  </SelectItem>
                  <SelectItem value="embed">Embed (iframe)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="link-label">Label (optional)</Label>
              <Input
                id="link-label"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="e.g., Team sharing"
                maxLength={100}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="link-expires">Expiration Date (optional)</Label>
              <Input
                id="link-expires"
                type="datetime-local"
                value={newLinkExpires}
                onChange={(e) => setNewLinkExpires(e.target.value)}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateLink} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Share Link</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this share link? Anyone with the
              link will no longer be able to access the dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setLinkToDelete(null)
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLink}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
