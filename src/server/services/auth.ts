/**
 * Authentication Service
 *
 * Password hashing & verification using bcryptjs.
 * Safe user sanitization for client-side consumption.
 *
 * Usage:
 *   import { hashPassword, verifyPassword, sanitizeUser } from '@server/services/auth'
 */
import bcrypt from 'bcryptjs'
import type { SelectUser } from '@server/db/schema'

// ─── Configuration ────────────────────────────────

/**
 * Number of bcrypt salt rounds.
 * 12 is a good balance between security and performance.
 * Each increment roughly doubles the computation time.
 */
const SALT_ROUNDS = 12

// ─── Password Hashing ────────────────────────────

/**
 * Hash a plaintext password using bcrypt.
 * @param password - The plaintext password to hash
 * @returns The bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS)
  return bcrypt.hash(password, salt)
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * @param password - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns Whether the password matches the hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─── User Sanitization ──────────────────────────

/**
 * Safe user object for client-side consumption.
 * Never includes `passwordHash` or other sensitive fields.
 */
export interface SafeUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Strip sensitive fields from a user record.
 * Always use this before sending user data to the client.
 */
export function sanitizeUser(user: SelectUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
