-- Check for all dependencies on payment_status column
-- Run this first to see what needs to be handled

-- 1. Check for views that depend on payment_status
SELECT 
    dependent_ns.nspname AS dependent_schema,
    dependent_view.relname AS dependent_view_name,
    dependent_view.relkind,
    'VIEW' as dependency_type
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_namespace AS dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
JOIN pg_attribute AS a ON pg_depend.refobjid = a.attrelid AND pg_depend.refobjsubid = a.attnum
WHERE a.attrelid = 'public.sales'::regclass
  AND a.attname = 'payment_status'

UNION ALL

-- 2. Check for RLS policies that might reference payment_status
SELECT 
    schemaname as dependent_schema,
    tablename as dependent_view_name,
    'r' as relkind,
    'RLS_POLICY' as dependency_type
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'sales'
AND (definition LIKE '%payment_status%' OR definition LIKE '%payment_status%')

UNION ALL

-- 3. Check for functions that might reference payment_status
SELECT 
    n.nspname as dependent_schema,
    p.proname as dependent_view_name,
    'f' as relkind,
    'FUNCTION' as dependency_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc LIKE '%payment_status%'
AND n.nspname = 'public'

UNION ALL

-- 4. Check for triggers that might reference payment_status
SELECT 
    n.nspname as dependent_schema,
    t.tgname as dependent_view_name,
    't' as relkind,
    'TRIGGER' as dependency_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'sales'
AND n.nspname = 'public'
AND t.tgname LIKE '%payment%';

-- 5. Check current column structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sales' 
AND table_schema = 'public'
AND column_name IN ('payment_status', 'order_status')
ORDER BY column_name;
