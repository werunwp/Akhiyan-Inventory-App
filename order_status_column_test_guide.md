# Order Status Column Test Guide

## New Table Structure

The sales table now has two status columns:

1. **Courier Status** - Shows the original courier status (unchanged)
2. **Order Status** - Shows the categorized business status based on rules

## Order Status Column Rules

### **CANCELLED Status (Red Badge):**
- **RETURN** → Shows as "CANCELLED"
- **PAID RETURN** → Shows as "CANCELLED"
- Traditional cancelled statuses

### **PAID Status (Green Badge):**
- **DELIVERED** → Shows as "PAID"
- **PARTIAL DELIVERY** → Shows as "PAID"
- **EXCHANGE** → Shows as "PAID"
- Traditional paid statuses

### **Other Statuses (Gray Badge):**
- All other statuses show their original values (e.g., "PENDING", "IN TRANSIT", etc.)

## Test Cases

### Test 1: PAID RETURN Order
1. Create a sale with courier_status = "PAID RETURN"
2. Check the table
3. **Expected**: 
   - Courier Status: "PAID RETURN" (original)
   - Order Status: "CANCELLED" (red badge)

### Test 2: EXCHANGE Order
1. Create a sale with courier_status = "EXCHANGE"
2. Check the table
3. **Expected**: 
   - Courier Status: "EXCHANGE" (original)
   - Order Status: "PAID" (green badge)

### Test 3: PARTIAL DELIVERY Order
1. Create a sale with courier_status = "PARTIAL DELIVERY"
2. Check the table
3. **Expected**: 
   - Courier Status: "PARTIAL DELIVERY" (original)
   - Order Status: "PAID" (green badge)

### Test 4: DELIVERED Order
1. Create a sale with courier_status = "DELIVERED"
2. Check the table
3. **Expected**: 
   - Courier Status: "DELIVERED" (original)
   - Order Status: "PAID" (green badge)

### Test 5: RETURN Order
1. Create a sale with courier_status = "RETURN"
2. Check the table
3. **Expected**: 
   - Courier Status: "RETURN" (original)
   - Order Status: "CANCELLED" (red badge)

### Test 6: Other Statuses
1. Create sales with courier_status = "PENDING", "IN TRANSIT", "NOT SENT"
2. Check the table
3. **Expected**: 
   - Courier Status: Shows original status
   - Order Status: Shows original status (gray badge)

## Table Display Example

| Invoice | Customer | Date | Amount | Courier Status | Order Status | Actions |
|---------|----------|------|--------|----------------|--------------|---------|
| INV-001 | John Doe | Jan 15 | $100 | PAID RETURN | CANCELLED | [Actions] |
| INV-002 | Jane Smith | Jan 15 | $200 | EXCHANGE | PAID | [Actions] |
| INV-003 | Bob Wilson | Jan 15 | $150 | PARTIAL DELIVERY | PAID | [Actions] |
| INV-004 | Alice Brown | Jan 15 | $300 | RETURN | CANCELLED | [Actions] |
| INV-005 | Charlie Lee | Jan 15 | $250 | PENDING | PENDING | [Actions] |

## Benefits

1. **Preserves Original Information**: Courier status shows the actual courier status
2. **Business Categorization**: Order status shows the business-relevant category
3. **Clear Visual Distinction**: Different badge colors for different categories
4. **Consistent with Card Logic**: Order status matches the categorization used in cards

## Verification Points

1. **Courier Status column** should always show the original courier status
2. **Order Status column** should show the categorized status based on rules
3. **PAID RETURN orders** should show "CANCELLED" in Order Status
4. **EXCHANGE orders** should show "PAID" in Order Status
5. **Color coding** should be consistent (red for cancelled, green for paid, gray for others)
6. **Table layout** should accommodate the new column properly
