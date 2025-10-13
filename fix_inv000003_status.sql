-- Fix INV000003 order status from Pending to Cancelled
-- This order has CANCELLED courier status but Pending order status

-- Step 1: Check current status
SELECT 
    invoice_number,
    courier_status,
    order_status,
    created_at,
    updated_at
FROM public.sales 
WHERE invoice_number = 'INV000003';

-- Step 2: Update order status to cancelled
UPDATE public.sales 
SET 
    order_status = 'cancelled',
    updated_at = NOW()
WHERE invoice_number = 'INV000003';

-- Step 3: Verify the update
SELECT 
    invoice_number,
    courier_status,
    order_status,
    created_at,
    updated_at
FROM public.sales 
WHERE invoice_number = 'INV000003';

-- Step 4: Check for any other orders with similar issues
SELECT 
    invoice_number,
    courier_status,
    order_status
FROM public.sales 
WHERE courier_status ILIKE '%CANCELLED%' 
  AND order_status = 'pending';
