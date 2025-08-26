import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Auth Callback Route Handler
 * 
 * This route handles the OAuth callback from Supabase authentication.
 * It exchanges the authorization code for a user session and sets 
 * the session as cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/';
  
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/';
  }

  console.log('🔐 Auth Callback - Code received:', !!code);
  console.log('🔐 Auth Callback - Redirect to:', next);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      env.supabase.url,
      env.supabase.anonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                console.log(`🍪 Auth Callback - Setting cookie: ${name}`);
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error('🍪 Auth Callback - Error setting cookies:', error);
            }
          },
        },
      }
    );

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error) {
        console.log('✅ Auth Callback - Successfully exchanged code for session');
        
        const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
        const isLocalEnv = process.env.NODE_ENV === 'development';
        
        if (isLocalEnv) {
          // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      } else {
        console.error('❌ Auth Callback - Error exchanging code for session:', error);
      }
    } catch (exchangeError) {
      console.error('❌ Auth Callback - Exception during code exchange:', exchangeError);
    }
  } else {
    console.warn('⚠️ Auth Callback - No code parameter received');
  }

  // return the user to an error page with instructions
  console.log('🔐 Auth Callback - Redirecting to auth error page');
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}