-- Fix SKU constraint to allow NULL values
-- Run this script directly on your Supabase database

-- Drop the existing unique constraint on SKU
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_sku_key;

-- Create a new unique constraint that allows NULL values
-- This constraint will only apply to non-NULL values, allowing multiple NULL values
CREATE UNIQUE INDEX products_sku_unique_idx ON public.products (sku) 
WHERE sku IS NOT NULL;

-- Add a comment to explain the constraint
COMMENT ON INDEX products_sku_unique_idx IS 'Ensures SKU uniqueness only for non-NULL values, allowing multiple products with NULL SKU';

-- Verify the constraint is working
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'products' 
AND indexname = 'products_sku_unique_idx';
