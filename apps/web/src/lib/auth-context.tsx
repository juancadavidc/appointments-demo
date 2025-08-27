'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { auth, type AuthUser, type AuthError } from './auth';
import { businessContext } from './business-context';
import type { SessionTimeoutConfig } from './logout-session-management';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  enhancedSignOut: (config?: {
    clearBusinessContext?: boolean;
    clearLocalStorage?: boolean;
    redirectToLogin?: boolean;
    redirectUrl?: string;
  }) => Promise<{ error: AuthError | null; cleanupResults?: Record<string, boolean> }>;
  refreshSession: () => Promise<void>;
  setBusinessContext: (businessId: string) => Promise<{ error: AuthError | null }>;
  getCurrentBusinessId: () => string | null;
  getCurrentBusinessIdAsync: (options?: { autoSelect?: boolean; skipCache?: boolean }) => Promise<string | null>;
  initializeSessionTimeout: (config?: Partial<SessionTimeoutConfig>) => void;
  resetSessionTimeout: () => void;
  stopSessionTimeout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading = true
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize authentication state on mount with RLS context
  useEffect(() => {
    let mounted = true;
    let authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    const initializeAuth = async () => {
      try {
        console.log('🔐 AuthContext: Initializing auth state...');
        
        // Fast synchronous check first - if no auth cookies, skip slow async check
        const likelyAuthenticated = auth.isLikelyAuthenticated();
        if (!likelyAuthenticated) {
          console.log('🔐 AuthContext: No auth cookies found, user not authenticated');
          return;
        }
        
        console.log('🔐 AuthContext: Auth cookies found, verifying session...');
        
        // Check session with improved error handling
        const result = await auth.getSession();
        const { data: sessionData, error } = result;
        
        if (error) {
          console.warn('🔐 AuthContext: Session check failed:', error.message);
          // Continue with initialization even if session check fails
        }
        
        if (mounted && sessionData.session?.user) {
          console.log('🔐 AuthContext: Session found, setting up user...');
          
          // Try to get business context (synchronous call)
          let validatedBusinessId: string | null = null;
          try {
            validatedBusinessId = businessContext.getCurrentBusinessId();
            
            if (validatedBusinessId) {
              console.log('🔐 AuthContext: Business context available:', validatedBusinessId);
            } else {
              console.log('🔐 AuthContext: No business context found');
            }
          } catch (businessError) {
            console.warn('🔐 AuthContext: Business context error:', businessError);
            validatedBusinessId = null;
          }

          const authUser: AuthUser = {
            id: sessionData.session.user.id,
            email: sessionData.session.user.email || '',
            name: sessionData.session.user.user_metadata?.name,
            businessId: validatedBusinessId || undefined,
          };

          if (mounted) {
            console.log('🔐 AuthContext: Setting user state:', { 
              userId: authUser.id, 
              hasBusinessId: !!authUser.businessId 
            });
            setUser(authUser);
          }
        } else {
          console.log('🔐 AuthContext: No existing session found');
        }

        // Set up auth state change listener with automatic business context setting
        authSubscription = auth.onAuthStateChange(async (authUser: AuthUser | null) => {
          if (mounted) {
            if (authUser) {
              // User logged in - attempt to get or discover business context
              const validatedBusinessId = businessContext.getCurrentBusinessId();
              
              if (validatedBusinessId) {
                authUser.businessId = validatedBusinessId;
                console.log('🔐 AuthContext: Business context set on auth change:', validatedBusinessId);
              } else {
                console.log('🔐 AuthContext: No business context available on auth change');
              }
            } else {
              // User logged out - clear business context
              await businessContext.clearBusinessContext();
            }
            
            setUser(authUser);
          }
        });

      } catch (error) {
        console.error('🔐 AuthContext: Error initializing auth:', error);
      } finally {
        if (mounted) {
          console.log('🔐 AuthContext: Auth initialization complete');
          setIsInitialized(true);
          setIsLoading(false); // Critical: Always clear loading state
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.data?.subscription?.unsubscribe?.();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await auth.signIn(email, password);
      
      if (result.error) {
        return { error: result.error };
      }

      // After successful login, attempt to get business context
      try {
        const validatedBusinessId = businessContext.getCurrentBusinessId();
        if (validatedBusinessId) {
          console.log('🔐 AuthContext: Business context set after login:', validatedBusinessId);
        } else {
          console.log('🔐 AuthContext: No business context available after login');
        }
      } catch (contextError) {
        console.warn('Error during business context restoration:', contextError);
      }

      // User state will be updated via the auth state change listener
      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: { message: 'Error inesperado al iniciar sesión' } };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await auth.signUp(email, password);
      
      if (result.error) {
        return { error: result.error };
      }

      // User state will be updated via the auth state change listener
      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: { message: 'Error inesperado al registrar usuario' } };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      console.log('🔐 AuthContext: Starting basic signOut process');
      
      // Clear business context before signing out
      await businessContext.clearBusinessContext();
      const result = await auth.signOut();
      
      if (result.error) {
        console.error('🔐 AuthContext: Basic signOut failed:', result.error);
        throw new Error(result.error.message);
      }
      
      console.log('🔐 AuthContext: Basic signOut completed');
      // User state will be updated via the auth state change listener
    } catch (error) {
      console.error('🔐 AuthContext: Sign out error:', error);
      
      // Even if there's an error, try to clear local state
      try {
        await businessContext.clearBusinessContext();
        setUser(null);
      } catch (cleanupError) {
        console.error('🔐 AuthContext: Failed to cleanup after signOut error:', cleanupError);
      }
      
      throw error; // Re-throw to let caller handle
    } finally {
      setIsLoading(false);
    }
  };

  const enhancedSignOut = async (config?: {
    clearBusinessContext?: boolean;
    clearLocalStorage?: boolean;
    redirectToLogin?: boolean;
    redirectUrl?: string;
  }) => {
    console.log('🔐 AUTH-CONTEXT STEP 1: Starting enhanced signOut process with config:', config);
    setIsLoading(true);
    
    try {
      console.log('🔐 AUTH-CONTEXT STEP 2: Calling auth.enhancedSignOut...');
      const result = await auth.enhancedSignOut(config);
      
      console.log('🔐 AUTH-CONTEXT STEP 3: auth.enhancedSignOut result:', result);
      
      if (result.error) {
        console.error('🔐 AUTH-CONTEXT STEP 4: Enhanced signOut failed:', result.error);
        
        // Even if enhanced logout fails, try emergency cleanup
        console.log('🔐 AUTH-CONTEXT STEP 5: Attempting emergency cleanup after enhanced signOut failure');
        try {
          await businessContext.clearBusinessContext();
          console.log('🔐 AUTH-CONTEXT STEP 5a: Business context cleared');
          setUser(null);
          console.log('🔐 AUTH-CONTEXT STEP 5b: User state cleared');
          
          // Force redirect if configured, even on failure
          if (config?.redirectToLogin && typeof window !== 'undefined') {
            const redirectUrl = config.redirectUrl || '/login';
            console.log('🔐 AUTH-CONTEXT STEP 5c: Force redirecting after failed logout to:', redirectUrl);
            window.location.replace(redirectUrl);
          }
        } catch (cleanupError) {
          console.error('🔐 AUTH-CONTEXT STEP 5d: Emergency cleanup also failed:', cleanupError);
        }
      } else {
        console.log('🔐 AUTH-CONTEXT STEP 4: Enhanced signOut completed successfully');
        console.log('🔐 AUTH-CONTEXT STEP 5: Clearing user state immediately...');
        setUser(null);
        console.log('🔐 AUTH-CONTEXT STEP 6: User state cleared');
      }
      
      return result;
    } catch (error) {
      console.error('🔐 AUTH-CONTEXT STEP 7: Unexpected error during enhanced sign out:', error);
      
      // Emergency fallback - clear everything and redirect
      try {
        console.log('🔐 AUTH-CONTEXT STEP 8: Performing emergency fallback logout');
        await businessContext.clearBusinessContext();
        console.log('🔐 AUTH-CONTEXT STEP 8a: Emergency business context cleared');
        setUser(null);
        console.log('🔐 AUTH-CONTEXT STEP 8b: Emergency user state cleared');
        
        if (config?.redirectToLogin && typeof window !== 'undefined') {
          const redirectUrl = config.redirectUrl || '/login?reason=emergency';
          console.log('🔐 AUTH-CONTEXT STEP 8c: Emergency redirect to:', redirectUrl);
          window.location.replace(redirectUrl);
        }
      } catch (fallbackError) {
        console.error('🔐 AUTH-CONTEXT STEP 8d: Emergency fallback failed:', fallbackError);
      }
      
      return { 
        error: { 
          message: error instanceof Error ? error.message : 'Enhanced sign out failed' 
        } 
      };
    } finally {
      console.log('🔐 AUTH-CONTEXT STEP 9: Setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Session timeout management functions
  const initializeSessionTimeout = (config?: Partial<SessionTimeoutConfig>) => {
    try {
      import('./logout-session-management').then(({ initializeSessionTimeout, setupActivityTracking }) => {
        initializeSessionTimeout(config, {
          onWarning: () => {
            console.warn('Session timeout warning - session will expire soon');
            // You can show a warning notification here
          },
          onTimeout: () => {
            console.warn('Session timeout - automatic logout');
            // Automatic logout handled by session manager
          },
        });
        
        // Setup user activity tracking
        setupActivityTracking();
      });
    } catch (error) {
      console.error('Failed to initialize session timeout:', error);
    }
  };

  const resetSessionTimeout = () => {
    try {
      import('./logout-session-management').then(({ resetSessionTimeout }) => {
        resetSessionTimeout();
      });
    } catch (error) {
      console.error('Failed to reset session timeout:', error);
    }
  };

  const stopSessionTimeout = () => {
    try {
      import('./logout-session-management').then(({ stopSessionTimeout }) => {
        stopSessionTimeout();
      });
    } catch (error) {
      console.error('Failed to stop session timeout:', error);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: sessionData } = await auth.getSession();
      
      if (sessionData.session?.user) {
        // Restore and validate business context using RLS system
        const validatedBusinessId = businessContext.getCurrentBusinessId();
        
        if (!validatedBusinessId) {
          console.log('🔐 AuthContext: No business context available during refresh');
        }

        const authUser: AuthUser = {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email || '',
          name: sessionData.session.user.user_metadata?.name,
          businessId: validatedBusinessId || undefined,
        };

        setUser(authUser);
      } else {
        setUser(null);
        await businessContext.clearBusinessContext();
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      setUser(null);
      await businessContext.clearBusinessContext();
    }
  };

  const setBusinessContextWrapper = async (businessId: string) => {
    try {
      // Use RLS context management for setting business context
      const result = await businessContext.setBusinessContext(businessId);
      
      if (!result.success) {
        const errorMessage = result.error?.message || 'Error al establecer el contexto del negocio';
        return { error: { message: errorMessage } };
      }

      // Update user state with new business context
      if (user) {
        setUser({
          ...user,
          businessId: businessId
        });
      }

      return { error: null };
    } catch (error) {
      console.error('Error setting business context:', error);
      return { error: { message: 'Error al establecer el contexto del negocio' } };
    }
  };

  const getCurrentBusinessId = () => {
    return businessContext.getCurrentBusinessId();
  };

  const getCurrentBusinessIdAsync = async (options?: { autoSelect?: boolean; skipCache?: boolean }) => {
    // Get user ID for database queries
    const userId = user?.id;

    console.log('User ID', userId);
    
    return await businessContext.getCurrentBusinessIdAsync({
      ...options,
      userId
    });
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isInitialized,
    signIn,
    signUp,
    signOut,
    enhancedSignOut,
    refreshSession,
    setBusinessContext: setBusinessContextWrapper,
    getCurrentBusinessId,
    getCurrentBusinessIdAsync,
    initializeSessionTimeout,
    resetSessionTimeout,
    stopSessionTimeout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for protecting routes
export function useRequireAuth() {
  const { user, isInitialized } = useAuth();
  
  useEffect(() => {
    if (isInitialized && !user) {
      // Redirect to login page
      window.location.href = '/login';
    }
  }, [user, isInitialized]);

  return { user, isInitialized, isAuthenticated: !!user };
}

// Hook for business context requirement
export function useRequireBusinessContext() {
  const { user, isInitialized, getCurrentBusinessId } = useAuth();
  const businessId = getCurrentBusinessId();
  
  useEffect(() => {
    if (isInitialized && user && !businessId) {
      // Redirect to business setup or registration
      window.location.href = '/register/business';
    }
  }, [user, isInitialized, businessId]);

  return { user, isInitialized, businessId, hasBusinessContext: !!businessId };
}

// Hook for async business context with auto-selection
export function useBusinessContext(options?: { autoSelect?: boolean; skipCache?: boolean }) {
  const { user, isInitialized, getCurrentBusinessIdAsync } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Stabilize options to prevent infinite re-renders
  const stableOptions = useMemo(() => options, [options]);

  useEffect(() => {
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
          // Handle specific timeout error
          if (err instanceof Error && err.message === 'TIMEOUT') {
            console.warn('🔄 Business context loading timed out, user may need to register business');
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
}