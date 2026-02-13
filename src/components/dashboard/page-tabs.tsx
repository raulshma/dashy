/**
 * Page Tabs Component
 *
 * Tab bar with drag-to-reorder, add/rename/delete functionality.
 * Uses @dnd-kit for drag and drop.
 */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  MoreVerticalIcon,
} from '@hugeicons/core-free-icons'
import type { DragEndEvent } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@/components/ui/icon'
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
        <Icon icon={Add01Icon} size="sm" />
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
        <span className="max-w-[--spacing(30)] truncate">{page.name}</span>
        {page.widgetCount > 0 && (
          <span className="text-xs text-muted-foreground ml-1">
            ({page.widgetCount})
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'shrink-0 p-1 mr-1 rounded hover:bg-muted transition-opacity',
            'opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100',
          )}
          aria-label="Page options"
        >
          <Icon icon={MoreVerticalIcon} size="sm" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            <Icon icon={Edit02Icon} size="sm" className="mr-2" />
            Rename
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Icon icon={Delete02Icon} size="sm" className="mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
