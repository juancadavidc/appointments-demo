import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';
import type { Business } from '@appointments-demo/types';
import { validateColombianPhone, isValidColombianDepartment } from '@appointments-demo/utils';

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

export async function GET() {
  try {
    const supabase = await createServerClientFromRequest();
    
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's businesses - use RLS policies which filter by auth.uid()
    console.log('🔍 Fetching businesses for user:', session.user.id);
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*');
    
    console.log('🔍 Business query result:', { businesses, businessError });
    
    if (businessError) {
      console.error('Error fetching user businesses:', businessError);
      return NextResponse.json({ error: 'Failed to fetch business data', details: businessError }, { status: 500 });
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ error: 'No business found for user' }, { status: 404 });
    }

    // For now, return the first business (in the future, handle multiple businesses)
    const businessData = businesses[0];
    
    if (!businessData) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Transform the flat database structure to match the TypeScript interface
    const business: Business = {
      id: businessData.id,
      name: businessData.name,
      description: businessData.description,
      address: {
        street: businessData.street,
        city: businessData.city,
        department: businessData.department,
        postalCode: businessData.postal_code
      },
      phone: businessData.phone,
      whatsappNumber: businessData.whatsapp_number,
      email: businessData.email,
      settings: businessData.settings,
      createdAt: new Date(businessData.created_at),
      updatedAt: new Date(businessData.updated_at)
    };

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Error fetching business profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClientFromRequest();
    
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's businesses - use RLS policies which filter by auth.uid()
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*');
    
    if (businessError) {
      console.error('Error fetching user businesses:', businessError);
      return NextResponse.json({ error: 'Failed to fetch business data' }, { status: 500 });
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ error: 'No business found for user' }, { status: 404 });
    }

    // For now, use the first business (in the future, handle multiple businesses)
    const existingBusiness = businesses[0];
    const businessId = existingBusiness.id;

    // Parse request body
    const body = await request.json();
    const businessUpdates: Partial<Business> = body;

    // Validate required fields
    const validationErrors: string[] = [];

    if (businessUpdates.name !== undefined && !businessUpdates.name.trim()) {
      validationErrors.push('Business name is required');
    }

    if (businessUpdates.phone !== undefined && !validateColombianPhone(businessUpdates.phone)) {
      validationErrors.push('Invalid Colombian phone number format');
    }

    if (businessUpdates.whatsappNumber !== undefined && businessUpdates.whatsappNumber && !validateColombianPhone(businessUpdates.whatsappNumber)) {
      validationErrors.push('Invalid Colombian WhatsApp number format');
    }

    if (businessUpdates.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessUpdates.email)) {
      validationErrors.push('Invalid email format');
    }

    if (businessUpdates.address?.department !== undefined && !isValidColombianDepartment(businessUpdates.address.department)) {
      validationErrors.push('Invalid Colombian department');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Transform the nested address structure to flat database structure
    const dbUpdates: Record<string, unknown> = { ...businessUpdates };
    if (businessUpdates.address) {
      delete dbUpdates.address;
      dbUpdates.street = businessUpdates.address.street;
      dbUpdates.city = businessUpdates.address.city;
      dbUpdates.department = businessUpdates.address.department;
      dbUpdates.postal_code = businessUpdates.address.postalCode;
    }
    if (businessUpdates.whatsappNumber !== undefined) {
      dbUpdates.whatsapp_number = businessUpdates.whatsappNumber;
      delete dbUpdates.whatsappNumber;
    }

    // Update business using direct Supabase call (RLS will ensure user can only update their own business)
    const { data: updatedBusinessData, error: updateError } = await supabase
      .from('businesses')
      .update(dbUpdates)
      .eq('id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating business:', updateError);
      return NextResponse.json({ error: 'Failed to update business' }, { status: 500 });
    }

    // Transform the flat database structure back to match the TypeScript interface
    const business: Business = {
      id: updatedBusinessData.id,
      name: updatedBusinessData.name,
      description: updatedBusinessData.description,
      address: {
        street: updatedBusinessData.street,
        city: updatedBusinessData.city,
        department: updatedBusinessData.department,
        postalCode: updatedBusinessData.postal_code
      },
      phone: updatedBusinessData.phone,
      whatsappNumber: updatedBusinessData.whatsapp_number,
      email: updatedBusinessData.email,
      settings: updatedBusinessData.settings,
      createdAt: new Date(updatedBusinessData.created_at),
      updatedAt: new Date(updatedBusinessData.updated_at)
    };

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Error updating business profile:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}