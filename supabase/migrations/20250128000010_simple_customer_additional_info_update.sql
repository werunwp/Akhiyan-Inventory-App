-- Simple migration to update customer additional_info fields
-- This migration provides a basic structure without complex functions

-- Create a simple function to get customers that need additional_info updates
CREATE OR REPLACE FUNCTION public.get_customers_needing_additional_info()
RETURNS TABLE(
    customer_id UUID,
    customer_name TEXT,
    current_additional_info TEXT,
    has_purchases_with_variants BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.additional_info,
        EXISTS(
            SELECT 1 
            FROM public.sales s
            JOIN public.sales_items si ON s.id = si.sale_id
            JOIN public.product_variants pv ON si.variant_id = pv.id
            WHERE s.customer_id = c.id
            AND pv.attributes IS NOT NULL
            AND jsonb_each_text(pv.attributes)->>'key' ILIKE '%size%'
        ) as has_purchases_with_variants
    FROM public.customers c
    WHERE (c.additional_info IS NULL OR c.additional_info = '')
    AND EXISTS(
        SELECT 1 
        FROM public.sales s
        JOIN public.sales_items si ON s.id = si.sale_id
        JOIN public.product_variants pv ON si.variant_id = pv.id
        WHERE s.customer_id = c.id
        AND pv.attributes IS NOT NULL
        AND jsonb_each_text(pv.attributes)->>'key' ILIKE '%size%'
    )
    ORDER BY c.name;
END;
$function$;

-- Add index for better performance on customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_additional_info ON public.customers(additional_info) WHERE additional_info IS NULL OR additional_info = '';


