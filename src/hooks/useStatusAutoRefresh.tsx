import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCategorizedOrderStatus } from '@/lib/orderStatusCategorization';

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

export const useStatusAutoRefresh = () => {
  const queryClient = useQueryClient();

  // Auto refresh courier status every hour
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Get all sales with consignment IDs
        const { data: salesWithTracking } = await supabase
          .from('sales')
          .select('id, consignment_id')
          .not('consignment_id', 'is', null)
          .neq('courier_status', 'delivered')
          .neq('courier_status', 'returned')
          .neq('courier_status', 'lost');

        if (!salesWithTracking || salesWithTracking.length === 0) return;

        // Get webhook settings for status check (using same pattern as useWebhookSettings)
        const { data: webhookData } = await supabase
        .from('courier_webhook_settings')
        .select('*')
        .limit(1);
        
        const webhookSettings = webhookData?.[0];

        if (!webhookSettings?.status_check_webhook_url) return;

        // Refresh status for each sale
        for (const sale of salesWithTracking) {
          try {
            // Call n8n webhook for status check
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };
            
            // Add Basic Auth if credentials are configured
            if (webhookSettings.auth_username && webhookSettings.auth_password &&
                webhookSettings.auth_username.trim() !== '' && webhookSettings.auth_password.trim() !== '') {
              const credentials = btoa(`${webhookSettings.auth_username}:${webhookSettings.auth_password}`);
              headers['Authorization'] = `Basic ${credentials}`;
            }

            // Build URL with only consignment_id parameter
            const url = new URL(webhookSettings.status_check_webhook_url);
            url.searchParams.append('consignment_id', sale.consignment_id);

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
              } else if (result.status) {
                // Legacy format: { "status": "..." }
                newCourierStatus = result.status;
              } else if (result.courier_status) {
                // Legacy format: { "courier_status": "..." }
                newCourierStatus = result.courier_status;
              }
              
              console.log('Extracted courier status:', newCourierStatus);
              
              // Normalize status for consistent display
              const normalizedStatus = newCourierStatus.toLowerCase().replace(/[^a-z0-9]/g, '_');
              let displayStatus = newCourierStatus;
              
              if (normalizedStatus.includes('pickup_cancelled') || normalizedStatus.includes('pickup_cancel') || normalizedStatus.includes('cancelled')) {
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
              
              // Map courier status to order status
              let orderStatusUpdate = {};
              if (normalizedStatus.includes('delivered') || normalizedStatus.includes('completed')) {
                orderStatusUpdate = { order_status: 'delivered' };
                console.log('Auto-refresh: Setting order status to: delivered');
              } else if (normalizedStatus.includes('returned') || normalizedStatus.includes('lost') || 
                         normalizedStatus.includes('cancelled') || normalizedStatus.includes('pickup_cancelled') || 
                         normalizedStatus.includes('pickup_cancel')) {
                orderStatusUpdate = { order_status: 'cancelled' };
                console.log('Auto-refresh: Setting order status to: cancelled');
              } else {
                console.log('Auto-refresh: No order status update needed for status:', normalizedStatus);
              }
              
              console.log('Auto-refresh: Order status update object:', orderStatusUpdate);
              

              // Update the sale in database
              await supabase
                .from('sales')
                .update({ 
                  courier_status: displayStatus,
                  order_status: getCategorizedOrderStatus(displayStatus),
                  last_status_check: new Date().toISOString(),
                  ...orderStatusUpdate
                })
                .eq('id', sale.id);

              // If order is cancelled, restore inventory
              if (displayStatus === 'cancelled') {
                console.log('Order cancelled via auto-refresh, restoring inventory...');
                await restoreInventoryForCancelledOrder(sale.id);
              }
            }
          } catch (error) {
            console.error(`Failed to refresh status for sale ${sale.id}:`, error);
          }
          
          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Refresh sales data in UI
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        
        console.log(`Auto-refreshed ${salesWithTracking.length} order statuses`);
      } catch (error) {
        console.error('Error in auto-refresh:', error);
      }
    }, 60 * 60 * 1000); // 1 hour in milliseconds

    return () => clearInterval(interval);
  }, [queryClient]);

  return null;
};