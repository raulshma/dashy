/**
 * Optimistic Mutations Hook
 *
 * Provides optimistic update tracking with rollback support for widget mutations.
 * Integrates with React 19's useOptimistic for concurrent rendering.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react'

export type MutationStatus = 'pending' | 'confirmed' | 'failed'

export interface PendingMutation<TSnapshot = unknown> {
  id: string
  type: 'widget-config' | 'widget-layout' | 'widget-create' | 'widget-delete'
  timestamp: number
  snapshot: TSnapshot
  status: MutationStatus
  error?: string
}

interface MutationStore<TSnapshot = unknown> {
  pending: Map<string, PendingMutation<TSnapshot>>
  listeners: Set<() => void>
}

function createMutationStore<TSnapshot = unknown>(): MutationStore<TSnapshot> {
  return {
    pending: new Map(),
    listeners: new Set(),
  }
}

function subscribeStore<TSnapshot>(
  store: MutationStore<TSnapshot>,
): (onStoreChange: () => void) => () => void {
  return (onStoreChange: () => void) => {
    store.listeners.add(onStoreChange)
    return () => {
      store.listeners.delete(onStoreChange)
    }
  }
}

function getStoreSnapshot<TSnapshot>(
  store: MutationStore<TSnapshot>,
): ReadonlyMap<string, PendingMutation<TSnapshot>> {
  return store.pending
}

function notifyListeners<TSnapshot>(store: MutationStore<TSnapshot>): void {
  for (const listener of store.listeners) {
    listener()
  }
}

export interface OptimisticMutationOptions<TSnapshot> {
  onRollback?: (snapshot: TSnapshot) => void | Promise<void>
  onConfirm?: (mutationId: string, serverData: unknown) => void
  onError?: (mutationId: string, error: Error) => void
}

export interface UseOptimisticMutationsReturn<TSnapshot> {
  pendingMutations: ReadonlyMap<string, PendingMutation<TSnapshot>>
  hasPendingMutations: boolean
  startMutation: (
    type: PendingMutation<TSnapshot>['type'],
    snapshot: TSnapshot,
  ) => string
  confirmMutation: (mutationId: string, serverData?: unknown) => void
  failMutation: (mutationId: string, error?: string) => void
  clearMutation: (mutationId: string) => void
  getMutation: (mutationId: string) => PendingMutation<TSnapshot> | undefined
  rollbackMutation: (mutationId: string) => Promise<boolean>
  rollbackAllPending: () => Promise<void>
}

function createMutationId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function useOptimisticMutations<TSnapshot = unknown>(
  options: OptimisticMutationOptions<TSnapshot> = {},
): UseOptimisticMutationsReturn<TSnapshot> {
  const storeRef = useRef<MutationStore<TSnapshot> | null>(null)

  if (storeRef.current === null) {
    storeRef.current = createMutationStore<TSnapshot>()
  }

  const store = storeRef.current
  const optionsRef = useRef(options)
  optionsRef.current = options

  const pendingMutations = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => subscribeStore(store)(onStoreChange),
      [store],
    ),
    useCallback(() => getStoreSnapshot(store), [store]),
    useCallback(() => getStoreSnapshot(store), [store]),
  )

  const hasPendingMutations = pendingMutations.size > 0

  const startMutation = useCallback(
    (type: PendingMutation<TSnapshot>['type'], snapshot: TSnapshot): string => {
      const id = createMutationId()
      const mutation: PendingMutation<TSnapshot> = {
        id,
        type,
        timestamp: Date.now(),
        snapshot,
        status: 'pending',
      }

      store.pending.set(id, mutation)
      notifyListeners(store)

      return id
    },
    [store],
  )

  const confirmMutation = useCallback(
    (mutationId: string, serverData?: unknown): void => {
      const mutation = store.pending.get(mutationId)
      if (!mutation) {
        return
      }

      mutation.status = 'confirmed'
      notifyListeners(store)

      optionsRef.current.onConfirm?.(mutationId, serverData)

      setTimeout(() => {
        store.pending.delete(mutationId)
        notifyListeners(store)
      }, 100)
    },
    [store],
  )

  const failMutation = useCallback(
    (mutationId: string, error?: string): void => {
      const mutation = store.pending.get(mutationId)
      if (!mutation) {
        return
      }

      mutation.status = 'failed'
      mutation.error = error
      notifyListeners(store)

      const err = new Error(error ?? 'Mutation failed')
      optionsRef.current.onError?.(mutationId, err)
    },
    [store],
  )

  const clearMutation = useCallback(
    (mutationId: string): void => {
      if (store.pending.has(mutationId)) {
        store.pending.delete(mutationId)
        notifyListeners(store)
      }
    },
    [store],
  )

  const getMutation = useCallback(
    (mutationId: string): PendingMutation<TSnapshot> | undefined => {
      return store.pending.get(mutationId)
    },
    [store],
  )

  const rollbackMutation = useCallback(
    async (mutationId: string): Promise<boolean> => {
      const mutation = store.pending.get(mutationId)
      if (!mutation || mutation.status !== 'failed') {
        return false
      }

      try {
        await optionsRef.current.onRollback?.(mutation.snapshot)

        store.pending.delete(mutationId)
        notifyListeners(store)

        return true
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError)
        return false
      }
    },
    [store],
  )

  const rollbackAllPending = useCallback(async (): Promise<void> => {
    const failedMutations = Array.from(store.pending.values()).filter(
      (mutation) => mutation.status === 'failed',
    )

    for (const mutation of failedMutations) {
      await rollbackMutation(mutation.id)
    }
  }, [store, rollbackMutation])

  return {
    pendingMutations,
    hasPendingMutations,
    startMutation,
    confirmMutation,
    failMutation,
    clearMutation,
    getMutation,
    rollbackMutation,
    rollbackAllPending,
  }
}

export function useIsWidgetPending(
  pendingMutations: ReadonlyMap<string, PendingMutation>,
  widgetId: string,
): boolean {
  for (const mutation of pendingMutations.values()) {
    if (mutation.status === 'pending') {
      const snapshot = mutation.snapshot as Record<string, unknown>
      if ('widgetId' in snapshot && snapshot.widgetId === widgetId) {
        return true
      }
      if ('positions' in snapshot && Array.isArray(snapshot.positions)) {
        const positions = snapshot.positions as Array<{ id: string }>
        if (positions.some((p) => p.id === widgetId)) {
          return true
        }
      }
    }
  }
  return false
}
