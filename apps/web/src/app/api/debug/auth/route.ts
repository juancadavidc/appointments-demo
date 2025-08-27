import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

// Create server client for authenticated requests (reads user session from cookies)
const createServerClientFromRequest = async () => {
  const cookieStore = await cookies();
  
  return createServerClient<Database>(
    env.supabase.url,
    env.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

/**
 * Debug Authentication Endpoint
 * 
 * This endpoint helps debug authentication issues by showing:
 * - All cookies received
 * - Supabase-specific cookies
 * - Authentication state
 * - Session information
 */
export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Filter Supabase cookies
    const supabaseCookies = allCookies.filter(cookie => 
      cookie.name.includes('sb') || 
      cookie.name.includes('supabase') ||
      cookie.name.includes('auth')
    );

    console.log('🔍 DEBUG AUTH - All cookies:', allCookies.length);
    console.log('🔍 DEBUG AUTH - Supabase cookies:', supabaseCookies.length);

    // Try to authenticate
    const authClient = await createServerClientFromRequest();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    const { data: { session }, error: sessionError } = await authClient.auth.getSession();

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      cookies: {
        total: allCookies.length,
        supabaseRelated: supabaseCookies.length,
        names: allCookies.map(c => c.name),
        supabaseCookieNames: supabaseCookies.map(c => c.name),
        supabaseCookies: supabaseCookies.map(c => ({
          name: c.name,
          value: c.value ? c.value.substring(0, 30) + '...' : 'empty',
          hasValue: !!c.value
        }))
      },
      authentication: {
        hasUser: !!user,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userRole: user?.role || null,
        userMetadata: user?.user_metadata || null,
        authError: authError ? {
          message: authError.message,
          status: authError.status
        } : null,
      },
      session: {
        hasSession: !!session,
        expiresAt: session?.expires_at || null,
        accessToken: session?.access_token ? 'present' : 'missing',
        refreshToken: session?.refresh_token ? 'present' : 'missing',
        tokenType: session?.token_type || null,
        sessionError: sessionError ? {
          message: sessionError.message,
          status: sessionError.status
        } : null,
      },
      supabaseConfig: {
        url: env.supabase.url ? 'configured' : 'missing',
        anonKey: env.supabase.anonKey ? 'configured' : 'missing',
        serviceRoleKey: env.supabase.serviceRoleKey ? 'configured' : 'missing',
      }
    };

    console.log('🔍 DEBUG AUTH - Full debug info:', JSON.stringify(debugInfo, null, 2));

    return NextResponse.json(debugInfo, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('🔍 DEBUG AUTH - Error:', error);
    
    return NextResponse.json({
      error: 'Debug endpoint error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Handle POST requests for testing authentication with request data
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const requestData = await request.json();
    
    // Get the same debug info as GET
    const getResponse = await GET();
    const debugInfo = await getResponse.json();

    return NextResponse.json({
      ...debugInfo,
      requestData,
      method: 'POST'
    });

  } catch (error) {
    console.error('🔍 DEBUG AUTH POST - Error:', error);
    
    return NextResponse.json({
      error: 'Debug POST endpoint error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}