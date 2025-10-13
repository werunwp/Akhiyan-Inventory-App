# Updated Sales Cards Test Guide

## New Calculation Logic

### **Total Revenue Card:**
- **Includes**: All orders EXCEPT PAID RETURN, EXCHANGE, CANCELLED orders
- **Calculation**: Sum of `grand_total` for included orders
- **Count**: Number of included orders

### **Amount Paid Card:**
- **Includes**: ONLY DELIVERED and PARTIAL DELIVERY orders
- **Calculation**: Sum of `amount_paid` for included orders
- **Count**: Number of included orders

### **Amount Due Card:**
- **Includes**: All orders EXCEPT RETURN, EXCHANGE, CANCELLED, DELIVERED, PARTIAL DELIVERY orders
- **Calculation**: Sum of `amount_due` for included orders
- **Count**: Number of included orders

## Test Cases

### Test 1: Total Revenue Card
**Should Include:**
- ✅ PENDING orders
- ✅ PAID orders
- ✅ PARTIAL orders
- ✅ DELIVERED orders
- ✅ PARTIAL DELIVERY orders
- ✅ RETURN orders (not PAID RETURN)

**Should Exclude:**
- ❌ PAID RETURN orders
- ❌ EXCHANGE orders
- ❌ CANCELLED orders
- ❌ LOST orders

### Test 2: Amount Paid Card
**Should Include:**
- ✅ DELIVERED orders only
- ✅ PARTIAL DELIVERY orders only

**Should Exclude:**
- ❌ All other statuses (PENDING, PAID, PARTIAL, RETURN, EXCHANGE, etc.)

### Test 3: Amount Due Card
**Should Include:**
- ✅ PENDING orders
- ✅ PAID orders (if they have amount_due > 0)
- ✅ PARTIAL orders (if they have amount_due > 0)

**Should Exclude:**
- ❌ RETURN orders
- ❌ EXCHANGE orders
- ❌ CANCELLED orders
- ❌ DELIVERED orders
- ❌ PARTIAL DELIVERY orders
- ❌ LOST orders

## Example Test Scenario

Create the following test orders:

| Order | Status | Grand Total | Amount Paid | Amount Due | Total Revenue | Amount Paid | Amount Due |
|-------|--------|-------------|-------------|------------|---------------|-------------|------------|
| 1 | PENDING | 1000 | 0 | 1000 | ✅ Include | ❌ Exclude | ✅ Include |
| 2 | DELIVERED | 2000 | 2000 | 0 | ✅ Include | ✅ Include | ❌ Exclude |
| 3 | PARTIAL DELIVERY | 1500 | 1500 | 0 | ✅ Include | ✅ Include | ❌ Exclude |
| 4 | RETURN | 800 | 0 | 800 | ✅ Include | ❌ Exclude | ❌ Exclude |
| 5 | EXCHANGE | 1200 | 1200 | 0 | ❌ Exclude | ❌ Exclude | ❌ Exclude |
| 6 | PAID RETURN | 900 | 900 | 0 | ❌ Exclude | ❌ Exclude | ❌ Exclude |
| 7 | CANCELLED | 500 | 0 | 500 | ❌ Exclude | ❌ Exclude | ❌ Exclude |

**Expected Results:**
- **Total Revenue**: 1000 + 2000 + 1500 + 800 = 5300 (From 4 sales)
- **Amount Paid**: 2000 + 1500 = 3500 (From 2 sales)
- **Amount Due**: 1000 + 0 = 1000 (From 1 sale)

## Card Display Examples

### Total Revenue Card:
```
Total Revenue
৳5,300
From 4 sales
```

### Amount Paid Card:
```
Amount Paid
৳3,500
From 2 sales
```

### Amount Due Card:
```
Amount Due
৳1,000
From 1 sales
```

## Status Rules Summary

| Status | Total Revenue | Amount Paid | Amount Due |
|--------|---------------|-------------|------------|
| PENDING | ✅ Include | ❌ Exclude | ✅ Include |
| PAID | ✅ Include | ❌ Exclude | ✅ Include (if due > 0) |
| PARTIAL | ✅ Include | ❌ Exclude | ✅ Include (if due > 0) |
| DELIVERED | ✅ Include | ✅ Include | ❌ Exclude |
| PARTIAL DELIVERY | ✅ Include | ✅ Include | ❌ Exclude |
| RETURN | ✅ Include | ❌ Exclude | ❌ Exclude |
| EXCHANGE | ❌ Exclude | ❌ Exclude | ❌ Exclude |
| PAID RETURN | ❌ Exclude | ❌ Exclude | ❌ Exclude |
| CANCELLED | ❌ Exclude | ❌ Exclude | ❌ Exclude |
| LOST | ❌ Exclude | ❌ Exclude | ❌ Exclude |

## Verification Points

1. **Different Counts**: Each card should show different sales counts
2. **Correct Calculations**: Each card should calculate based on its specific rules
3. **Proper Exclusions**: Orders should be excluded according to the rules
4. **Accurate Totals**: Sums should match the expected calculations
