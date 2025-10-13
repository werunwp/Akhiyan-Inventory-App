-- Consolidate payment_status and order_status into single order_status field
-- This migration removes the redundant payment_status column and uses only order_status

-- First, update any records where order_status is null but payment_status has a value
UPDATE public.sales 
SET order_status = payment_status 
WHERE order_status IS NULL AND payment_status IS NOT NULL;

-- Now we can safely drop the payment_status column
ALTER TABLE public.sales DROP COLUMN IF EXISTS payment_status;

-- Update the constraint to reflect the new order_status values
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;

-- Add new constraint for order_status with all possible values
ALTER TABLE public.sales 
ADD CONSTRAINT sales_order_status_check 
CHECK (order_status IN ('pending', 'partial', 'paid', 'cancelled'));

-- Add comment to document the consolidated field
COMMENT ON COLUMN public.sales.order_status IS 'Consolidated order status: pending, partial, paid, cancelled (replaces both payment_status and order_status)';
