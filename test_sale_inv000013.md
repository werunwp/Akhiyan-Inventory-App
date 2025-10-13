# Test Sale INV000013 - Order Status Verification

## What to Check

To verify if the order status logic is working correctly for sale INV000013, please check the following:

### **Database Query to Run:**

```sql
SELECT 
    id,
    invoice_number,
    courier_status,
    order_status,
    payment_status,
    customer_name,
    created_at
FROM sales 
WHERE invoice_number = 'INV000013';
```

### **Expected Results Based on Courier Status:**

| Courier Status | Expected Order Status | Should Be |
|----------------|----------------------|------------|
| **PAID RETURN** | cancelled | ✅ |
| **RETURN** | cancelled | ✅ |
| **EXCHANGE** | paid | ✅ |
| **DELIVERED** | paid | ✅ |
| **PARTIAL DELIVERY** | paid | ✅ |
| **PENDING** | pending | ✅ |
| **Other statuses** | pending | ✅ |

### **What to Look For:**

1. **If courier_status = "PAID RETURN":**
   - `order_status` should be `"cancelled"`
   - If it's still `"pending"`, the logic is not working

2. **If courier_status = "EXCHANGE":**
   - `order_status` should be `"paid"`
   - If it's still `"pending"`, the logic is not working

3. **If courier_status = "DELIVERED":**
   - `order_status` should be `"paid"`
   - If it's still `"pending"`, the logic is not working

### **Manual Verification Steps:**

1. **Open the Sales page** in the application
2. **Find sale INV000013** in the table
3. **Check the courier status** displayed
4. **Check the order status** (if visible in the table)
5. **Verify the sales cards** show correct calculations

### **If Order Status is Still "Pending":**

The issue might be:
1. **Logic not applied to existing sales** - Only new sales get the automatic order status
2. **Courier status not set** - If courier_status is null/empty, order_status defaults to "pending"
3. **Logic not working** - The categorization function might not be working correctly

### **To Fix Existing Sales:**

Use the "Direct Fix" button on the Sales page to update all existing sales with the correct order status based on their current courier status.

### **Expected Behavior:**

- **New sales**: Order status automatically set based on courier status
- **Existing sales**: Need to run the "Direct Fix" button to update
- **Sales cards**: Should show correct calculations based on order status

Please run the SQL query above and let me know what the results are for INV000013!
