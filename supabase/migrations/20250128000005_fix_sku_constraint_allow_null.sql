-- Fix SKU constraint to allow NULL values
-- The current constraint doesn't allow multiple NULL values, which causes issues when SKU is empty

-- Drop the existing unique constraint on SKU
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_sku_key;

-- Create a new unique constraint that allows NULL values
-- This constraint will only apply to non-NULL values, allowing multiple NULL values
CREATE UNIQUE INDEX products_sku_unique_idx ON public.products (sku) 
WHERE sku IS NOT NULL;

-- Add a comment to explain the constraint
COMMENT ON INDEX products_sku_unique_idx IS 'Ensures SKU uniqueness only for non-NULL values, allowing multiple products with NULL SKU';
