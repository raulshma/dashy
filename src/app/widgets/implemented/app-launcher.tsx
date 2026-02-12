import { useState, useMemo, useRef, useEffect } from 'react'
import { z } from 'zod'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Icon } from '@/components/ui/icon'
import {
  Link02Icon,
  Add01Icon,
  Search01Icon,
  Folder01Icon,
  Upload04Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'

const MAX_ICON_FILE_BYTES = 128 * 1024
const ALLOWED_ICON_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

export const bookmarkSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  url: z.string().url(),
  icon: z.string().optional(),
  groupId: z.string().optional(),
})

export const groupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
})

export const appLauncherConfigSchema = z.object({
  bookmarks: z.array(bookmarkSchema).default([]),
  groups: z.array(groupSchema).default([]),
  showSearch: z.boolean().default(true),
  columns: z.number().int().min(2).max(8).default(4),
})

export type Bookmark = z.infer<typeof bookmarkSchema>
export type Group = z.infer<typeof groupSchema>
export type AppLauncherWidgetConfig = z.infer<typeof appLauncherConfigSchema>

function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
  } catch {
    return ''
  }
}

function BookmarkItem({
  bookmark,
  isEditing,
  onClick,
  onRequestUpload,
  onClearIcon,
}: {
  bookmark: Bookmark
  isEditing: boolean
  onClick: () => void
  onRequestUpload: () => void
  onClearIcon: () => void
}) {
  const iconSrc = bookmark.icon || getFaviconUrl(bookmark.url)

  return (
    <div className="group flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-colors">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex flex-col items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg"
        title={bookmark.name}
      >
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden group-hover:bg-white/20 transition-colors">
          {iconSrc ? (
            <img
              src={iconSrc}
              alt={bookmark.name}
              className="w-6 h-6 object-contain"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <Icon
              icon={Link02Icon}
              size="md"
              className="text-muted-foreground"
            />
          )}
        </div>
        <span className="text-xs text-muted-foreground group-hover:text-foreground truncate max-w-full text-center">
          {bookmark.name}
        </span>
      </button>

      {isEditing && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRequestUpload}
            className="p-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
            title="Upload custom icon"
            aria-label={`Upload icon for ${bookmark.name}`}
          >
            <Icon icon={Upload04Icon} size="xs" />
          </button>
          {bookmark.icon && (
            <button
              type="button"
              onClick={onClearIcon}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              title="Remove custom icon"
              aria-label={`Remove icon for ${bookmark.name}`}
            >
              <Icon icon={Delete02Icon} size="xs" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
      } else {
        reject(new Error('Failed to read image file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

function GroupHeader({
  group,
  collapsed,
  onToggle,
  count,
}: {
  group: Group
  collapsed: boolean
  onToggle: () => void
  count: number
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left"
    >
      <div style={{ color: group.color || 'currentColor' }}>
        <Icon
          icon={Folder01Icon}
          size="sm"
          className={collapsed ? '' : 'rotate-90'}
        />
      </div>
      <span className="text-sm font-medium">{group.name}</span>
      <span className="text-xs text-muted-foreground ml-auto">{count}</span>
    </button>
  )
}

export function AppLauncherWidget({
  config,
  isEditing,
  onConfigChange,
}: WidgetRenderProps<AppLauncherWidgetConfig>) {
  const [search, setSearch] = useState('')
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingBookmarkId, setPendingBookmarkId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(config.groups.filter((g) => g.collapsed).map((g) => g.id)),
  )
  const searchInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

  const filteredBookmarks = useMemo(() => {
    if (!search.trim()) return config.bookmarks
    const query = search.toLowerCase()
    return config.bookmarks.filter((b) => b.name.toLowerCase().includes(query))
  }, [config.bookmarks, search])

  const groupedBookmarks = useMemo(() => {
    const groups = new Map<string | undefined, Bookmark[]>()
    for (const bookmark of filteredBookmarks) {
      const groupId = bookmark.groupId
      if (!groups.has(groupId)) {
        groups.set(groupId, [])
      }
      groups.get(groupId)!.push(bookmark)
    }
    return groups
  }, [filteredBookmarks])

  const ungroupedBookmarks = groupedBookmarks.get(undefined) || []
  const groupsWithBookmarks = config.groups.filter((g) =>
    groupedBookmarks.has(g.id),
  )

  const handleOpenBookmark = (bookmark: Bookmark) => {
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  const handleIconUploadForBookmark = async (file: File, bookmarkId: string) => {
    setUploadMessage(null)
    setUploadError(null)

    if (!ALLOWED_ICON_MIME_TYPES.has(file.type)) {
      setUploadError('Only PNG, JPG, WEBP, and GIF icons are allowed.')
      return
    }

    if (file.size > MAX_ICON_FILE_BYTES) {
      setUploadError('Icon must be 128KB or smaller for performance.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (!dataUrl.startsWith('data:image/')) {
        setUploadError('Invalid icon content.')
        return
      }

      onConfigChange?.({
        bookmarks: config.bookmarks.map((bookmark) =>
          bookmark.id === bookmarkId ? { ...bookmark, icon: dataUrl } : bookmark,
        ),
      })

      setUploadMessage('Custom icon uploaded.')
    } catch {
      setUploadError('Could not upload icon.')
    }
  }

  const handleClearIconForBookmark = (bookmarkId: string) => {
    setUploadMessage(null)
    setUploadError(null)
    onConfigChange?.({
      bookmarks: config.bookmarks.map((bookmark) =>
        bookmark.id === bookmarkId
          ? { ...bookmark, icon: undefined }
          : bookmark,
      ),
    })
    setUploadMessage('Custom icon removed.')
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && config.showSearch) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [config.showSearch])

  const gridStyle = {
    gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
  }

  return (
    <GlassCard className="h-full p-3 flex flex-col gap-2 overflow-hidden">
      {config.showSearch && (
        <div className="relative">
          <Icon
            icon={Search01Icon}
            size="sm"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search... (Ctrl+K)"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white/5 rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>
      )}

      {isEditing && (
        <>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              const bookmarkId = pendingBookmarkId
              event.currentTarget.value = ''

              if (!file || !bookmarkId) return

              void handleIconUploadForBookmark(file, bookmarkId)
            }}
          />

          {uploadError && (
            <p className="text-xs text-red-400 px-1" role="alert">
              {uploadError}
            </p>
          )}

          {!uploadError && uploadMessage && (
            <p className="text-xs text-emerald-400 px-1">{uploadMessage}</p>
          )}
        </>
      )}

      <div className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-3">
        {ungroupedBookmarks.length > 0 && (
          <div className="grid gap-1" style={gridStyle}>
            {ungroupedBookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                isEditing={isEditing}
                onClick={() => handleOpenBookmark(bookmark)}
                onRequestUpload={() => {
                  setPendingBookmarkId(bookmark.id)
                  iconInputRef.current?.click()
                }}
                onClearIcon={() => handleClearIconForBookmark(bookmark.id)}
              />
            ))}
          </div>
        )}

        {groupsWithBookmarks.map((group) => {
          const bookmarks = groupedBookmarks.get(group.id) || []
          const isCollapsed = collapsedGroups.has(group.id)

          return (
            <div key={group.id} className="space-y-1">
              <GroupHeader
                group={group}
                collapsed={isCollapsed}
                onToggle={() => toggleGroup(group.id)}
                count={bookmarks.length}
              />
              {!isCollapsed && (
                <div className="grid gap-1 pl-4" style={gridStyle}>
                  {bookmarks.map((bookmark) => (
                    <BookmarkItem
                      key={bookmark.id}
                      bookmark={bookmark}
                      isEditing={isEditing}
                      onClick={() => handleOpenBookmark(bookmark)}
                      onRequestUpload={() => {
                        setPendingBookmarkId(bookmark.id)
                        iconInputRef.current?.click()
                      }}
                      onClearIcon={() => handleClearIconForBookmark(bookmark.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {config.bookmarks.length === 0 && !isEditing && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Icon icon={Add01Icon} size="xl" className="mb-2 opacity-50" />
            <p className="text-sm">Add bookmarks to get started</p>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

export const appLauncherWidgetDefinition: Widget<typeof appLauncherConfigSchema> =
  {
    type: 'app-launcher',
    displayName: 'App Launcher',
    description: 'Quick access grid of bookmarks and links',
    icon: 'link',
    category: 'productivity',
    configSchema: appLauncherConfigSchema,
    defaultConfig: {
      bookmarks: [],
      groups: [],
      showSearch: true,
      columns: 4,
    },
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 6, h: 4 },
  }
