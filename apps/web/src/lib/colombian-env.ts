/**
 * Colombian environment configuration utilities
 * Provides Colombian market-specific environment defaults and configurations
 */

import { env } from './env';

/**
 * Colombian market configuration interface
 */
export interface ColombianMarketConfig {
  timezone: string;
  currency: string;
  phonePrefix: string;
  locale: string;
  businessHours: {
    start: string;
    end: string;
    format: '12h' | '24h';
  };
  dateFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
    currency: {
      symbol: string;
      position: 'before' | 'after';
    };
  };
}

/**
 * Default Colombian market configuration
 */
export const COLOMBIAN_DEFAULTS: ColombianMarketConfig = {
  timezone: 'America/Bogota',
  currency: 'COP',
  phonePrefix: '+57',
  locale: 'es-CO',
  businessHours: {
    start: '08:00',
    end: '18:00',
    format: '24h',
  },
  dateFormat: 'DD/MM/YYYY',
  numberFormat: {
    decimal: ',',
    thousands: '.',
    currency: {
      symbol: '$',
      position: 'before',
    },
  },
};

/**
 * Get Colombian market configuration from environment
 */
export function getColombianMarketConfig(): ColombianMarketConfig {
  return {
    ...COLOMBIAN_DEFAULTS,
    timezone: env.colombia.timezone,
    currency: env.colombia.currency,
    phonePrefix: env.colombia.phonePrefix,
  };
}

/**
 * Get current Colombian time
 */
export function getCurrentColombianTime(): Date {
  const config = getColombianMarketConfig();
  const now = new Date();
  
  // Convert to Colombian timezone
  return new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
}

/**
 * Format date for Colombian market
 */
export function formatColombianDate(date: Date): string {
  const config = getColombianMarketConfig();
  
  // Validate date before formatting
  if (isNaN(date.getTime())) {
    throw new RangeError('Invalid time value');
  }
  
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: config.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format time for Colombian market
 */
export function formatColombianTime(date: Date, includeSeconds: boolean = false): string {
  const config = getColombianMarketConfig();
  
  // Validate date before formatting
  if (isNaN(date.getTime())) {
    throw new RangeError('Invalid time value');
  }
  
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' }),
    hour12: config.businessHours.format === '12h',
  }).format(date);
}

/**
 * Format date and time for Colombian market
 */
export function formatColombianDateTime(date: Date): string {
  return `${formatColombianDate(date)} ${formatColombianTime(date)}`;
}

/**
 * Check if current time is within Colombian business hours
 */
export function isColombianBusinessHours(date?: Date): boolean {
  const config = getColombianMarketConfig();
  const checkDate = date || getCurrentColombianTime();
  
  // Get day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = checkDate.getDay();
  
  // Check if it's a weekday (Monday-Friday)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Get hour in 24h format
  const hour = checkDate.getHours();
  const minute = checkDate.getMinutes();
  const currentTime = hour * 100 + minute;
  
  // Parse business hours
  const [startHour, startMinute] = config.businessHours.start.split(':').map(Number);
  const [endHour, endMinute] = config.businessHours.end.split(':').map(Number);
  const startTime = startHour * 100 + startMinute;
  const endTime = endHour * 100 + endMinute;
  
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Get Colombian currency formatter
 */
export function getColombianCurrencyFormatter(): Intl.NumberFormat {
  const config = getColombianMarketConfig();
  
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format amount in Colombian pesos
 */
export function formatColombianCurrency(amount: number): string {
  const formatter = getColombianCurrencyFormatter();
  return formatter.format(amount);
}

/**
 * Get Colombian number formatter
 */
export function getColombianNumberFormatter(): Intl.NumberFormat {
  return new Intl.NumberFormat('es-CO');
}

/**
 * Format number for Colombian market
 */
export function formatColombianNumber(number: number): string {
  const formatter = getColombianNumberFormatter();
  return formatter.format(number);
}

/**
 * Get Colombian timezone info
 */
export function getColombianTimezoneInfo(): { 
  timezone: string; 
  offset: number; 
  abbreviation: string;
  isDST: boolean;
} {
  const config = getColombianMarketConfig();
  
  // Get timezone offset in minutes (not used but kept for reference)
  // const offset = -now.getTimezoneOffset() / 60;
  
  // Colombia doesn't use daylight saving time
  return {
    timezone: config.timezone,
    offset: -5, // Colombia is always GMT-5
    abbreviation: 'COT', // Colombia Time
    isDST: false,
  };
}

/**
 * Validate Colombian environment configuration
 */
export function validateColombianEnvironment(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const config = getColombianMarketConfig();
    
    // Validate timezone
    if (!config.timezone || config.timezone !== 'America/Bogota') {
      warnings.push(`Colombian timezone should be 'America/Bogota', got '${config.timezone}'`);
    }
    
    // Validate currency
    if (!config.currency || config.currency !== 'COP') {
      warnings.push(`Colombian currency should be 'COP', got '${config.currency}'`);
    }
    
    // Validate phone prefix
    if (!config.phonePrefix || config.phonePrefix !== '+57') {
      warnings.push(`Colombian phone prefix should be '+57', got '${config.phonePrefix}'`);
    }
    
    // Test date/time formatting
    try {
      const testDate = new Date();
      formatColombianDate(testDate);
      formatColombianTime(testDate);
      formatColombianCurrency(1000);
    } catch (error) {
      errors.push(`Error testing Colombian formatting: ${error}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
    
  } catch (error) {
    errors.push(`Failed to validate Colombian environment: ${error}`);
    return {
      isValid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Log Colombian environment configuration
 */
export function logColombianEnvironment(): void {
  const validation = validateColombianEnvironment();

  if (validation.warnings.length > 0) {
    console.warn('⚠️  Colombian Environment Warnings:');
    validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  if (validation.errors.length > 0) {
    console.error('❌ Colombian Environment Errors:');
    validation.errors.forEach(error => console.error(`   - ${error}`));
  }
  
  if (validation.isValid) {
    console.log('✅ Colombian environment configuration is valid');
  }
}