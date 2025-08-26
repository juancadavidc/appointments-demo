'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColombianBusinessForm } from '@/components/business/registration-form';
import { BusinessRegistrationData } from '@/components/forms/validation-schemas';
import { useAuth } from '@/lib/auth-provider';

interface RegistrationState {
  isLoading: boolean;
  errors: Record<string, string>;
  generalError: string;
  isSuccess: boolean;
}

interface RegistrationResponse {
  success: boolean;
  data?: {
    business: {
      id: string;
      name: string;
      email: string;
      phone: string;
      whatsapp_number: string;
      address: {
        street: string;
        city: string;
        department: string;
      };
    };
  };
  error?: {
    type: 'validation_error' | 'email_exists' | 'server_error';
    message: string;
    details?: Record<string, string>;
    field?: string;
  };
  message?: string;
}

/**
 * Colombian Business Registration Page
 * 
 * Provides a complete registration flow for Colombian businesses including:
 * - Form validation with Colombian-specific rules
 * - API integration with error handling
 * - Loading states and user feedback
 * - Success flow with dashboard redirect
 * - Multi-tenant business context setup
 */
export default function BusinessRegistrationPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isInitialized } = useAuth();
  const [state, setState] = useState<RegistrationState>({
    isLoading: false,
    errors: {},
    generalError: '',
    isSuccess: false
  });

  /**
   * Handle business registration API call
   */
  const handleBusinessRegistration = async (data: BusinessRegistrationData) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      errors: {},
      generalError: ''
    }));

    try {
      const response = await fetch('/api/business/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: RegistrationResponse = await response.json();

      if (response.ok && result.success && result.data) {
        // Handle successful registration
        await handleSuccessfulRegistration(result.data.business);
      } else {
        // Handle API errors
        handleRegistrationError(result.error);
      }
    } catch (error) {
      // Handle network errors
      console.error('Registration network error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        generalError: 'Error de conexión. Por favor, verifica tu internet e intenta nuevamente.'
      }));
    }
  };

  /**
   * Handle successful business registration
   */
  const handleSuccessfulRegistration = async (business: NonNullable<RegistrationResponse['data']>['business']) => {
    try {
      // Set business context in localStorage for multi-tenant isolation
      setBusinessContext(business);

      // Show success state briefly
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: true
      }));

      // Redirect to dashboard after brief delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error setting business context:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        generalError: 'Error configurando el contexto del negocio. Por favor, intenta nuevamente.'
      }));
    }
  };

  /**
   * Handle registration errors from API
   */
  const handleRegistrationError = (error: RegistrationResponse['error']) => {
    if (!error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        generalError: 'Error desconocido. Por favor, intenta nuevamente.'
      }));
      return;
    }

    switch (error.type) {
      case 'validation_error':
        setState(prev => ({
          ...prev,
          isLoading: false,
          errors: error.details || {},
          generalError: error.details ? '' : error.message
        }));
        break;

      case 'email_exists':
        setState(prev => ({
          ...prev,
          isLoading: false,
          errors: { email: error.message },
          generalError: ''
        }));
        break;

      case 'server_error':
      default:
        setState(prev => ({
          ...prev,
          isLoading: false,
          generalError: error.message || 'Error interno del servidor. Intente nuevamente.'
        }));
        break;
    }
  };

  /**
   * Set business context for multi-tenant isolation
   */
  const setBusinessContext = (business: NonNullable<RegistrationResponse['data']>['business']) => {
    if (typeof window !== 'undefined') {
      // Store business ID for API authentication
      localStorage.setItem('current_business_id', business.id);
      
      // Store business context for immediate access
      const businessContext = {
        business_id: business.id,
        name: business.name,
        email: business.email,
        phone: business.phone,
        whatsapp_number: business.whatsapp_number,
        address: business.address
      };
      
      localStorage.setItem('business_context', JSON.stringify(businessContext));
    }
  };

  // Show loading state while auth is initializing
  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Cargando...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.push('/login');
    return null;
  }

  // Show success state
  if (state.isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                ¡Registro Exitoso!
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Tu negocio ha sido registrado correctamente. Te estamos redirigiendo al panel de control...
              </p>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Registra tu Negocio
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Crea tu cuenta para comenzar a gestionar citas en Colombia
        </p>
        
        {/* User Info Display */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Usuario:</span> {user.email}
              </p>
              {user.name && (
                <p className="text-sm text-blue-600">
                  <span className="font-medium">Nombre:</span> {user.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* General Error Message */}
          {state.generalError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{state.generalError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Registration Form */}
          <ColombianBusinessForm
            onSubmit={handleBusinessRegistration}
            isLoading={state.isLoading}
          />

          {/* Loading Overlay */}
          {state.isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">Registrando negocio...</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          Al registrarte, aceptas nuestros{' '}
          <a href="/terms" className="text-blue-600 hover:text-blue-500">
            Términos de Servicio
          </a>{' '}
          y{' '}
          <a href="/privacy" className="text-blue-600 hover:text-blue-500">
            Política de Privacidad
          </a>
        </p>
      </div>
    </div>
  );
}

