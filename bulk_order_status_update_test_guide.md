# Bulk Order Status Update Test Guide

## New Bulk Update Function

I've added a "Update Order Statuses" button to the Sales page that will update all existing orders with the correct `order_status` based on their current `courier_status`.

### **How to Use:**

1. **Click the "Update Order Statuses" button** in the Sales page header
2. **The function will:**
   - Fetch all sales from the database
   - Check each sale's current `order_status` vs what it should be
   - Update any mismatched orders
   - Show a success message with the count of updated orders

### **What It Updates:**

#### **Orders that will be updated:**
- **PAID RETURN** orders with `order_status = "pending"` → `order_status = "cancelled"`
- **RETURN** orders with `order_status = "pending"` → `order_status = "cancelled"`
- **EXCHANGE** orders with `order_status = "pending"` → `order_status = "paid"`
- **DELIVERED** orders with `order_status = "pending"` → `order_status = "paid"`
- **PARTIAL DELIVERY** orders with `order_status = "pending"` → `order_status = "paid"`

#### **Orders that won't be updated:**
- Orders that already have the correct `order_status`
- Orders with other courier statuses that should remain "pending"

## Test Cases

### Test 1: Update PAID RETURN Orders
1. Create a sale with `courier_status = "PAID RETURN"` and `order_status = "pending"`
2. Click "Update Order Statuses" button
3. **Expected**: The order's `order_status` should be updated to "cancelled"

### Test 2: Update EXCHANGE Orders
1. Create a sale with `courier_status = "EXCHANGE"` and `order_status = "pending"`
2. Click "Update Order Statuses" button
3. **Expected**: The order's `order_status` should be updated to "paid"

### Test 3: Update Multiple Orders
1. Create multiple sales with different courier statuses
2. Click "Update Order Statuses" button
3. **Expected**: All orders should be updated according to the rules

### Test 4: No Updates Needed
1. Ensure all orders already have correct `order_status`
2. Click "Update Order Statuses" button
3. **Expected**: Message "All order statuses are already correct"

## Console Output

The function provides detailed console output:

```
Starting bulk update of order statuses...
Found 25 sales to check
Sale abc123: PAID RETURN -> order_status: pending -> cancelled
Sale def456: EXCHANGE -> order_status: pending -> paid
Sale ghi789: DELIVERED -> order_status: pending -> paid
Updating 3 sales...
Successfully updated 3 order statuses
```

## Database Updates

The function updates the database with SQL like:

```sql
UPDATE sales SET order_status = 'cancelled' WHERE id = 'sale-id';
UPDATE sales SET order_status = 'paid' WHERE id = 'sale-id';
```

## Safety Features

1. **Batch Processing**: Updates are done in batches of 10 to avoid overwhelming the database
2. **Error Handling**: Individual update failures don't stop the entire process
3. **Progress Logging**: Detailed console output shows what's being updated
4. **Toast Notifications**: Success/error messages are shown to the user

## Verification

After running the update:

1. **Check the database**: Verify that `order_status` fields are updated correctly
2. **Check the cards**: The sales cards should now show correct calculations
3. **Check individual orders**: Each order should have the correct `order_status`

## Expected Results

| Courier Status | Before | After |
|----------------|--------|-------|
| PAID RETURN | pending | cancelled |
| RETURN | pending | cancelled |
| EXCHANGE | pending | paid |
| DELIVERED | pending | paid |
| PARTIAL DELIVERY | pending | paid |
| PENDING | pending | pending |
| IN TRANSIT | pending | pending |

This will fix the issue where existing orders with "PAID RETURN" status still have "pending" order_status!
