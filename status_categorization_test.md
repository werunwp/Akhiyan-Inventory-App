# Status Categorization Test Guide

## New Status Rules Implemented

### **PAID Status (Counted as Successful Sales):**
- ✅ **DELIVERED** - Counts as paid
- ✅ **PARTIAL DELIVERY** - Counts as paid  
- ✅ **EXCHANGE** - Counts as paid
- ✅ Traditional payment statuses: `paid`, `pending`, `partial`

### **CANCELLED Status (Counted as Cancelled Sales):**
- ❌ **RETURN** - Counts as cancelled
- ❌ **PAID RETURN** - Counts as cancelled
- ❌ Traditional cancellation statuses: `cancelled`, `cancel`, `lost`

### **Special Cases:**
- ✅ **EXCHANGE** - Counts as paid (even though it contains "return")
- ❌ **RETURN** - Counts as cancelled
- ❌ **PAID RETURN** - Counts as cancelled

## Test Cases

### Test 1: DELIVERED Status
1. Create a sale with courier_status = "DELIVERED"
2. Check Sales page statistics
3. **Expected**: Sale should be counted in total revenue and paid sales

### Test 2: PARTIAL DELIVERY Status  
1. Create a sale with courier_status = "PARTIAL DELIVERY"
2. Check Sales page statistics
3. **Expected**: Sale should be counted in total revenue and paid sales

### Test 3: EXCHANGE Status
1. Create a sale with courier_status = "EXCHANGE"
2. Check Sales page statistics
3. **Expected**: Sale should be counted in total revenue and paid sales

### Test 4: RETURN Status
1. Create a sale with courier_status = "RETURN"
2. Check Sales page statistics
3. **Expected**: Sale should be counted as cancelled, NOT in revenue

### Test 5: PAID RETURN Status
1. Create a sale with courier_status = "PAID RETURN"
2. Check Sales page statistics
3. **Expected**: Sale should be counted as cancelled, NOT in revenue

### Test 6: Mixed Statuses
1. Create multiple sales with different statuses
2. Check that:
   - DELIVERED, PARTIAL DELIVERY, EXCHANGE count as paid
   - RETURN, PAID RETURN count as cancelled
   - Revenue calculations are correct

## Verification Points

### Sales Page:
- Total Revenue should include DELIVERED, PARTIAL DELIVERY, EXCHANGE
- Total Revenue should NOT include RETURN, PAID RETURN
- Sales count should reflect paid sales only
- Cancelled sales count should reflect cancelled sales

### Reports Page:
- Successful orders should include DELIVERED, PARTIAL DELIVERY, EXCHANGE
- Cancelled orders should include RETURN, PAID RETURN
- Revenue calculations should match the new rules

## Status Examples

| Courier Status | Payment Status | Should Count As | Revenue Included |
|---------------|----------------|-----------------|------------------|
| DELIVERED | pending | Paid | Yes |
| PARTIAL DELIVERY | partial | Paid | Yes |
| EXCHANGE | paid | Paid | Yes |
| RETURN | paid | Cancelled | No |
| PAID RETURN | paid | Cancelled | No |
| CANCELLED | cancelled | Cancelled | No |
| LOST | pending | Cancelled | No |

## Implementation Details

The new logic uses helper functions:
- `isPaidSale()` - Determines if a sale should count as paid
- `isCancelledSale()` - Determines if a sale should count as cancelled

Both Sales page and Reports page now use the same categorization logic for consistency.
