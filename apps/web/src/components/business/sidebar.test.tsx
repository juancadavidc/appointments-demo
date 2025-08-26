import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
import { BusinessSidebar } from './sidebar';
import { useAuth } from '@/lib/auth-provider';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
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
  function MockIcon(props: { [key: string]: unknown }) {
    return <div data-testid="mock-icon" {...props} />;
  }
  
  return {
    HomeIcon: MockIcon,
    UserGroupIcon: MockIcon,
    CogIcon: MockIcon,
    CalendarIcon: MockIcon,
    ClipboardDocumentListIcon: MockIcon,
    UsersIcon: MockIcon,
    XMarkIcon: MockIcon,
    Bars3Icon: MockIcon,
    ExclamationTriangleIcon: MockIcon,
  };
});

// Mock auth context
jest.mock('@/lib/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const mockRouterPush = jest.fn();
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockGetCurrentBusinessId = jest.fn();

describe('BusinessSidebar', () => {
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

  it('renders all navigation links', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    expect(screen.getByText('Especialistas')).toBeInTheDocument();
    expect(screen.getByText('Servicios')).toBeInTheDocument();
    expect(screen.getByText('Calendario')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
  });

  it('highlights active navigation link', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    const dashboardLink = screen.getByRole('link', { name: /panel de control/i });
    expect(dashboardLink).toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('shows different active state for specialists page', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/specialists');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    const specialistsLink = screen.getByRole('link', { name: /especialistas/i });
    expect(specialistsLink).toHaveClass('bg-blue-50', 'text-blue-700');
  });

  it('calls onClose when clicking outside on mobile', () => {
    const mockOnClose = jest.fn();
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={mockOnClose} />);

    // Click the overlay
    const overlay = screen.getByTestId('sidebar-overlay');
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('displays business logo and name', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Mi Negocio')).toBeInTheDocument();
  });

  it('shows sign out button', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument();
  });

  it('shows logout confirmation dialog when sign out is clicked', () => {
    const mockEnhancedSignOut = jest.fn();
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');
    
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: mockEnhancedSignOut,
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    const signOutButton = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(signOutButton);

    // Should show confirmation dialog
    expect(screen.getByText(/¿Estás seguro de que deseas cerrar sesión?/)).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
    expect(screen.getByText('Sí, Cerrar Sesión')).toBeInTheDocument();
    
    // Should not call enhancedSignOut yet
    expect(mockEnhancedSignOut).not.toHaveBeenCalled();
  });

  it('cancels logout when cancel button is clicked', () => {
    const mockEnhancedSignOut = jest.fn();
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');
    
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: mockEnhancedSignOut,
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    // Click sign out button
    const signOutButton = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(signOutButton);

    // Click cancel button
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    // Dialog should be gone
    expect(screen.queryByText(/¿Estás seguro de que deseas cerrar sesión?/)).not.toBeInTheDocument();
    
    // Should not call enhancedSignOut
    expect(mockEnhancedSignOut).not.toHaveBeenCalled();
  });

  it('calls enhancedSignOut when logout is confirmed', async () => {
    const mockEnhancedSignOut = jest.fn().mockResolvedValue({ error: null });
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');
    
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: mockEnhancedSignOut,
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    // Click sign out button
    const signOutButton = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(signOutButton);

    // Click confirm button
    const confirmButton = screen.getByText('Sí, Cerrar Sesión');
    fireEvent.click(confirmButton);

    // Should call enhancedSignOut with correct config
    expect(mockEnhancedSignOut).toHaveBeenCalledWith({
      clearBusinessContext: true,
      clearLocalStorage: true,
      redirectToLogin: true,
      redirectUrl: '/login?reason=logout'
    });
  });

  it('shows loading state during logout', async () => {
    const mockEnhancedSignOut = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
    );
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');
    
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: mockEnhancedSignOut,
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    // Initial state
    expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument();

    // Click sign out and confirm
    const signOutButton = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(signOutButton);
    
    const confirmButton = screen.getByText('Sí, Cerrar Sesión');
    fireEvent.click(confirmButton);

    // Should show loading state
    expect(screen.getByText('Cerrando Sesión...')).toBeInTheDocument();
    expect(signOutButton).toBeDisabled();
  });

  it('shows error toast when logout fails', async () => {
    const mockEnhancedSignOut = jest.fn().mockResolvedValue({ 
      error: { message: 'Network error' } 
    });
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');
    
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: mockEnhancedSignOut,
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    // Click sign out and confirm
    const signOutButton = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(signOutButton);
    
    const confirmButton = screen.getByText('Sí, Cerrar Sesión');
    fireEvent.click(confirmButton);

    // Wait for error to show
    await screen.findByText('Network error');
    
    // Should show error toast
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('dismisses error toast when X is clicked', async () => {
    const mockEnhancedSignOut = jest.fn().mockResolvedValue({ 
      error: { message: 'Network error' } 
    });
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');
    
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      isInitialized: true,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      enhancedSignOut: mockEnhancedSignOut,
      refreshSession: jest.fn(),
      setBusinessContext: jest.fn(),
      getCurrentBusinessId: mockGetCurrentBusinessId,
      getCurrentBusinessIdAsync: jest.fn(),
      initializeSessionTimeout: jest.fn(),
      resetSessionTimeout: jest.fn(),
      stopSessionTimeout: jest.fn(),
    });

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    // Trigger error
    const signOutButton = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(signOutButton);
    
    const confirmButton = screen.getByText('Sí, Cerrar Sesión');
    fireEvent.click(confirmButton);

    // Wait for error to show
    await screen.findByText('Network error');
    
    // Click dismiss button
    const dismissButton = screen.getByRole('button', { name: '' });
    fireEvent.click(dismissButton);

    // Error should be gone
    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });

  it('has correct navigation hrefs', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByRole('link', { name: /panel de control/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /especialistas/i })).toHaveAttribute('href', '/specialists');
    expect(screen.getByRole('link', { name: /servicios/i })).toHaveAttribute('href', '/services');
    expect(screen.getByRole('link', { name: /calendario/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /clientes/i })).toHaveAttribute('href', '/clients');
    expect(screen.getByRole('link', { name: /configuración/i })).toHaveAttribute('href', '/settings');
  });

  it('renders with correct responsive classes', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    const sidebar = screen.getByTestId('business-sidebar');
    expect(sidebar).toHaveClass('fixed', 'inset-y-0', 'left-0', 'z-50', 'w-64', 'bg-white', 'shadow-lg');
  });

  it('shows when isOpen is true', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={true} onClose={jest.fn()} />);

    const sidebar = screen.getByTestId('business-sidebar');
    expect(sidebar).toBeInTheDocument();
  });

  it('is hidden when isOpen is false', () => {
    mockGetCurrentBusinessId.mockReturnValue('business-123');
    mockUsePathname.mockReturnValue('/dashboard');

    render(<BusinessSidebar isOpen={false} onClose={jest.fn()} />);

    const sidebar = screen.queryByTestId('business-sidebar');
    expect(sidebar).not.toBeInTheDocument();
  });
});