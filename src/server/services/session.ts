/**
 * Session Management
 *
 * Secure HTTP-only cookie-based sessions using TanStack Start's `useSession`.
 * Sessions are encrypted with the SESSION_SECRET from environment config.
 *
 * Usage:
 *   import { useAppSession, getSessionUser } from '@server/services/session'
 *
 *   const session = await useAppSession()
 *   await session.update({ userId: 'abc', email: 'user@example.com' })
 */
import { useSession } from '@tanstack/react-start/server';

// ─── Session Types ────────────────────────────────

/**
 * Data stored in the encrypted session cookie.
 */
export interface SessionData {
  /** Authenticated user ID */
  userId?: string;
  /** User email (cached for quick access) */
  email?: string;
  /** User display name (cached for UI) */
  displayName?: string;
}

// ─── Session Utilities ──────────────────────────

/**
 * Get the current session.
 *
 * TanStack Start's `useSession` encrypts all session data into
 * a single HTTP-only, secure cookie — no server-side storage needed.
 */
export function useAppSession() {
  return useSession<SessionData>({
    password:
      process.env.SESSION_SECRET ??
      'change-me-to-a-random-secret-at-least-32-chars!!',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  });
}

/**
 * Convenience: extract the userId from the current session.
 * Returns null if no active session.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await useAppSession();
  return session.data.userId ?? null;
}
