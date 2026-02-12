import * as React from 'react'

interface UseEditModeOptions {
  initialMode?: boolean
  onEnterEditMode?: () => void
  onExitEditMode?: () => void
  enableEscapeToExit?: boolean
}

function useEditMode(options: UseEditModeOptions = {}) {
  const {
    initialMode = false,
    onEnterEditMode,
    onExitEditMode,
    enableEscapeToExit = true,
  } = options
  const [isEditMode, setIsEditMode] = React.useState(initialMode)
  const hasUnsavedChangesRef = React.useRef(false)

  const enterEditMode = React.useCallback(() => {
    setIsEditMode(true)
    onEnterEditMode?.()
  }, [onEnterEditMode])

  const exitEditMode = React.useCallback(() => {
    setIsEditMode(false)
    onExitEditMode?.()
  }, [onExitEditMode])

  const toggleEditMode = React.useCallback(() => {
    if (isEditMode) {
      exitEditMode()
    } else {
      enterEditMode()
    }
  }, [isEditMode, enterEditMode, exitEditMode])

  const setHasUnsavedChanges = React.useCallback((hasChanges: boolean) => {
    hasUnsavedChangesRef.current = hasChanges
  }, [])

  const confirmExit = React.useCallback((): boolean => {
    if (isEditMode && hasUnsavedChangesRef.current) {
      return window.confirm(
        'You have unsaved changes. Are you sure you want to exit edit mode?',
      )
    }
    return true
  }, [isEditMode])

  const safeExitEditMode = React.useCallback(() => {
    if (confirmExit()) {
      exitEditMode()
    }
  }, [confirmExit, exitEditMode])

  React.useEffect(() => {
    if (!enableEscapeToExit) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isEditMode) {
        safeExitEditMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableEscapeToExit, isEditMode, safeExitEditMode])

  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isEditMode && hasUnsavedChangesRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isEditMode])

  return {
    isEditMode,
    enterEditMode,
    exitEditMode: safeExitEditMode,
    toggleEditMode,
    setHasUnsavedChanges,
  }
}

export { useEditMode }
