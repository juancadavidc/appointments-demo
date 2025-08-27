'use client';

import { useState, useCallback } from 'react';
import type { BusinessSettings, BusinessHours } from '@appointments-demo/types';

interface BusinessSettingsPanelProps {
  settings: BusinessSettings;
  onSave: (updatedSettings: BusinessSettings) => Promise<void>;
}

interface FormErrors {
  [key: string]: string;
}

const TIMEZONE_OPTIONS = [
  { value: 'America/Bogota', label: 'Bogotá (Colombia) - GMT-5' },
  { value: 'America/New_York', label: 'Nueva York - GMT-5/-4' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles - GMT-8/-7' },
  { value: 'Europe/Madrid', label: 'Madrid - GMT+1/+2' },
  { value: 'UTC', label: 'UTC (Tiempo Universal)' }
];

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function BusinessSettingsPanel({ settings, onSave }: BusinessSettingsPanelProps) {
  const [formData, setFormData] = useState({
    timezone: settings.timezone,
    currency: settings.currency,
    businessHours: settings.businessHours || []
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Initialize business hours if empty
  const initializeBusinessHours = useCallback((): BusinessHours[] => {
    if (formData.businessHours.length === 7) {
      return formData.businessHours;
    }

    return Array.from({ length: 7 }, (_, index) => {
      const existing = formData.businessHours.find(h => h.dayOfWeek === index);
      return existing || {
        dayOfWeek: index,
        openTime: index === 0 ? '10:00' : '08:00', // Sunday starts later
        closeTime: index === 6 ? '14:00' : '18:00', // Saturday closes early
        isOpen: index !== 0 // Sunday closed by default
      };
    });
  }, [formData.businessHours]);

  const [businessHours, setBusinessHours] = useState<BusinessHours[]>(initializeBusinessHours);

  const validateTimeFormat = (time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const validateBusinessHours = (): boolean => {
    const newErrors: FormErrors = {};

    businessHours.forEach((hour, index) => {
      if (hour.isOpen) {
        if (!validateTimeFormat(hour.openTime)) {
          newErrors[`openTime_${index}`] = 'Formato de hora inválido (HH:MM)';
        }
        if (!validateTimeFormat(hour.closeTime)) {
          newErrors[`closeTime_${index}`] = 'Formato de hora inválido (HH:MM)';
        }
        
        // Check if open time is before close time
        if (validateTimeFormat(hour.openTime) && validateTimeFormat(hour.closeTime)) {
          const openMinutes = parseInt(hour.openTime.split(':')[0]) * 60 + parseInt(hour.openTime.split(':')[1]);
          const closeMinutes = parseInt(hour.closeTime.split(':')[0]) * 60 + parseInt(hour.closeTime.split(':')[1]);
          
          if (openMinutes >= closeMinutes) {
            newErrors[`timeRange_${index}`] = 'La hora de cierre debe ser posterior a la de apertura';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBusinessHourChange = (dayIndex: number, field: keyof BusinessHours, value: string | boolean) => {
    setBusinessHours(prev => 
      prev.map((hour, index) => 
        index === dayIndex ? { ...hour, [field]: value } : hour
      )
    );

    // Clear errors for this day when user makes changes
    const dayErrors = Object.keys(errors).filter(key => key.includes(`_${dayIndex}`));
    if (dayErrors.length > 0) {
      setErrors(prev => {
        const newErrors = { ...prev };
        dayErrors.forEach(key => delete newErrors[key]);
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateBusinessHours()) {
      return;
    }

    setIsLoading(true);
    try {
      const updatedSettings: BusinessSettings = {
        ...settings,
        timezone: formData.timezone,
        currency: formData.currency,
        businessHours: businessHours
      };

      await onSave(updatedSettings);
    } catch (error) {
      console.error('Error saving business settings:', error);
      setErrors({ submit: 'Error al guardar la configuración. Inténtalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Configuración del Negocio
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Configura los ajustes para tu negocio en Colombia
        </p>
      </div>

      {/* Basic Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
            Zona Horaria
          </label>
          <select
            id="timezone"
            value={formData.timezone}
            onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {TIMEZONE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Recomendado: Bogotá para negocios colombianos
          </p>
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
            Moneda
          </label>
          <select
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled // Fixed to COP for Colombian businesses
          >
            <option value="COP">COP - Peso Colombiano</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Peso colombiano para tu negocio local
          </p>
        </div>
      </div>

      {/* Business Hours */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Horarios de Atención</h4>
        <div className="space-y-4">
          {businessHours.map((hour, index) => (
            <div key={hour.dayOfWeek} className="grid grid-cols-12 gap-4 items-center">
              {/* Day checkbox and name */}
              <div className="col-span-3 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`day_${index}`}
                  checked={hour.isOpen}
                  onChange={(e) => handleBusinessHourChange(index, 'isOpen', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`day_${index}`} className="text-sm font-medium text-gray-700">
                  {DAY_NAMES[hour.dayOfWeek]}
                </label>
              </div>

              {/* Hours inputs */}
              {hour.isOpen ? (
                <>
                  <div className="col-span-4">
                    <label className="sr-only">Hora de apertura para el día {index}</label>
                    <input
                      type="time"
                      value={hour.openTime}
                      onChange={(e) => handleBusinessHourChange(index, 'openTime', e.target.value)}
                      className={`block w-full border rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`openTime_${index}`] || errors[`timeRange_${index}`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div className="col-span-1 text-center text-sm text-gray-500">
                    a
                  </div>
                  <div className="col-span-4">
                    <label className="sr-only">Hora de cierre para el día {index}</label>
                    <input
                      type="time"
                      value={hour.closeTime}
                      onChange={(e) => handleBusinessHourChange(index, 'closeTime', e.target.value)}
                      className={`block w-full border rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`closeTime_${index}`] || errors[`timeRange_${index}`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-9 text-sm text-gray-500 italic">
                  Cerrado
                </div>
              )}

              {/* Error messages */}
              {(errors[`openTime_${index}`] || errors[`closeTime_${index}`] || errors[`timeRange_${index}`]) && (
                <div className="col-span-12 text-sm text-red-600">
                  {errors[`openTime_${index}`] || errors[`closeTime_${index}`] || errors[`timeRange_${index}`]}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Los horarios determinan cuándo los clientes pueden agendar citas
        </p>
      </div>

      {/* Form Actions */}
      <div className="border-t border-gray-200 pt-6 flex justify-between items-center">
        {errors.submit && (
          <p className="text-sm text-red-600">{errors.submit}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </form>
  );
}