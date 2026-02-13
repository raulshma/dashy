import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { z } from 'zod'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

export const notesWidgetConfigSchema = z.object({
  content: z.string().default('<p>Write your notes here...</p>'),
  showToolbar: z.boolean().default(true),
  autosaveMs: z.number().int().min(500).max(10000).default(1500),
  stickyMode: z.boolean().default(false),
  stickyTop: z.number().int().min(0).max(160).default(16),
})

export type NotesWidgetConfig = z.infer<typeof notesWidgetConfigSchema>

function ToolbarButton({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-1 text-xs transition-colors ${
        active
          ? 'bg-white/25 text-white'
          : 'bg-white/10 text-white/80 hover:bg-white/20'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  )
}

export function NotesWidget({
  config,
  isEditing,
  onConfigChange,
}: WidgetRenderProps<NotesWidgetConfig>): React.ReactElement {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stickyTop = Math.max(0, Math.min(160, config.stickyTop))

  const editor = useEditor({
    extensions: [StarterKit],
    content: config.content,
    editable: isEditing,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      if (!onConfigChange) return

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      const html = currentEditor.getHTML()
      saveTimeoutRef.current = setTimeout(() => {
        onConfigChange({ content: html })
      }, config.autosaveMs)
    },
  })

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editor) return

    const current = editor.getHTML()
    if (current !== config.content) {
      editor.commands.setContent(config.content, { emitUpdate: false })
    }
  }, [editor, config.content])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(isEditing)
  }, [editor, isEditing])

  const saveLabel = useMemo(
    () =>
      onConfigChange
        ? `Autosaves every ${(config.autosaveMs / 1000).toFixed(1)}s`
        : 'Read-only',
    [config.autosaveMs, onConfigChange],
  )

  return (
    <GlassCard
      className={cn(
        'h-full overflow-hidden p-0',
        config.stickyMode && 'sticky z-30 shadow-2xl shadow-black/30',
      )}
      style={
        config.stickyMode
          ? {
              top: `${stickyTop}px`,
            }
          : undefined
      }
    >
      {config.showToolbar && (
        <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-black/20 px-2 py-2">
          <ToolbarButton
            label="B"
            active={editor?.isActive('bold')}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            disabled={!editor || !isEditing}
          />
          <ToolbarButton
            label="I"
            active={editor?.isActive('italic')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            disabled={!editor || !isEditing}
          />
          <ToolbarButton
            label="S"
            active={editor?.isActive('strike')}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            disabled={!editor || !isEditing}
          />
          <ToolbarButton
            label="H2"
            active={editor?.isActive('heading', { level: 2 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
            disabled={!editor || !isEditing}
          />
          <ToolbarButton
            label="• List"
            active={editor?.isActive('bulletList')}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            disabled={!editor || !isEditing}
          />
          <ToolbarButton
            label="1. List"
            active={editor?.isActive('orderedList')}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            disabled={!editor || !isEditing}
          />
          <ToolbarButton
            label="P"
            active={editor?.isActive('paragraph')}
            onClick={() => editor?.chain().focus().setParagraph().run()}
            disabled={!editor || !isEditing}
          />

          {onConfigChange && (
            <ToolbarButton
              label={config.stickyMode ? '📌 Pinned' : '📍 Pin'}
              active={config.stickyMode}
              onClick={() => onConfigChange({ stickyMode: !config.stickyMode })}
              disabled={!isEditing}
            />
          )}

          <span className="ml-auto text-[10px] text-white/55">{saveLabel}</span>
        </div>
      )}

      <div className="h-full overflow-auto p-3">
        <EditorContent
          editor={editor}
          className="prose prose-invert prose-sm max-w-none min-h-full [&_.ProseMirror]:min-h-35 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-white/90"
        />
      </div>
    </GlassCard>
  )
}

export const notesWidgetDefinition: Widget<typeof notesWidgetConfigSchema> = {
  type: 'notes',
  displayName: 'Notes',
  description: 'Rich text notes with lightweight toolbar and autosave',
  icon: 'note',
  category: 'productivity',
  configSchema: notesWidgetConfigSchema,
  defaultConfig: {
    content: '<p>Write your notes here...</p>',
    showToolbar: true,
    autosaveMs: 1500,
    stickyMode: false,
    stickyTop: 16,
  },
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 8, h: 8 },
}
