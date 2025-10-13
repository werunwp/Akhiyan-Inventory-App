-- Direct SQL fix for PAID RETURN orders
-- This script will update all orders with PAID RETURN status to have order_status = 'cancelled'

-- First, let's see what we have
SELECT 
    id, 
    courier_status, 
    order_status,
    customer_name,
    created_at
FROM sales 
WHERE courier_status ILIKE '%return%'
ORDER BY created_at DESC;

-- Update all orders with PAID RETURN to cancelled
UPDATE sales 
SET order_status = 'cancelled' 
WHERE courier_status ILIKE '%paid%return%' 
   OR courier_status ILIKE '%return%paid%'
   OR courier_status = 'PAID RETURN'
   OR courier_status = 'paid return'
   OR courier_status = 'PAID_RETURN'
   OR courier_status = 'paid_return';

-- Update all orders with RETURN (not PAID RETURN) to cancelled
UPDATE sales 
SET order_status = 'cancelled' 
WHERE courier_status = 'RETURN' 
   OR courier_status = 'return'
   OR courier_status = 'Return';

-- Update all orders with EXCHANGE to paid
UPDATE sales 
SET order_status = 'paid' 
WHERE courier_status = 'EXCHANGE' 
   OR courier_status = 'exchange'
   OR courier_status = 'Exchange';

-- Update all orders with DELIVERED to paid
UPDATE sales 
SET order_status = 'paid' 
WHERE courier_status = 'DELIVERED' 
   OR courier_status = 'delivered'
   OR courier_status = 'Delivered';

-- Update all orders with PARTIAL DELIVERY to paid
UPDATE sales 
SET order_status = 'paid' 
WHERE courier_status ILIKE '%partial%delivery%'
   OR courier_status ILIKE '%partial delivery%'
   OR courier_status = 'PARTIAL DELIVERY'
   OR courier_status = 'partial delivery';

-- Check the results
SELECT 
    courier_status,
    order_status,
    COUNT(*) as count
FROM sales 
WHERE courier_status ILIKE '%return%' 
   OR courier_status ILIKE '%exchange%'
   OR courier_status ILIKE '%delivered%'
   OR courier_status ILIKE '%partial%'
GROUP BY courier_status, order_status
ORDER BY courier_status;
