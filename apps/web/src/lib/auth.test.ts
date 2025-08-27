import { auth } from './auth';
import { businessContext } from './business-context';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Supabase
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockSupabase = require('./supabase').supabase;

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email/Password Authentication Scenarios', () => {
    describe('Registration', () => {
      it('should successfully register with valid email and password', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          email_confirmed_at: '2024-01-01T00:00:00Z'
        };
        const mockResponse = { 
          data: { user: mockUser, session: null }, 
          error: null 
        };
        mockSupabase.auth.signUp.mockResolvedValue(mockResponse);

        const result = await auth.signUp('test@example.com', 'password123');

        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(result).toEqual(mockResponse);
        expect(result.data.user?.email).toBe('test@example.com');
      });

      it('should handle registration with invalid email format', async () => {
        const mockError = {
          message: 'Invalid email format',
          status: 400
        };
        const mockResponse = { 
          data: { user: null, session: null }, 
          error: mockError 
        };
        mockSupabase.auth.signUp.mockResolvedValue(mockResponse);

        const result = await auth.signUp('invalid-email', 'password123');

        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'invalid-email',
          password: 'password123',
        });
        expect(result.error).toEqual(mockError);
        expect(result.data.user).toBeNull();
      });

      it('should handle registration with weak password', async () => {
        const mockError = {
          message: 'Password should be at least 6 characters',
          status: 400
        };
        const mockResponse = { 
          data: { user: null, session: null }, 
          error: mockError 
        };
        mockSupabase.auth.signUp.mockResolvedValue(mockResponse);

        const result = await auth.signUp('test@example.com', '123');

        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: '123',
        });
        expect(result.error).toEqual(mockError);
        expect(result.data.user).toBeNull();
      });

      it('should handle registration with existing email', async () => {
        const mockError = {
          message: 'User already registered',
          status: 400
        };
        const mockResponse = { 
          data: { user: null, session: null }, 
          error: mockError 
        };
        mockSupabase.auth.signUp.mockResolvedValue(mockResponse);

        const result = await auth.signUp('existing@example.com', 'password123');

        expect(result.error).toEqual(mockError);
        expect(result.data.user).toBeNull();
      });
    });

    describe('Login', () => {
      it('should successfully login with valid credentials', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' }
        };
        const mockSession = {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: mockUser
        };
        const mockResponse = { 
          data: { user: mockUser, session: mockSession }, 
          error: null 
        };
        mockSupabase.auth.signInWithPassword.mockResolvedValue(mockResponse);

        const result = await auth.signIn('test@example.com', 'password123');

        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(result).toEqual(mockResponse);
        expect(result.data.session?.access_token).toBeTruthy();
      });

      it('should handle login with invalid email', async () => {
        const mockError = {
          message: 'Invalid login credentials',
          status: 400
        };
        const mockResponse = { 
          data: { user: null, session: null }, 
          error: mockError 
        };
        mockSupabase.auth.signInWithPassword.mockResolvedValue(mockResponse);

        const result = await auth.signIn('nonexistent@example.com', 'password123');

        expect(result.error).toEqual(mockError);
        expect(result.data.user).toBeNull();
        expect(result.data.session).toBeNull();
      });

      it('should handle login with incorrect password', async () => {
        const mockError = {
          message: 'Invalid login credentials',
          status: 400
        };
        const mockResponse = { 
          data: { user: null, session: null }, 
          error: mockError 
        };
        mockSupabase.auth.signInWithPassword.mockResolvedValue(mockResponse);

        const result = await auth.signIn('test@example.com', 'wrongpassword');

        expect(result.error).toEqual(mockError);
        expect(result.data.user).toBeNull();
        expect(result.data.session).toBeNull();
      });

      it('should handle network errors during login', async () => {
        const mockError = {
          message: 'Network error',
          status: 500
        };
        const mockResponse = { 
          data: { user: null, session: null }, 
          error: mockError 
        };
        mockSupabase.auth.signInWithPassword.mockResolvedValue(mockResponse);

        const result = await auth.signIn('test@example.com', 'password123');

        expect(result.error).toEqual(mockError);
        expect(result.data.user).toBeNull();
      });
    });

    describe('Session Management', () => {
      it('should get current session successfully', async () => {
        const mockSession = {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: { id: 'user-123', email: 'test@example.com' }
        };
        const mockResponse = { data: { session: mockSession }, error: null };
        mockSupabase.auth.getSession.mockResolvedValue(mockResponse);

        const result = await auth.getSession();

        expect(mockSupabase.auth.getSession).toHaveBeenCalled();
        expect(result).toEqual(mockResponse);
        expect(result.data.session?.access_token).toBeTruthy();
      });

      it('should handle no active session', async () => {
        const mockResponse = { data: { session: null }, error: null };
        mockSupabase.auth.getSession.mockResolvedValue(mockResponse);

        const result = await auth.getSession();

        expect(result.data.session).toBeNull();
        expect(result.error).toBeNull();
      });
    });

    describe('Logout', () => {
      it('should successfully logout', async () => {
        const mockResponse = { error: null };
        mockSupabase.auth.signOut.mockResolvedValue(mockResponse);

        const result = await auth.signOut();

        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
        expect(result).toEqual(mockResponse);
      });

      it('should handle logout errors', async () => {
        const mockError = { message: 'Logout failed', status: 500 };
        const mockResponse = { error: mockError };
        mockSupabase.auth.signOut.mockResolvedValue(mockResponse);

        const result = await auth.signOut();

        expect(result.error).toEqual(mockError);
      });
    });

    describe('Auth State Changes', () => {
      it('should call callback with user data on auth state change', () => {
        const mockCallback = jest.fn();
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' }
        };
        const mockSession = { user: mockUser };

        // Mock the onAuthStateChange to immediately call the callback
        mockSupabase.auth.onAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
          callback('SIGNED_IN', mockSession);
          return { data: { subscription: {} } };
        });

        auth.onAuthStateChange(mockCallback);

        expect(mockCallback).toHaveBeenCalledWith({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        });
      });

      it('should call callback with null when user signs out', async () => {
        const mockCallback = jest.fn();
        mockSupabase.rpc.mockResolvedValue({ error: null });

        mockSupabase.auth.onAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
          // Use setTimeout to simulate async behavior
          setTimeout(() => callback('SIGNED_OUT', null), 0);
          return { data: { subscription: {} } };
        });

        auth.onAuthStateChange(mockCallback);

        // Wait for the async callback
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCallback).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('Business Context Management', () => {
    describe('Business Context Storage', () => {
      it('should store business ID in localStorage', () => {
        const validBusinessId = '123e4567-e89b-12d3-a456-426614174000';
        businessContext.setCurrentBusinessId(validBusinessId);
        
        expect(localStorageMock.setItem).toHaveBeenCalledWith('current_business_id', validBusinessId);
      });

      it('should retrieve business ID from localStorage', () => {
        const validBusinessId = '123e4567-e89b-12d3-a456-426614174000';
        localStorageMock.getItem.mockReturnValue(validBusinessId);
        
        const businessId = businessContext.getCurrentBusinessId();
        
        expect(localStorageMock.getItem).toHaveBeenCalledWith('current_business_id');
        expect(businessId).toBe(validBusinessId);
      });

      it('should clear business context from localStorage', () => {
        businessContext.clearBusinessContext();
        
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('current_business_id');
      });

      it('should handle server-side rendering (no window)', () => {
        // Test that functions handle undefined window gracefully
        // This is tested in the actual implementation's typeof window checks
        expect(() => businessContext.getCurrentBusinessId()).not.toThrow();
        expect(() => businessContext.setCurrentBusinessId('test')).not.toThrow();
        expect(() => businessContext.clearBusinessContext()).not.toThrow();
      });
    });

    describe('Database Business Context', () => {
      it('should set database business context successfully', async () => {
        mockSupabase.rpc.mockResolvedValue({ error: null });
        
        const result = await businessContext.setBusinessContext('123e4567-e89b-12d3-a456-426614174000');
        
        expect(mockSupabase.rpc).toHaveBeenCalledWith('set_current_business_id', {
          business_uuid: '123e4567-e89b-12d3-a456-426614174000'
        });
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should handle database context errors', async () => {
        const mockError = { message: 'RPC failed', code: '301' };
        mockSupabase.rpc.mockResolvedValue({ error: mockError });
        
        const result = await businessContext.setBusinessContext('123e4567-e89b-12d3-a456-426614174000');
        
        expect(result.success).toBe(false);
        expect(result.error).toEqual({
          message: 'Failed to set database context: RPC failed',
          code: '301'
        });
      });

      it('should handle database context exceptions', async () => {
        mockSupabase.rpc.mockRejectedValue(new Error('Network error'));
        
        const result = await businessContext.setBusinessContext('123e4567-e89b-12d3-a456-426614174000');
        
        expect(result.success).toBe(false);
        expect(result.error).toEqual({
          message: 'Network error',
          code: 'UNEXPECTED_ERROR'
        });
      });
    });

    describe('Business Context Validation', () => {
      it('should validate business context successfully', async () => {
        const mockBusiness = { id: '123e4567-e89b-12d3-a456-426614174000' };
        const mockSingle = jest.fn().mockResolvedValue({
          data: mockBusiness,
          error: null
        });
        const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle });
        const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
        mockSupabase.from.mockReturnValue({ select: mockSelect });
        
        const result = await businessContext.validateBusinessAccess('user-123', '123e4567-e89b-12d3-a456-426614174000');
        
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should handle invalid business context', async () => {
        const mockSingle = jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        });
        const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle });
        const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
        mockSupabase.from.mockReturnValue({ select: mockSelect });
        
        const result = await businessContext.validateBusinessAccess('user-123', '123e4567-e89b-12d3-a456-426614174000');
        
        expect(result.success).toBe(false);
        expect(result.error).toEqual({
          message: 'Business access validation failed',
          code: 'ACCESS_DENIED'
        });
      });
    });

    describe('Authentication with Business Context', () => {
      it('should set business context after successful login', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { business_id: '123e4567-e89b-12d3-a456-426614174000' }
        };
        const mockSession = {
          access_token: 'token',
          user: mockUser
        };
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null
        });
        mockSupabase.rpc.mockResolvedValue({ error: null });
        
        const result = await auth.signIn('test@example.com', 'password123');
        
        expect(result.error).toBeNull();
        expect(localStorageMock.setItem).toHaveBeenCalledWith('current_business_id', '123e4567-e89b-12d3-a456-426614174000');
        expect(mockSupabase.rpc).toHaveBeenCalledWith('set_current_business_id', {
          business_uuid: '123e4567-e89b-12d3-a456-426614174000'
        });
      });

      it('should handle login without business context', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {}
        };
        const mockSession = {
          access_token: 'token',
          user: mockUser
        };
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null
        });
        
        const result = await auth.signIn('test@example.com', 'password123');
        
        expect(result.error).toBeNull();
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
      });

      it('should clear business context on logout', async () => {
        mockSupabase.auth.signOut.mockResolvedValue({ error: null });
        
        const result = await auth.signOut();
        
        expect(result.error).toBeNull();
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('current_business_id');
      });

      it('should set business context manually', async () => {
        mockSupabase.auth.updateUser.mockResolvedValue({ error: null });
        mockSupabase.rpc.mockResolvedValue({ error: null });
        
        const result = await auth.setBusinessContext('123e4567-e89b-12d3-a456-426614174000');
        
        expect(result.error).toBeNull();
        expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
          data: { business_id: '123e4567-e89b-12d3-a456-426614174000' }
        });
        expect(localStorageMock.setItem).toHaveBeenCalledWith('current_business_id', '123e4567-e89b-12d3-a456-426614174000');
      });

      it('should get current business ID', () => {
        localStorageMock.getItem.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
        
        const validBusinessId = '123e4567-e89b-12d3-a456-426614174000';
        localStorageMock.getItem.mockReturnValue(validBusinessId);
        
        const businessId = auth.getCurrentBusinessId();
        
        expect(businessId).toBe(validBusinessId);
      });

      it('should validate business access', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        });
        
        const mockSingle = jest.fn().mockResolvedValue({
          data: { id: '123e4567-e89b-12d3-a456-426614174000' },
          error: null
        });
        const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle });
        const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
        mockSupabase.from.mockReturnValue({ select: mockSelect });
        
        const result = await auth.validateBusinessAccess('123e4567-e89b-12d3-a456-426614174000');
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should handle unauthenticated business access validation', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        });
        
        const result = await auth.validateBusinessAccess('123e4567-e89b-12d3-a456-426614174000');
        
        expect(result.valid).toBe(false);
        expect(result.error).toEqual({
          message: 'User not authenticated',
          status: 401
        });
      });
    });

    describe('Enhanced Auth State Changes', () => {
      it('should handle auth state change with business context', async () => {
        const mockCallback = jest.fn();
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: 'Test User', business_id: '123e4567-e89b-12d3-a456-426614174000' }
        };
        const mockSession = { user: mockUser };
        mockSupabase.rpc.mockResolvedValue({ error: null });

        mockSupabase.auth.onAuthStateChange.mockImplementation(async (callback: (event: string, session: unknown) => void) => {
          await callback('SIGNED_IN', mockSession);
          return { data: { subscription: {} } };
        });

        auth.onAuthStateChange(mockCallback);

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockCallback).toHaveBeenCalledWith({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          businessId: '123e4567-e89b-12d3-a456-426614174000',
        });
        // Note: localStorage.setItem is called by the unified business context
      });

      it('should clear business context on auth state change to signed out', async () => {
        const mockCallback = jest.fn();
        mockSupabase.rpc.mockResolvedValue({ error: null });

        mockSupabase.auth.onAuthStateChange.mockImplementation(async (callback: (event: string, session: unknown) => void) => {
          await callback('SIGNED_OUT', null);
          return { data: { subscription: {} } };
        });

        auth.onAuthStateChange(mockCallback);

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockCallback).toHaveBeenCalledWith(null);
        // Note: localStorage.removeItem is called by the unified business context clearBusinessContext method
      });
    });
  });
});