import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Plus, Edit, Eye, TrendingUp, TrendingDown, DollarSign, RefreshCw, Truck, Trash2, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSales } from "@/hooks/useSales";
import { SaleDialog } from "@/components/SaleDialog";
import { EditSaleDialog } from "@/components/EditSaleDialog";
import { SaleDetailsDialog } from "@/components/SaleDetailsDialog";
import { CourierOrderDialog } from "@/components/CourierOrderDialog";
import { SimpleDateRangeFilter } from "@/components/SimpleDateRangeFilter";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { useStatusAutoRefresh } from "@/hooks/useStatusAutoRefresh";
import { useWebhookSettings } from "@/hooks/useWebhookSettings";
import { useCourierStatusRealtime } from "@/hooks/useCourierStatusRealtime";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface Sale {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  grand_total: number;
  order_status: string;
  courier_status?: string;
  consignment_id?: string;
  last_status_check?: string;
  estimated_delivery?: string;
  created_at: string;
  amount_paid: number;
  amount_due: number;
}

// Helper function to get categorized order status based on courier status
const getCategorizedOrderStatus = (courierStatus: string) => {
  if (!courierStatus) {
    console.log(`Status "${courierStatus}" categorized as: pending (empty)`);
    return 'pending';
  }
  
  const normalizedStatus = courierStatus.toLowerCase().trim();
  
  console.log(`Categorizing status: "${courierStatus}" -> normalized: "${normalizedStatus}"`);
  
  // Check for RETURN or PAID RETURN (any variation)
  if (normalizedStatus.includes('return')) {
    console.log(`Status "${courierStatus}" categorized as: cancelled (contains 'return')`);
    return 'cancelled';
  }
  
  // Check for DELIVERED, PARTIAL DELIVERY, and EXCHANGE
  if (normalizedStatus.includes('delivered') || 
      normalizedStatus.includes('partial') || 
      normalizedStatus.includes('exchange')) {
    console.log(`Status "${courierStatus}" categorized as: paid (contains 'delivered/partial/exchange')`);
    return 'paid';
  }
  
  // Default to pending for other statuses
  console.log(`Status "${courierStatus}" categorized as: pending (default)`);
  return 'pending';
};


export default function Sales() {
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCourierDialog, setShowCourierDialog] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [detailsSaleId, setDetailsSaleId] = useState<string | null>(null);
  const [courierSaleId, setCourierSaleId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshingStatuses, setIsRefreshingStatuses] = useState(false);
  const [refreshingIndividual, setRefreshingIndividual] = useState<string | null>(null);
  
  const itemsPerPage = 20;
  
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();
  const { deleteSale } = useSales();
  const { isAdmin } = useUserRole();
  
  // Enable auto-refresh for courier statuses
  useStatusAutoRefresh();
  
  // Enable real-time updates for courier statuses
  useCourierStatusRealtime();

  const { data: sales = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Sale[];
    },
  });

  // Listen for sales data updates to refresh without page reload
  useEffect(() => {
    const handleSalesUpdate = () => {
      refetch();
    };
    
    window.addEventListener('salesDataUpdated', handleSalesUpdate);
    return () => window.removeEventListener('salesDataUpdated', handleSalesUpdate);
  }, [refetch]);

  const { webhookSettings } = useWebhookSettings();

  const handleStatusRefresh = async (saleId: string, consignmentId: string, showToast = true) => {
    setRefreshingIndividual(saleId);
    try {
      if (!webhookSettings) {
        throw new Error('Webhook settings not loaded');
      }

      // Webhook settings loaded

      if (!webhookSettings.status_check_webhook_url) {
        console.error('Webhook settings found but missing status_check_webhook_url:', webhookSettings);
        throw new Error('No status check webhook URL configured');
      }

      // Webhook settings details logged (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log('Webhook settings details:', {
        status_check_webhook_url: webhookSettings.status_check_webhook_url,
        auth_username: webhookSettings.auth_username,
        auth_password: webhookSettings.auth_password ? '***' : 'undefined',
        auth_password_length: webhookSettings.auth_password ? webhookSettings.auth_password.length : 0
      });
      }

      // Revert to direct webhook status check (previous working behavior for admin)
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (webhookSettings.auth_username && webhookSettings.auth_password &&
          webhookSettings.auth_username.trim() !== '' && webhookSettings.auth_password.trim() !== '') {
        const credentials = btoa(`${webhookSettings.auth_username}:${webhookSettings.auth_password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }
      const url = new URL(webhookSettings.status_check_webhook_url);
      url.searchParams.append('consignment_id', consignmentId);
      const response = await fetch(url.toString(), { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      const result = await response.json();
      console.log('Status check response:', result);
      
      // Handle the specific response format from your webhook
      let newStatus = 'pending';
      
      if (Array.isArray(result) && result.length > 0) {
        // Format: [{ "type": "success", "code": 200, "data": { "order_status": "..." } }]
        const firstResponse = result[0];
        if (firstResponse.type === 'success' && firstResponse.data) {
          newStatus = firstResponse.data.order_status || 'pending';
        }
      } else if (result.data && result.data.order_status) {
        // Fallback format: { "data": { "order_status": "..." } }
        newStatus = result.data.order_status;
      } else if (result.order_status) {
        // Direct format: { "order_status": "..." }
        newStatus = result.order_status;
      } else if (result.status) {
        // Legacy format: { "status": "..." }
        newStatus = result.status;
      } else if (result.courier_status) {
        // Legacy format: { "courier_status": "..." }
        newStatus = result.courier_status;
      }
      
      console.log('Extracted courier status:', newStatus);
      
      // Normalize status for consistent display
      const normalizedStatus = newStatus.toLowerCase().replace(/[^a-z0-9]/g, '_');
      let displayStatus = newStatus;
      
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
      
      console.log('Status normalization:', { original: newStatus, normalized: normalizedStatus, display: displayStatus });
        
      // Map courier status to order status for business logic
      let orderStatusUpdate = {};
      
      if (normalizedStatus.includes('delivered') || normalizedStatus.includes('completed')) {
        orderStatusUpdate = { order_status: 'paid' };
        console.log('Setting order status to: paid');
      } else if (normalizedStatus.includes('returned') || normalizedStatus.includes('cancelled') || 
                 normalizedStatus.includes('pickup_cancelled') || normalizedStatus.includes('pickup_cancel') || normalizedStatus.includes('lost')) {
        orderStatusUpdate = { order_status: 'cancelled' };
        console.log('Setting order status to: cancelled');
      } else {
        console.log('No payment status update needed for status:', normalizedStatus);
      }
      
      // Apply categorization rules to order_status based on courier_status
      const categorizedOrderStatus = getCategorizedOrderStatus(displayStatus);
      orderStatusUpdate = { order_status: categorizedOrderStatus };
      console.log(`Setting order status to: ${categorizedOrderStatus} based on courier status: ${displayStatus}`);
      
      console.log('Payment status update object:', paymentStatusUpdate);
      console.log('Order status update object:', orderStatusUpdate);
        
      // Update the sale in database
      const updateData = {
        courier_status: displayStatus,
        last_status_check: new Date().toISOString(),
        ...paymentStatusUpdate,
        ...orderStatusUpdate
      };
      
      console.log('Updating sale in database with:', updateData);
      
      const { error: updateError } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', saleId);

      // If order is cancelled, restore inventory
      if (displayStatus === 'cancelled') {
        console.log('Order cancelled, restoring inventory...');
        await restoreInventoryForCancelledOrder(saleId);
      }
        
        if (!updateError) {
          console.log('Sale updated successfully in database');
          if (showToast) toast.success(`Status updated to: ${displayStatus.toUpperCase()}`);
          // Refresh the sales data
          queryClient.invalidateQueries({ queryKey: ["sales"] });
          return true;
        } else {
          console.error('Failed to update sale status:', updateError);
          if (showToast) toast.error('Failed to update status in database');
          return false;
        }
      
      
    } catch (error: any) {
      const msg = error?.message || 'Failed to refresh order status';
      if (showToast) toast.error(msg);
      console.error("Error refreshing status:", error);
      return false;
    } finally {
      setRefreshingIndividual(null);
    }
  };

  const handleBulkStatusRefresh = async () => {
    setIsRefreshingStatuses(true);
    
    const salesWithConsignmentId = filteredSales.filter(sale => sale.consignment_id);
    
    if (salesWithConsignmentId.length === 0) {
      toast.info("No orders with tracking IDs found");
      setIsRefreshingStatuses(false);
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const sale of salesWithConsignmentId) {
      const success = await handleStatusRefresh(sale.id, sale.consignment_id!, false);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Add a small delay between requests to avoid overwhelming the webhook
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRefreshingStatuses(false);
    
    if (successCount > 0) {
      toast.success(`Updated ${successCount} order statuses successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
    } else if (failureCount > 0) {
      toast.error(`Failed to update ${failureCount} order statuses`);
    }
  };

  const filteredSales = useMemo(() => {
    let filtered = sales;

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter((sale) => {
        const saleDate = new Date(sale.created_at);
        
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(saleDate, { start: dateRange.from, end: dateRange.to });
        } else if (dateRange.from) {
          return saleDate >= dateRange.from;
        } else if (dateRange.to) {
          return saleDate <= dateRange.to;
        }
        
        return true;
      });
    }

    // Apply order status filter
    if (orderStatusFilter !== "all") {
      filtered = filtered.filter((sale) => {
        const orderStatus = (sale.order_status || '').toLowerCase();
        
        switch (orderStatusFilter) {
          case "paid":
            return orderStatus === "paid";
          case "cancelled":
            return orderStatus === "cancelled";
          case "pending":
            return orderStatus === "pending" || orderStatus === "partial";
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [sales, dateRange, orderStatusFilter]);

  // Pagination calculations
  const totalSales = filteredSales.length;
  const totalPages = Math.ceil(totalSales / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, orderStatusFilter]);

  const currentMonthSales = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
    });
  }, [sales]);

  const stats = useMemo(() => {
    // Helper function to determine if a sale should be excluded from Total Revenue
    const isExcludedFromTotalRevenue = (sale: Sale) => {
      const orderStatus = (sale.order_status || '').toLowerCase();
      
      // Exclude cancelled orders from Total Revenue
      return orderStatus === 'cancelled';
    };
    
    // Helper function to determine if a sale should be included in Amount Paid
    const isIncludedInAmountPaid = (sale: Sale) => {
      const orderStatus = (sale.order_status || '').toLowerCase();
      
      // Only paid orders count as Amount Paid
      return orderStatus === 'paid';
    };
    
    // Helper function to determine if a sale should be excluded from Amount Due
    const isExcludedFromAmountDue = (sale: Sale) => {
      const orderStatus = (sale.order_status || '').toLowerCase();
      
      // Exclude cancelled and paid orders from Amount Due
      return orderStatus === 'cancelled' || orderStatus === 'paid';
    };
    
    // Calculate Total Revenue: all orders excluding cancelled orders
    const totalRevenueSales = filteredSales.filter(sale => !isExcludedFromTotalRevenue(sale));
    const totalRevenue = totalRevenueSales.reduce((sum, sale) => sum + (sale.grand_total || 0), 0);
    
    // Calculate Amount Paid: only paid orders
    const amountPaidSales = filteredSales.filter(sale => isIncludedInAmountPaid(sale));
    const totalPaid = amountPaidSales.reduce((sum, sale) => sum + (sale.grand_total || 0), 0);
    
    // Calculate Amount Due: pending and partial orders (excluding cancelled and paid)
    const amountDueSales = filteredSales.filter(sale => !isExcludedFromAmountDue(sale));
    const totalDue = amountDueSales.reduce((sum, sale) => sum + (sale.amount_due || 0), 0);
    
    return {
      totalRevenue,
      totalPaid,
      totalDue,
      totalRevenueCount: totalRevenueSales.length,
      amountPaidCount: amountPaidSales.length,
      amountDueCount: amountDueSales.length
    };
  }, [filteredSales]);

  const handleEditSale = (saleId: string) => {
    setEditingSaleId(saleId);
    setShowEditDialog(true);
  };

  const handleViewDetails = (saleId: string) => {
    setDetailsSaleId(saleId);
    setShowDetailsDialog(true);
  };

  const handleCourierOrder = (saleId: string) => {
    setCourierSaleId(saleId);
    setShowCourierDialog(true);
  };

  const handleDeleteSale = (saleId: string) => {
    if (confirm("Are you sure you want to delete this sale? This action cannot be undone.")) {
      deleteSale.mutate(saleId);
    }
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setEditingSaleId(null);
  };

  const formatCurrencyAmount = (amount: number) => {
    return formatAmount(amount);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading sales data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground">
            Track your sales transactions and invoices
          </p>
        </div>
        {/* Desktop Layout - All filters in one row */}
        <div className="hidden md:flex gap-2">
          <SimpleDateRangeFilter onDateRangeChange={(from, to) => setDateRange({ from, to })} defaultPreset="all" />
          <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="paid">Paid Orders</SelectItem>
              <SelectItem value="pending">Pending Orders</SelectItem>
              <SelectItem value="cancelled">Cancelled Orders</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowSaleDialog(true)} className="w-fit">
            <Plus className="mr-2 h-4 w-4" />
            New Sale
          </Button>
        </div>

        {/* Mobile Layout - Stacked filters */}
        <div className="flex flex-col gap-2 md:hidden">
          {/* Date filter row */}
          <div className="w-full">
            <SimpleDateRangeFilter onDateRangeChange={(from, to) => setDateRange({ from, to })} defaultPreset="all" />
          </div>
          
          {/* Status filter and New Sale button row */}
          <div className="flex gap-2">
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger className="flex-1">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="paid">Paid Orders</SelectItem>
                <SelectItem value="pending">Pending Orders</SelectItem>
                <SelectItem value="cancelled">Cancelled Orders</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowSaleDialog(true)} className="w-fit">
              <Plus className="mr-2 h-4 w-4" />
              New Sale
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium">Total Revenue</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyAmount(stats.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  From {stats.totalRevenueCount} sales
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium">Amount Paid</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyAmount(stats.totalPaid)}</div>
                <p className="text-xs text-muted-foreground">
                  From {stats.amountPaidCount} sales
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium">Amount Due</p>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrencyAmount(stats.totalDue)}</div>
                <p className="text-xs text-muted-foreground">
                  From {stats.amountDueCount} sales
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Invoice</TableHead>
                  <TableHead className="whitespace-nowrap">Customer</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="whitespace-nowrap">Amount</TableHead>
                  <TableHead className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>Courier Status</span>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Real-time updates active"></div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleBulkStatusRefresh}
                          disabled={isRefreshingStatuses}
                          className="h-6 w-6 p-0"
                          title="Refresh all order statuses"
                        >
                          <RefreshCw className={cn("h-3 w-3", isRefreshingStatuses && "animate-spin")} />
                        </Button>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Order Status</TableHead>
                  <TableHead className="whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium whitespace-nowrap">{sale.invoice_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{sale.customer_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(sale.created_at), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrencyAmount(sale.grand_total || 0)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant={
                              sale.courier_status === 'delivered' ? 'default' : 
                              sale.courier_status === 'in_transit' || sale.courier_status === 'out_for_delivery' ? 'secondary' : 
                              sale.courier_status === 'not_sent' ? 'outline' :
                              sale.courier_status === 'returned' || sale.courier_status === 'lost' ? 'destructive' :
                              'secondary'
                            }
                            className="w-fit px-2 py-1"
                          >
                            {sale.courier_status === 'not_sent' ? 'Not Sent' : 
                             sale.courier_status === 'in_transit' ? 'In Transit' :
                             sale.courier_status === 'out_for_delivery' ? 'Out for Delivery' :
                             sale.courier_status === 'returned' ? 'Returned' :
                             sale.courier_status === 'lost' ? 'Lost' :
                             sale.courier_status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                          </Badge>
                          {sale.last_status_check && (
                            <div className="text-xs text-muted-foreground truncate">
                              Updated: {format(new Date(sale.last_status_check), "MMM dd, HH:mm")}
                            </div>
                          )}
                          {sale.estimated_delivery && sale.courier_status !== 'delivered' && (
                            <div className="text-xs text-muted-foreground truncate">
                              ETA: {format(new Date(sale.estimated_delivery), "MMM dd")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge 
                          variant={
                            sale.order_status === 'paid' ? 'default' : 
                            sale.order_status === 'cancelled' ? 'destructive' : 
                            'secondary'
                          }
                          className="w-fit px-2 py-1"
                        >
                          {sale.order_status === 'paid' ? 'Paid' : 
                           sale.order_status === 'cancelled' ? 'Cancelled' :
                           sale.order_status === 'pending' ? 'Pending' :
                           sale.order_status || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSale(sale.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(sale.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                           {sale.consignment_id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusRefresh(sale.id, sale.consignment_id!, true)}
                              disabled={isRefreshingStatuses || refreshingIndividual === sale.id}
                              title="Refresh order status"
                            >
                              <RefreshCw className={cn("h-4 w-4", (isRefreshingStatuses || refreshingIndividual === sale.id) && "animate-spin")} />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCourierOrder(sale.id)}
                              title="Send to courier"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSale(sale.id)}
                              disabled={deleteSale.isPending}
                              title="Delete sale"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Info and Controls */}
      {totalSales > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalSales)} of {totalSales} sales
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {(() => {
                const maxVisiblePages = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                
                if (endPage - startPage + 1 < maxVisiblePages) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                const pages = [];
                
                if (startPage > 1) {
                  pages.push(
                    <PaginationItem key={1}>
                      <PaginationLink
                        onClick={() => setCurrentPage(1)}
                        className="cursor-pointer"
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                  );
                  if (startPage > 2) {
                    pages.push(
                      <PaginationItem key="start-ellipsis">
                        <span className="px-3 py-2 text-muted-foreground">...</span>
                      </PaginationItem>
                    );
                  }
                }
                
                for (let page = startPage; page <= endPage; page++) {
                  pages.push(
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
                
                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pages.push(
                      <PaginationItem key="end-ellipsis">
                        <span className="px-3 py-2 text-muted-foreground">...</span>
                      </PaginationItem>
                    );
                  }
                  pages.push(
                    <PaginationItem key={totalPages}>
                      <PaginationLink
                        onClick={() => setCurrentPage(totalPages)}
                        className="cursor-pointer"
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
                
                return pages;
              })()}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
            </div>
          )}
        </div>
      )}

      <SaleDialog open={showSaleDialog} onOpenChange={setShowSaleDialog} />
      <EditSaleDialog 
        open={showEditDialog} 
        onOpenChange={handleCloseEditDialog}
        saleId={editingSaleId}
      />
      <SaleDetailsDialog 
        open={showDetailsDialog} 
        onOpenChange={setShowDetailsDialog}
        saleId={detailsSaleId}
      />
      <CourierOrderDialog 
        open={showCourierDialog} 
        onOpenChange={setShowCourierDialog}
        saleId={courierSaleId}
      />
    </div>
  );
}