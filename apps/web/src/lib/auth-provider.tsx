/**
 * Zustand-based AuthProvider
 * 
 * Drop-in replacement for the existing auth-provider.tsx
 * Provides initialization and cleanup logic for the authentication store
 */

'use client';

import React, { ReactNode, useEffect } from 'react';
import { useAuthStore } from './auth-store';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // Initialize the auth store on mount
    initialize();
  }, [initialize]);

  return <>{children}</>;
}

// Re-export everything from auth-store for backwards compatibility
export { 
  useAuth,
  useAuthState,
  useAuthActions,
  useAuthStatus,
  useAuthLoading,
  useAuthUser,
  useAuthBusinessId,
  useAuthError,
  useIsAuthenticated,
  useIsInitialized,
  useRequireAuth,
  useRequireBusinessContext,
  useBusinessContext
} from './auth-store';