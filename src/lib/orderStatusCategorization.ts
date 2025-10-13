/**
 * Helper function to get categorized order status based on courier status
 * This applies the business logic for categorizing courier statuses into order statuses
 */
export const getCategorizedOrderStatus = (courierStatus: string): string => {
  if (!courierStatus) return 'pending';
  
  const normalizedStatus = courierStatus.toLowerCase().trim();
  
  // RETURN, PAID RETURN, and CANCELLED count as cancelled
  if (normalizedStatus.includes('return') || normalizedStatus.includes('cancelled')) {
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
