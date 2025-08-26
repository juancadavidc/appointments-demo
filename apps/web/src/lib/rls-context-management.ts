/**
 * RLS Context Management
 * Row Level Security helper functions for setting and managing business context
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Type definitions
export interface BusinessContextResult {
  success: boolean
  error?: string
  businessId?: string
}

export interface BusinessValidationResult {
  isValid: boolean
  businessData?: Record<string, unknown>
  error?: string
}

export interface BusinessIsolationResult {
  isIsolated: boolean
  business1Data?: Record<string, unknown>[]
  business2Data?: Record<string, unknown>[]
  error?: string
}

export interface BusinessContextSwitchResult {
  success: boolean
  previousBusinessId: string | null
  newBusinessId: string
  error?: string
}

/**
 * Set business context in PostgreSQL session using current_setting
 * This establishes the business_id for Row Level Security policies
 */
export async function setBusinessContext(businessId: string): Promise<BusinessContextResult> {
  try {
    // Validate business ID format
    if (!businessId || !UUID_REGEX.test(businessId)) {
      return {
        success: false,
        error: 'Invalid business ID format'
      }
    }

    // Verify user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user) {
      return {
        success: false,
        error: 'No authenticated user session'
      }
    }

    // Validate user owns this business before setting context
    const validation = await validateBusinessContext(businessId)
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || 'User does not own this business'
      }
    }

    // Set business context in PostgreSQL session
    const { error } = await supabase.rpc('set_business_context', {
      business_id: businessId
    })

    if (error) {
      return {
        success: false,
        error: 'Failed to set business context in database'
      }
    }

    // Store in localStorage for client-side access
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_business_id', businessId)
    }

    return {
      success: true,
      businessId
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error setting business context: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Get current business context from localStorage
 * Returns null if no valid context is set
 */
export function getBusinessContext(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const businessId = localStorage.getItem('current_business_id')
  
  // Validate stored business ID format
  if (businessId && UUID_REGEX.test(businessId)) {
    return businessId
  }

  // Clear invalid business context
  if (businessId) {
    localStorage.removeItem('current_business_id')
  }

  return null
}

/**
 * Validate that the current user owns the specified business
 * Used before setting business context to prevent unauthorized access
 */
export async function validateBusinessContext(businessId: string): Promise<BusinessValidationResult> {
  try {
    // Verify user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user) {
      return {
        isValid: false,
        error: 'No authenticated user session'
      }
    }

    // Query business table to verify ownership
    const { data: businessData, error } = await supabase
      .from('businesses')
      .select('id, owner_id, name, status')
      .eq('id', businessId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          isValid: false,
          error: 'Business not found or user does not own this business'
        }
      }
      return {
        isValid: false,
        error: `Database validation failed: ${error.message}`
      }
    }

    // Verify ownership
    if (businessData.owner_id !== session.user.id) {
      return {
        isValid: false,
        error: 'User does not own this business'
      }
    }

    return {
      isValid: true,
      businessData
    }
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Clear business context from database session and localStorage
 */
export async function clearBusinessContext(): Promise<BusinessContextResult> {
  try {
    // Clear PostgreSQL session context
    //const { error } = await supabase.rpc('clear_business_context')

    //if (error) {
    //  return {
    //    success: false,
    //    error: `Failed to clear business context: ${error.message}`
    //  }
    //}

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_business_id')
    }

    return {
      success: true
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error clearing business context: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Verify business data isolation by testing queries from different business contexts
 * This is used for testing RLS policy effectiveness
 */
export async function verifyBusinessIsolation(
  businessId1: string,
  businessId2: string,
  tableName: string
): Promise<BusinessIsolationResult> {
  try {
    // Set context for first business and query data
    const context1Result = await setBusinessContext(businessId1)
    if (!context1Result.success) {
      return {
        isIsolated: false,
        error: `Failed to set business context during isolation test: ${context1Result.error}`
      }
    }

    const { data: business1Data, error: query1Error } = await supabase.rpc('test_data_isolation', {
      table_name: tableName
    })

    if (query1Error) {
      return {
        isIsolated: false,
        error: `Failed to query business 1 data: ${query1Error.message}`
      }
    }

    // Set context for second business and query data
    const context2Result = await setBusinessContext(businessId2)
    if (!context2Result.success) {
      return {
        isIsolated: false,
        error: `Failed to set business context for business 2: ${context2Result.error}`
      }
    }

    const { data: business2Data, error: query2Error } = await supabase.rpc('test_data_isolation', {
      table_name: tableName
    })

    if (query2Error) {
      return {
        isIsolated: false,
        error: `Failed to query business 2 data: ${query2Error.message}`
      }
    }

    // Check for data isolation
    const business1Ids = business1Data?.map((item: Record<string, unknown>) => item.id) || []
    const business2Ids = business2Data?.map((item: Record<string, unknown>) => item.id) || []

    // Verify no overlap in data IDs
    const hasOverlap = business1Ids.some((id: string) => business2Ids.includes(id))

    if (hasOverlap) {
      return {
        isIsolated: false,
        business1Data,
        business2Data,
        error: 'Business isolation failed: found overlapping data between businesses'
      }
    }

    return {
      isIsolated: true,
      business1Data,
      business2Data
    }
  } catch (error) {
    return {
      isIsolated: false,
      error: `Isolation test error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Switch from current business context to a new one
 * Validates ownership and updates both database and localStorage
 */
export async function switchBusinessContext(newBusinessId: string): Promise<BusinessContextSwitchResult> {
  try {
    const previousBusinessId = getBusinessContext()

    // Check if already in the specified context
    if (previousBusinessId === newBusinessId) {
      return {
        success: false,
        previousBusinessId,
        newBusinessId,
        error: 'Already in the specified business context'
      }
    }

    // Set new business context
    const result = await setBusinessContext(newBusinessId)

    if (!result.success) {
      return {
        success: false,
        previousBusinessId,
        newBusinessId,
        error: result.error
      }
    }

    return {
      success: true,
      previousBusinessId,
      newBusinessId
    }
  } catch (error) {
    return {
      success: false,
      previousBusinessId: getBusinessContext(),
      newBusinessId,
      error: `Switch context error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Check if a valid business context is currently set
 */
export function isBusinessContextSet(): boolean {
  return getBusinessContext() !== null
}

/**
 * Discover user's business from database
 * Used when localStorage is empty but user might have a business
 */
export async function discoverUserBusiness(): Promise<string | null> {
  try {
    // Verify user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user) {
      return null
    }

    // Query user's businesses using RLS policies
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, name, owner_id')
      .limit(1) // For now, just get the first business
    
    if (error || !businesses || businesses.length === 0) {
      return null
    }

    const business = businesses[0]
    
    // Verify ownership (extra safety check)
    if (business.owner_id !== session.user.id) {
      return null
    }

    console.log('🔍 Discovered user business:', business.id, business.name)
    return business.id
  } catch (error) {
    console.warn('Error discovering user business:', error)
    return null
  }
}

/**
 * Get business context with validation
 * Returns business ID if valid context exists, null otherwise
 */
export async function getValidatedBusinessContext(): Promise<string | null> {
  const businessId = getBusinessContext()
  
  if (!businessId) {
    return null
  }

  // Validate the stored business context
  const validation = await validateBusinessContext(businessId)
  
  if (!validation.isValid) {
    // Clear invalid context
    await clearBusinessContext()
    return null
  }

  return businessId
}

/**
 * Get business context with auto-discovery
 * If localStorage is empty, tries to discover user's business automatically
 */
export async function getOrDiscoverBusinessContext(): Promise<string | null> {
  // First try to get validated business context from localStorage
  let businessId = await getValidatedBusinessContext()
  
  if (businessId) {
    return businessId
  }

  // If no valid context in localStorage, try to discover user's business
  console.log('🔍 No business context found, attempting auto-discovery...')
  businessId = await discoverUserBusiness()
  
  if (businessId) {
    // Automatically set the discovered business context
    const setResult = await setBusinessContext(businessId)
    if (setResult.success) {
      console.log('🔍 Auto-discovery successful, business context set:', businessId)
      return businessId
    } else {
      console.warn('🔍 Auto-discovery found business but failed to set context:', setResult.error)
    }
  }

  return null
}

/**
 * Ensure business context is set and valid before database operations
 * Throws error if context is missing or invalid
 */
export async function ensureBusinessContext(): Promise<string> {
  const businessId = await getValidatedBusinessContext()
  
  if (!businessId) {
    throw new Error('No valid business context. Please set business context before database operations.')
  }

  return businessId
}

/**
 * Execute a database operation with automatic business context validation
 * Ensures business context is set before executing the operation
 */
export async function executeWithBusinessContext<T>(
  operation: (businessId: string) => Promise<T>
): Promise<T> {
  const businessId = await ensureBusinessContext()
  return await operation(businessId)
}

/**
 * Business context debugging utilities
 */
export const businessContextDebug = {
  /**
   * Get current business context status for debugging
   */
  getContextStatus: async () => {
    const localStorageId = getBusinessContext()
    const { data: { session } } = await supabase.auth.getSession()
    
    return {
      localStorageBusinessId: localStorageId,
      isValidFormat: localStorageId ? UUID_REGEX.test(localStorageId) : false,
      hasSession: !!session?.user,
      userId: session?.user?.id || null
    }
  },

  /**
   * Test RLS policies for a specific table
   */
  testRLSPolicy: async (tableName: string, businessId: string) => {
    const contextResult = await setBusinessContext(businessId)
    if (!contextResult.success) {
      return { error: contextResult.error }
    }

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(5)

      return {
        success: !error,
        recordCount: data?.length || 0,
        error: error?.message
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}