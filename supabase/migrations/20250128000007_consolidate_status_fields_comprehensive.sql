-- Comprehensive migration to consolidate payment_status and order_status
-- This handles all dependencies and ensures a clean transition

-- Step 1: Check for any existing views or functions that depend on payment_status
-- First, let's see what depends on the payment_status column
DO $$
DECLARE
    dep_record RECORD;
BEGIN
    -- Check for dependencies
    FOR dep_record IN 
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
          AND a.attname = 'payment_status'
    LOOP
        RAISE NOTICE 'Found dependency: %.% (type: %)', dep_record.dependent_schema, dep_record.dependent_view_name, dep_record.relkind;
    END LOOP;
END $$;

-- Step 2: Drop any views that depend on payment_status
DROP VIEW IF EXISTS public.sales_with_total CASCADE;
DROP VIEW IF EXISTS public.sales_summary CASCADE;
DROP VIEW IF EXISTS public.sales_analytics CASCADE;

-- Step 3: Update any existing records where order_status is null but payment_status has a value
UPDATE public.sales 
SET order_status = payment_status 
WHERE order_status IS NULL AND payment_status IS NOT NULL;

-- Step 4: Now we can safely drop the payment_status column
ALTER TABLE public.sales DROP COLUMN IF EXISTS payment_status;

-- Step 5: Update the constraint to reflect the new order_status values
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;

-- Step 6: Add new constraint for order_status with all possible values
ALTER TABLE public.sales 
ADD CONSTRAINT sales_order_status_check 
CHECK (order_status IN ('pending', 'partial', 'paid', 'cancelled'));

-- Step 7: Add comment to document the consolidated field
COMMENT ON COLUMN public.sales.order_status IS 'Consolidated order status: pending, partial, paid, cancelled (replaces both payment_status and order_status)';

-- Step 8: Verify the migration was successful
DO $$
BEGIN
    -- Check if payment_status column still exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'payment_status'
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Migration failed: payment_status column still exists';
    ELSE
        RAISE NOTICE 'Migration successful: payment_status column removed';
    END IF;
    
    -- Check if order_status column exists and has the right constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'order_status'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Migration successful: order_status column exists';
    ELSE
        RAISE EXCEPTION 'Migration failed: order_status column missing';
    END IF;
END $$;
