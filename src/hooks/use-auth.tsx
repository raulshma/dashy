/**
 * Auth Hook
 *
 * React hook for accessing the current user state and auth actions.
 *
 * Usage:
 *   import { useAuth } from '@/hooks/use-auth'
 *
 *   function MyComponent() {
 *     const { user, isAuthenticated, isLoading, logout } = useAuth()
 *   }
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { SafeUser } from '@server/services/auth';
import { getCurrentUserFn, logoutFn } from '@server/api/auth';

// ─── Auth Context ──────────────────────────────

interface AuthContextValue {
  /** The currently authenticated user, or null */
  user: SafeUser | null;
  /** Whether auth state is still being loaded */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Log the user out and redirect to login */
  logout: () => Promise<void>;
  /** Refresh the user state from the server */
  refresh: () => Promise<void>;
  /** Optimistically set/update the local user object */
  setUser: (user: SafeUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await getCurrentUserFn();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutFn();
    } catch {
      // logoutFn throws redirect — that's expected
    } finally {
      setUser(null);
    }
  }, []);

  // Fetch user on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
        refresh,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────

/**
 * Access the auth state from any component inside `<AuthProvider>`.
 *
 * @throws If used outside of `<AuthProvider>`
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
