/**
 * Basic tests for the new Zustand Authentication Store
 */

import { useAuthStore } from './auth-store';

// Mock the auth and business context modules
jest.mock('./auth', () => ({
  auth: {
    isLikelyAuthenticated: jest.fn(() => false),
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signIn: jest.fn(),
    signOut: jest.fn(),
    enhancedSignOut: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  }
}));

jest.mock('./business-context', () => ({
  businessContext: {
    getCurrentBusinessId: jest.fn(() => null),
    clearBusinessContext: jest.fn(() => Promise.resolve()),
    setBusinessContext: jest.fn(() => Promise.resolve({ success: true })),
    getCurrentBusinessIdAsync: jest.fn(() => Promise.resolve(null)),
  }
}));

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with the correct default state', () => {
    const store = useAuthStore.getState();
    
    expect(store.status).toBe('initializing');
    expect(store.user).toBe(null);
    expect(store.businessId).toBe(null);
    expect(store.error).toBe(null);
    expect(store.isLoading).toBe(true);
  });

  it('should have all required methods', () => {
    const store = useAuthStore.getState();
    
    // Check that all required methods exist
    expect(typeof store.initialize).toBe('function');
    expect(typeof store.signIn).toBe('function');
    expect(typeof store.signUp).toBe('function');
    expect(typeof store.signOut).toBe('function');
    expect(typeof store.enhancedSignOut).toBe('function');
    expect(typeof store.setBusinessContext).toBe('function');
    expect(typeof store.getCurrentBusinessId).toBe('function');
    expect(typeof store.getCurrentBusinessIdAsync).toBe('function');
    expect(typeof store.refreshSession).toBe('function');
  });

  it('should update state when _setUnauthenticated is called', () => {
    const store = useAuthStore.getState();
    const error = { message: 'Test error' };
    
    store._setUnauthenticated(error);
    
    const newState = useAuthStore.getState();
    expect(newState.status).toBe('unauthenticated');
    expect(newState.user).toBe(null);
    expect(newState.businessId).toBe(null);
    expect(newState.error).toEqual(error);
    expect(newState.isLoading).toBe(false);
  });

  it('should update state when _setAuthenticated is called', () => {
    const store = useAuthStore.getState();
    const user = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    };
    const businessId = 'test-business-id';
    
    store._setAuthenticated(user, businessId);
    
    const newState = useAuthStore.getState();
    expect(newState.status).toBe('authenticated');
    expect(newState.user).toEqual(user);
    expect(newState.businessId).toBe(businessId);
    expect(newState.error).toBe(null);
    expect(newState.isLoading).toBe(false);
  });
});