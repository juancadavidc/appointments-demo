'use client';

import { PencilIcon, MapPinIcon, PhoneIcon, EnvelopeIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { Business } from '@appointments-demo/types';
import { formatColombianPhone } from '@appointments-demo/utils';

interface BusinessProfileCardProps {
  business: Business;
  onEdit?: () => void;
}

export function BusinessProfileCard({ business, onEdit }: BusinessProfileCardProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      {/* Header with name and edit button */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {business.name}
          </h3>
          {business.description && (
            <p className="text-gray-600 text-sm">
              {business.description}
            </p>
          )}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            aria-label="Editar perfil del negocio"
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            Editar Perfil
          </button>
        )}
      </div>

      {/* Business information grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Address Information */}
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Dirección</p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{business.address?.street}</p>
                <p>{business.address.city}, {business.address.department}</p>
                {business.address?.postalCode && (
                  <p className="text-xs text-gray-500">CP: {business.address.postalCode}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="flex items-start space-x-3">
            <PhoneIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Teléfono</p>
              <p className="text-sm text-gray-600">
                {formatColombianPhone(business.phone) || business.phone}
              </p>
              {business.whatsappNumber && (
                <div className="mt-1">
                  <p className="text-xs text-gray-500">WhatsApp</p>
                  <p className="text-sm text-gray-600">
                    {formatColombianPhone(business.whatsappNumber) || business.whatsappNumber}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <EnvelopeIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Correo</p>
              <p className="text-sm text-gray-600 break-all">
                {business.email}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Information */}
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Zona Horaria</p>
              <p className="text-sm text-gray-600">
                {business.settings.timezone}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Configuración para horarios de citas
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="h-5 w-5 flex items-center justify-center mt-0.5 flex-shrink-0">
              <span className="text-gray-400 text-sm font-bold">$</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Moneda</p>
              <p className="text-sm text-gray-600">
                {business.settings.currency} - Peso Colombiano
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Moneda para precios de servicios
              </p>
            </div>
          </div>

          {/* Business Hours Summary */}
          {business.settings.businessHours && business.settings.businessHours.length > 0 && (
            <div className="flex items-start space-x-3">
              <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">Horarios</p>
                <div className="text-xs text-gray-600 space-y-1">
                  {business.settings.businessHours
                    .filter(hour => hour.isOpen)
                    .map(hour => {
                      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                      return (
                        <div key={hour.dayOfWeek} className="flex justify-between">
                          <span>{dayNames[hour.dayOfWeek]}</span>
                          <span>{hour.openTime} - {hour.closeTime}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with last update */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Última actualización: {new Date(business.updatedAt).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}