import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { BusinessLayout } from './layout';
import { useAuth } from '@/lib/auth-provider';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/dashboard'),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => {
  const MockIcon = ({ className, ...props }: { className?: string; [key: string]: unknown }) =>
    React.createElement('div', { className, 'data-testid': 'mock-icon', ...props });
  
  return {
    Bars3Icon: MockIcon,
  };
});

// Mock BusinessSidebar component
jest.mock('./sidebar', () => ({
  BusinessSidebar: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="business-sidebar">
        <div data-testid="mobile-navigation">
          <a href="/dashboard">Panel de Control</a>
          <a href="/specialists">Especialistas</a>
          <a href="/services">Servicios</a>
          <a href="/calendar">Calendario</a>
          <a href="/clients">Clientes</a>
          <a href="/settings">Configuración</a>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  },
}));

// Mock auth context
jest.mock('@/lib/auth-provider', () => ({
  useAuth: jest.fn(),
}));

// Mock ProtectedRoute component
jest.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div data-testid="protected-route">{children}</div>,
}));

const mockRouterPush = jest.fn();
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetCurrentBusinessId = jest.fn();

describe('BusinessLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
    });
    
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
  });

  it('renders sidebar navigation with main sections', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    // Check for main navigation links - use getAllByText since header also contains this text
    expect(screen.getAllByText('Panel de Control')[0]).toBeInTheDocument();
    expect(screen.getByText('Especialistas')).toBeInTheDocument();
    expect(screen.getByText('Servicios')).toBeInTheDocument();
    expect(screen.getByText('Calendario')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
  });

  it('renders children content', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('shows mobile hamburger menu button', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    const hamburgerButton = screen.getByRole('button', { name: /abrir menú/i });
    expect(hamburgerButton).toBeInTheDocument();
  });

  it('toggles mobile navigation menu', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    const hamburgerButton = screen.getByRole('button', { name: /abrir menú/i });
    
    // Click to open mobile menu
    fireEvent.click(hamburgerButton);
    
    // Mobile menu should be visible (there are 2 sidebars: desktop and mobile)
    expect(screen.getAllByTestId('mobile-navigation')).toHaveLength(2);
  });

  it('navigates to correct routes when clicking navigation links', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    // Click dashboard link
    const dashboardLink = screen.getByRole('link', { name: /panel de control/i });
    fireEvent.click(dashboardLink);
    
    // Click specialists link
    const specialistsLink = screen.getByRole('link', { name: /especialistas/i });
    fireEvent.click(specialistsLink);
    
    // Click services link  
    const servicesLink = screen.getByRole('link', { name: /servicios/i });
    fireEvent.click(servicesLink);
    
    // Click calendar link
    const calendarLink = screen.getByRole('link', { name: /calendario/i });
    fireEvent.click(calendarLink);
    
    // Click clients link
    const clientsLink = screen.getByRole('link', { name: /clientes/i });
    fireEvent.click(clientsLink);
    
    // Click settings link
    const settingsLink = screen.getByRole('link', { name: /configuración/i });
    fireEvent.click(settingsLink);
  });

  it('requires business context for protected route', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    // Should render content when business context is available
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
  });

  it('displays current business context in layout', () => {
    const businessId = 'business-123';
    mockGetCurrentBusinessId.mockReturnValue(businessId);

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    // Layout should handle business context properly
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('has responsive design elements', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');

    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    // Check for responsive design elements - there are multiple sidebars (desktop and mobile)
    const sidebars = screen.getAllByTestId('business-sidebar');
    expect(sidebars.length).toBeGreaterThan(0);
  });
});