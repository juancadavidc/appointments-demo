'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBusinessContext } from '@/lib/auth-provider';
import { BusinessProfileCard } from '@/components/business/business-profile-card';
import { BusinessProfileEditForm } from '@/components/business/business-profile-edit-form';
import { BusinessSettingsPanel } from '@/components/business/business-settings-panel';
import type { Business, BusinessSettings } from '@appointments-demo/types';

// Disable static optimization for this page since it requires client-side auth
export const dynamic = 'force-dynamic';

export default function BusinessDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Use new async business context hook with auto-selection
  const { businessId, isLoading: isBusinessLoading, error: businessError } = useBusinessContext({ autoSelect: true });
  
  const [business, setBusiness] = useState<Business | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setupMode = searchParams.get('setup') === 'business';

  useEffect(() => {
    // Wait for business context to load
    if (isBusinessLoading) return;
    
    // Handle business context errors
    if (businessError) {
      setError(`Error al cargar el contexto del negocio: ${businessError}`);
      setIsLoading(false);
      return;
    }
    
    // Handle business setup flow
    if (setupMode && !businessId) {
      // Redirect to dedicated business registration page for better UX
      router.push('/register/business');
      return;
    }

    if (businessId) {
      fetchBusinessProfile();
    } else {
      // No business found after auto-selection attempt
      setError('No se encontró ningún negocio asociado a tu cuenta');
      setIsLoading(false);
    }
  }, [businessId, isBusinessLoading, businessError, setupMode, router]);

  const fetchBusinessProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/business/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch business profile');
      }

      const data = await response.json();
      setBusiness(data.business);
    } catch (err) {
      console.error('Error fetching business profile:', err);
      setError('Error al cargar el perfil del negocio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSave = async (updatedBusiness: Business) => {
    try {
      const response = await fetch('/api/business/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedBusiness),
      });

      if (!response.ok) {
        throw new Error('Failed to update business profile');
      }

      const data = await response.json();
      setBusiness(data.business);
      setIsEditingProfile(false);
    } catch (err) {
      console.error('Error updating business profile:', err);
      throw new Error('Error al actualizar el perfil del negocio');
    }
  };

  const handleSettingsSave = async (updatedSettings: BusinessSettings) => {
    try {
      const response = await fetch('/api/business/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to update business settings');
      }

      const data = await response.json();
      
      // Update the business object with new settings
      if (business) {
        setBusiness({ ...business, settings: data.settings });
      }
      
      setIsEditingSettings(false);
    } catch (err) {
      console.error('Error updating business settings:', err);
      throw new Error('Error al actualizar la configuración del negocio');
    }
  };

  if (isBusinessLoading || isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/6 mb-8"></div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-800 mb-2">
              Error al cargar el dashboard
            </h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchBusinessProfile}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">
              Negocio no encontrado
            </h3>
            <p className="text-yellow-600">
              No se pudo encontrar la información de tu negocio. Por favor, contacta soporte.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Panel de Control
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Gestiona tu negocio {business.name}
            </p>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="space-y-8">
          {/* Business Profile Section */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Perfil del Negocio</h3>
              <p className="text-sm text-gray-600">
                Información básica de tu negocio visible para los clientes
              </p>
            </div>
            
            {isEditingProfile ? (
              <BusinessProfileEditForm
                business={business}
                onSave={handleProfileSave}
                onCancel={() => setIsEditingProfile(false)}
              />
            ) : (
              <BusinessProfileCard
                business={business}
                onEdit={() => setIsEditingProfile(true)}
              />
            )}
          </div>

          {/* Business Settings Section */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Configuración</h3>
              <p className="text-sm text-gray-600">
                Horarios, zona horaria y configuraciones generales
              </p>
            </div>
            
            {isEditingSettings ? (
              <BusinessSettingsPanel
                settings={business.settings}
                onSave={handleSettingsSave}
              />
            ) : (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">Configuración Actual</h4>
                    <p className="text-sm text-gray-600">
                      Zona horaria: {business.settings.timezone} | Moneda: {business.settings.currency}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsEditingSettings(true)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Editar Configuración
                  </button>
                </div>
                
                {/* Quick settings overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {business.settings.businessHours?.filter(h => h.isOpen).length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Días abiertos</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {business.settings.timezone}
                    </div>
                    <div className="text-sm text-gray-600">Zona horaria</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {business.settings.currency}
                    </div>
                    <div className="text-sm text-gray-600">Moneda</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Acciones Rápidas</h3>
              <p className="text-sm text-gray-600">
                Próximamente: Gestión de especialistas, servicios y citas
              </p>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  disabled
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 cursor-not-allowed"
                >
                  <div className="text-lg font-medium mb-2">Especialistas</div>
                  <div className="text-sm">Próximamente</div>
                </button>
                <button
                  disabled
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 cursor-not-allowed"
                >
                  <div className="text-lg font-medium mb-2">Servicios</div>
                  <div className="text-sm">Próximamente</div>
                </button>
                <button
                  disabled
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500 cursor-not-allowed"
                >
                  <div className="text-lg font-medium mb-2">Calendario</div>
                  <div className="text-sm">Próximamente</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}