# SKU Functionality Test Guide

## Database Migration
1. Run the SQL script `fix_sku_constraint.sql` on your Supabase database
2. This will:
   - Drop the existing unique constraint on SKU
   - Create a new partial unique index that allows multiple NULL values
   - Only enforce uniqueness for non-NULL SKU values

## Frontend Changes Made
1. **Product Creation**: Empty SKU strings are converted to NULL
2. **Product Updates**: Empty SKU strings are converted to NULL  
3. **WooCommerce Import**: Empty SKU strings are converted to NULL
4. **Product Duplication**: If original has no SKU, duplicate will also have NULL SKU
5. **UI Improvements**: SKU field is now clearly marked as optional with helpful text

## Test Cases

### Test 1: Create Product with Empty SKU
1. Go to Products page
2. Click "Add Product"
3. Fill in product name and price
4. Leave SKU field empty
5. Click "Create Product"
6. **Expected**: Product should be created successfully without any SKU constraint errors

### Test 2: Create Product with Valid SKU
1. Go to Products page
2. Click "Add Product"
3. Fill in product name, price, and SKU (e.g., "SKU-001")
4. Click "Create Product"
5. **Expected**: Product should be created successfully with the SKU

### Test 3: Create Multiple Products with Empty SKU
1. Create first product with empty SKU
2. Create second product with empty SKU
3. **Expected**: Both products should be created successfully (no duplicate key error)

### Test 4: Update Product SKU to Empty
1. Edit an existing product that has a SKU
2. Clear the SKU field
3. Save the product
4. **Expected**: Product should be updated successfully with NULL SKU

### Test 5: Duplicate Product with No SKU
1. Find a product with no SKU
2. Duplicate it
3. **Expected**: Duplicated product should have NULL SKU (not generate a random one)

## Verification
- Check database: Multiple products can have NULL SKU values
- Check database: Only non-NULL SKU values are enforced for uniqueness
- Check UI: SKU field shows as optional with helpful text
- Check functionality: No more "duplicate key value violates unique constraint" errors
