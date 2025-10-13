# Status Display Test Guide

## Updated Status Display Logic

The sales table now shows categorized status instead of raw courier status values.

### **New Status Display Rules:**

#### **CANCELLED Status (Red Badge):**
- **RETURN** → Shows as "CANCELLED"
- **PAID RETURN** → Shows as "CANCELLED"
- Traditional cancelled statuses

#### **PAID Status (Green Badge):**
- **DELIVERED** → Shows as "PAID"
- **PARTIAL DELIVERY** → Shows as "PAID"
- **EXCHANGE** → Shows as "PAID"
- Traditional paid statuses

#### **Other Statuses (Gray Badge):**
- All other statuses show their original values (e.g., "PENDING", "IN TRANSIT", etc.)

## Test Cases

### Test 1: PAID RETURN Status Display
1. Create a sale with courier_status = "PAID RETURN"
2. Check the sales table
3. **Expected**: Should show "CANCELLED" with red badge (destructive variant)

### Test 2: EXCHANGE Status Display
1. Create a sale with courier_status = "EXCHANGE"
2. Check the sales table
3. **Expected**: Should show "PAID" with green badge (default variant)

### Test 3: PARTIAL DELIVERY Status Display
1. Create a sale with courier_status = "PARTIAL DELIVERY"
2. Check the sales table
3. **Expected**: Should show "PAID" with green badge (default variant)

### Test 4: DELIVERED Status Display
1. Create a sale with courier_status = "DELIVERED"
2. Check the sales table
3. **Expected**: Should show "PAID" with green badge (default variant)

### Test 5: RETURN Status Display
1. Create a sale with courier_status = "RETURN"
2. Check the sales table
3. **Expected**: Should show "CANCELLED" with red badge (destructive variant)

### Test 6: Other Statuses Display
1. Create sales with courier_status = "PENDING", "IN TRANSIT", "NOT SENT"
2. Check the sales table
3. **Expected**: Should show original status names with gray badge (secondary variant)

## Status Display Examples

### Before (Raw Status):
```
PAID RETURN  (showing original status)
EXCHANGE     (showing original status)
RETURN       (showing original status)
```

### After (Categorized Status):
```
CANCELLED    (red badge - PAID RETURN)
PAID         (green badge - EXCHANGE)
CANCELLED    (red badge - RETURN)
```

## Badge Variants

| Status Category | Badge Variant | Color |
|----------------|---------------|-------|
| CANCELLED | destructive | Red |
| PAID | default | Green |
| Other | secondary | Gray |

## Verification Points

1. **PAID RETURN orders** should show "CANCELLED" with red badge
2. **EXCHANGE orders** should show "PAID" with green badge
3. **PARTIAL DELIVERY orders** should show "PAID" with green badge
4. **DELIVERED orders** should show "PAID" with green badge
5. **RETURN orders** should show "CANCELLED" with red badge
6. **Other statuses** should show their original names with gray badge

## Implementation Details

The `getCategorizedStatus()` function:
1. Checks courier status first for special cases
2. Falls back to payment status for traditional cases
3. Returns both the display text and badge variant
4. Maintains backward compatibility for other statuses

This ensures that the status display in the table matches the categorization rules used in the card calculations.
