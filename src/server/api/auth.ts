/**
 * Auth Server Functions
 *
 * Server-side functions for registration, login, logout,
 * and fetching the current authenticated user.
 *
 * Usage:
 *   import { loginFn, registerFn, logoutFn, getCurrentUserFn } from '@server/api/auth'
 */
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@server/db/connection';
import { users } from '@server/db/schema';
import {
  ConflictError,
  handleServerError,
  UnauthorizedError,
  ValidationError,
} from '@server/api/utils';
import { hashPassword, sanitizeUser, verifyPassword } from '@server/services/auth';
import { useAppSession } from '@server/services/session';
import { loginSchema, registerSchema } from '@shared/schemas';
import type { SafeUser } from '@server/services/auth';
import type { ApiResponse } from '@shared/types';

// ─── Auth Middleware ──────────────────────────────

/**
 * Middleware that enforces authentication.
 * Attaches the authenticated user to the server function context.
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await useAppSession();
    const userId = session.data.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      // Session references a deleted or deactivated user — clear it
      await session.clear();
      throw new UnauthorizedError('Session expired');
    }

    return next({ context: { user } });
  },
);

// ─── Protected Server Function Factory ──────────

/**
 * Base server function that requires authentication.
 * The handler receives `context.user` with the full user record.
 */
export const protectedGetFn = createServerFn({ method: 'GET' }).middleware([
  authMiddleware,
]);

export const protectedPostFn = createServerFn({ method: 'POST' }).middleware([
  authMiddleware,
]);

// ─── Registration ───────────────────────────────

/**
 * Register a new user account.
 *
 * Flow: validate → check uniqueness → hash password → insert → create session → return user
 */
export const registerFn = createServerFn({ method: 'POST' })
  .inputValidator(registerSchema)
  .handler(async ({ data }): Promise<ApiResponse<SafeUser>> => {
    try {
      // Check for existing user
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, data.email.toLowerCase()))
        .limit(1);

      if (existing) {
        throw new ConflictError('An account with this email already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Insert user
      const [newUser] = await db
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          passwordHash,
          displayName: data.displayName,
        })
        .returning();

      if (!newUser) {
        throw new Error('Failed to create user');
      }

      // Create session
      const session = await useAppSession();
      await session.update({
        userId: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
      });

      return { success: true, data: sanitizeUser(newUser) };
    } catch (error) {
      return handleServerError(error);
    }
  });

// ─── Login ──────────────────────────────────────

/**
 * Authenticate with email and password.
 *
 * Flow: validate → find user → verify password → create session
 */
export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator(loginSchema)
  .handler(async ({ data }): Promise<ApiResponse<SafeUser>> => {
    try {
      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, data.email.toLowerCase()))
        .limit(1);

      if (!user) {
        // Use generic message to prevent email enumeration
        throw new UnauthorizedError('Invalid email or password');
      }

      if (!user.isActive) {
        throw new UnauthorizedError('Account has been deactivated');
      }

      // Verify password
      const isValid = await verifyPassword(data.password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Create session
      const session = await useAppSession();
      await session.update({
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      });

      return { success: true, data: sanitizeUser(user) };
    } catch (error) {
      return handleServerError(error);
    }
  });

// ─── Logout ─────────────────────────────────────

/**
 * Destroy the current session and redirect to login.
 */
export const logoutFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const session = await useAppSession();
    await session.clear();
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: '/auth/login' as string });
  },
);

// ─── Get Current User ───────────────────────────

/**
 * Fetch the currently authenticated user from the session.
 * Returns null if not authenticated (safe to call from any page).
 */
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SafeUser | null> => {
    try {
      const session = await useAppSession();
      const userId = session.data.userId;

      if (!userId) {
        return null;
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || !user.isActive) {
        await session.clear();
        return null;
      }

      return sanitizeUser(user);
    } catch {
      return null;
    }
  },
);

// ─── Update Account Schema ──────────────────────

const updateAccountSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and a digit',
    )
    .optional(),
});

// ─── Update Account ─────────────────────────────

/**
 * Update the current user's profile (display name, email, password).
 */
export const updateAccountFn = protectedPostFn
  .inputValidator(updateAccountSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<SafeUser>> => {
    try {
      const userId = context.user.id;

      const updateValues: Record<string, unknown> = {};

      // Update display name
      if (data.displayName !== undefined) {
        updateValues.displayName = data.displayName;
      }

      // Update email
      if (data.email !== undefined) {
        const normalizedEmail = data.email.toLowerCase();

        // Check for existing user with this email
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (existing && existing.id !== userId) {
          throw new ConflictError('An account with this email already exists');
        }

        updateValues.email = normalizedEmail;
      }

      // Change password
      if (data.newPassword) {
        if (!data.currentPassword) {
          throw new ValidationError('Current password is required');
        }

        const [currentUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!currentUser) {
          throw new UnauthorizedError('User not found');
        }

        const isCurrentValid = await verifyPassword(
          data.currentPassword,
          currentUser.passwordHash,
        );

        if (!isCurrentValid) {
          throw new ValidationError('Current password is incorrect');
        }

        updateValues.passwordHash = await hashPassword(data.newPassword);
      }

      // Nothing to update
      if (Object.keys(updateValues).length === 0) {
        throw new ValidationError('No changes provided');
      }

      // Apply update
      const [updatedUser] = await db
        .update(users)
        .set(updateValues)
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        throw new Error('Failed to update user');
      }

      // Update session with new values
      const session = await useAppSession();
      await session.update({
        userId: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
      });

      return { success: true, data: sanitizeUser(updatedUser) };
    } catch (error) {
      return handleServerError(error);
    }
  });
