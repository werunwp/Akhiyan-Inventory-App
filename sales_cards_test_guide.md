# Sales Cards Test Guide

## Updated Card Functionality

### **Total Revenue Card:**
- Shows total revenue from paid sales only
- Displays count: "From X sales"
- Uses new paid status rules (DELIVERED, PARTIAL DELIVERY, EXCHANGE count as paid)

### **Amount Paid Card:**
- Shows total amount_paid from paid sales only
- Displays count: "From X sales" 
- Uses new paid status rules (DELIVERED, PARTIAL DELIVERY, EXCHANGE count as paid)

### **Amount Due Card:**
- Shows total amount_due from paid sales only
- Displays count: "From X sales"
- Uses new paid status rules (DELIVERED, PARTIAL DELIVERY, EXCHANGE count as paid)

## Test Cases

### Test 1: DELIVERED Status Sales
1. Create sales with courier_status = "DELIVERED"
2. Set different amount_paid and amount_due values
3. Check all three cards
4. **Expected**: All cards should include these sales in calculations and count

### Test 2: PARTIAL DELIVERY Status Sales
1. Create sales with courier_status = "PARTIAL DELIVERY"
2. Set different amount_paid and amount_due values
3. Check all three cards
4. **Expected**: All cards should include these sales in calculations and count

### Test 3: EXCHANGE Status Sales
1. Create sales with courier_status = "EXCHANGE"
2. Set different amount_paid and amount_due values
3. Check all three cards
4. **Expected**: All cards should include these sales in calculations and count

### Test 4: RETURN Status Sales (Should be excluded)
1. Create sales with courier_status = "RETURN"
2. Set different amount_paid and amount_due values
3. Check all three cards
4. **Expected**: All cards should NOT include these sales in calculations or count

### Test 5: PAID RETURN Status Sales (Should be excluded)
1. Create sales with courier_status = "PAID RETURN"
2. Set different amount_paid and amount_due values
3. Check all three cards
4. **Expected**: All cards should NOT include these sales in calculations or count

### Test 6: Mixed Status Sales
1. Create multiple sales with different statuses:
   - 2 DELIVERED sales (amount_paid: 100, 200)
   - 1 PARTIAL DELIVERY sale (amount_paid: 150)
   - 1 EXCHANGE sale (amount_paid: 300)
   - 1 RETURN sale (amount_paid: 50) - should be excluded
   - 1 PAID RETURN sale (amount_paid: 75) - should be excluded

2. **Expected Results:**
   - Total Revenue: Sum of grand_total for DELIVERED, PARTIAL DELIVERY, EXCHANGE sales
   - Amount Paid: 100 + 200 + 150 + 300 = 750 (excluding RETURN and PAID RETURN)
   - Amount Due: Sum of amount_due for DELIVERED, PARTIAL DELIVERY, EXCHANGE sales
   - Sales Count: 4 sales (DELIVERED, PARTIAL DELIVERY, EXCHANGE)

## Card Display Format

### Before:
```
Amount Paid
৳49,010
Received payments
```

### After:
```
Amount Paid
৳49,010
From 52 sales
```

## Verification Points

1. **Consistency**: All three cards should show the same sales count
2. **Accuracy**: Amount calculations should only include paid status sales
3. **Exclusion**: RETURN and PAID RETURN sales should not appear in any calculations
4. **Inclusion**: DELIVERED, PARTIAL DELIVERY, and EXCHANGE sales should appear in all calculations

## Status Rules Applied

| Status | Included in Cards | Revenue | Amount Paid | Amount Due |
|--------|------------------|---------|-------------|------------|
| DELIVERED | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| PARTIAL DELIVERY | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| EXCHANGE | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| RETURN | ❌ No | ❌ No | ❌ No | ❌ No |
| PAID RETURN | ❌ No | ❌ No | ❌ No | ❌ No |
| CANCELLED | ❌ No | ❌ No | ❌ No | ❌ No |
| LOST | ❌ No | ❌ No | ❌ No | ❌ No |
