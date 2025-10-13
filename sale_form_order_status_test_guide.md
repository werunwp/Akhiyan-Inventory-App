# Sale Form Order Status Test Guide

## Updated Sale Creation Form

I've updated the sale creation form to include a **Courier Status** dropdown and automatically set the **Order Status** based on your categorization rules.

### **New Features:**

1. **Courier Status Dropdown**: Added to the sale creation form
2. **Automatic Order Status**: Order status is automatically set based on courier status
3. **Categorization Rules**: Applied your business rules to determine order status

## How It Works

### **Courier Status Options:**
- Not Set (default)
- Pending
- In Transit
- Out for Delivery
- Delivered
- Partial Delivery
- Return
- **Paid Return**
- Exchange
- Cancelled
- Lost

### **Automatic Order Status Rules:**

| Courier Status | Order Status |
|----------------|--------------|
| **PAID RETURN** | cancelled |
| **RETURN** | cancelled |
| **EXCHANGE** | paid |
| **DELIVERED** | paid |
| **PARTIAL DELIVERY** | paid |
| **Other statuses** | pending |

## Test Cases

### Test 1: Create Sale with PAID RETURN
1. **Open "Create New Sale" dialog**
2. **Fill in customer details and items**
3. **Select "Paid Return" from Courier Status dropdown**
4. **Submit the sale**
5. **Expected**: Order status should be automatically set to "cancelled"

### Test 2: Create Sale with EXCHANGE
1. **Open "Create New Sale" dialog**
2. **Fill in customer details and items**
3. **Select "Exchange" from Courier Status dropdown**
4. **Submit the sale**
5. **Expected**: Order status should be automatically set to "paid"

### Test 3: Create Sale with DELIVERED
1. **Open "Create New Sale" dialog**
2. **Fill in customer details and items**
3. **Select "Delivered" from Courier Status dropdown**
4. **Submit the sale**
5. **Expected**: Order status should be automatically set to "paid"

### Test 4: Create Sale with PENDING
1. **Open "Create New Sale" dialog**
2. **Fill in customer details and items**
3. **Select "Pending" from Courier Status dropdown**
4. **Submit the sale**
5. **Expected**: Order status should be automatically set to "pending"

## Form Layout

The sale creation form now has:

1. **Customer Information** (existing)
2. **Payment Information** (existing)
3. **Order Status** dropdown (existing - for payment status)
4. **Courier Status** dropdown (NEW)
5. **Order Summary** (existing)

## Implementation Details

### **Sale Creation Logic:**
```javascript
// Helper function to get categorized order status
const getCategorizedOrderStatus = (courierStatus: string) => {
  if (!courierStatus) return 'pending';
  
  const normalizedStatus = courierStatus.toLowerCase().trim();
  
  // RETURN and PAID RETURN count as cancelled
  if (normalizedStatus.includes('return')) {
    return 'cancelled';
  }
  
  // DELIVERED, PARTIAL DELIVERY, and EXCHANGE count as paid
  if (normalizedStatus.includes('delivered') || 
      normalizedStatus.includes('partial') || 
      normalizedStatus.includes('exchange')) {
    return 'paid';
  }
  
  // Default to pending for other statuses
  return 'pending';
};
```

### **Database Updates:**
- `order_status` field is now included in sale creation
- Automatically set based on courier status selection
- Follows your business categorization rules

## Expected Results

| Courier Status Selection | Order Status Set To |
|-------------------------|-------------------|
| Paid Return | cancelled |
| Return | cancelled |
| Exchange | paid |
| Delivered | paid |
| Partial Delivery | paid |
| Pending | pending |
| In Transit | pending |
| Out for Delivery | pending |
| Cancelled | pending |
| Lost | pending |

## Benefits

- ✅ **Automatic categorization** - No manual order status selection needed
- ✅ **Business rule compliance** - Follows your categorization rules
- ✅ **User-friendly** - Clear courier status options
- ✅ **Consistent** - Same rules applied to all new sales
- ✅ **Database integrity** - Order status is always set correctly

## Verification

After creating a sale:

1. **Check the sales table** - Order status should show the correct categorization
2. **Check the sales cards** - Calculations should reflect the correct order status
3. **Check individual sale details** - Order status should match the courier status selection

This ensures that new sales are created with the correct order status from the start, following your business rules!
