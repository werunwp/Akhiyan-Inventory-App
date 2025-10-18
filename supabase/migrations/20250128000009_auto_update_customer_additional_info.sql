-- Auto-update customer additional_info fields with variation size values
-- This migration will populate empty additional_info fields for existing customers

-- Create function to extract size values from customer's purchase history
CREATE OR REPLACE FUNCTION public.update_customer_additional_info()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    customer_record RECORD;
    size_values TEXT[];
    additional_info TEXT;
BEGIN
    -- Loop through all customers with empty or null additional_info
    FOR customer_record IN 
        SELECT DISTINCT c.id, c.name
        FROM public.customers c
        WHERE c.additional_info IS NULL OR c.additional_info = ''
    LOOP
        -- Reset for each customer
        size_values := ARRAY[]::TEXT[];
        
        -- Get all size values from this customer's purchase history
        SELECT ARRAY_AGG(DISTINCT size_value)
        INTO size_values
        FROM (
            SELECT 
                jsonb_each_text(pv.attributes)->>'value' as size_value
            FROM public.sales s
            JOIN public.sales_items si ON s.id = si.sale_id
            JOIN public.product_variants pv ON si.variant_id = pv.id
            WHERE s.customer_id = customer_record.id
            AND pv.attributes IS NOT NULL
            AND jsonb_each_text(pv.attributes)->>'key' ILIKE '%size%'
            AND jsonb_each_text(pv.attributes)->>'value' IS NOT NULL
            AND jsonb_each_text(pv.attributes)->>'value' != ''
        ) size_data
        WHERE size_value IS NOT NULL;
        
        -- Format the additional_info if we found size values
        IF array_length(size_values, 1) > 0 THEN
            additional_info := 'Baby Age: ' || array_to_string(size_values, ', ');
            
            -- Update the customer's additional_info
            UPDATE public.customers 
            SET 
                additional_info = additional_info,
                updated_at = now()
            WHERE id = customer_record.id;
            
            RAISE NOTICE 'Updated customer % (%) with additional_info: %', 
                customer_record.name, customer_record.id, additional_info;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed updating customer additional_info fields';
END;
$function$;

-- Execute the function to update existing customers
SELECT public.update_customer_additional_info();

-- Create a function to update a specific customer's additional_info
CREATE OR REPLACE FUNCTION public.update_single_customer_additional_info(customer_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    size_values TEXT[];
    additional_info TEXT;
    customer_name TEXT;
BEGIN
    -- Get customer name
    SELECT name INTO customer_name FROM public.customers WHERE id = customer_uuid;
    
    -- Get all size values from this customer's purchase history
    SELECT ARRAY_AGG(DISTINCT size_value)
    INTO size_values
    FROM (
        SELECT 
            jsonb_each_text(pv.attributes)->>'value' as size_value
        FROM public.sales s
        JOIN public.sales_items si ON s.id = si.sale_id
        JOIN public.product_variants pv ON si.variant_id = pv.id
        WHERE s.customer_id = customer_uuid
        AND pv.attributes IS NOT NULL
        AND jsonb_each_text(pv.attributes)->>'key' ILIKE '%size%'
        AND jsonb_each_text(pv.attributes)->>'value' IS NOT NULL
        AND jsonb_each_text(pv.attributes)->>'value' != ''
    ) size_data
    WHERE size_value IS NOT NULL;
    
    -- Format the additional_info if we found size values
    IF array_length(size_values, 1) > 0 THEN
        additional_info := 'Baby Age: ' || array_to_string(size_values, ', ');
        
        -- Update the customer's additional_info
        UPDATE public.customers 
        SET 
            additional_info = additional_info,
            updated_at = now()
        WHERE id = customer_uuid;
        
        RETURN 'Updated customer ' || customer_name || ' with additional_info: ' || additional_info;
    ELSE
        RETURN 'No size variations found for customer ' || customer_name;
    END IF;
END;
$function$;

-- Create a function to get customers that need additional_info updates
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


