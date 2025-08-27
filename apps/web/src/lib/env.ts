/**
 * Environment configuration utility
 * Centralizes environment variable management with type safety and validation
 * Following Next.js best practices with Zod validation
 */

import { z } from 'zod';

/**
 * Client-side environment variable schema (NEXT_PUBLIC_* variables)
 */
const clientEnvSchema = z.object({
  // Supabase Configuration (Client-side accessible)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL format'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anonymous key is required'),
  
  // Colombian Configuration with defaults (Client-accessible)
  NEXT_PUBLIC_COLOMBIA_TIMEZONE: z.string().default('America/Bogota'),
  NEXT_PUBLIC_COLOMBIA_CURRENCY: z.string().default('COP'),
  NEXT_PUBLIC_COLOMBIA_PHONE_PREFIX: z.string().default('+57'),
  
  // App Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3000'),
  
  // Optional Client Configuration
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
});

/**
 * Server-side environment variable schema (includes server-only variables)
 */
const serverEnvSchema = clientEnvSchema.extend({
  // Supabase Server-side Configuration
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Server-only Configuration
  API_TIMEOUT: z.coerce.number().default(10000),
  ENABLE_DEBUG_MODE: z.coerce.boolean().optional(),
  ENABLE_TEST_DATA: z.coerce.boolean().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * Determine if we're on the server side
 */
const isServer = typeof window === 'undefined';

/**
 * Parse environment variables based on context
 */
const schema = isServer ? serverEnvSchema : clientEnvSchema;

// Create explicit env object for client-side because Next.js doesn't expose 
// NEXT_PUBLIC_ variables properly in Object.keys(process.env)
const envToValidate = isServer ? process.env : {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_COLOMBIA_TIMEZONE: process.env.NEXT_PUBLIC_COLOMBIA_TIMEZONE,
  NEXT_PUBLIC_COLOMBIA_CURRENCY: process.env.NEXT_PUBLIC_COLOMBIA_CURRENCY,
  NEXT_PUBLIC_COLOMBIA_PHONE_PREFIX: process.env.NEXT_PUBLIC_COLOMBIA_PHONE_PREFIX,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
};

const parsedEnv = schema.safeParse(envToValidate);

if (!parsedEnv.success) {
  console.error(`❌ Environment validation failed (${isServer ? 'server' : 'client'} side):`);
  console.error(parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

/**
 * Type-safe environment configuration
 */
export const env = {
  supabase: {
    url: parsedEnv.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: parsedEnv.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: isServer && 'SUPABASE_SERVICE_ROLE_KEY' in parsedEnv.data ? parsedEnv.data.SUPABASE_SERVICE_ROLE_KEY : undefined,
  },
  
  colombia: {
    timezone: parsedEnv.data.NEXT_PUBLIC_COLOMBIA_TIMEZONE,
    currency: parsedEnv.data.NEXT_PUBLIC_COLOMBIA_CURRENCY,
    phonePrefix: parsedEnv.data.NEXT_PUBLIC_COLOMBIA_PHONE_PREFIX,
  },
  
  app: {
    env: parsedEnv.data.NEXT_PUBLIC_APP_ENV,
    nodeEnv: parsedEnv.data.NODE_ENV,
    version: parsedEnv.data.NEXT_PUBLIC_APP_VERSION,
    baseUrl: parsedEnv.data.NEXT_PUBLIC_API_BASE_URL,
    apiTimeout: isServer && 'API_TIMEOUT' in parsedEnv.data ? parsedEnv.data.API_TIMEOUT : 10000,
  },
  
  features: {
    debugMode: isServer && 'ENABLE_DEBUG_MODE' in parsedEnv.data 
      ? parsedEnv.data.ENABLE_DEBUG_MODE ?? (parsedEnv.data.NODE_ENV === 'development')
      : (parsedEnv.data.NODE_ENV === 'development'),
    testData: isServer && 'ENABLE_TEST_DATA' in parsedEnv.data 
      ? parsedEnv.data.ENABLE_TEST_DATA ?? (parsedEnv.data.NODE_ENV === 'development')
      : (parsedEnv.data.NODE_ENV === 'development'),
    analytics: parsedEnv.data.NEXT_PUBLIC_ENABLE_ANALYTICS,
  },
  
  logging: {
    level: isServer && 'LOG_LEVEL' in parsedEnv.data ? parsedEnv.data.LOG_LEVEL : 'info' as const,
  },
} as const;

/**
 * Validate all required environment variables are present
 * Now handled automatically by Zod schema validation
 */
export async function validateEnvironment(): Promise<void> {
  try {
    console.log('✅ Environment configuration validated successfully');
    console.log(`Environment: ${env.app.env}`);
    console.log(`Node Environment: ${env.app.nodeEnv}`);
    console.log(`Version: ${env.app.version}`);
    console.log(`Base URL: ${env.app.baseUrl}`);
    console.log(`Colombian timezone: ${env.colombia.timezone}`);
    console.log(`Colombian currency: ${env.colombia.currency}`);
    console.log(`Colombian phone prefix: ${env.colombia.phonePrefix}`);
    
    // Validate Colombian-specific configuration
    if (env.colombia.timezone !== 'America/Bogota') {
      console.warn(`⚠️  Colombian timezone should be 'America/Bogota', got '${env.colombia.timezone}'`);
    }
    
    if (env.colombia.currency !== 'COP') {
      console.warn(`⚠️  Colombian currency should be 'COP', got '${env.colombia.currency}'`);
    }
    
    if (env.colombia.phonePrefix !== '+57') {
      console.warn(`⚠️  Colombian phone prefix should be '+57', got '${env.colombia.phonePrefix}'`);
    }
    
    // Test Colombian environment configuration
    try {
      const colombianEnvModule = await import('./colombian-env');
      colombianEnvModule.logColombianEnvironment();
    } catch (error) {
      console.warn('⚠️  Colombian environment configuration not available:', error);
    }
    
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    throw error;
  }
}

/**
 * Environment detection helpers
 */
export const isDevelopment = env.app.env === 'development';
export const isStaging = env.app.env === 'staging';
export const isProduction = env.app.env === 'production';

/**
 * Colombian configuration helpers
 */
export const getColombianTimezone = () => env.colombia.timezone;
export const getColombianCurrency = () => env.colombia.currency;
export const getColombianPhonePrefix = () => env.colombia.phonePrefix;