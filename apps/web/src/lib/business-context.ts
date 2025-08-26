/**
 * Unified Business Context Management
 * Single source of truth for all business context operations
 * Consolidates localStorage, RLS context, and validation logic
 */

import { supabase } from './supabase';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Constants
const STORAGE_KEY = 'current_business_id';

export type BusinessContextError = {
  message: string;
  code?: string;
};

export type BusinessContextResult = {
  success: boolean;
  error?: BusinessContextError;
  businessId?: string;
};

export type GetBusinessIdOptions = {
  autoSelect?: boolean;  // Auto-select first business if none stored (default: true)
  userId?: string;       // User ID for server-side queries
  skipCache?: boolean;   // Skip localStorage cache and query database
};

export type UserBusiness = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
};

/**
 * Unified Business Context Manager
 * Single source of truth for all business context operations
 */
export const businessContext = {
  /**
   * Get current business ID - THE authoritative method with database fallback
   * All other getCurrentBusinessId calls should use this
   */
  getCurrentBusinessId(): string | null {
    // Server-side: no localStorage access
    if (typeof window === 'undefined') {
      return null;
    }

    const businessId = localStorage.getItem(STORAGE_KEY);
    
    // Validate stored business ID format
    if (businessId && UUID_REGEX.test(businessId)) {
      return businessId;
    }

    // Clear invalid business context
    if (businessId) {
      console.warn('Invalid business ID found in storage, clearing:', businessId);
      localStorage.removeItem(STORAGE_KEY);
    }
    
    return null;
  },

  /**
   * Enhanced get current business ID with database fallback and timeout
   * Automatically queries database if no localStorage business ID exists
   */
  async getCurrentBusinessIdAsync(options: GetBusinessIdOptions = {}): Promise<string | null> {

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Business context loading timeout')), 2000);
    });

    try {
      // Wrap the entire operation with timeout
      return await Promise.race([
        this._getCurrentBusinessIdAsyncInternal(options),
        timeoutPromise
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Business context loading timeout') {
        console.warn('⏰ Business context loading timed out after 2 seconds');
        throw new Error('TIMEOUT');
      }
      throw error;
    }
  },

  /**
   * Internal implementation of getCurrentBusinessIdAsync without timeout
   */
  async _getCurrentBusinessIdAsyncInternal(options: GetBusinessIdOptions = {}): Promise<string | null> {
    const { autoSelect = true, userId, skipCache = false } = options;

    // Check localStorage cache first (unless skipping cache)
    if (!skipCache && typeof window !== 'undefined') {
      const cachedBusinessId = localStorage.getItem(STORAGE_KEY);
      
      if (cachedBusinessId && UUID_REGEX.test(cachedBusinessId)) {
        // Validate cached business belongs to user if userId provided
        if (userId) {
          const isValid = await this.validateBusinessOwnership(cachedBusinessId, userId);
          if (isValid) {
            return cachedBusinessId;
          } else {
            // Cached business doesn't belong to user - clear it
            console.warn('Cached business ID does not belong to user, clearing:', cachedBusinessId);
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          return cachedBusinessId;
        }
      }
      
      // Clear invalid cached business ID
      if (cachedBusinessId) {
        console.warn('Invalid cached business ID found, clearing:', cachedBusinessId);
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // No valid cached business ID - query database with retry logic
    console.log('Auto-selecting business', autoSelect);
    if (autoSelect) {
      const businesses = await this._getUserBusinessesWithRetry(userId);
      
      console.log('Businesses', businesses);
      if (businesses.length > 0) {
        // Auto-select first business
        const selectedBusinessId = businesses[0].id;
        
        // Cache the selection in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, selectedBusinessId);
        }
        
        console.log('🏢 Auto-selected business:', { 
          businessId: selectedBusinessId, 
          businessName: businesses[0].name,
          totalBusinesses: businesses.length 
        });
        
        return selectedBusinessId;
      }
    }

    return null;
  },

  /**
   * Get user businesses with retry logic and exponential backoff
   */
  async _getUserBusinessesWithRetry(userId?: string, maxRetries: number = 2): Promise<UserBusiness[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add exponential backoff delay for retries
        if (attempt > 0) {
          const delay = Math.min(500 * Math.pow(2, attempt - 1), 1000); // 500ms, 1000ms max
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await this.getUserBusinesses(userId);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Attempt ${attempt + 1}/${maxRetries} failed:`, lastError.message);
        
        // Don't retry on the last attempt
        if (attempt === maxRetries - 1) {
          break;
        }
      }
    }
    
    console.error('All attempts to fetch user businesses failed:', lastError?.message);
    throw lastError || new Error('Failed to fetch user businesses after retries');
  },

  /**
   * Get all businesses owned by the specified user
   */
  async getUserBusinesses(userId?: string): Promise<UserBusiness[]> {
    try {
      let query = supabase
        .from('businesses')
        .select('id, name, email, created_at, updated_at')
        .order('created_at', { ascending: true });

      // If userId is provided, add explicit filter (useful for server-side operations)
      if (userId) {
        query = query.eq('owner_id', userId);
      }
      // Otherwise rely on RLS policies to filter by authenticated user

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch user businesses: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user businesses:', error);
      throw error;
    }
  },

  /**
   * Validate that a business belongs to the specified user
   */
  async validateBusinessOwnership(businessId: string, userId: string): Promise<boolean> {
    try {
      if (!UUID_REGEX.test(businessId)) {
        return false;
      }

      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('id', businessId)
        .eq('owner_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error validating business ownership:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error validating business ownership:', error);
      return false;
    }
  },

  /**
   * Set user's default business (stores in localStorage and sets RLS context)
   */
  async setDefaultBusiness(businessId: string, userId?: string): Promise<BusinessContextResult> {
    try {
      // Validate business ownership if userId provided
      if (userId) {
        const isOwner = await this.validateBusinessOwnership(businessId, userId);
        if (!isOwner) {
          return {
            success: false,
            error: { message: 'Business does not belong to user', code: 'OWNERSHIP_ERROR' }
          };
        }
      }

      // Set as current business context
      return await this.setBusinessContext(businessId);
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to set default business',
          code: 'SET_DEFAULT_ERROR'
        }
      };
    }
  },

  /**
   * Set business context with full synchronization
   * Updates localStorage AND database RLS context
   */
  async setBusinessContext(businessId: string): Promise<BusinessContextResult> {
    try {
      // Validate business ID format
      if (!businessId || !UUID_REGEX.test(businessId)) {
        return {
          success: false,
          error: { message: 'Invalid business ID format', code: 'INVALID_FORMAT' }
        };
      }

      // 1. Set localStorage (client-side state)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, businessId);
      }

      // 2. Set database RLS context
      const { error: rlsError } = await supabase.rpc('set_current_business_id', {
        business_uuid: businessId
      });

      if (rlsError) {
        // Rollback localStorage on RLS failure
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        
        return {
          success: false,
          error: { 
            message: `Failed to set database context: ${rlsError.message}`,
            code: rlsError.code || 'RLS_ERROR'
          }
        };
      }

      console.log('✅ Business context set successfully:', businessId);
      return { success: true, businessId };

    } catch (error) {
      // Rollback localStorage on any failure
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error setting business context',
          code: 'UNEXPECTED_ERROR'
        }
      };
    }
  },

  /**
   * Clear business context completely
   * Removes from localStorage AND clears RLS context
   */
  async clearBusinessContext(): Promise<BusinessContextResult> {
    try {
      // 1. Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }

      // 2. Clear database RLS context
      const { error: rlsError } = await supabase.rpc('set_current_business_id', {
        business_uuid: null
      });

      if (rlsError) {
        console.warn('Failed to clear database context:', rlsError.message);
        // Don't fail the operation - localStorage is already cleared
      }

      console.log('✅ Business context cleared successfully');
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error clearing business context',
          code: 'CLEAR_ERROR'
        }
      };
    }
  },

  /**
   * Validate that user has access to the specified business
   */
  async validateBusinessAccess(userId: string, businessId: string): Promise<BusinessContextResult> {
    try {
      if (!UUID_REGEX.test(businessId)) {
        return {
          success: false,
          error: { message: 'Invalid business ID format', code: 'INVALID_FORMAT' }
        };
      }

      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('id', businessId)
        .eq('owner_id', userId)
        .single();

      if (error) {
        return {
          success: false,
          error: { 
            message: 'Business access validation failed', 
            code: error.code || 'ACCESS_DENIED' 
          }
        };
      }

      return { success: !!data, businessId };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Business validation error',
          code: 'VALIDATION_ERROR'
        }
      };
    }
  },

  /**
   * Check if business context is currently set
   */
  hasBusinessContext(): boolean {
    return this.getCurrentBusinessId() !== null;
  },

  /**
   * Get business context with additional metadata
   */
  getBusinessContextInfo(): {
    businessId: string | null;
    isSet: boolean;
    isValid: boolean;
    source: 'localStorage' | 'none';
  } {
    const businessId = this.getCurrentBusinessId();
    
    return {
      businessId,
      isSet: businessId !== null,
      isValid: businessId !== null && UUID_REGEX.test(businessId),
      source: businessId !== null ? 'localStorage' : 'none'
    };
  },

  /**
   * Test RLS isolation - useful for debugging
   */
  async testRLSIsolation(): Promise<{
    isWorking: boolean;
    businessesWithoutContext: number;
    error?: string;
  }> {
    try {
      // First clear any existing context
      await supabase.rpc('set_current_business_id', { business_uuid: null });

      // Try to access all businesses without setting context
      const { data: allBusinesses, error } = await supabase
        .from('businesses')
        .select('id, name');

      if (error) {
        return {
          isWorking: false,
          businessesWithoutContext: 0,
          error: error.message
        };
      }

      const count = allBusinesses?.length || 0;
      
      return {
        isWorking: count === 0,
        businessesWithoutContext: count,
        error: count > 0 ? `RLS may not be working - ${count} businesses returned without context` : undefined
      };

    } catch (error) {
      return {
        isWorking: false,
        businessesWithoutContext: 0,
        error: error instanceof Error ? error.message : 'Unknown test error'
      };
    }
  },

  /**
   * Legacy setCurrentBusinessId method for test compatibility
   * Only sets localStorage, does not set RLS context
   */
  setCurrentBusinessId: (businessId: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, businessId);
    }
  }
};

// Legacy compatibility exports - gradually remove these
export const {
  getCurrentBusinessId,
  setBusinessContext,
  clearBusinessContext,
  validateBusinessAccess,
  hasBusinessContext,
  setCurrentBusinessId
} = businessContext;

// For gradual migration - alias the main functions
export const getBusinessContext = getCurrentBusinessId;
// setCurrentBusinessId is now exported from businessContext object above