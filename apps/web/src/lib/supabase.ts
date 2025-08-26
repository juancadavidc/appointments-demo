import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { env } from './env';
import type { Database } from './database.types';

// Lazy initialization function for Supabase client
function createSupabaseClient() {
  try {
    const supabaseUrl = env.supabase.url;
    const supabaseAnonKey = env.supabase.anonKey;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please check your environment configuration.'
      );
    }

    // Check if we're in browser environment
    if (typeof window !== 'undefined') {
      // Browser environment - use SSR-compatible browser client
      return createBrowserClient(supabaseUrl, supabaseAnonKey);
    } else {
      // Server environment - use regular client without session persistence
      return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      });
    }
  } catch (error) {
    console.error('Supabase configuration error:', error);
    throw error;
  }
}

// Create Supabase client for client-side operations with lazy loading
let _supabaseClient: SupabaseClient<Database> | null = null;

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    if (!_supabaseClient) {
      _supabaseClient = createSupabaseClient();
    }
    return _supabaseClient![prop as keyof SupabaseClient<Database>];
  }
});

// Create Supabase client with service role for server-side operations
export const createServerSupabaseClient = () => {
  const supabaseUrl = env.supabase.url;
  const serviceRoleKey = env.supabase.serviceRoleKey;
  
  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable for server operations.'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

