import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import BusinessDashboardPage from './page';
import { useAuth } from '@/lib/auth-provider';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/dashboard'),
}));

// Mock auth context
jest.mock('@/lib/auth-provider', () => ({
  useAuth: jest.fn(),
}));

// Mock ProtectedRoute component
jest.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => children,
}));

// BusinessLayout is now handled at the route group level

const mockRouterPush = jest.fn();
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetCurrentBusinessId = jest.fn();

describe('BusinessDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
    });
  });

  it('renders business dashboard page', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: jest.fn(),
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessDashboardPage />);

    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    expect(screen.getByText('Resumen de tu negocio')).toBeInTheDocument();
  });

  it('displays dashboard welcome message', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: jest.fn(),
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessDashboardPage />);

    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    expect(screen.getByText('Resumen de tu negocio')).toBeInTheDocument();
  });

  it('renders dashboard with business context validation', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: jest.fn(),
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessDashboardPage />);

    // Should render dashboard content when business context is available
    expect(screen.getByText('¡Bienvenido a tu panel de control!')).toBeInTheDocument();
  });

  it('handles missing business context', () => {
    mockGetCurrentBusinessId.mockReturnValue(null);
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: jest.fn(),
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessDashboardPage />);

    // Should still render dashboard content
    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
  });
});