'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { 
  HomeIcon, 
  UserGroupIcon, 
  CogIcon, 
  CalendarIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface BusinessSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Panel de Control', href: '/dashboard', icon: HomeIcon },
  { name: 'Especialistas', href: '/specialists', icon: UserGroupIcon },
  { name: 'Servicios', href: '/services', icon: ClipboardDocumentListIcon },
  { name: 'Calendario', href: '/calendar', icon: CalendarIcon },
  { name: 'Clientes', href: '/clients', icon: UsersIcon },
  { name: 'Configuración', href: '/settings', icon: CogIcon },
];

export function BusinessSidebar({ isOpen, onClose }: BusinessSidebarProps) {
  const pathname = usePathname();
  const { enhancedSignOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleSignOutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleSignOutConfirm = async () => {
    console.log('🔐 LOGOUT STEP 1: User confirmed logout, starting process...');
    setIsLoggingOut(true);
    setLogoutError(null);
    setShowLogoutConfirm(false);
    
    try {
      console.log('🔐 LOGOUT STEP 2: Calling enhancedSignOut with config:', {
        clearBusinessContext: true,
        clearLocalStorage: true,
        redirectToLogin: true,
        redirectUrl: '/login?logout=true'
      });
      
      const result = await enhancedSignOut({
        clearBusinessContext: true,
        clearLocalStorage: true,
        redirectToLogin: true,
        redirectUrl: '/login?logout=true'
      });
      
      console.log('🔐 LOGOUT STEP 3: Enhanced logout result:', result);
      
      if (result.error) {
        console.error('🔐 LOGOUT STEP 4: Enhanced logout failed:', result.error);
        console.log('🔐 LOGOUT STEP 4a: Cleanup results:', result.cleanupResults);
        setLogoutError(result.error.message);
        setIsLoggingOut(false);
      } else {
        console.log('🔐 LOGOUT STEP 4: Enhanced logout successful, cleanup results:', result.cleanupResults);
        console.log('🔐 LOGOUT STEP 5: Waiting for automatic redirect...');
        // Redirect will happen automatically via enhancedSignOut
      }
    } catch (error) {
      console.error('🔐 LOGOUT STEP 6: Unexpected error during logout:', error);
      setLogoutError('Error inesperado durante el cierre de sesión');
      setIsLoggingOut(false);
      
      // Force redirect even on error
      try {
        console.log('🔐 LOGOUT STEP 7: Force redirecting to login...');
        window.location.replace('/login?logout=true');
      } catch (redirectError) {
        console.error('🔐 LOGOUT STEP 8: Failed to redirect after error:', redirectError);
      }
    }
  };

  const handleSignOutCancel = () => {
    setShowLogoutConfirm(false);
  };

  const handleErrorDismiss = () => {
    setLogoutError(null);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
        onClick={onClose}
        data-testid="sidebar-overlay"
      />
      
      {/* Sidebar */}
      <div 
        className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0"
        data-testid="business-sidebar"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MN</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Mi Negocio</p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <button
            className="lg:hidden -mr-2 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  isActive
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-3 py-2 text-sm font-medium border-l-4 transition-colors duration-150 ease-in-out`}
                onClick={() => {
                  // Close mobile menu when navigation item is clicked
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    onClose();
                  }
                }}
              >
                <item.icon
                  className={`${
                    isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 h-5 w-5 transition-colors duration-150 ease-in-out`}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Sign out button */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200">
          <button
            onClick={handleSignOutClick}
            disabled={isLoggingOut}
            className={`group flex w-full items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out ${
              isLoggingOut
                ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {isLoggingOut ? (
              <svg
                className="mr-3 h-5 w-5 text-gray-400 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            )}
            {isLoggingOut ? 'Cerrando Sesión...' : 'Cerrar Sesión'}
          </button>
        </div>

        {/* Logout Confirmation Dialog */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  Cerrar Sesión
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                ¿Estás seguro de que deseas cerrar sesión? Perderás cualquier trabajo no guardado.
              </p>
              <div className="flex space-x-3 justify-end">
                <button
                  onClick={handleSignOutCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSignOutConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 transition-colors"
                >
                  Sí, Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Toast */}
        {logoutError && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-sm z-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                <span className="text-sm">{logoutError}</span>
              </div>
              <button
                onClick={handleErrorDismiss}
                className="ml-4 text-white hover:text-gray-200"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}