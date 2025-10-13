# Order Status Update Test Guide

## Updated Order Status Logic

The `order_status` field in the database is now automatically updated based on the `courier_status` using your categorization rules.

### **Order Status Update Rules:**

#### **CANCELLED Status:**
- **RETURN** → `order_status` = "cancelled"
- **PAID RETURN** → `order_status` = "cancelled"

#### **PAID Status:**
- **DELIVERED** → `order_status` = "paid"
- **PARTIAL DELIVERY** → `order_status` = "paid"
- **EXCHANGE** → `order_status` = "paid"

#### **PENDING Status:**
- All other statuses → `order_status` = "pending"

## How It Works

1. **Automatic Updates**: When courier status is updated (via status refresh), the order_status is automatically updated based on the categorization rules
2. **Database Field**: The `order_status` field in the sales table is updated with the categorized status
3. **Real-time**: Updates happen immediately when status is refreshed

## Test Cases

### Test 1: PAID RETURN Order
1. Create a sale with courier_status = "PAID RETURN"
2. Refresh the status (or wait for automatic update)
3. **Expected**: `order_status` should be updated to "cancelled"

### Test 2: EXCHANGE Order
1. Create a sale with courier_status = "EXCHANGE"
2. Refresh the status (or wait for automatic update)
3. **Expected**: `order_status` should be updated to "paid"

### Test 3: PARTIAL DELIVERY Order
1. Create a sale with courier_status = "PARTIAL DELIVERY"
2. Refresh the status (or wait for automatic update)
3. **Expected**: `order_status` should be updated to "paid"

### Test 4: DELIVERED Order
1. Create a sale with courier_status = "DELIVERED"
2. Refresh the status (or wait for automatic update)
3. **Expected**: `order_status` should be updated to "paid"

### Test 5: RETURN Order
1. Create a sale with courier_status = "RETURN"
2. Refresh the status (or wait for automatic update)
3. **Expected**: `order_status` should be updated to "cancelled"

### Test 6: Other Statuses
1. Create sales with courier_status = "PENDING", "IN TRANSIT", "NOT SENT"
2. Refresh the status (or wait for automatic update)
3. **Expected**: `order_status` should be updated to "pending"

## Database Updates

The system now updates both fields when courier status changes:

```sql
UPDATE sales SET 
  courier_status = 'PAID RETURN',
  order_status = 'cancelled',
  last_status_check = '2024-01-15T10:30:00Z'
WHERE id = 'sale-id';
```

## Verification Points

1. **Database Field**: Check that `order_status` field is updated in the database
2. **Automatic Updates**: Status refresh should update both courier_status and order_status
3. **Rule Application**: 
   - RETURN/PAID RETURN → "cancelled"
   - DELIVERED/PARTIAL DELIVERY/EXCHANGE → "paid"
   - Others → "pending"
4. **Real-time**: Updates should happen immediately when status is refreshed

## Implementation Details

The `getCategorizedOrderStatus()` function:
1. Takes the courier_status as input
2. Applies the categorization rules
3. Returns the appropriate order_status value
4. Is used in the status refresh logic to update the database

This ensures that the order_status field always reflects the business categorization based on the courier status, making it consistent with the card calculations and business logic.
