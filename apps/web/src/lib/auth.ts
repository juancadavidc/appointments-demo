import { supabase } from './supabase';
import { businessContext as unifiedBusinessContext } from './business-context';
import type { User, Session } from '@supabase/supabase-js';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  businessId?: string;
};

export type AuthError = {
  message: string;
  status?: number;
};

export type AuthResult<T> = {
  data: T;
  error: AuthError | null;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    user_metadata?: { name?: string; business_id?: string };
  };
};

// Legacy business context - DEPRECATED: Use businessContext from './business-context.ts'
export const businessContext = {
  getCurrentBusinessId: (): string | null => {
    return unifiedBusinessContext.getCurrentBusinessId();
  },
  setCurrentBusinessId: (businessId: string): void => {
    // Only set localStorage - full context setting should use unifiedBusinessContext.setBusinessContext
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_business_id', businessId);
    }
  },
  clearBusinessContext: (): void => {
    unifiedBusinessContext.clearBusinessContext();
  },
  setDatabaseBusinessContext: async (businessId: string): Promise<{ error: AuthError | null }> => {
    const result = await unifiedBusinessContext.setBusinessContext(businessId);
    return { error: result.success ? null : (result.error ? { message: result.error.message, status: 500 } : { message: 'Failed to set context', status: 500 }) };
  },
  validateBusinessContext: async (userId: string, businessId: string): Promise<{ valid: boolean; error: AuthError | null }> => {
    const result = await unifiedBusinessContext.validateBusinessAccess(userId, businessId);
    return { valid: result.success, error: result.success ? null : (result.error ? { message: result.error.message, status: 500 } : { message: 'Validation failed', status: 500 }) };
  },
  // Add new unified methods for compatibility
  setBusinessContext: async (businessId: string) => {
    return await unifiedBusinessContext.setBusinessContext(businessId);
  },
  validateBusinessAccess: async (userId: string, businessId: string) => {
    return await unifiedBusinessContext.validateBusinessAccess(userId, businessId);
  }
};

// Enhanced authentication service wrapper
export const auth = {
  // Sign up with email and password
  signUp: async (email: string, password: string): Promise<AuthResult<{ user: User | null; session: Session | null }>> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        return { 
          data: { user: null, session: null }, 
          error: { message: error.message, status: error.status } 
        };
      }
      
      return { data, error: null };
    } catch (err) {
      return { 
        data: { user: null, session: null }, 
        error: { 
          message: err instanceof Error ? err.message : 'Registration failed',
          status: 500 
        } 
      };
    }
  },

  // Sign in with email and password
  signIn: async (email: string, password: string): Promise<AuthResult<{ user: User | null; session: Session | null }>> => {
    try {
      console.log('🔐 Auth: Attempting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log('🔐 Auth: Login response received', { 
        hasSession: !!data.session,
        hasUser: !!data.user,
        error: error?.message 
      });
      
      if (error) {
        console.warn('🔐 Auth: Login failed:', error.message);
        return { 
          data: { user: null, session: null }, 
          error: { message: error.message, status: error.status } 
        };
      }

      console.log('🔐 Auth: Login successful, checking for session cookies...');
      
      // Give a moment for cookies to be set
      setTimeout(() => {
        console.log('🔐 Auth: Cookies should now be set in browser');
      }, 100);

      // If user has business_id in metadata, set business context
      if (data.session?.user?.user_metadata?.business_id) {
        console.log('🔐 Auth: Setting business context from metadata:', data.session.user.user_metadata.business_id);
        const businessId = data.session.user.user_metadata.business_id;
        
        // Set full business context (localStorage + RLS)
        const contextResult = await unifiedBusinessContext.setBusinessContext(businessId);
        if (!contextResult.success) {
          // Log warning but don't fail authentication
          console.warn('Failed to set business context:', contextResult.error);
        }
      }
      
      return { data, error: null };
    } catch (err) {
      console.error('🔐 Auth: Unexpected error during login:', err);
      return { 
        data: { user: null, session: null }, 
        error: { 
          message: err instanceof Error ? err.message : 'Login failed',
          status: 500 
        } 
      };
    }
  },

  // Sign out with complete cleanup
  signOut: async (): Promise<{ error: AuthError | null }> => {
    try {
      console.log('🔐 AUTH-SIGNOUT STEP 1: Starting auth.signOut...');
      
      // Clear business context first
      console.log('🔐 AUTH-SIGNOUT STEP 2: Clearing business context...');
      await unifiedBusinessContext.clearBusinessContext();
      
      console.log('🔐 AUTH-SIGNOUT STEP 3: Calling supabase.auth.signOut with timeout...');
      
      // Create a timeout promise to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Supabase signOut timeout')), 2000);
      });
      
      // Race the signOut against timeout
      let result;
      try {
        result = await Promise.race([
          supabase.auth.signOut(),
          timeoutPromise
        ]);
        console.log('🔐 AUTH-SIGNOUT STEP 4: supabase.auth.signOut completed:', result);
      } catch (timeoutError) {
        console.warn('🔐 AUTH-SIGNOUT STEP 4: supabase.auth.signOut timed out:', timeoutError);
        // Continue with success even if Supabase signOut times out
        // The important cleanup (business context) is already done
        return { error: null };
      }
      
      const { error } = result as { error: { message: string; status?: number } | null };
      
      if (error) {
        console.warn('🔐 AUTH-SIGNOUT STEP 5: supabase.auth.signOut error:', error);
        return { error: { message: error.message, status: error.status } };
      }
      
      console.log('🔐 AUTH-SIGNOUT STEP 5: auth.signOut completed successfully');
      return { error: null };
    } catch (err) {
      console.error('🔐 AUTH-SIGNOUT STEP 6: Unexpected error in auth.signOut:', err);
      return { 
        error: { 
          message: err instanceof Error ? err.message : 'Logout failed',
          status: 500 
        } 
      };
    }
  },

  // Enhanced logout with comprehensive cleanup
  enhancedSignOut: async (config?: {
    clearBusinessContext?: boolean;
    clearLocalStorage?: boolean;
    redirectToLogin?: boolean;
    redirectUrl?: string;
  }): Promise<{ error: AuthError | null; cleanupResults?: Record<string, boolean> }> => {
    try {
      console.log('🔐 AUTH-LIB STEP 1: Starting auth.enhancedSignOut with config:', config);
      
      // Import here to avoid circular dependencies
      console.log('🔐 AUTH-LIB STEP 2: Importing logout-session-management...');
      const { enhancedLogout } = await import('./logout-session-management');
      
      console.log('🔐 AUTH-LIB STEP 3: Calling enhancedLogout...');
      const result = await enhancedLogout(config);
      
      console.log('🔐 AUTH-LIB STEP 4: enhancedLogout result:', result);
      
      const returnValue = {
        error: result.success ? null : result.error || { message: 'Enhanced logout failed', status: 500 },
        cleanupResults: result.cleanupResults,
      };
      
      console.log('🔐 AUTH-LIB STEP 5: Returning result:', returnValue);
      return returnValue;
    } catch (err) {
      console.error('🔐 AUTH-LIB STEP 6: Error in auth.enhancedSignOut:', err);
      return { 
        error: { 
          message: err instanceof Error ? err.message : 'Enhanced logout failed',
          status: 500 
        } 
      };
    }
  },

  // Quick synchronous check if user is likely authenticated (checks cookies)
  isLikelyAuthenticated: (): boolean => {
    if (typeof window === 'undefined') {
      return false; // Server-side, assume not authenticated
    }
    
    try {
      // Check for Supabase auth cookies - they follow pattern sb-<project-ref>-auth-token
      const cookies = document.cookie.split(';');
      const hasAuthCookie = cookies.some(cookie => 
        cookie.trim().startsWith('sb-') && cookie.includes('-auth-token')
      );
      
      // Also check localStorage for additional confirmation
      const hasLocalStorage = localStorage.getItem('supabase.auth.token') !== null;
      
      return hasAuthCookie || hasLocalStorage;
    } catch (error) {
      // If we can't check cookies/localStorage, assume not authenticated
      console.warn('🔐 Auth: Unable to check authentication cookies:', error);
      return false;
    }
  },

  // Get current user session
  getSession: async (): Promise<AuthResult<{ session: Session | null }>> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        return { 
          data: { session: null }, 
          error: { message: error.message, status: error.status } 
        };
      }
      
      return { data, error: null };
    } catch (err) {
      return { 
        data: { session: null }, 
        error: { 
          message: err instanceof Error ? err.message : 'Session retrieval failed',
          status: 500 
        } 
      };
    }
  },

  // Get current user
  getUser: async (): Promise<AuthResult<{ user: User | null }>> => {
    try {
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        return { 
          data: { user: null }, 
          error: { message: error.message, status: error.status } 
        };
      }
      
      return { data, error: null };
    } catch (err) {
      return { 
        data: { user: null }, 
        error: { 
          message: err instanceof Error ? err.message : 'User retrieval failed',
          status: 500 
        } 
      };
    }
  },

  // Listen to auth changes with business context handling
  onAuthStateChange: (callback: (user: AuthUser | null) => void) => {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const businessId = session.user.user_metadata?.business_id || unifiedBusinessContext.getCurrentBusinessId();
        
        // Set business context if available
        if (businessId) {
          await unifiedBusinessContext.setBusinessContext(businessId);
        }
        
        const user: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name,
          businessId: businessId || undefined,
        };
        callback(user);
      } else {
        // Clear business context on sign out
        await unifiedBusinessContext.clearBusinessContext();
        callback(null);
      }
    });
  },

  // Reset password
  resetPassword: async (email: string): Promise<AuthResult<{ message?: string } | null>> => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        return { 
          data: null, 
          error: { message: error.message, status: error.status } 
        };
      }
      
      return { data, error: null };
    } catch (err) {
      return { 
        data: null, 
        error: { 
          message: err instanceof Error ? err.message : 'Password reset failed',
          status: 500 
        } 
      };
    }
  },

  // Update password
  updatePassword: async (password: string): Promise<AuthResult<{ user: User } | null>> => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
      });
      
      if (error) {
        return { 
          data: null, 
          error: { message: error.message, status: error.status } 
        };
      }
      
      return { data, error: null };
    } catch (err) {
      return { 
        data: null, 
        error: { 
          message: err instanceof Error ? err.message : 'Password update failed',
          status: 500 
        } 
      };
    }
  },

  // Verify email with OTP token
  verifyEmail: async (token: string, type: 'signup' | 'recovery'): Promise<AuthResult<{ user: User | null; session: Session | null }>> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type
      });
      
      if (error) {
        return { 
          data: { user: null, session: null }, 
          error: { message: error.message, status: error.status } 
        };
      }
      
      return { data, error: null };
    } catch (err) {
      return { 
        data: { user: null, session: null }, 
        error: { 
          message: err instanceof Error ? err.message : 'Email verification failed',
          status: 500 
        } 
      };
    }
  },

  // Resend verification email
  resendVerificationEmail: async (email: string, type: 'signup' | 'recovery'): Promise<AuthResult<{ messageId?: string } | null>> => {
    try {
      const { data, error } = await supabase.auth.resend({
        type: type === 'recovery' ? 'signup' : type as 'signup',
        email: email
      });
      
      if (error) {
        return { 
          data: null, 
          error: { message: error.message, status: error.status } 
        };
      }
      
      return { 
        data: { messageId: data?.messageId ?? undefined },
        error: null 
      };
    } catch (err) {
      return { 
        data: null, 
        error: { 
          message: err instanceof Error ? err.message : 'Resend email failed',
          status: 500 
        } 
      };
    }
  },

  // Set business context after registration
  setBusinessContext: async (businessId: string): Promise<{ error: AuthError | null }> => {
    try {
      // Update user metadata with business_id
      const { error: updateError } = await supabase.auth.updateUser({
        data: { business_id: businessId }
      });

      if (updateError) {
        return { error: { message: updateError.message, status: updateError.status } };
      }

      // Set full business context (localStorage + RLS)
      const result = await unifiedBusinessContext.setBusinessContext(businessId);
      return { error: result.success ? null : (result.error ? { message: result.error.message, status: 500 } : { message: 'Failed to set context', status: 500 }) };
    } catch (err) {
      return { 
        error: { 
          message: err instanceof Error ? err.message : 'Failed to set business context',
          status: 500 
        } 
      };
    }
  },

  // Get current business context
  getCurrentBusinessId: (): string | null => {
    return businessContext.getCurrentBusinessId();
  },

  // Validate user has access to business
  validateBusinessAccess: async (businessId: string): Promise<{ valid: boolean; error: AuthError | null }> => {
    const { data: userData } = await auth.getUser();
    
    if (!userData.user) {
      return { valid: false, error: { message: 'User not authenticated', status: 401 } };
    }

    const result = await unifiedBusinessContext.validateBusinessAccess(userData.user.id, businessId);
    return { valid: result.success, error: result.success ? null : result.error || { message: 'Validation failed', status: 500 } };
  }
};