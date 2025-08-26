/**
 * Integration Tests for Complete Authentication Cleanup and Verification
 * Tests end-to-end logout flow with complete session cleanup and redirect functionality
 */

import { supabase } from './supabase';
import { 
  enhancedLogout, 
  validateLogoutCleanup,
  emergencyLogout,
  SessionTimeoutManager,
  initializeSessionTimeout,
  setupActivityTracking
} from './logout-session-management';
import { auth } from './auth';
import { clearBusinessContext, getBusinessContext } from './rls-context-management';

// Mock all dependencies
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      refreshSession: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

jest.mock('./auth', () => ({
  auth: {
    signOut: jest.fn(),
    enhancedSignOut: jest.fn(),
  },
  businessContext: {
    clearBusinessContext: jest.fn(),
    getCurrentBusinessId: jest.fn(),
    setCurrentBusinessId: jest.fn(),
  },
}));

jest.mock('./rls-context-management', () => ({
  clearBusinessContext: jest.fn(),
  setBusinessContext: jest.fn(),
  getBusinessContext: jest.fn(),
  validateBusinessContext: jest.fn(),
}));

jest.mock('./jwt-token-management', () => ({
  jwtTokenManager: {
    isTokenExpired: jest.fn(),
    refreshTokenWithBusinessContext: jest.fn(),
    getBusinessIdFromToken: jest.fn(),
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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
const mockLocation = {
  href: '',
  replace: jest.fn(),
  assign: jest.fn(),
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  origin: 'http://localhost:3000',
  ancestorOrigins: {} as DOMStringList,
  reload: jest.fn(),
} as Location;

// Mock localStorage with proper Storage interface
const storageWithLength = {
  ...localStorageMock,
  get length() {
    return Object.keys(localStorageMock).filter(key => key !== 'length' && key !== 'key').length;
  },
  key: (index: number) => {
    const keys = Object.keys(localStorageMock).filter(key => key !== 'length' && key !== 'key');
    return keys[index] || null;
  }
} as Storage;

// Mock window object properly
Object.defineProperty(global, 'window', {
  value: {
    location: mockLocation,
    localStorage: storageWithLength,
  },
  writable: true,
});

describe('Complete Authentication Cleanup and Verification', () => {
  const mockBusinessId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUserId = 'user123';
  const mockSession = {
    access_token: 'mock-jwt-token',
    refresh_token: 'mock-refresh-token',
    user: {
      id: mockUserId,
      email: 'test@example.com',
      user_metadata: { business_id: mockBusinessId },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockLocation.href = '';
    (mockLocation.replace as jest.MockedFunction<typeof mockLocation.replace>).mockClear();
    
    // Set up default mocks
    const mockGetBusinessContext = getBusinessContext as jest.MockedFunction<typeof getBusinessContext>;
    mockGetBusinessContext.mockImplementation(() => {
      return localStorageMock.getItem('current_business_id');
    });
  });

  describe('Enhanced Logout Complete Flow', () => {
    test('should perform complete cleanup and redirect to login', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      
      // Set up initial state
      localStorageMock.setItem('current_business_id', mockBusinessId);
      localStorageMock.setItem('session_data', 'test_data');
      localStorageMock.setItem('user_preferences', 'preferences');
      
      // Mock successful operations
      mockClearBusinessContext.mockResolvedValue({ success: true });
      (mockSupabase.auth.signOut as jest.MockedFunction<typeof mockSupabase.auth.signOut>).mockResolvedValue({ error: null });
      
      const result = await enhancedLogout({
        redirectToLogin: true,
        redirectUrl: '/login',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.cleanupResults).toEqual({
        supabaseSession: true,
        businessContext: true,
        localStorage: true,
        databaseContext: true,
      });

      // Verify cleanup
      expect(mockClearBusinessContext).toHaveBeenCalledTimes(1);
      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(mockLocation.replace).toHaveBeenCalledWith('/login');
    });

    test('should handle partial cleanup failures gracefully', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      
      // Set up initial state
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      // Mock partial failure
      mockClearBusinessContext.mockResolvedValue({ 
        success: false, 
        error: 'Database connection failed' 
      });
      (mockSupabase.auth.signOut as jest.MockedFunction<typeof mockSupabase.auth.signOut>).mockResolvedValue({ error: null });
      
      const result = await enhancedLogout({
        redirectToLogin: true,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Database connection failed');
      expect(result.cleanupResults?.supabaseSession).toBe(true);
      expect(result.cleanupResults?.businessContext).toBe(false);
      expect(result.cleanupResults?.localStorage).toBe(true);
    });

    test('should clear all session-related localStorage keys', async () => {
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      mockClearBusinessContext.mockResolvedValue({ success: true });
      
      // Set up various session data
      const sessionKeys = [
        'current_business_id',
        'user_preferences', 
        'session_data',
        'auth_token',
        'refresh_token',
        'business_session_history',
        'last_activity_time',
      ];
      
      sessionKeys.forEach(key => {
        localStorageMock.setItem(key, 'test_value');
      });

      await enhancedLogout();

      // Verify all keys are cleared
      sessionKeys.forEach(key => {
        expect(localStorageMock.getItem(key)).toBeNull();
      });
    });
  });

  describe('Logout Cleanup Validation', () => {
    test('should validate complete cleanup success', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockGetBusinessContext = getBusinessContext as jest.MockedFunction<typeof getBusinessContext>;
      
      // Mock clean state
      (mockSupabase.auth.getSession as jest.MockedFunction<typeof mockSupabase.auth.getSession>).mockResolvedValue({ data: { session: null }, error: null });
      mockGetBusinessContext.mockReturnValue(null);
      
      const validation = await validateLogoutCleanup();

      expect(validation.isComplete).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should identify incomplete cleanup issues', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockGetBusinessContext = getBusinessContext as jest.MockedFunction<typeof getBusinessContext>;
      
      // Mock incomplete cleanup
      (mockSupabase.auth.getSession as jest.MockedFunction<typeof mockSupabase.auth.getSession>).mockResolvedValue({ 
        data: { session: mockSession as { user: { id: string } } }, 
        error: null 
      });
      mockGetBusinessContext.mockReturnValue(mockBusinessId);
      localStorageMock.setItem('current_business_id', mockBusinessId);
      localStorageMock.setItem('session_data', 'test_data');
      
      const validation = await validateLogoutCleanup();

      expect(validation.isComplete).toBe(false);
      expect(validation.issues).toContain('Supabase session still active');
      expect(validation.issues).toContain('Business context not cleared');
      expect(validation.issues.some(issue => issue.includes('current_business_id'))).toBe(true);
      expect(validation.issues.some(issue => issue.includes('session_data'))).toBe(true);
    });

    test('should handle validation errors', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      (mockSupabase.auth.getSession as jest.MockedFunction<typeof mockSupabase.auth.getSession>).mockRejectedValue(new Error('Network error'));
      
      const validation = await validateLogoutCleanup();

      expect(validation.isComplete).toBe(false);
      expect(validation.issues).toEqual(['Validation error: Network error']);
    });
  });

  describe('Emergency Logout Functionality', () => {
    test('should perform immediate emergency logout', async () => {
      // Set up session data
      localStorageMock.setItem('current_business_id', mockBusinessId);
      localStorageMock.setItem('session_data', 'critical_data');
      
      await emergencyLogout('security_threat');

      // Verify immediate cleanup
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
      expect(localStorageMock.getItem('session_data')).toBeNull();
      expect(mockLocation.replace).toHaveBeenCalledWith('/login?reason=security_threat');
    });

    test('should handle emergency logout with minimal cleanup on errors', async () => {
      // Mock console methods to avoid test output
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      // Set up data that might fail to clear
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      // Simulate error by making localStorage throw
      const originalRemoveItem = localStorageMock.removeItem;
      localStorageMock.removeItem = jest.fn().mockImplementation(() => {
        throw new Error('localStorage error');
      });

      await emergencyLogout();

      expect(mockLocation.replace).toHaveBeenCalledWith('/login');
      
      // Restore original function and console
      localStorageMock.removeItem = originalRemoveItem;
      consoleError.mockRestore();
    });
  });

  describe('Session Timeout Management', () => {
    test('should create session timeout manager with default config', () => {
      const timeoutManager = new SessionTimeoutManager();
      
      expect(timeoutManager.isEnabled()).toBe(true);
      
      const config = timeoutManager.getConfig();
      expect(config.timeoutMs).toBe(60 * 60 * 1000); // 1 hour
      expect(config.timeoutWarningMs).toBe(55 * 60 * 1000); // 55 minutes
      expect(config.checkIntervalMs).toBe(60 * 1000); // 1 minute
    });

    test('should start and stop timeout manager', () => {
      const onWarning = jest.fn();
      const onTimeout = jest.fn();
      
      const timeoutManager = new SessionTimeoutManager(
        { enabled: true },
        { onWarning, onTimeout }
      );
      
      // Start should set up timers
      timeoutManager.start();
      expect(timeoutManager.isEnabled()).toBe(true);
      
      // Stop should clear timers
      timeoutManager.stop();
    });

    test('should trigger warning and timeout callbacks', (done) => {
      const onWarning = jest.fn();
      const onTimeout = jest.fn();
      
      const timeoutManager = new SessionTimeoutManager(
        {
          timeoutWarningMs: 10, // 10ms for testing
          timeoutMs: 20, // 20ms for testing
          checkIntervalMs: 5, // 5ms for testing
        },
        { onWarning, onTimeout }
      );
      
      timeoutManager.start();
      
      // Check that warning is called
      setTimeout(() => {
        expect(onWarning).toHaveBeenCalled();
        timeoutManager.stop();
        done();
      }, 15);
    });

    test('should reset timeout on user activity', () => {
      const timeoutManager = new SessionTimeoutManager();
      
      timeoutManager.start();
      timeoutManager.resetTimeout();
      
      // Should update last activity time
      expect(localStorageMock.getItem('last_activity_time')).not.toBeNull();
      
      timeoutManager.stop();
    });

    test('should initialize global session timeout', () => {
      const config = { timeoutMs: 30 * 60 * 1000 }; // 30 minutes
      const callbacks = { onWarning: jest.fn(), onTimeout: jest.fn() };
      
      const manager = initializeSessionTimeout(config, callbacks);
      
      expect(manager).toBeInstanceOf(SessionTimeoutManager);
      expect(manager.getConfig().timeoutMs).toBe(30 * 60 * 1000);
      
      manager.stop();
    });
  });

  describe('Activity Tracking Setup', () => {
    test('should setup activity tracking event listeners', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      
      setupActivityTracking();
      
      const expectedEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      expectedEvents.forEach(event => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          true
        );
      });
      
      addEventListenerSpy.mockRestore();
    });
  });

  describe('Integration with Auth Context', () => {
    test('should integrate enhanced logout with auth service', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      
      // Set up mocks
      mockClearBusinessContext.mockResolvedValue({ success: true });
      (mockSupabase.auth.signOut as jest.MockedFunction<typeof mockSupabase.auth.signOut>).mockResolvedValue({ error: null });
      
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      const result = await auth.enhancedSignOut({
        clearBusinessContext: true,
        clearLocalStorage: true,
        redirectToLogin: false, // Don't redirect in test
      });

      expect(result.error).toBeNull();
      expect(result.cleanupResults).toBeDefined();
      expect(result.cleanupResults?.supabaseSession).toBe(true);
      expect(result.cleanupResults?.businessContext).toBe(true);
      expect(result.cleanupResults?.localStorage).toBe(true);
    });

    test('should handle enhanced logout errors in auth service', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      
      // Mock failure
      mockClearBusinessContext.mockResolvedValue({ 
        success: false, 
        error: 'Critical database error' 
      });
      (mockSupabase.auth.signOut as jest.MockedFunction<typeof mockSupabase.auth.signOut>).mockResolvedValue({ error: null });
      
      const result = await auth.enhancedSignOut();

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Critical database error');
    });
  });

  describe('Cross-Browser Tab Synchronization', () => {
    test('should handle logout synchronization across tabs', async () => {
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      mockClearBusinessContext.mockResolvedValue({ success: true });
      
      // Set up business context in multiple "tabs"
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      // Perform logout in one "tab"
      await enhancedLogout({
        redirectToLogin: false,
      });

      // Verify business context is cleared (simulating sync effect)
      expect(localStorageMock.getItem('current_business_id')).toBeNull();
    });

    test('should maintain logout state consistency', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      (mockSupabase.auth.signOut as jest.MockedFunction<typeof mockSupabase.auth.signOut>).mockResolvedValue({ error: null });
      (mockSupabase.auth.getSession as jest.MockedFunction<typeof mockSupabase.auth.getSession>).mockResolvedValue({ data: { session: null }, error: null });
      
      await enhancedLogout();
      
      // Check session after logout (simulating page refresh or tab switch)
      const { data } = await supabase.auth.getSession();
      expect(data.session).toBeNull();
      
      const validation = await validateLogoutCleanup();
      expect(validation.isComplete).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from partial cleanup failures', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      
      localStorageMock.setItem('current_business_id', mockBusinessId);
      
      // Mock business context failure but Supabase success
      mockClearBusinessContext.mockResolvedValue({ 
        success: false, 
        error: 'Database timeout' 
      });
      (mockSupabase.auth.signOut as jest.MockedFunction<typeof mockSupabase.auth.signOut>).mockResolvedValue({ error: null });
      
      const result = await enhancedLogout();
      
      // Should still perform localStorage cleanup and Supabase logout
      expect(result.cleanupResults?.localStorage).toBe(true);
      expect(result.cleanupResults?.supabaseSession).toBe(true);
      expect(result.cleanupResults?.businessContext).toBe(false);
      
      // Overall should be marked as failed due to business context failure
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Database timeout');
    });

    test('should provide detailed cleanup status for debugging', async () => {
      const mockSupabase = supabase as jest.Mocked<typeof supabase>;
      const mockClearBusinessContext = clearBusinessContext as jest.MockedFunction<typeof clearBusinessContext>;
      
      // Mock mixed success/failure
      mockClearBusinessContext.mockResolvedValue({ success: true });
      (mockSupabase.auth.signOut as jest.MockedFunction<typeof mockSupabase.auth.signOut>).mockRejectedValue(new Error('Network error'));
      
      const result = await enhancedLogout({
        redirectToLogin: false,
      });
      
      expect(result.cleanupResults).toEqual({
        supabaseSession: false,
        businessContext: true,
        localStorage: true,
        databaseContext: true,
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Network error');
    });
  });
});