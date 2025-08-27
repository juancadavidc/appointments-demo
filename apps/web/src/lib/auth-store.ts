/**
 * Zustand-based Authentication Store
 * 
 * Replaces the complex auth-provider.tsx with a simple, predictable state machine.
 * Eliminates useEffect chains and provides single source of truth for authentication.
 */

import * as React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { auth, type AuthUser, type AuthError } from './auth';
import { businessContext } from './business-context';
import type { SessionTimeoutConfig } from './logout-session-management';

// State Machine Definition
type AuthState = 
  | { 
      status: 'initializing';
      user: null;
      businessId: null;
      error: null;
      isLoading: true;
    }
  | { 
      status: 'unauthenticated';
      user: null;
      businessId: null;
      error: AuthError | null;
      isLoading: false;
    }
  | { 
      status: 'authenticated';
      user: AuthUser;
      businessId: string | null;
      error: null;
      isLoading: false;
    }
  | { 
      status: 'authenticating';
      user: null;
      businessId: null;
      error: null;
      isLoading: true;
    }
  | { 
      status: 'signing-out';
      user: AuthUser;
      businessId: string | null;
      error: null;
      isLoading: true;
    };

// Store Actions Interface
interface AuthActions {
  // Core authentication actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  enhancedSignOut: (config?: {
    clearBusinessContext?: boolean;
    clearLocalStorage?: boolean;
    redirectToLogin?: boolean;
    redirectUrl?: string;
  }) => Promise<{ error: AuthError | null; cleanupResults?: Record<string, boolean> }>;
  
  // Business context actions  
  setBusinessContext: (businessId: string) => Promise<{ error: AuthError | null }>;
  getCurrentBusinessId: () => string | null;
  getCurrentBusinessIdAsync: (options?: { autoSelect?: boolean; skipCache?: boolean }) => Promise<string | null>;
  
  // Session management
  refreshSession: () => Promise<void>;
  initializeSessionTimeout: (config?: Partial<SessionTimeoutConfig>) => void;
  resetSessionTimeout: () => void;
  stopSessionTimeout: () => void;

  // Internal state transitions (not exposed publicly)
  _setUnauthenticated: (error?: AuthError) => void;
  _setAuthenticated: (user: AuthUser, businessId?: string) => void;
}

// Complete Store Type
type AuthStore = AuthState & AuthActions;

// Zustand Store Implementation
export const useAuthStore = create<AuthStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      status: 'initializing',
      user: null,
      businessId: null,
      error: null,
      isLoading: true,

      // Initialize authentication state
      initialize: async () => {
        try {
          console.log('🔐 AuthStore: Initializing...');
          
          // Fast synchronous check first
          const likelyAuthenticated = auth.isLikelyAuthenticated();
          if (!likelyAuthenticated) {
            console.log('🔐 AuthStore: No auth cookies found');
            set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
            return;
          }

          console.log('🔐 AuthStore: Auth cookies found, verifying session...');
          
          // Check session
          const { data: sessionData, error } = await auth.getSession();
          
          if (error) {
            console.warn('🔐 AuthStore: Session check failed:', error.message);
            set({ status: 'unauthenticated', user: null, businessId: null, error, isLoading: false });
            return;
          }

          if (sessionData.session?.user) {
            console.log('🔐 AuthStore: Session found, setting up user...');
            
            // Get business context
            let validatedBusinessId: string | null = null;
            try {
              validatedBusinessId = businessContext.getCurrentBusinessId();
              if (validatedBusinessId) {
                console.log('🔐 AuthStore: Business context available:', validatedBusinessId);
              }
            } catch (businessError) {
              console.warn('🔐 AuthStore: Business context error:', businessError);
            }

            const user: AuthUser = {
              id: sessionData.session.user.id,
              email: sessionData.session.user.email || '',
              name: sessionData.session.user.user_metadata?.name,
              businessId: validatedBusinessId || undefined,
            };

            set({ 
              status: 'authenticated',
              user,
              businessId: validatedBusinessId,
              error: null,
              isLoading: false
            });

            // Set up auth state listener
            auth.onAuthStateChange(async (authUser: AuthUser | null) => {
              if (authUser) {
                // User logged in
                const currentBusinessId = businessContext.getCurrentBusinessId();
                if (currentBusinessId) {
                  authUser.businessId = currentBusinessId;
                }
                
                set({
                  status: 'authenticated',
                  user: authUser,
                  businessId: currentBusinessId,
                  error: null,
                  isLoading: false
                });
              } else {
                // User logged out
                await businessContext.clearBusinessContext();
                set({
                  status: 'unauthenticated',
                  user: null,
                  businessId: null,
                  error: null,
                  isLoading: false
                });
              }
            });
          } else {
            console.log('🔐 AuthStore: No existing session found');
            set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
          }
        } catch (error) {
          console.error('🔐 AuthStore: Error during initialization:', error);
          set({ 
            status: 'unauthenticated',
            user: null,
            businessId: null,
            error: { message: error instanceof Error ? error.message : 'Initialization failed' },
            isLoading: false
          });
        }
      },

      // Sign in
      signIn: async (email: string, password: string) => {
        set({ status: 'authenticating', user: null, businessId: null, error: null, isLoading: true });

        try {
          const result = await auth.signIn(email, password);
          
          if (result.error) {
            set({ status: 'unauthenticated', user: null, businessId: null, error: result.error, isLoading: false });
            return { error: result.error };
          }

          // Success - auth listener will handle state update
          return { error: null };
        } catch (error) {
          const authError = { message: error instanceof Error ? error.message : 'Sign in failed' };
          set({ status: 'unauthenticated', user: null, businessId: null, error: authError, isLoading: false });
          return { error: authError };
        }
      },

      // Sign up
      signUp: async (email: string, password: string) => {
        set({ status: 'authenticating', user: null, businessId: null, error: null, isLoading: true });

        try {
          const result = await auth.signUp(email, password);
          
          if (result.error) {
            set({ status: 'unauthenticated', user: null, businessId: null, error: result.error, isLoading: false });
            return { error: result.error };
          }

          // Success - auth listener will handle state update
          return { error: null };
        } catch (error) {
          const authError = { message: error instanceof Error ? error.message : 'Sign up failed' };
          set({ status: 'unauthenticated', user: null, businessId: null, error: authError, isLoading: false });
          return { error: authError };
        }
      },

      // Sign out
      signOut: async () => {
        const currentState = get();
        if (currentState.status === 'authenticated') {
          set({ ...currentState, status: 'signing-out', isLoading: true });
        }

        try {
          console.log('🔐 AuthStore: Starting signOut process');
          
          await businessContext.clearBusinessContext();
          const result = await auth.signOut();
          
          if (result.error) {
            console.error('🔐 AuthStore: SignOut failed:', result.error);
            // Even on error, clear local state
            set({ status: 'unauthenticated', user: null, businessId: null, error: result.error, isLoading: false });
            throw new Error(result.error.message);
          }
          
          console.log('🔐 AuthStore: SignOut completed');
          set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
        } catch (error) {
          console.error('🔐 AuthStore: Sign out error:', error);
          // Emergency cleanup
          try {
            await businessContext.clearBusinessContext();
            set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
          } catch (cleanupError) {
            console.error('🔐 AuthStore: Failed cleanup after signOut error:', cleanupError);
          }
          throw error;
        }
      },

      // Enhanced sign out
      enhancedSignOut: async (config) => {
        const currentState = get();
        if (currentState.status === 'authenticated') {
          set({ ...currentState, status: 'signing-out', isLoading: true });
        }

        try {
          console.log('🔐 AuthStore: Starting enhanced signOut with config:', config);
          const result = await auth.enhancedSignOut(config);
          
          if (result.error) {
            console.error('🔐 AuthStore: Enhanced signOut failed:', result.error);
            // Emergency cleanup
            try {
              await businessContext.clearBusinessContext();
              set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
            } catch (cleanupError) {
              console.error('🔐 AuthStore: Emergency cleanup failed:', cleanupError);
            }
          } else {
            console.log('🔐 AuthStore: Enhanced signOut completed successfully');
            set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
          }
          
          return result;
        } catch (error) {
          console.error('🔐 AuthStore: Unexpected error during enhanced sign out:', error);
          
          // Emergency fallback
          try {
            await businessContext.clearBusinessContext();
            set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
          } catch (fallbackError) {
            console.error('🔐 AuthStore: Emergency fallback failed:', fallbackError);
          }
          
          return { 
            error: { 
              message: error instanceof Error ? error.message : 'Enhanced sign out failed' 
            } 
          };
        }
      },

      // Set business context
      setBusinessContext: async (businessId: string) => {
        try {
          const result = await businessContext.setBusinessContext(businessId);
          
          if (!result.success) {
            const errorMessage = result.error?.message || 'Error al establecer el contexto del negocio';
            return { error: { message: errorMessage } };
          }

          // Update state with new business context
          const currentState = get();
          if (currentState.status === 'authenticated' && currentState.user) {
            set({
              ...currentState,
              user: { ...currentState.user, businessId },
              businessId
            });
          }

          return { error: null };
        } catch (error) {
          console.error('🔐 AuthStore: Error setting business context:', error);
          return { error: { message: 'Error al establecer el contexto del negocio' } };
        }
      },

      // Get current business ID
      getCurrentBusinessId: () => {
        return businessContext.getCurrentBusinessId();
      },

      // Get current business ID async
      getCurrentBusinessIdAsync: async (options) => {
        const state = get();
        const userId = state.user?.id;
        
        return await businessContext.getCurrentBusinessIdAsync({
          ...options,
          userId
        });
      },

      // Refresh session
      refreshSession: async () => {
        try {
          const { data: sessionData } = await auth.getSession();
          
          if (sessionData.session?.user) {
            const validatedBusinessId = businessContext.getCurrentBusinessId();
            
            const authUser: AuthUser = {
              id: sessionData.session.user.id,
              email: sessionData.session.user.email || '',
              name: sessionData.session.user.user_metadata?.name,
              businessId: validatedBusinessId || undefined,
            };

            set({
              status: 'authenticated',
              user: authUser,
              businessId: validatedBusinessId,
              error: null,
              isLoading: false
            });
          } else {
            set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
            await businessContext.clearBusinessContext();
          }
        } catch (error) {
          console.error('🔐 AuthStore: Error refreshing session:', error);
          set({ status: 'unauthenticated', user: null, businessId: null, error: null, isLoading: false });
          await businessContext.clearBusinessContext();
        }
      },

      // Session timeout management
      initializeSessionTimeout: (config) => {
        try {
          import('./logout-session-management').then(({ initializeSessionTimeout, setupActivityTracking }) => {
            initializeSessionTimeout(config, {
              onWarning: () => {
                console.warn('🔐 AuthStore: Session timeout warning');
              },
              onTimeout: () => {
                console.warn('🔐 AuthStore: Session timeout - automatic logout');
              },
            });
            setupActivityTracking();
          });
        } catch (error) {
          console.error('🔐 AuthStore: Failed to initialize session timeout:', error);
        }
      },

      resetSessionTimeout: () => {
        try {
          import('./logout-session-management').then(({ resetSessionTimeout }) => {
            resetSessionTimeout();
          });
        } catch (error) {
          console.error('🔐 AuthStore: Failed to reset session timeout:', error);
        }
      },

      stopSessionTimeout: () => {
        try {
          import('./logout-session-management').then(({ stopSessionTimeout }) => {
            stopSessionTimeout();
          });
        } catch (error) {
          console.error('🔐 AuthStore: Failed to stop session timeout:', error);
        }
      },

      // Internal state transitions
      _setUnauthenticated: (error) => {
        set({ status: 'unauthenticated', user: null, businessId: null, error: error || null, isLoading: false });
      },

      _setAuthenticated: (user, businessId) => {
        set({ status: 'authenticated', user, businessId: businessId || null, error: null, isLoading: false });
      },
    }),
    {
      name: 'auth-store', // For Redux DevTools
    }
  )
);

// Individual selectors to prevent object recreation and infinite re-renders
export const useAuthStatus = () => useAuthStore((state) => state.status);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthBusinessId = () => useAuthStore((state) => state.businessId);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useIsAuthenticated = () => useAuthStore((state) => state.status === 'authenticated');
export const useIsInitialized = () => useAuthStore((state) => state.status !== 'initializing');

// Optimized state selector using shallow comparison
export const useAuthState = () => {
  const status = useAuthStatus();
  const isLoading = useAuthLoading();
  const user = useAuthUser();
  const businessId = useAuthBusinessId();
  const error = useAuthError();
  
  return React.useMemo(() => ({
    status,
    isLoading,
    isAuthenticated: status === 'authenticated',
    isInitialized: status !== 'initializing',
    user,
    businessId,
    error,
  }), [status, isLoading, user, businessId, error]);
};

export const useAuthActions = () => React.useMemo(() => {
  const store = useAuthStore.getState();
  return {
    initialize: store.initialize,
    signIn: store.signIn,
    signUp: store.signUp,
    signOut: store.signOut,
    enhancedSignOut: store.enhancedSignOut,
    setBusinessContext: store.setBusinessContext,
    getCurrentBusinessId: store.getCurrentBusinessId,
    getCurrentBusinessIdAsync: store.getCurrentBusinessIdAsync,
    refreshSession: store.refreshSession,
    initializeSessionTimeout: store.initializeSessionTimeout,
    resetSessionTimeout: store.resetSessionTimeout,
    stopSessionTimeout: store.stopSessionTimeout,
  };
}, []); // Empty dependency array since these methods don't change

// Compatibility hooks for migration period
export const useAuth = () => {
  const user = useAuthUser();
  const isLoading = useAuthLoading();
  const isInitialized = useIsInitialized();
  const actions = useAuthActions();
  
  return React.useMemo(() => ({
    user,
    isLoading,
    isInitialized,
    signIn: actions.signIn,
    signUp: actions.signUp,
    signOut: actions.signOut,
    enhancedSignOut: actions.enhancedSignOut,
    refreshSession: actions.refreshSession,
    setBusinessContext: actions.setBusinessContext,
    getCurrentBusinessId: actions.getCurrentBusinessId,
    getCurrentBusinessIdAsync: actions.getCurrentBusinessIdAsync,
    initializeSessionTimeout: actions.initializeSessionTimeout,
    resetSessionTimeout: actions.resetSessionTimeout,
    stopSessionTimeout: actions.stopSessionTimeout,
  }), [user, isLoading, isInitialized, actions]);
};

// Hook for protecting routes
export const useRequireAuth = () => {
  const isAuthenticated = useIsAuthenticated();
  const isInitialized = useIsInitialized();
  const user = useAuthUser();
  
  React.useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated, isInitialized]);

  return { user, isInitialized, isAuthenticated };
};

// Hook for business context requirement
export const useRequireBusinessContext = () => {
  const isAuthenticated = useIsAuthenticated();
  const isInitialized = useIsInitialized();
  const user = useAuthUser();
  const businessId = useAuthBusinessId();
  
  React.useEffect(() => {
    if (isInitialized && isAuthenticated && !businessId) {
      window.location.href = '/register/business';
    }
  }, [isAuthenticated, isInitialized, businessId]);

  return { user, isInitialized, businessId, hasBusinessContext: !!businessId };
};

// Hook for async business context with auto-selection
export const useBusinessContext = (options?: { autoSelect?: boolean; skipCache?: boolean }) => {
  const user = useAuthUser();
  const isInitialized = useIsInitialized();
  const { getCurrentBusinessIdAsync } = useAuthActions();
  const [businessId, setBusinessId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Stabilize options to prevent infinite re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOptions = React.useMemo(() => options, [options?.autoSelect, options?.skipCache]);

  React.useEffect(() => {
    let mounted = true;

    async function loadBusinessContext() {
      if (!isInitialized || !user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const result = await getCurrentBusinessIdAsync(stableOptions);
        
        if (mounted) {
          setBusinessId(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof Error && err.message === 'TIMEOUT') {
            console.warn('🔄 Business context loading timed out');
            setError('TIMEOUT');
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load business context');
          }
          setIsLoading(false);
        }
      }
    }

    loadBusinessContext();

    return () => {
      mounted = false;
    };
  }, [user, isInitialized, getCurrentBusinessIdAsync, stableOptions]);

  return {
    user,
    businessId,
    isLoading,
    error,
    hasBusinessContext: !!businessId,
    isInitialized: isInitialized && !isLoading
  };
};

