/**
 * Shared type definitions — barrel export.
 *
 * Import types via: `import { type User, type ApiResponse } from '@shared/types'`
 */
export type {
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,
  SortDirection,
  SortParams,
  ErrorCode,
} from './api'

export {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  ErrorCodes,
} from './api'

export type {
  BaseEntity,
  User,
  Dashboard,
  Page,
  Widget,
  WidgetConfig,
  Template,
  ShareLink,
  ShareLinkMode,
  DashboardVersion,
} from './common'
