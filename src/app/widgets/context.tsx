/**
 * Widget Context — Provides isolated state sandbox for each widget instance.
 *
 * Each widget gets its own context scope, preventing state leakage between instances.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { WidgetConfigSchema, WidgetLifecycle } from '@shared/contracts'

interface WidgetSandboxState<TConfig extends WidgetConfigSchema> {
  config: TConfig
  isLoading: boolean
  error: Error | null
  lastRefresh: Date | null
}

interface WidgetSandboxContextValue<
  TConfig extends WidgetConfigSchema,
> extends WidgetSandboxState<TConfig> {
  updateConfig: (updates: Partial<TConfig>) => void
  refresh: () => Promise<void>
  setError: (error: Error | null) => void
  setLoading: (isLoading: boolean) => void
}

const WidgetSandboxContext =
  createContext<WidgetSandboxContextValue<WidgetConfigSchema> | null>(null)

export function useWidgetSandbox<
  TConfig extends WidgetConfigSchema,
>(): WidgetSandboxContextValue<TConfig> {
  const context = useContext(WidgetSandboxContext)
  if (!context) {
    throw new Error(
      'useWidgetSandbox must be used within a WidgetSandboxProvider',
    )
  }
  return context as WidgetSandboxContextValue<TConfig>
}

interface WidgetSandboxProviderProps<TConfig extends WidgetConfigSchema> {
  children: React.ReactNode
  initialConfig: TConfig
  lifecycle?: WidgetLifecycle
  onConfigChange?: (config: TConfig) => void
}

export function WidgetSandboxProvider<TConfig extends WidgetConfigSchema>({
  children,
  initialConfig,
  lifecycle,
  onConfigChange,
}: WidgetSandboxProviderProps<TConfig>): React.ReactElement {
  const [state, setState] = useState<WidgetSandboxState<TConfig>>({
    config: initialConfig,
    isLoading: false,
    error: null,
    lastRefresh: null,
  })

  const configRef = useRef(state.config)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    lifecycle?.onMount?.()
    return () => {
      mountedRef.current = false
      lifecycle?.onUnmount?.()
    }
  }, [lifecycle])

  useEffect(() => {
    if (configRef.current !== state.config && mountedRef.current) {
      lifecycle?.onConfigChange?.(state.config, configRef.current)
      configRef.current = state.config
    }
  }, [state.config, lifecycle])

  const updateConfig = useCallback(
    (updates: Partial<TConfig>) => {
      setState((prev) => {
        const newConfig = { ...prev.config, ...updates }
        onConfigChange?.(newConfig)
        return { ...prev, config: newConfig }
      })
    },
    [onConfigChange],
  )

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      await lifecycle?.onRefresh?.()
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          lastRefresh: new Date(),
        }))
      }
    } catch (error) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }))
      }
    }
  }, [lifecycle])

  const setError = useCallback((error: Error | null) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }))
  }, [])

  const value: WidgetSandboxContextValue<TConfig> = {
    ...state,
    updateConfig: updateConfig as (
      updates: Partial<WidgetConfigSchema>,
    ) => void,
    refresh,
    setError,
    setLoading,
  }

  return (
    <WidgetSandboxContext.Provider
      value={value as WidgetSandboxContextValue<WidgetConfigSchema>}
    >
      {children}
    </WidgetSandboxContext.Provider>
  )
}

export function useWidgetConfig<TConfig extends WidgetConfigSchema>(): TConfig {
  const { config } = useWidgetSandbox<TConfig>()
  return config
}

export function useWidgetLoading(): boolean {
  const { isLoading } = useWidgetSandbox()
  return isLoading
}

export function useWidgetError(): Error | null {
  const { error } = useWidgetSandbox()
  return error
}
