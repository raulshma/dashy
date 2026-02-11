/**
 * Standard API response wrapper for all server function responses.
 *
 * @template T - The type of data returned on success.
 */
export interface ApiResponse<T> {
  /** Whether the operation was successful */
  success: boolean
  /** The response data (present when success is true) */
  data?: T
  /** Error information (present when success is false) */
  error?: ApiError
}

/**
 * Structured error object returned from server functions.
 */
export interface ApiError {
  /** Machine-readable error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR') */
  code: string
  /** Human-readable error message */
  message: string
  /** Optional field-level validation errors */
  fieldErrors?: Record<string, Array<string>>
}

/**
 * Pagination parameters for list queries.
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number
  /** Number of items per page */
  limit: number
}

/**
 * Paginated response metadata.
 *
 * @template T - The type of items in the list.
 */
export interface PaginatedResponse<T> {
  /** The items on the current page */
  items: Array<T>
  /** Total number of items across all pages */
  total: number
  /** Current page number (1-indexed) */
  page: number
  /** Number of items per page */
  limit: number
  /** Total number of pages */
  totalPages: number
  /** Whether there is a next page */
  hasNextPage: boolean
  /** Whether there is a previous page */
  hasPreviousPage: boolean
}

/**
 * Sort direction for list queries.
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Sort parameters for list queries.
 */
export interface SortParams {
  /** Field name to sort by */
  field: string
  /** Sort direction */
  direction: SortDirection
}

/**
 * Helper to create a successful API response.
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

/**
 * Helper to create an error API response.
 */
export function createErrorResponse(
  code: string,
  message: string,
  fieldErrors?: Record<string, Array<string>>,
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, fieldErrors },
  }
}

/**
 * Helper to create a paginated response.
 */
export function createPaginatedResponse<T>(
  items: Array<T>,
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit)
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  }
}

/**
 * Common error codes used across the application.
 */
export const ErrorCodes = {
  // Client errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
