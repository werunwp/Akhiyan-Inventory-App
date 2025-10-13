import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSales } from "@/hooks/useSales";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { getCategorizedOrderStatus } from "@/lib/orderStatusCategorization";
import { ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourierStatusDetails } from "./CourierStatusDetails";

// Function to restore inventory when an order is cancelled
const restoreInventoryForCancelledOrder = async (saleId: string) => {
  try {
    // Get sale items
    const { data: saleItems, error: itemsError } = await supabase
      .from('sales_items')
      .select('*')
      .eq('sale_id', saleId);

    if (itemsError) {
      console.error('Error fetching sale items:', itemsError);
      return;
    }

    if (!saleItems || saleItems.length === 0) {
      console.log('No sale items found for cancelled order');
      return;
    }

    console.log('Restoring inventory for cancelled order items:', saleItems);

    // Restore inventory for each item
    for (const item of saleItems) {
      if (item.variant_id) {
        // Restore variant inventory
        const { data: currentVariant, error: getVariantError } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', item.variant_id)
          .single();

        if (getVariantError) {
          console.error('Error getting variant current stock:', getVariantError);
          continue;
        }

        const { error: variantError } = await supabase
          .from('product_variants')
          .update({ 
            stock_quantity: (currentVariant.stock_quantity || 0) + item.quantity
          })
          .eq('id', item.variant_id);

        if (variantError) {
          console.error('Error restoring variant inventory:', variantError);
        } else {
          console.log(`Restored ${item.quantity} units to variant ${item.variant_id}`);
        }

        // Log inventory change
        await supabase
          .from('inventory_logs')
          .insert({
            product_id: item.product_id,
            variant_id: item.variant_id,
            type: 'restore_cancellation',
            quantity: item.quantity,
            reason: `Restored due to order cancellation (Sale ID: ${saleId})`
          });
      } else {
        // Restore product inventory
        const { data: currentProduct, error: getProductError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (getProductError) {
          console.error('Error getting product current stock:', getProductError);
          continue;
        }

        const { error: productError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: (currentProduct.stock_quantity || 0) + item.quantity
          })
          .eq('id', item.product_id);

        if (productError) {
          console.error('Error restoring product inventory:', productError);
        } else {
          console.log(`Restored ${item.quantity} units to product ${item.product_id}`);
        }

        // Log inventory change
        await supabase
          .from('inventory_logs')
          .insert({
            product_id: item.product_id,
            type: 'restore_cancellation',
            quantity: item.quantity,
            reason: `Restored due to order cancellation (Sale ID: ${saleId})`
          });
      }
    }

    console.log('Inventory restoration completed for cancelled order');
  } catch (error) {
    console.error('Error restoring inventory for cancelled order:', error);
  }
};

interface SaleDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}

interface SaleWithItems {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_whatsapp?: string;
  city?: string;
  zone?: string;
  area?: string;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  payment_method: string;
  order_status: string;
  order_status?: string;
  courier_status?: string;
  consignment_id?: string;
  last_status_check?: string;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    rate: number;
    total: number;
    variant_id: string | null;
    variant_attributes?: Record<string, string>;
    product_image_url?: string; // Added for product image
  }>;
}

export const SaleDetailsDialog = ({ open, onOpenChange, saleId }: SaleDetailsDialogProps) => {
  const { getSaleWithItems } = useSales();
  const [sale, setSale] = useState<SaleWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const { formatAmount } = useCurrency();

  const fetchSaleDetails = async () => {
    if (!saleId) return;
    
    setIsLoading(true);
    try {
      const saleData = await getSaleWithItems(saleId);
      setSale(saleData);
    } catch (error) {
      console.error("Error fetching sale details:", error);
      toast.error("Failed to load sale details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusRefresh = async (consignmentId: string) => {
    setIsRefreshingStatus(true);
    
    try {
      // Get webhook settings for status check (using same pattern as useWebhookSettings)
      const { data: webhookData } = await supabase
        .from('courier_webhook_settings')
        .select('*')
        .limit(1);
      
      const webhookSettings = webhookData?.[0];

      if (!webhookSettings?.status_check_webhook_url) {
        toast.error("No status check webhook URL configured");
        return;
      }

      // Prepare headers for webhook request
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add Basic Auth if credentials are configured
      if (webhookSettings.auth_username && webhookSettings.auth_password &&
          webhookSettings.auth_username.trim() !== '' && webhookSettings.auth_password.trim() !== '') {
        const credentials = btoa(`${webhookSettings.auth_username}:${webhookSettings.auth_password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }

      // Send status check request to the webhook
      // Build URL with only consignment_id parameter
      const url = new URL(webhookSettings.status_check_webhook_url);
      url.searchParams.append('consignment_id', consignmentId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(headers.Authorization && { 'Authorization': headers.Authorization })
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Status check response:', result);
        
        // Handle the specific response format from your webhook
        let newCourierStatus = 'pending';
        
        if (Array.isArray(result) && result.length > 0) {
          // Format: [{ "type": "success", "code": 200, "data": { "order_status": "..." } }]
          const firstResponse = result[0];
          if (firstResponse.type === 'success' && firstResponse.data) {
            newCourierStatus = firstResponse.data.order_status || 'pending';
          }
        } else if (result.data && result.data.order_status) {
          // Fallback format: { "data": { "order_status": "..." } }
          newCourierStatus = result.data.order_status;
        } else if (result.order_status) {
          // Direct format: { "order_status": "..." }
          newCourierStatus = result.order_status;
        }
        
        console.log('Extracted courier status:', newCourierStatus);
        
        // Normalize status for consistent display
        const normalizedStatus = newCourierStatus.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let displayStatus = newCourierStatus;
        
        if (normalizedStatus.includes('pickup_cancelled') || normalizedStatus.includes('pickup_cancel')) {
          displayStatus = 'cancelled';
        } else if (normalizedStatus.includes('in_transit') || normalizedStatus.includes('picked_up')) {
          displayStatus = 'in_transit';
        } else if (normalizedStatus.includes('out_for_delivery')) {
          displayStatus = 'out_for_delivery';
        } else if (normalizedStatus.includes('delivered') || normalizedStatus.includes('completed')) {
          displayStatus = 'delivered';
        } else if (normalizedStatus.includes('returned')) {
          displayStatus = 'returned';
        }
        
        console.log('Normalized display status:', displayStatus);
        
        // Map courier status to payment status for business logic
        let orderStatusUpdate = {};
        if (normalizedStatus.includes('delivered') || normalizedStatus.includes('completed')) {
          orderStatusUpdate = { order_status: 'paid' };
          console.log('SaleDetails: Setting order status to: paid');
        } else if (normalizedStatus.includes('returned') || normalizedStatus.includes('cancelled') || 
                   normalizedStatus.includes('pickup_cancelled') || normalizedStatus.includes('pickup_cancel') || normalizedStatus.includes('lost')) {
          orderStatusUpdate = { order_status: 'cancelled' };
          console.log('SaleDetails: Setting order status to: cancelled');
        } else {
          console.log('SaleDetails: No payment status update needed for status:', normalizedStatus);
        }
        
        console.log('SaleDetails: Order status update object:', orderStatusUpdate);
        
        
        // Update the sale in database and local state
        const { error: updateError } = await supabase
          .from('sales')
          .update({ 
            courier_status: displayStatus,
            order_status: getCategorizedOrderStatus(displayStatus),
            last_status_check: new Date().toISOString(),
            ...orderStatusUpdate
          })
          .eq('id', saleId);

        // If order is cancelled, restore inventory
        if (displayStatus === 'cancelled') {
          console.log('Order cancelled via dialog, restoring inventory...');
          await restoreInventoryForCancelledOrder(saleId);
        }
        
        if (!updateError && sale) {
          setSale({
            ...sale,
            courier_status: displayStatus,
            order_status: getCategorizedOrderStatus(displayStatus),
            last_status_check: new Date().toISOString(),
            ...orderStatusUpdate
          });
          toast.success(`Status updated to: ${displayStatus}`);
        } else if (updateError) {
          console.error('Failed to update sale status:', updateError);
          toast.error('Failed to update status in database');
        }
      } else {
        const errorText = await response.text();
        console.error('Status check failed:', response.status, errorText);
        toast.error(`Status check failed: ${response.status}`);
      }
    } catch (error) {
      console.error("Error refreshing status:", error);
      toast.error('Failed to check status');
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  useEffect(() => {
    if (open && saleId) {
      fetchSaleDetails();
    }
  }, [open, saleId]);

  if (!sale) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            {isLoading ? (
              <p>Loading sale details...</p>
            ) : (
              <p>No sale data found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Sale Details - {sale.invoice_number}
            <Badge variant={
              sale.order_status === "paid" ? "default" : 
              sale.order_status === "cancelled" ? "destructive" : 
              "secondary"
            }>
              {sale.order_status?.charAt(0).toUpperCase() + sale.order_status?.slice(1)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {/* Customer Information */}
          <Card className="border-2 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <CardHeader className="bg-gradient-to-r from-blue-100/30 to-indigo-100/30 border-b">
              <CardTitle className="text-lg text-blue-900">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">{sale.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{sale.customer_phone || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">{sale.customer_whatsapp || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">{sale.customer_address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">City</p>
                  <p className="text-sm text-muted-foreground">{sale.city || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Zone</p>
                  <p className="text-sm text-muted-foreground">{sale.zone || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Area</p>
                  <p className="text-sm text-muted-foreground">{sale.area || "Not provided"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sale Information */}
          <Card className="border-2 bg-gradient-to-r from-green-50/50 to-emerald-50/50">
            <CardHeader className="bg-gradient-to-r from-green-100/30 to-emerald-100/30 border-b">
              <CardTitle className="text-lg text-green-900">Sale Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Payment Method</p>
                <p className="text-sm text-muted-foreground">{sale.payment_method}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Created At</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(sale.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(sale.updated_at), "MMM dd, yyyy 'at' hh:mm a")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Courier Status Card - Full Width */}
          <div className="col-span-full">
            <CourierStatusDetails 
              sale={sale}
              onRefreshStatus={async (saleId, consignmentId) => {
                await handleStatusRefresh(consignmentId);
                return true;
              }}
              isRefreshing={isRefreshingStatus}
            />
          </div>
        </div>

        {/* Items Table */}
        <Card className="border-2 bg-gradient-to-r from-orange-50/50 to-amber-50/50">
          <CardHeader className="bg-gradient-to-r from-orange-100/30 to-amber-100/30 border-b">
            <CardTitle className="text-lg text-orange-900">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {/* Product Image */}
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                          {item.product_image_url ? (
                            <img
                              src={item.product_image_url}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to placeholder if image fails to load
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-500">No Image</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.product_name}</p>
                          {item.variant_attributes && (
                            <p className="text-sm text-muted-foreground">
                              {Object.entries(item.variant_attributes)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatAmount(item.rate)}</TableCell>
                    <TableCell className="text-right">{formatAmount(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="border-2 bg-gradient-to-r from-teal-50/50 to-cyan-50/50">
          <CardHeader className="bg-gradient-to-r from-teal-100/30 to-cyan-100/30 border-b">
            <CardTitle className="text-lg text-teal-900">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatAmount(sale.subtotal)}</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({sale.discount_percent}%)</span>
                <span>-{formatAmount(sale.discount_amount)}</span>
              </div>
            )}
            {sale.fee > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Charge/Fee</span>
                <span>+{formatAmount(sale.fee)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Grand Total</span>
              <span>{formatAmount(sale.grand_total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Amount Paid</span>
              <span className="text-green-600">{formatAmount(sale.amount_paid)}</span>
            </div>
            {sale.amount_due > 0 && (
              <div className="flex justify-between">
                <span>Amount Due</span>
                <span className="text-red-600">{formatAmount(sale.amount_due)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};