import React from 'react';
import { render, screen } from '@testing-library/react';
import { BusinessLayout } from './layout';
import { BusinessSidebar } from './sidebar';

// Mock Next.js dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@heroicons/react/24/outline', () => {
  const MockIcon = ({ className, ...props }: { className?: string; [key: string]: unknown }) =>
    React.createElement('div', { className, 'data-testid': 'mock-icon', ...props });
  
  return {
    HomeIcon: MockIcon,
    UserGroupIcon: MockIcon,
    CogIcon: MockIcon,
    CalendarIcon: MockIcon,
    ClipboardDocumentListIcon: MockIcon,
    UsersIcon: MockIcon,
    XMarkIcon: MockIcon,
    Bars3Icon: MockIcon,
  };
});

// Mock auth context
jest.mock('@/lib/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    signOut: jest.fn(),
    getCurrentBusinessId: () => 'business-123',
  }),
}));

// Mock ProtectedRoute
jest.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Business Navigation Integration', () => {
  it('renders navigation components without errors', () => {
    render(
      <BusinessSidebar isOpen={true} onClose={jest.fn()} />
    );

    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
    expect(screen.getByText('Especialistas')).toBeInTheDocument();
    expect(screen.getByText('Servicios')).toBeInTheDocument();
  });

  it('renders business layout with navigation', () => {
    render(
      <BusinessLayout>
        <div>Test Content</div>
      </BusinessLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});