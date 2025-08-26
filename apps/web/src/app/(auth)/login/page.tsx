'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { LoginSchema, type LoginData, extractValidationErrors } from '@/components/forms/validation-schemas';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Use refs for persistent state that survives re-renders
  const hasRedirectedRef = useRef(false);
  const cancelledRef = useRef(false);

  // Check if user is already authenticated
  useEffect(() => {
    // Reset cancellation for this effect run
    cancelledRef.current = false;
    
    const isLogout = searchParams.get('logout') === 'true';
    console.log('🔐 LOGIN PAGE STEP 1: useEffect triggered, isLogout:', isLogout, 'hasRedirected:', hasRedirectedRef.current);
    
    // Prevent multiple redirects
    if (hasRedirectedRef.current) {
      console.log('🔐 LOGIN PAGE STEP 1a: Already redirected, skipping auth check');
      setCheckingAuth(false);
      return;
    }
    
    if (!isLogout) {
      console.log('🔐 LOGIN PAGE STEP 2: Not a logout redirect, checking authentication...');
      checkAuthentication().catch((error) => {
        console.error('🔐 LOGIN PAGE: Authentication check failed:', error);
        if (!cancelledRef.current && !hasRedirectedRef.current) {
          setCheckingAuth(false);
        }
      });
    } else {
      console.log('🔐 LOGIN PAGE STEP 2: Logout redirect detected, skipping auth check');
      // Skip authentication check when coming from logout
      setCheckingAuth(false);
    }
    
    return () => {
      console.log('🔐 LOGIN PAGE CLEANUP: Setting cancelled to true');
      cancelledRef.current = true;
    };
  }, [router, searchParams]);

  // Handle verification message from registration
  useEffect(() => {
    const message = searchParams.get('message');
    const email = searchParams.get('email');
    
    if (message === 'verify_email' && email) {
      setErrors({
        form: `Se ha enviado un email de verificación a ${decodeURIComponent(email)}. Revisa tu bandeja de entrada y haz clic en el enlace para verificar tu cuenta antes de iniciar sesión.`
      });
    }
  }, [searchParams]);

  const checkAuthentication = async () => {
    console.log('🔐 LOGIN AUTH CHECK STEP 1: Starting checkAuthentication, cancelled:', cancelledRef.current, 'hasRedirected:', hasRedirectedRef.current);
    
    // Double check - don't proceed if already redirected
    if (hasRedirectedRef.current) {
      console.log('🔐 LOGIN AUTH CHECK STEP 1a: hasRedirected is true, aborting');
      return;
    }
    
    try {
      console.log('🔐 LOGIN AUTH CHECK STEP 2: Checking existing authentication...');
      
      // Fast synchronous check first - if no auth cookies, skip slow async check
      console.log('🔐 LOGIN AUTH CHECK STEP 3: Running fast synchronous auth check...');
      const likelyAuthenticated = auth.isLikelyAuthenticated();
      console.log('🔐 LOGIN AUTH CHECK STEP 4: likelyAuthenticated result:', likelyAuthenticated);
      
      if (!likelyAuthenticated) {
        console.log('🔐 LOGIN AUTH CHECK STEP 5: No auth cookies found, showing login form immediately');
        if (!cancelledRef.current && !hasRedirectedRef.current) {
          setCheckingAuth(false);
        }
        return;
      }
      
      console.log('🔐 LOGIN AUTH CHECK STEP 5: Auth cookies found, verifying session...');
      
      // Create a timeout promise to prevent hanging
      console.log('🔐 LOGIN AUTH CHECK STEP 6: Creating timeout promise (5 seconds)...');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Session verification timeout')), 5000);
      });
      
      // Race the session check against timeout
      try {
        console.log('🔐 LOGIN AUTH CHECK STEP 7: Starting session verification race...');
        const result = await Promise.race([
          auth.getSession(),
          timeoutPromise
        ]) as any;
        
        // Check if cancelled after async operation
        if (cancelledRef.current) {
          console.log('🔐 LOGIN AUTH CHECK STEP 8: Operation cancelled after session check, aborting');
          return;
        }
        
        console.log('🔐 LOGIN AUTH CHECK STEP 8: Session verification race completed, result:', result);
        
        const { data, error } = result;
        
        if (error) {
          console.warn('🔐 LOGIN AUTH CHECK STEP 9: Session verification failed:', error.message);
          // Continue to show login form if session check fails
          return;
        }
        
        if (data.session && !cancelledRef.current && !hasRedirectedRef.current) {
          console.log('🔐 LOGIN AUTH CHECK STEP 9: User already authenticated, setting redirect flag and redirecting...');
          
          // Set redirect flag BEFORE redirecting to prevent duplicate redirects
          hasRedirectedRef.current = true;
          
          // User is already authenticated, redirect to dashboard
          const returnUrl = searchParams.get('returnUrl');
          const redirectPath = returnUrl ? decodeURIComponent(returnUrl) : '/dashboard';
          console.log('🔐 LOGIN AUTH CHECK STEP 10: Redirecting to:', redirectPath);
          
          // Use window.location for immediate redirect that bypasses React navigation
          window.location.href = redirectPath;
          return;
        }
        
        console.log('🔐 LOGIN AUTH CHECK STEP 9: Session verification complete, no valid session or already cancelled/redirected');
      } catch (timeoutError) {
        console.warn('🔐 LOGIN AUTH CHECK STEP 11: Session verification timed out or failed:', timeoutError);
        // Show login form if verification times out
        return;
      }
      
    } catch (error) {
      console.error('🔐 LOGIN AUTH CHECK STEP 12: Error checking authentication:', error);
      // Continue to show login form even if auth check fails
    } finally {
      if (!cancelledRef.current && !hasRedirectedRef.current) {
        console.log('🔐 LOGIN AUTH CHECK STEP 13: Setting checkingAuth to false');
        setCheckingAuth(false);
      } else {
        console.log('🔐 LOGIN AUTH CHECK STEP 13: Skipped setting checkingAuth to false (cancelled or redirected)');
      }
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    try {
      LoginSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error: unknown) {
      const validationErrors = extractValidationErrors(error as z.ZodError);
      setErrors(validationErrors);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await auth.signIn(formData.email, formData.password);
      
      if (result.error) {
        // Handle login errors with specific Spanish messages
        if (result.error.message.includes('Invalid login credentials')) {
          setErrors({ 
            form: 'Email o contraseña incorrectos. Por favor verifica tus credenciales.' 
          });
        } else if (result.error.message.includes('Email not confirmed')) {
          setErrors({ 
            form: 'Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.' 
          });
        } else if (result.error.message.includes('Too many requests')) {
          setErrors({ 
            form: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' 
          });
        } else if (result.error.message.includes('Network')) {
          setErrors({ 
            form: 'Error de conexión. Verifica tu conexión a internet e intenta de nuevo.' 
          });
        } else {
          setErrors({ 
            form: result.error.message || 'Error al iniciar sesión. Intenta de nuevo.' 
          });
        }
        return;
      }

      // Login successful
      if (result.data.session) {
        // Get return URL from query params, fallback to dashboard
        const returnUrl = searchParams.get('returnUrl');
        const redirectPath = returnUrl ? decodeURIComponent(returnUrl) : '/dashboard';
        
        // Always redirect to dashboard after successful login
        // The business context will be handled by the dashboard page
        router.push(redirectPath);
      } else {
        setErrors({ form: 'Error inesperado al iniciar sesión' });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ form: 'Error inesperado. Intenta de nuevo más tarde.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrors({ email: 'Ingresa tu email para recuperar la contraseña' });
      return;
    }

    try {
      const result = await auth.resetPassword(formData.email);
      if (result.error) {
        setErrors({ form: 'Error al enviar el email de recuperación' });
      } else {
        setErrors({ 
          form: `Se ha enviado un email de recuperación a ${formData.email}. Revisa tu bandeja de entrada.` 
        });
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ form: 'Error al enviar el email de recuperación' });
    }
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Iniciar sesión
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            ¿No tienes cuenta?{' '}
            <a href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Regístrate aquí
            </a>
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {errors.form && (
              <div className={`border rounded-md p-4 ${
                errors.form.includes('enviado') 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-sm ${
                  errors.form.includes('enviado') 
                    ? 'text-green-800' 
                    : 'text-red-800'
                }`}>
                  {errors.form}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="tu@email.com"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <span className="text-sm text-gray-500">
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </span>
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-blue-600 hover:text-blue-500 disabled:text-gray-400"
                  disabled={isLoading}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}