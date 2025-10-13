-- SAFE MIGRATION STEPS - Run these one by one in Supabase SQL Editor

-- Step 1: Check what depends on payment_status column
SELECT 
    dependent_ns.nspname AS dependent_schema,
    dependent_view.relname AS dependent_view_name,
    dependent_view.relkind
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_namespace AS dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
JOIN pg_attribute AS a ON pg_depend.refobjid = a.attrelid AND pg_depend.refobjsubid = a.attnum
WHERE a.attrelid = 'public.sales'::regclass
  AND a.attname = 'payment_status';

-- Step 2: If any views are found above, drop them first
-- (Replace 'view_name' with actual view names from Step 1)
-- DROP VIEW IF EXISTS public.view_name CASCADE;

-- Step 3: Update existing data - copy payment_status to order_status where needed
UPDATE public.sales 
SET order_status = payment_status 
WHERE order_status IS NULL AND payment_status IS NOT NULL;

-- Step 4: Verify the update worked
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN order_status IS NOT NULL THEN 1 END) as records_with_order_status,
    COUNT(CASE WHEN payment_status IS NOT NULL THEN 1 END) as records_with_payment_status
FROM public.sales;

-- Step 5: Drop the payment_status column
ALTER TABLE public.sales DROP COLUMN IF EXISTS payment_status;

-- Step 6: Update constraints
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;

ALTER TABLE public.sales 
ADD CONSTRAINT sales_order_status_check 
CHECK (order_status IN ('pending', 'partial', 'paid', 'cancelled'));

-- Step 7: Verify final state
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales' 
AND table_schema = 'public'
AND column_name IN ('payment_status', 'order_status')
ORDER BY column_name;
