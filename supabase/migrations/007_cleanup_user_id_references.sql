-- Migration: Clean up user_id references and use owner_id consistently
-- Description: Removes obsolete user_id column and updates functions to use owner_id

-- Drop old RLS policies that reference user_id (these were supposed to be dropped in migration 006)
DROP POLICY IF EXISTS "Users can view their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can insert their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can delete their own businesses" ON businesses;

-- Update get_user_businesses function to use owner_id instead of user_id
CREATE OR REPLACE FUNCTION get_user_businesses(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    business_id UUID,
    business_name TEXT,
    business_email TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT b.id, b.name, b.email, b.created_at
    FROM businesses b
    WHERE b.owner_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user_owns_business function to use owner_id instead of user_id
CREATE OR REPLACE FUNCTION user_owns_business(business_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM businesses 
        WHERE id = business_uuid 
        AND owner_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the index on user_id before removing the column
DROP INDEX IF EXISTS idx_businesses_user_id;

-- Remove the obsolete user_id column from businesses table
ALTER TABLE businesses DROP COLUMN IF EXISTS user_id;

-- Update function comments to reflect owner_id usage
COMMENT ON FUNCTION get_user_businesses(UUID) IS 'Returns all businesses owned by a user via owner_id';
COMMENT ON FUNCTION user_owns_business(UUID, UUID) IS 'Validates if user owns specified business via owner_id';

-- Add migration completion comment
COMMENT ON TABLE businesses IS 'Business entities with multi-tenant isolation via owner_id (user_id column removed in migration 007)';