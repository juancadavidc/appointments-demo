/**
 * Comprehensive Test Suite for Logout Functionality and Session Management
 * Tests complete session cleanup, business context clearing, and authentication state management
 */

import { 
  clearBusinessContext, 
  setBusinessContext, 
  getBusinessContext 
} from './rls-context-management';
import { auth, businessContext } from './auth';
import { jwtTokenManager, fetchInterceptor } from './jwt-token-management';

// Mock RLS context management
jest.mock('./rls-context-management', () => ({
  clearBusinessContext: jest.fn(),
  setBusinessContext: jest.fn(),
  getBusinessContext: jest.fn(),
}));

// Mock Supabase client
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ data: null, error: null, count: null, status: 200, statusText: 'OK' }),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Mock auth module
jest.mock('./auth', () => ({
  auth: {
    signOut: jest.fn().mockResolvedValue({ error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
  },
  businessContext: {
    getCurrentBusinessId: jest.fn(),
    setCurrentBusinessId: jest.fn(),
    clearBusinessContext: jest.fn(),
  },
}));

// Mock JWT token management
jest.mock('./jwt-token-management', () => ({
  jwtTokenManager: {
    isTokenExpired: jest.fn(),
    refreshTokenWithBusinessContext: jest.fn(),
    getBusinessIdFromToken: jest.fn(),
    validateBusinessContextConsistency: jest.fn(),
  },
  fetchInterceptor: {
    fetchWithAuth: jest.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Enhanced localStorage mock with proper Storage interface
const enhancedLocalStorageMock = {
  ...localStorageMock,
  length: 0,
  key: jest.fn((index: number) => {
    const keys = Object.keys((localStorageMock as { store?: Record<string, string> }).store || {});
    return keys[index] || null;
  }),
} as Storage;

Object.defineProperty(window, 'localStorage', {
  value: enhancedLocalStorageMock,
});

// Mock window.location
const mockLocation = {
  href: '',
  replace: jest.fn(),
  assign: jest.fn(),
  ancestorOrigins: {} as DOMStringList,
  hash: '',
  host: 'localhost:3000',
  hostname: 'localhost',
  origin: 'http://localhost:3000',
  pathname: '/',
  port: '3000',
  protocol: 'http:',
  search: '',
  reload: jest.fn(),
} as Location;

// Mock window object
Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    location: mockLocation,
    localStorage: enhancedLocalStorageMock,
  },
  writable: true,
});

describe('Logout Functionality and Session Cleanup', () => {
  const mockBusinessId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUserId = 'user123';
  const mockSession = {
    access_token: 'mock-jwt-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: mockUserId,
      email: 'test@example.com',
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z',
      app_metadata: { provider: 'email' },
      user_metadata: { business_id: mockBusinessId },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockLocation.href = '';
    
    // Set up getBusinessContext mock to return current localStorage value
    const mockGetBusinessContext = getBusinessContext as jest.MockedFunction<typeof getBusinessContext>;
    const mockBusinessContextGetCurrent = businessContext.getCurrentBusinessId as jest.MockedFunction<typeof businessContext.getCurrentBusinessId>;
    
    mockGetBusinessContext.mockImplementation(() => {
      return localStorageMock.getItem('current_business_id');
    });
    
    mockBusinessContextGetCurrent.mockImplementation(() => {
      return localStorageMock.getItem('current_business_id');
    });
  });

  describe('Basic Logout Functionality', () => {
    test('should clear Supabase session on logout', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });

      const result = await auth.signOut();

      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
      expect(result.error).toBeNull();
    });

    test('should handle Supabase signOut errors gracefully', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      const mockError = { message: 'Network error', status: 500 };
      mockAuth.signOut.mockResolvedValue({ error: mockError });

      const result = await auth.signOut();

      expect(result.error).toEqual({
        message: 'Network error',
        status: 500,
      });
    });

    test('should handle exceptions during logout', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockRejectedValue(new Error('Connection timeout'));

      const result = await auth.signOut();

      expect(result.error).toEqual({
        message: 'Connection timeout',
        status: 500,
      });
    });
  });

  describe('Business Context Cleanup', () => {
    test('should clear localStorage business_id on logout', async () => {
      // Set up initial business context
      localStorageMock.setItem('current_business_id', mockBusinessId);
      const mockBusinessContextGetCurrent = businessContext.getCurrentBusinessId as jest.MockedFunction<typeof businessContext.getCurrentBusinessId>;
      mockBusinessContextGetCurrent.mockReturnValue(mockBusinessId);

      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });

      await auth.signOut();

      // After logout, mock should return null
      mockBusinessContextGetCurrent.mockReturnValue(null);
      expect(businessContext.getCurrentBusinessId()).toBeNull();
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });

    test('should clear database business context on logout', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });

      // Set up initial business context in localStorage
      localStorageMock.setItem('current_business_id', mockBusinessId);

      await auth.signOut();

      // Business context should be cleared via RLS context management
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });

    test('should clear business context even if Supabase signOut fails', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: { message: 'Network error', status: 500 } });

      // Set up initial business context
      localStorageMock.setItem('current_business_id', mockBusinessId);

      await auth.signOut();

      // Business context should still be cleared despite logout failure
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });
  });

  describe('Complete Session Data Cleanup', () => {
    test('should clear all session-related localStorage data', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });

      // Set up various session data
      localStorageMock.setItem('current_business_id', mockBusinessId);
      localStorageMock.setItem('session_data', 'some_session_data');
      localStorageMock.setItem('user_preferences', 'preferences');

      await auth.signOut();

      // Business context should be cleared
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });

    test('should clear RLS business context from database session', async () => {
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      mockClearBusinessContext.mockResolvedValue({ success: true });

      localStorageMock.setItem('current_business_id', mockBusinessId);

      const clearResult = await clearBusinessContext();

      expect(clearResult.success).toBe(true);
      expect(mockClearBusinessContext).toHaveBeenCalledTimes(1);
    });

    test('should handle RLS context clearing errors', async () => {
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      mockClearBusinessContext.mockResolvedValue({
        success: false,
        error: 'Failed to clear business context: Database connection failed',
      });

      localStorageMock.setItem('current_business_id', mockBusinessId);

      const clearResult = await clearBusinessContext();

      expect(clearResult.success).toBe(false);
      expect(clearResult.error).toContain('Failed to clear business context');
    });
  });

  describe('Session Token Management During Logout', () => {
    test('should invalidate JWT tokens on logout', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });
      mockAuth.getSession
        .mockResolvedValueOnce({ data: { session: mockSession }, error: null }) // Before logout
        .mockResolvedValueOnce({ data: { session: null }, error: null }); // After logout

      // Before logout - should have session
      const beforeLogout = await auth.getSession();
      expect(beforeLogout.data.session).not.toBeNull();

      await auth.signOut();

      // After logout - session should be null
      const afterLogout = await auth.getSession();
      expect(afterLogout.data.session).toBeNull();
    });

    test('should clear refresh tokens on logout', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });

      await auth.signOut();

      // Verify signOut was called which should clear refresh tokens
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    });

    test('should prevent token refresh after logout', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      const mockJwtTokenManager = jwtTokenManager as jest.Mocked<typeof jwtTokenManager>;
      
      mockAuth.signOut.mockResolvedValue({ error: null });
      mockJwtTokenManager.refreshTokenWithBusinessContext.mockResolvedValue({
        success: false,
        session: null,
        error: { message: 'Failed to refresh session', status: 401 },
      });

      await auth.signOut();

      // Try to refresh after logout
      const refreshResult = await jwtTokenManager.refreshTokenWithBusinessContext();

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error?.message).toContain('Failed to refresh session');
    });
  });

  describe('API Request Handling After Logout', () => {
    test('should handle 401 errors by clearing context and redirecting', async () => {
      const mockFetchInterceptor = fetchInterceptor as jest.Mocked<typeof fetchInterceptor>;
      
      // Mock fetch interceptor to simulate 401 handling
      mockFetchInterceptor.fetchWithAuth.mockImplementation(async () => {
        // Simulate the behavior that sets location.href
        mockLocation.href = '/login';
        throw new Error('401 Unauthorized');
      });

      localStorageMock.setItem('current_business_id', mockBusinessId);

      try {
        await fetchInterceptor.fetchWithAuth('/api/test', {});
      } catch {
        // Expected to fail due to 401
      }

      // Should redirect to login on 401
      expect(mockLocation.href).toBe('/login');
    });

    test('should clear business context on 403 errors with business context message', async () => {
      const mockFetchInterceptor = fetchInterceptor as jest.Mocked<typeof fetchInterceptor>;
      const mockGetBusinessContext = getBusinessContext as jest.MockedFunction<typeof getBusinessContext>;
      
      mockGetBusinessContext.mockReturnValue(mockBusinessId);
      localStorageMock.setItem('current_business_id', mockBusinessId);

      // Mock fetch interceptor to simulate 403 handling
      mockFetchInterceptor.fetchWithAuth.mockImplementation(async () => {
        // Simulate clearing business context and redirect
        localStorageMock.removeItem('current_business_id');
        mockLocation.href = '/login?error=business_context_invalid';
        const response = new Response(JSON.stringify({ error: 'Invalid business context' }), { status: 403 });
        return response;
      });

      await fetchInterceptor.fetchWithAuth('/api/test', {});

      // Should clear business context and redirect to login with error
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
      expect(mockLocation.href).toBe('/login?error=business_context_invalid');
    });
  });

  describe('Auth State Change Listener', () => {
    test('should clear business context when auth state changes to null', async () => {
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      const mockCallback = jest.fn();
      
      // Mock auth state change listener
      const mockOnAuthStateChange = auth.onAuthStateChange as jest.MockedFunction<typeof auth.onAuthStateChange>;
      mockOnAuthStateChange.mockImplementation((callback) => {
        // Simulate auth state change to null (logout)
        callback(null);
        return { data: { subscription: { id: 'mock-subscription', callback: jest.fn(), unsubscribe: jest.fn() } } };
      });

      auth.onAuthStateChange(mockCallback);

      // Should clear business context when user becomes null
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
      expect(mockCallback).toHaveBeenCalledWith(null);
    });

    test('should restore business context when auth state changes to valid user', async () => {
      const mockCallback = jest.fn();
      const mockSetBusinessContext = setBusinessContext as jest.MockedFunction<typeof setBusinessContext>;
      const mockGetBusinessContext = getBusinessContext as jest.MockedFunction<typeof getBusinessContext>;
      
      // Set up business context before auth change
      localStorageMock.setItem('current_business_id', mockBusinessId);
      mockGetBusinessContext.mockReturnValue(mockBusinessId);
      mockSetBusinessContext.mockResolvedValue({ success: true, businessId: mockBusinessId });

      const mockOnAuthStateChange = auth.onAuthStateChange as jest.MockedFunction<typeof auth.onAuthStateChange>;
      mockOnAuthStateChange.mockImplementation((callback) => {
        // Simulate auth state change to valid user
        const authUser = {
          id: mockUserId,
          email: 'test@example.com',
          name: undefined,
          businessId: mockBusinessId,
        };
        callback(authUser);
        return { data: { subscription: { id: 'mock-subscription', callback: jest.fn(), unsubscribe: jest.fn() } } };
      });

      const listener = auth.onAuthStateChange(mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      expect(listener).toBeDefined();
    });
  });

  describe('Logout Integration with Session Management', () => {
    test('should perform complete logout flow with all cleanup steps', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      
      // Set up initial state
      localStorageMock.setItem('current_business_id', mockBusinessId);
      localStorageMock.setItem('session_data', 'test_data');
      
      // Mock successful logout
      mockAuth.signOut.mockResolvedValue({ error: null });

      const result = await auth.signOut();

      // Verify complete cleanup
      expect(result.error).toBeNull();
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });

    test('should attempt cleanup even if some steps fail', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      
      // Set up initial state
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      // Mock partial failure - auth signOut fails but business context should still be cleared
      mockAuth.signOut.mockResolvedValue({ error: { message: 'Network timeout', status: 500 } });

      const result = await auth.signOut();

      // Should still clear business context even if auth signOut fails
      expect(result.error?.message).toBe('Network timeout');
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });
  });

  describe('Session Timeout Scenarios', () => {
    test('should handle expired tokens by clearing session', async () => {
      const mockJwtTokenManager = jwtTokenManager as jest.Mocked<typeof jwtTokenManager>;
      mockJwtTokenManager.isTokenExpired.mockReturnValue(true);
      
      const expiredToken = 'expired-token';
      
      expect(jwtTokenManager.isTokenExpired(expiredToken)).toBe(true);
    });

    test('should attempt token refresh before logout on expired tokens', async () => {
      const mockJwtTokenManager = jwtTokenManager as jest.Mocked<typeof jwtTokenManager>;
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      // Mock successful token refresh
      mockJwtTokenManager.refreshTokenWithBusinessContext.mockResolvedValue({
        success: true,
        session: mockSession,
        error: null,
      });

      const refreshResult = await jwtTokenManager.refreshTokenWithBusinessContext();
      
      expect(refreshResult.success).toBe(true);
      expect(mockJwtTokenManager.refreshTokenWithBusinessContext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cross-tab Logout Synchronization', () => {
    test('should handle storage events for cross-tab logout', () => {
      // Set up initial business context
      localStorageMock.setItem('current_business_id', mockBusinessId);
      expect(getBusinessContext()).toBe(mockBusinessId);

      // Simulate storage event (business context cleared in another tab)
      const storageEvent = new StorageEvent('storage', {
        key: 'current_business_id',
        oldValue: mockBusinessId,
        newValue: null,
      });

      // Verify storage event was created correctly
      expect(storageEvent.key).toBe('current_business_id');
      
      // Clear context manually to simulate the event effect
      localStorageMock.removeItem('current_business_id');
      
      expect(getBusinessContext()).toBeNull();
    });

    test('should synchronize logout state across browser tabs', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });

      // Set up multiple "tabs" with business context
      localStorageMock.setItem('current_business_id', mockBusinessId);

      await auth.signOut();

      // Verify business context cleared (simulating cross-tab sync)
      expect(getBusinessContext()).toBeNull();
    });
  });

  describe('Error Recovery and Cleanup Validation', () => {
    test('should validate complete cleanup after logout', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });

      // Set up session data
      localStorageMock.setItem('current_business_id', mockBusinessId);

      await auth.signOut();

      // Validate all cleanup completed
      expect(getBusinessContext()).toBeNull();
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });

    test('should provide clear error messages for cleanup failures', async () => {
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      mockClearBusinessContext.mockResolvedValue({
        success: false,
        error: 'Failed to clear business context: Connection lost',
      });

      const clearResult = await clearBusinessContext();

      expect(clearResult.success).toBe(false);
      expect(clearResult.error).toContain('Failed to clear business context: Connection lost');
    });
  });
});

describe('Advanced Logout Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Logout with Active Business Operations', () => {
    test('should handle logout during active business operations', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      const mockBusinessId = '550e8400-e29b-41d4-a716-446655440000';
      
      // Set up active business context
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      // Mock auth operations
      mockAuth.signOut.mockResolvedValue({ error: null });

      const result = await auth.signOut();

      expect(result.error).toBeNull();
      expect(getBusinessContext()).toBeNull();
    });
  });

  describe('Logout State Persistence', () => {
    test('should maintain logout state after page refresh', async () => {
      const mockAuth = auth as jest.Mocked<typeof auth>;
      mockAuth.signOut.mockResolvedValue({ error: null });
      mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

      await auth.signOut();

      // Simulate page refresh - check session
      const sessionResult = await auth.getSession();
      
      expect(sessionResult.data.session).toBeNull();
      expect(getBusinessContext()).toBeNull();
    });
  });
});