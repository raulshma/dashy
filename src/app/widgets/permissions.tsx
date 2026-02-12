/**
 * Widget Permissions — Permission management for widget capabilities.
 *
 * Provides permission checking and requesting for widget capabilities.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type {
  PermissionChecker,
  PermissionRequester,
  PermissionStatus,
  WidgetCapability,
  WidgetPermissionRequest,
  WidgetPermissions,
} from '@shared/contracts'

interface WidgetPermissionsContextValue {
  permissions: WidgetPermissions
  checkPermission: PermissionChecker
  requestPermission: PermissionRequester
  grantPermission: (capability: WidgetCapability) => void
  denyPermission: (capability: WidgetCapability) => void
  resetPermissions: () => void
}

const WidgetPermissionsContext =
  createContext<WidgetPermissionsContextValue | null>(null)

const DEFAULT_PERMISSIONS: WidgetPermissions = {
  network: 'prompt',
  storage: 'prompt',
  notifications: 'denied',
  clipboard: 'prompt',
}

interface WidgetPermissionsProviderProps {
  children: React.ReactNode
  initialPermissions?: WidgetPermissions
  onPermissionChange?: (
    capability: WidgetCapability,
    status: PermissionStatus,
  ) => void
}

export function WidgetPermissionsProvider({
  children,
  initialPermissions,
  onPermissionChange,
}: WidgetPermissionsProviderProps): React.ReactElement {
  const [permissions, setPermissions] = useState<WidgetPermissions>(
    () =>
      ({
        ...DEFAULT_PERMISSIONS,
        ...initialPermissions,
      }) as WidgetPermissions,
  )

  const checkPermission = useCallback<PermissionChecker>(
    (capability) => {
      return permissions[capability] ?? 'denied'
    },
    [permissions],
  )

  const requestPermission = useCallback<PermissionRequester>(
    async (request: WidgetPermissionRequest) => {
      const currentStatus = permissions[request.capability] ?? 'denied'

      if (currentStatus === 'granted') {
        return 'granted'
      }

      if (currentStatus === 'denied') {
        return 'denied'
      }

      const shouldGrant = await new Promise<boolean>((resolve) => {
        const result = window.confirm(
          `This widget requests access to: ${request.capability}\n\nReason: ${request.reason}\n\nAllow access?`,
        )
        resolve(result)
      })

      const newStatus: PermissionStatus = shouldGrant ? 'granted' : 'denied'
      setPermissions((prev) => ({
        ...prev,
        [request.capability]: newStatus,
      }))
      onPermissionChange?.(request.capability, newStatus)

      return newStatus
    },
    [permissions, onPermissionChange],
  )

  const grantPermission = useCallback(
    (capability: WidgetCapability) => {
      setPermissions((prev) => ({
        ...prev,
        [capability]: 'granted',
      }))
      onPermissionChange?.(capability, 'granted')
    },
    [onPermissionChange],
  )

  const denyPermission = useCallback(
    (capability: WidgetCapability) => {
      setPermissions((prev) => ({
        ...prev,
        [capability]: 'denied',
      }))
      onPermissionChange?.(capability, 'denied')
    },
    [onPermissionChange],
  )

  const resetPermissions = useCallback(() => {
    setPermissions(DEFAULT_PERMISSIONS)
  }, [])

  const value = useMemo(
    () => ({
      permissions,
      checkPermission,
      requestPermission,
      grantPermission,
      denyPermission,
      resetPermissions,
    }),
    [
      permissions,
      checkPermission,
      requestPermission,
      grantPermission,
      denyPermission,
      resetPermissions,
    ],
  )

  return (
    <WidgetPermissionsContext.Provider value={value}>
      {children}
    </WidgetPermissionsContext.Provider>
  )
}

export function useWidgetPermissions(): WidgetPermissionsContextValue {
  const context = useContext(WidgetPermissionsContext)
  if (!context) {
    throw new Error(
      'useWidgetPermissions must be used within a WidgetPermissionsProvider',
    )
  }
  return context
}

export function useCapability(capability: WidgetCapability): PermissionStatus {
  const { checkPermission } = useWidgetPermissions()
  return checkPermission(capability)
}

export function useHasCapability(capability: WidgetCapability): boolean {
  const status = useCapability(capability)
  return status === 'granted'
}

export async function requestNetworkAccess(reason: string): Promise<boolean> {
  const { requestPermission } = useWidgetPermissions()
  const result = await requestPermission({ capability: 'network', reason })
  return result === 'granted'
}

export type {
  WidgetCapability,
  WidgetPermissionRequest,
  WidgetPermissions,
  PermissionStatus,
}
