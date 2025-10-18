-- Fix duplicate sales issue by cleaning up conflicting triggers
-- This migration addresses potential duplicate sales caused by multiple triggers

-- Drop all existing customer stats triggers to prevent conflicts
DROP TRIGGER IF EXISTS update_customer_stats_on_insert ON public.sales;
DROP TRIGGER IF EXISTS update_customer_stats_on_update ON public.sales;
DROP TRIGGER IF EXISTS update_customer_stats_on_delete ON public.sales;
DROP TRIGGER IF EXISTS update_customer_stats_trigger ON public.sales;

-- Create a single, optimized trigger for customer stats updates
CREATE OR REPLACE FUNCTION public.update_customer_stats_optimized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    customer_uuid UUID;
BEGIN
    -- Get customer_id from the affected row
    IF TG_OP = 'DELETE' THEN
        customer_uuid := OLD.customer_id;
    ELSE
        customer_uuid := NEW.customer_id;
    END IF;
    
    -- Skip if no customer_id
    IF customer_uuid IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Update customer statistics with optimized query
    UPDATE public.customers 
    SET 
        order_count = (
            SELECT COUNT(*) 
            FROM public.sales 
            WHERE customer_id = customer_uuid
        ),
        delivered_count = (
            SELECT COUNT(*) 
            FROM public.sales 
            WHERE customer_id = customer_uuid 
            AND order_status = 'paid'
        ),
        cancelled_count = (
            SELECT COUNT(*) 
            FROM public.sales 
            WHERE customer_id = customer_uuid 
            AND order_status = 'cancelled'
        ),
        total_spent = (
            SELECT COALESCE(SUM(grand_total), 0) 
            FROM public.sales 
            WHERE customer_id = customer_uuid 
            AND order_status = 'paid'
        ),
        last_purchase_date = (
            SELECT MAX(created_at)
            FROM public.sales 
            WHERE customer_id = customer_uuid 
            AND order_status = 'paid'
        ),
        updated_at = now()
    WHERE id = customer_uuid;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create a single trigger for all sales operations
CREATE TRIGGER update_customer_stats_single_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.update_customer_stats_optimized();

-- Add unique constraint to prevent duplicate sales with same invoice number
-- This will prevent database-level duplicates
ALTER TABLE public.sales 
ADD CONSTRAINT IF NOT EXISTS sales_invoice_number_unique 
UNIQUE (invoice_number);

-- Add index for better performance on customer_id lookups
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_status ON public.sales(order_status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);


