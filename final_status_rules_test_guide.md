# Final Status Rules Test Guide

## Updated Status Categorization

### **PAID Status (Counted as Successful Sales):**
- ✅ **DELIVERED** - Counts as paid
- ✅ **PARTIAL DELIVERY** - Counts as paid  
- ✅ **EXCHANGE** - Counts as paid
- ✅ Traditional payment statuses: `paid`, `pending`, `partial`

### **CANCELLED Status (Counted as Cancelled Sales):**
- ❌ **RETURN** - Counts as cancelled
- ❌ **PAID RETURN** - Counts as cancelled
- ❌ Traditional cancellation statuses: `cancelled`, `cancel`, `lost`

## Updated Card Logic

### **Total Revenue Card:**
- **Includes**: All orders EXCEPT RETURN, PAID RETURN, CANCELLED orders
- **Now includes**: EXCHANGE orders (now count as paid)
- **Calculation**: Sum of `grand_total` for included orders

### **Amount Paid Card:**
- **Includes**: DELIVERED, PARTIAL DELIVERY, and EXCHANGE orders
- **Calculation**: Sum of `amount_paid` for included orders

### **Amount Due Card:**
- **Includes**: All orders EXCEPT RETURN, PAID RETURN, CANCELLED, DELIVERED, PARTIAL DELIVERY, EXCHANGE orders
- **Calculation**: Sum of `amount_due` for included orders

## Test Cases

### Test 1: EXCHANGE Status (Now Counts as Paid)
1. Create a sale with courier_status = "EXCHANGE"
2. Check all three cards
3. **Expected**: 
   - Total Revenue: ✅ Include
   - Amount Paid: ✅ Include
   - Amount Due: ❌ Exclude

### Test 2: RETURN Status (Now Counts as Cancelled)
1. Create a sale with courier_status = "RETURN"
2. Check all three cards
3. **Expected**: 
   - Total Revenue: ❌ Exclude
   - Amount Paid: ❌ Exclude
   - Amount Due: ❌ Exclude

### Test 3: PAID RETURN Status (Now Counts as Cancelled)
1. Create a sale with courier_status = "PAID RETURN"
2. Check all three cards
3. **Expected**: 
   - Total Revenue: ❌ Exclude
   - Amount Paid: ❌ Exclude
   - Amount Due: ❌ Exclude

### Test 4: PARTIAL DELIVERY Status (Counts as Paid)
1. Create a sale with courier_status = "PARTIAL DELIVERY"
2. Check all three cards
3. **Expected**: 
   - Total Revenue: ✅ Include
   - Amount Paid: ✅ Include
   - Amount Due: ❌ Exclude

## Example Test Scenario

Create the following test orders:

| Order | Status | Grand Total | Amount Paid | Amount Due | Total Revenue | Amount Paid | Amount Due |
|-------|--------|-------------|-------------|------------|---------------|-------------|------------|
| 1 | PENDING | 1000 | 0 | 1000 | ✅ Include | ❌ Exclude | ✅ Include |
| 2 | DELIVERED | 2000 | 2000 | 0 | ✅ Include | ✅ Include | ❌ Exclude |
| 3 | PARTIAL DELIVERY | 1500 | 1500 | 0 | ✅ Include | ✅ Include | ❌ Exclude |
| 4 | EXCHANGE | 1200 | 1200 | 0 | ✅ Include | ✅ Include | ❌ Exclude |
| 5 | RETURN | 800 | 0 | 800 | ❌ Exclude | ❌ Exclude | ❌ Exclude |
| 6 | PAID RETURN | 900 | 900 | 0 | ❌ Exclude | ❌ Exclude | ❌ Exclude |
| 7 | CANCELLED | 500 | 0 | 500 | ❌ Exclude | ❌ Exclude | ❌ Exclude |

**Expected Results:**
- **Total Revenue**: 1000 + 2000 + 1500 + 1200 = 5700 (From 4 sales)
- **Amount Paid**: 2000 + 1500 + 1200 = 4700 (From 3 sales)
- **Amount Due**: 1000 + 0 = 1000 (From 1 sale)

## Status Rules Summary

| Status | Total Revenue | Amount Paid | Amount Due | Category |
|--------|---------------|-------------|------------|----------|
| PENDING | ✅ Include | ❌ Exclude | ✅ Include | Active |
| DELIVERED | ✅ Include | ✅ Include | ❌ Exclude | Paid |
| PARTIAL DELIVERY | ✅ Include | ✅ Include | ❌ Exclude | Paid |
| EXCHANGE | ✅ Include | ✅ Include | ❌ Exclude | Paid |
| RETURN | ❌ Exclude | ❌ Exclude | ❌ Exclude | Cancelled |
| PAID RETURN | ❌ Exclude | ❌ Exclude | ❌ Exclude | Cancelled |
| CANCELLED | ❌ Exclude | ❌ Exclude | ❌ Exclude | Cancelled |
| LOST | ❌ Exclude | ❌ Exclude | ❌ Exclude | Cancelled |

## Key Changes Made

### **From Previous Version:**
- **EXCHANGE**: Now counts as paid (was excluded from Total Revenue)
- **RETURN**: Now counts as cancelled (was included in Total Revenue)
- **PAID RETURN**: Now counts as cancelled (was excluded from Total Revenue)

### **Consistent Logic:**
- Both Sales page and Reports page use the same categorization
- All cards show different sales counts based on their specific rules
- Status categorization is consistent across the application

## Verification Points

1. **EXCHANGE orders** should appear in Total Revenue and Amount Paid
2. **RETURN and PAID RETURN orders** should be excluded from all calculations
3. **PARTIAL DELIVERY orders** should appear in Total Revenue and Amount Paid
4. **Different sales counts** should be shown on each card
5. **Consistent logic** between Sales and Reports pages
