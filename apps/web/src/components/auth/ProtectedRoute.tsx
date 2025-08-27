'use client';

import { useEffect, ReactNode, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { businessContext } from '@/lib/business-context';

interface ProtectedRouteProps {
  children: ReactNode;
  requireBusinessContext?: boolean;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requireBusinessContext = false,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuth();
  const [isBusinessReady, setIsBusinessReady] = useState(!requireBusinessContext);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // User is not authenticated, redirect to login
      const returnUrl = encodeURIComponent(pathname);
      router.push(`${redirectTo}?returnUrl=${returnUrl}`);
      return;
    }

    if (requireBusinessContext) {
      businessContext
        .getCurrentBusinessIdAsync({ autoSelect: true, userId: user.id })
        .then(businessId => businessId 
          ? Promise.resolve(businessId)
          : Promise.reject(new Error('No business found'))
        )
        .then(businessId => {
          console.log('✅ Business context ready:', businessId);
          setIsBusinessReady(true);
        })
        .catch(error => {
          console.log('❌ Business context failed, redirecting:', error.message);
          
          // Handle different error types
          if (error.message === 'TIMEOUT') {
            router.push('/register/business?reason=timeout');
          } else if (error.message === 'No business found') {
            router.push('/register/business?reason=no-business');
          } else {
            router.push('/register/business?reason=error');
          }
        });
    }
  }, [user, authLoading, requireBusinessContext, router, pathname, redirectTo]);

  // Show loading state while checking authentication and business context
  if (authLoading || (requireBusinessContext && !isBusinessReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Verificando autenticación...' : 'Cargando contexto del negocio...'}
          </p>
          {requireBusinessContext && !isBusinessReady && (
            <p className="text-sm text-gray-400 mt-2">
              Esto solo toma unos segundos
            </p>
          )}
        </div>
      </div>
    );
  }

  // Don't render children if user is not authenticated or business context not ready
  if (!user || (requireBusinessContext && !isBusinessReady)) {
    return null;
  }

  // User is authenticated and has required context, render children
  return <>{children}</>;
}

export default ProtectedRoute;