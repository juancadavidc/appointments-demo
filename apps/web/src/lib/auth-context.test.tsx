import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth, useRequireAuth, useRequireBusinessContext } from './auth-provider';
import { auth, businessContext } from './auth';

// Mock auth module
jest.mock('./auth', () => ({
  auth: {
    getSession: jest.fn(),
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    setBusinessContext: jest.fn(),
    onAuthStateChange: jest.fn(),
  },
  businessContext: {
    getCurrentBusinessId: jest.fn(),
    validateBusinessContext: jest.fn(),
    setDatabaseBusinessContext: jest.fn(),
    clearBusinessContext: jest.fn(),
  },
}));

// Mock window.location
const mockLocation = {
  href: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
};

// Mock location assignment more thoroughly
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

const mockAuth = auth as jest.Mocked<typeof auth>;
const mockBusinessContext = businessContext as jest.Mocked<typeof businessContext>;

// Test component to access auth context
function TestComponent() {
  const { user, isLoading, isInitialized } = useAuth();
  
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not loading'}</div>
      <div data-testid="initialized">{isInitialized ? 'Initialized' : 'Not initialized'}</div>
    </div>
  );
}

// Test component for useRequireAuth hook
function ProtectedComponent() {
  const { user, isAuthenticated } = useRequireAuth();
  
  return (
    <div>
      <div data-testid="protected-user">{user ? user.email : 'No user'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Authenticated' : 'Not authenticated'}</div>
    </div>
  );
}

// Test component for useRequireBusinessContext hook
function BusinessProtectedComponent() {
  const { user, businessId, hasBusinessContext } = useRequireBusinessContext();
  
  return (
    <div>
      <div data-testid="business-user">{user ? user.email : 'No user'}</div>
      <div data-testid="business-id">{businessId || 'No business'}</div>
      <div data-testid="has-business">{hasBusinessContext ? 'Has business' : 'No business'}</div>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
  });

  it('initializes with no user and loading state', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { id: 'test-id', callback: jest.fn(), unsubscribe: jest.fn() } }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('No user');
    expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    expect(screen.getByTestId('initialized')).toHaveTextContent('Not initialized');

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('Initialized');
    });
  });

  it('initializes with existing session', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    };
    const mockSession = { 
      user: mockUser,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer'
    };

    mockAuth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    mockBusinessContext.getCurrentBusinessId.mockReturnValue('business-123');
    mockBusinessContext.validateBusinessContext.mockResolvedValue({
      valid: true,
      error: null
    });
    mockBusinessContext.setDatabaseBusinessContext.mockResolvedValue({
      error: null
    });
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { id: 'test-id', callback: jest.fn(), unsubscribe: jest.fn() } }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('initialized')).toHaveTextContent('Initialized');
    });

    expect(mockBusinessContext.validateBusinessContext).toHaveBeenCalledWith('user-123', 'business-123');
    expect(mockBusinessContext.setDatabaseBusinessContext).toHaveBeenCalledWith('business-123');
  });

  it('clears invalid business context on initialization', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    };
    const mockSession = { 
      user: mockUser,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer'
    };

    mockAuth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    mockBusinessContext.getCurrentBusinessId.mockReturnValue('business-123');
    mockBusinessContext.validateBusinessContext.mockResolvedValue({
      valid: false,
      error: { message: 'Invalid business context', status: 403 }
    });
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { id: 'test-id', callback: jest.fn(), unsubscribe: jest.fn() } }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('Initialized');
    });

    expect(mockBusinessContext.clearBusinessContext).toHaveBeenCalled();
  });

  it('handles auth state changes', async () => {
    let authStateCallback: ((user: { id: string; email: string; name: string; businessId: string }) => void) | undefined;

    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    mockAuth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { id: 'test-id', callback: jest.fn(), unsubscribe: jest.fn() } } };
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('Initialized');
    });

    // Simulate auth state change
    act(() => {
      if (authStateCallback) {
        authStateCallback({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          businessId: 'business-123'
        });
      }
    });

    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });
});

describe('useAuth hook', () => {
  it('throws error when used outside AuthProvider', () => {
    const TestComponentOutsideProvider = () => {
      useAuth();
      return null;
    };

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponentOutsideProvider />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});

describe('useRequireAuth hook', () => {
  beforeEach(() => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { id: 'test-id', callback: jest.fn(), unsubscribe: jest.fn() } }
    });
  });

  it('redirects to login when user is not authenticated', async () => {
    render(
      <AuthProvider>
        <ProtectedComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockLocation.href).toBe('/login');
    });
  });

  it('does not redirect when user is authenticated', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    };
    const mockSession = { 
      user: mockUser,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer'
    };

    mockAuth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    mockBusinessContext.getCurrentBusinessId.mockReturnValue(null);

    render(
      <AuthProvider>
        <ProtectedComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-user')).toHaveTextContent('test@example.com');
    });

    expect(mockLocation.href).toBe('');
  });
});

describe('useRequireBusinessContext hook', () => {
  beforeEach(() => {
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { id: 'test-id', callback: jest.fn(), unsubscribe: jest.fn() } }
    });
  });

  it('redirects to business registration when user has no business context', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    };
    const mockSession = { 
      user: mockUser,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer'
    };

    mockAuth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    mockBusinessContext.getCurrentBusinessId.mockReturnValue(null);

    render(
      <AuthProvider>
        <BusinessProtectedComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockLocation.href).toBe('/register/business');
    });
  });

  it('does not redirect when user has business context', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {},
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    };
    const mockSession = { 
      user: mockUser,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer'
    };

    mockAuth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    mockBusinessContext.getCurrentBusinessId.mockReturnValue('business-123');
    mockBusinessContext.validateBusinessContext.mockResolvedValue({
      valid: true,
      error: null
    });
    mockBusinessContext.setDatabaseBusinessContext.mockResolvedValue({
      error: null
    });

    render(
      <AuthProvider>
        <BusinessProtectedComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('business-user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('business-id')).toHaveTextContent('business-123');
      expect(screen.getByTestId('has-business')).toHaveTextContent('Has business');
    });

    expect(mockLocation.href).toBe('');
  });
});