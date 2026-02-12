import * as React from 'react'

interface UseActionHistoryOptions {
  limit?: number
}

interface UseActionHistoryResult<TAction> {
  canUndo: boolean
  canRedo: boolean
  isApplying: boolean
  undoStackSize: number
  redoStackSize: number
  undoActions: ReadonlyArray<TAction>
  redoActions: ReadonlyArray<TAction>
  push: (action: TAction) => void
  undo: (applyInverse: (action: TAction) => Promise<void>) => Promise<boolean>
  redo: (applyForward: (action: TAction) => Promise<void>) => Promise<boolean>
  clear: () => void
}

const DEFAULT_LIMIT = 100

function useActionHistory<TAction>(
  options: UseActionHistoryOptions = {},
): UseActionHistoryResult<TAction> {
  const { limit = DEFAULT_LIMIT } = options

  const [undoStack, setUndoStack] = React.useState<Array<TAction>>([])
  const [redoStack, setRedoStack] = React.useState<Array<TAction>>([])
  const [isApplying, setIsApplying] = React.useState(false)

  const undoStackRef = React.useRef<Array<TAction>>([])
  const redoStackRef = React.useRef<Array<TAction>>([])
  const isApplyingRef = React.useRef(false)

  React.useEffect(() => {
    undoStackRef.current = undoStack
  }, [undoStack])

  React.useEffect(() => {
    redoStackRef.current = redoStack
  }, [redoStack])

  React.useEffect(() => {
    isApplyingRef.current = isApplying
  }, [isApplying])

  const push = React.useCallback(
    (action: TAction) => {
      if (isApplyingRef.current) {
        return
      }

      setUndoStack((prev) => {
        const next = [...prev, action]
        if (next.length <= limit) {
          return next
        }

        return next.slice(next.length - limit)
      })
      setRedoStack([])
    },
    [limit],
  )

  const undo = React.useCallback(
    async (applyInverse: (action: TAction) => Promise<void>) => {
      if (isApplyingRef.current) {
        return false
      }

      const action = undoStackRef.current.at(-1)
      if (!action) {
        return false
      }

      setIsApplying(true)
      try {
        await applyInverse(action)

        setUndoStack((prev) => prev.slice(0, -1))
        setRedoStack((prev) => [...prev, action])
        return true
      } catch {
        return false
      } finally {
        setIsApplying(false)
      }
    },
    [],
  )

  const redo = React.useCallback(
    async (applyForward: (action: TAction) => Promise<void>) => {
      if (isApplyingRef.current) {
        return false
      }

      const action = redoStackRef.current.at(-1)
      if (!action) {
        return false
      }

      setIsApplying(true)
      try {
        await applyForward(action)

        setRedoStack((prev) => prev.slice(0, -1))
        setUndoStack((prev) => [...prev, action])
        return true
      } catch {
        return false
      } finally {
        setIsApplying(false)
      }
    },
    [],
  )

  const clear = React.useCallback(() => {
    if (isApplyingRef.current) {
      return
    }

    setUndoStack([])
    setRedoStack([])
  }, [])

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    isApplying,
    undoStackSize: undoStack.length,
    redoStackSize: redoStack.length,
    undoActions: undoStack,
    redoActions: redoStack,
    push,
    undo,
    redo,
    clear,
  }
}

export { useActionHistory }
