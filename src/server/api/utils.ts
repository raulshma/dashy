/**
 * Server API Utilities
 *
 * Common patterns, middleware, and error handling for TanStack Start server functions.
 *
 * Usage:
 *   import { protectedFn, publicFn, AppError } from '@server/api/utils'
 *
 *   export const getItems = publicFn
 *     .handler(async () => { ... })
 *
 *   export const createItem = protectedFn
 *     .validator(createItemSchema)
 *     .handler(async ({ data, context }) => { ... })
 */
import { createServerFn } from '@tanstack/react-start'
import {
  createErrorResponse,
  type ApiResponse,
  type ErrorCode,
} from '@shared/types'

// ─── Custom Error Classes ──────────────────────────

/**
 * Base application error with structured error code.
 * Throw this from server functions for consistent error handling.
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly fieldErrors?: Record<string, string[]>

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      statusCode?: number
      fieldErrors?: Record<string, string[]>
      cause?: unknown
    },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'AppError'
    this.code = code
    this.statusCode = options?.statusCode ?? 500
    this.fieldErrors = options?.fieldErrors
  }
}

/** Not Found error (404) */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} with ID '${id}' not found` : `${resource} not found`,
      { statusCode: 404 },
    )
    this.name = 'NotFoundError'
  }
}

/** Validation error (400) */
export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super('VALIDATION_ERROR', message, {
      statusCode: 400,
      fieldErrors,
    })
    this.name = 'ValidationError'
  }
}

/** Unauthorized error (401) */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, { statusCode: 401 })
    this.name = 'UnauthorizedError'
  }
}

/** Forbidden error (403) */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, { statusCode: 403 })
    this.name = 'ForbiddenError'
  }
}

/** Conflict error (409) — e.g., duplicate slug */
export class ConflictError extends AppError {
  constructor(message: string) {
    super('ALREADY_EXISTS', message, { statusCode: 409 })
    this.name = 'ConflictError'
  }
}

// ─── Error Handling ────────────────────────────────

/**
 * Wraps a handler function with standardized error handling.
 * Converts AppErrors and Zod errors into structured ApiResponse format.
 */
export function handleServerError(error: unknown): ApiResponse<never> {
  // Rate limit errors
  if (
    error instanceof Error &&
    error.name === 'RateLimitError' &&
    'retryAfter' in error
  ) {
    const rateError = error as Error & { retryAfter: number }
    return createErrorResponse('RATE_LIMITED', rateError.message)
  }

  // Known application errors
  if (error instanceof AppError) {
    return createErrorResponse(error.code, error.message, error.fieldErrors)
  }

  // Zod validation errors
  if (
    error instanceof Error &&
    error.name === 'ZodError' &&
    'issues' in error
  ) {
    const zodError = error as Error & {
      issues: Array<{ path: (string | number)[]; message: string }>
    }
    const fieldErrors: Record<string, string[]> = {}

    for (const issue of zodError.issues) {
      const field = issue.path.join('.')
      if (!fieldErrors[field]) fieldErrors[field] = []
      fieldErrors[field].push(issue.message)
    }

    return createErrorResponse(
      'VALIDATION_ERROR',
      'Validation failed',
      fieldErrors,
    )
  }

  // Unknown errors — log and return generic message
  // eslint-disable-next-line no-console
  console.error('[API Error]', error)

  return createErrorResponse(
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'development'
      ? error instanceof Error
        ? error.message
        : 'Unknown error'
      : 'An unexpected error occurred',
  )
}

// ─── Server Function Factories ─────────────────────

/**
 * Base server function for public (unauthenticated) GET endpoints.
 *
 * Usage:
 *   export const listPublicDashboards = publicGetFn
 *     .handler(async () => { ... })
 */
export const publicGetFn = createServerFn({ method: 'GET' })

/**
 * Base server function for public (unauthenticated) POST endpoints.
 */
export const publicPostFn = createServerFn({ method: 'POST' })

// ─── Slug Generation ───────────────────────────────

/**
 * Generate a URL-safe slug from a string.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
}
