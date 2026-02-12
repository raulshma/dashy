/**
 * Page Tabs Component
 *
 * Tab bar with drag-to-reorder, add/rename/delete functionality.
 * Uses @dnd-kit for drag and drop.
 */
import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Page {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  widgetCount: number
}

interface PageTabsProps {
  pages: Array<Page>
  activePageId: string | null
  onPageSelect: (pageId: string) => void
  onAddPage: () => void
  onRenamePage: (page: Page) => void
  onDeletePage: (page: Page) => void
  onReorder: (pages: Array<{ id: string }>) => void
}

export function PageTabs({
  pages,
  activePageId,
  onPageSelect,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onReorder,
}: PageTabsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex((p) => p.id === active.id)
      const newIndex = pages.findIndex((p) => p.id === over.id)

      const newOrder = arrayMove(pages, oldIndex, newIndex)
      onReorder(newOrder)
    }
  }

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={horizontalListSortingStrategy}
        >
          {pages.map((page) => (
            <PageTab
              key={page.id}
              page={page}
              isActive={page.id === activePageId}
              onSelect={() => onPageSelect(page.id)}
              onRename={() => onRenamePage(page)}
              onDelete={() => onDeletePage(page)}
              canDelete={pages.length > 1}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="ghost"
        size="sm"
        onClick={onAddPage}
        className="shrink-0 h-8 px-2 text-muted-foreground hover:text-foreground"
        aria-label="Add page"
      >
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Button>
    </div>
  )
}

interface PageTabProps {
  page: Page
  isActive: boolean
  onSelect: () => void
  onRename: () => void
  onDelete: () => void
  canDelete: boolean
}

function PageTab({
  page,
  isActive,
  onSelect,
  onRename,
  onDelete,
  canDelete,
}: PageTabProps) {
  const [showMenu, setShowMenu] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center rounded-md text-sm font-medium transition-colors',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
        isDragging && 'cursor-grabbing',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
        {...attributes}
        {...listeners}
      >
        {page.icon && <span className="text-base">{page.icon}</span>}
        <span className="max-w-[120px] truncate">{page.name}</span>
        {page.widgetCount > 0 && (
          <span className="text-xs text-muted-foreground ml-1">
            ({page.widgetCount})
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        onBlur={() => setShowMenu(false)}
        className={cn(
          'shrink-0 p-1 mr-1 rounded hover:bg-muted transition-opacity',
          showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
        aria-label="Page options"
      >
        <svg
          width="14"
          height="14"
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
      </button>

      {showMenu && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[120px] rounded-md border bg-popover p-1 shadow-md">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setShowMenu(false)
              onRename()
            }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
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
              <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Rename
          </button>
          {canDelete && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setShowMenu(false)
                onDelete()
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-destructive hover:text-destructive"
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
            </button>
          )}
        </div>
      )}
    </div>
  )
}
