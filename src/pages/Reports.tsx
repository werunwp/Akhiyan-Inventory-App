import { useState, useMemo } from "react";
import { TrendingUp, Download, Users, Package, DollarSign, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboard";
import { useProducts } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { useSales } from "@/hooks/useSales";
import { useSalesItems } from "@/hooks/useSalesItems";

import { SimpleDateRangeFilter } from "@/components/SimpleDateRangeFilter";

import { useCurrency } from "@/hooks/useCurrency";
import { format, eachDayOfInterval, eachMonthOfInterval, startOfDay, endOfDay, subDays, subMonths } from "date-fns";
import * as ExcelJS from "exceljs";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const Reports = () => {
  const { formatAmount } = useCurrency();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  
  const { dashboardStats, isLoading: dashboardLoading } = useDashboard(dateRange.from, dateRange.to);
  const { products, isLoading: productsLoading } = useProducts();
  const { customers, isLoading: customersLoading } = useCustomers();
  const { sales, isLoading: salesLoading } = useSales();
  const { salesItems, isLoading: salesItemsLoading } = useSalesItems(dateRange.from, dateRange.to);

  const isAnyLoading = dashboardLoading || productsLoading || customersLoading || salesLoading || salesItemsLoading;

  // Generate histogram data based on date range
  const chartData = useMemo(() => {
    if (!sales?.length || !products?.length || !customers?.length) return [];

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    let intervals: Date[] = [];

    // Determine date range for chart
    if (dateRange.from && dateRange.to) {
      startDate = startOfDay(dateRange.from);
      endDate = endOfDay(dateRange.to);
    } else {
      // Default to last 30 days if no date range selected
      startDate = startOfDay(subDays(now, 30));
      endDate = endOfDay(now);
    }

    // Generate daily intervals for detailed view
    intervals = eachDayOfInterval({ start: startDate, end: endDate });

    return intervals.map(date => {
      const dateStr = format(date, 'MMM dd');
      
      // Filter sales for this specific date
      const daySales = sales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate.toDateString() === date.toDateString();
      });

      // Filter customers created on this date
      const dayCustomers = customers.filter(customer => {
        const customerDate = new Date(customer.created_at);
        return customerDate.toDateString() === date.toDateString();
      });

      // Calculate metrics for this day - only include revenue from successful orders
      const successfulSales = daySales.filter(sale => {
        const courierStatus = (sale.courier_status || '').toLowerCase();
        const orderStatus = (sale.order_status || '').toLowerCase();
        
        // Exclude cancelled and returned orders
        if (courierStatus.includes('cancel') || courierStatus.includes('return') || 
            courierStatus.includes('lost') || orderStatus === 'cancelled') {
          return false;
        }
        
        // Include successful deliveries and paid/pending/partial orders
        return courierStatus.includes('delivered') || courierStatus.includes('completed') ||
               orderStatus === 'paid' || orderStatus === 'pending' || orderStatus === 'partial';
      });

      const dailyRevenue = successfulSales.reduce((sum, sale) => {
        // For partial payments, use amount_paid instead of grand_total
        if (sale.order_status?.toLowerCase() === 'partial') {
          return sum + (sale.amount_paid || 0);
        }
        return sum + (sale.grand_total || 0);
      }, 0);
      
      const dailyOrders = daySales.length;
      const dailyCustomers = dayCustomers.length;
      
      // Calculate average order value for this day
      const dailyAvgOrder = dailyOrders > 0 ? dailyRevenue / dailyOrders : 0;

      // Calculate stock levels (using products data)
      const totalStock = products.reduce((sum, product) => sum + (product.stock_quantity || 0), 0);
      const lowStockCount = products.filter(product => 
        (product.stock_quantity || 0) <= (product.low_stock_threshold || 0)
      ).length;

      return {
        date: dateStr,
        revenue: dailyRevenue,
        orders: dailyOrders,
        customers: dailyCustomers,
        avgOrder: dailyAvgOrder,
        stockLevel: totalStock,
        lowStock: lowStockCount
      };
    });
  }, [sales, products, customers, dateRange]);

  // Calculate summary metrics for the chart
  const chartSummary = useMemo(() => {
    if (!chartData.length) return null;

    const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = chartData.reduce((sum, item) => sum + item.orders, 0);
    const totalCustomers = chartData.reduce((sum, item) => sum + item.customers, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgStockLevel = chartData.reduce((sum, item) => sum + item.stockLevel, 0) / chartData.length;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      avgOrderValue,
      avgStockLevel,
      trend: totalRevenue > 0 ? 'up' : 'stable'
    };
  }, [chartData]);

  const handleExport = async () => {
    try {
      // Get date range for filename
      const fromDate = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : 'all-time';
      const toDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const dateRangeStr = fromDate === 'all-time' ? 'all-time' : `${fromDate}_to_${toDate}`;

      // Prepare sales data
      const salesData = sales.map(sale => ({
        'Invoice Number': sale.invoice_number,
        'Customer Name': sale.customer_name,
        'Customer Phone': sale.customer_phone || '',
        'Grand Total': sale.grand_total,
        'Payment Method': sale.payment_method,
        'Order Status': sale.order_status,
        'Discount Amount': sale.discount_amount || 0,
        'Amount Paid': sale.amount_paid || 0,
        'Amount Due': sale.amount_due || 0,
        'Date': new Date(sale.created_at).toLocaleDateString()
      }));

      // Prepare summary data
      const summaryData = [{
        'Report Period': `${fromDate} to ${toDate}`,
        'Total Revenue': filteredSalesData.totalRevenue,
        'Successful Orders': filteredSalesData.successfulOrders,
        'Total Orders': filteredSalesData.totalOrders,
        'Cancelled Orders': filteredSalesData.cancelledOrders,
        'Average Order Value': avgOrderValue,
        'Total Customers': customers.length,
        'Total Products': products.length,
        'Low Stock Items': dashboardStats?.lowStockProducts?.length || 0
      }];

      // Create workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      
      // Add summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(Object.keys(summaryData[0]));
      summarySheet.addRow(Object.values(summaryData[0]));
      
      // Style the header row
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add sales sheet
      if (salesData.length > 0) {
        const salesSheet = workbook.addWorksheet('Sales Report');
        salesSheet.addRow(Object.keys(salesData[0]));
        
        // Add data rows
        salesData.forEach(row => {
          salesSheet.addRow(Object.values(row));
        });
        
        // Style the header row
        salesSheet.getRow(1).font = { bold: true };
        salesSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Auto-fit columns
        salesSheet.columns.forEach(column => {
          column.width = 15;
        });
      }

      // Generate filename
      const filename = `business_report_${dateRangeStr}.xlsx`;
      
      // Export file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success("Report exported successfully");

    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  // Calculate filtered sales count and revenue based on selected date range
  const filteredSalesData = useMemo(() => {
    let filteredSales = sales;
    
    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filteredSales = sales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        
        if (dateRange.from && dateRange.to) {
          return saleDate >= dateRange.from && saleDate <= dateRange.to;
        } else if (dateRange.from) {
          return saleDate >= dateRange.from;
        } else if (dateRange.to) {
          return saleDate <= dateRange.to;
        }
        
        return true;
      });
    }

    // Helper function to determine if a sale should be counted as successful/paid
    const isSuccessfulSale = (sale: any) => {
      const courierStatus = (sale.courier_status || '').toLowerCase();
      const orderStatus = (sale.order_status || '').toLowerCase();
      
      // DELIVERED, PARTIAL DELIVERY, and EXCHANGE count as successful
      if (courierStatus.includes('delivered') || courierStatus.includes('partial delivery') || courierStatus.includes('exchange')) {
        return true;
      }
      
      // Traditional order status checks
      return orderStatus === 'paid' || orderStatus === 'pending' || orderStatus === 'partial';
    };
    
    // Helper function to determine if a sale should be counted as cancelled
    const isCancelledSale = (sale: any) => {
      const courierStatus = (sale.courier_status || '').toLowerCase();
      const orderStatus = (sale.order_status || '').toLowerCase();
      
      // RETURN and PAID RETURN count as cancelled
      if (courierStatus.includes('return') || courierStatus.includes('paid return')) {
        return true;
      }
      
      // Traditional cancellation checks
      return orderStatus === 'cancelled' || courierStatus.includes('cancel') || courierStatus.includes('lost');
    };

    // Filter for successful sales only (for revenue calculation)
    const successfulSales = filteredSales.filter(sale => isSuccessfulSale(sale));

    // Filter for cancelled/returned orders
    const cancelledOrders = filteredSales.filter(sale => isCancelledSale(sale));

    // Calculate total revenue from successful sales
    const totalRevenue = successfulSales.reduce((sum, sale) => {
      // For partial payments, use amount_paid instead of grand_total
      if (sale.order_status?.toLowerCase() === 'partial') {
        return sum + (sale.amount_paid || 0);
      }
      return sum + (sale.grand_total || 0);
    }, 0);

    return {
      totalOrders: filteredSales.length,
      successfulOrders: successfulSales.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue: totalRevenue
    };
  }, [sales, dateRange]);

  const avgOrderValue = filteredSalesData.totalRevenue && filteredSalesData.successfulOrders > 0 
    ? filteredSalesData.totalRevenue / filteredSalesData.successfulOrders 
    : 0;

  // Calculate top sold items based on date range
  const topSoldItems = useMemo(() => {
    if (!salesItems?.length || !products?.length || !sales?.length) return [];

    // Get sale IDs from filtered sales (successful sales only)
    const successfulSaleIds = sales
      .filter(sale => {
        // Apply date filter
        const saleDate = new Date(sale.created_at);
        const isInDateRange = (!dateRange.from || saleDate >= dateRange.from) && 
                             (!dateRange.to || saleDate <= dateRange.to);
        
        if (!isInDateRange) return false;

        // Filter for successful sales only
        const courierStatus = (sale.courier_status || '').toLowerCase();
        const orderStatus = (sale.order_status || '').toLowerCase();
        
        // Exclude cancelled and returned orders
        if (courierStatus.includes('cancel') || courierStatus.includes('return') || 
            courierStatus.includes('lost') || orderStatus === 'cancelled') {
          return false;
        }
        
        // Include successful deliveries and paid/pending/partial orders
        return courierStatus.includes('delivered') || courierStatus.includes('completed') ||
               orderStatus === 'paid' || orderStatus === 'pending' || orderStatus === 'partial';
      })
      .map(sale => sale.id);

    // Group sales items by product_id and calculate totals
    const productSalesMap = new Map<string, { quantity: number; revenue: number; productName: string }>();

    salesItems
      .filter(item => successfulSaleIds.includes(item.sale_id))
      .forEach(item => {
        const existing = productSalesMap.get(item.product_id) || { 
          quantity: 0, 
          revenue: 0, 
          productName: item.product_name 
        };
        
        productSalesMap.set(item.product_id, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.total,
          productName: item.product_name
        });
      });

    // Convert to array and add product details
    const itemsArray = Array.from(productSalesMap.entries())
      .map(([productId, data]) => {
        const product = products.find(p => p.id === productId);
        return {
          productId,
          productName: data.productName,
          quantity: data.quantity,
          revenue: data.revenue,
          image: product?.image_url || '/placeholder.svg'
        };
      })
      .sort((a, b) => b.revenue - a.revenue) // Sort by revenue
      .slice(0, 10); // Top 10 items

    return itemsArray;
  }, [salesItems, products, sales, dateRange]);



  return (
    <div className="space-y-6 w-full max-w-none overflow-x-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive business insights and performance metrics
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SimpleDateRangeFilter onDateRangeChange={(from, to) => setDateRange({ from, to })} />
          <Button onClick={handleExport} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {isAnyLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(filteredSalesData.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Revenue from successful orders only
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredSalesData.totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Selected period orders (all)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelled Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredSalesData.cancelledOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Cancelled/returned orders
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatAmount(avgOrderValue)}</div>
                <p className="text-xs text-muted-foreground">
                  Average per order
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Top Sold Items Section */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Top Sold Items</CardTitle>
          <p className="text-sm text-muted-foreground">
            Best selling products based on revenue for the selected period
          </p>
        </CardHeader>
        <CardContent>
          {isAnyLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-32 w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : topSoldItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {topSoldItems.map((item, index) => (
                <Card key={item.productId} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    <img 
                      src={item.image} 
                      alt={item.productName}
                      className="w-full h-32 object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                      #{index + 1}
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]" title={item.productName}>
                      {item.productName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Sold: {item.quantity} units
                    </p>
                    <p className="text-base font-bold text-primary">
                      {formatAmount(item.revenue)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <div className="text-center space-y-2">
                <Package className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">No sold items found for the selected period</p>
                <p className="text-sm text-muted-foreground">Try adjusting the date range</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comprehensive Business Overview Chart */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
                             <CardTitle className="text-xl">Business Performance Histogram</CardTitle>
               <p className="text-sm text-muted-foreground">
                 Histogram view showing distribution of revenue, orders, customers, and average order values
               </p>
            </div>
            {chartSummary && (
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Revenue: {formatAmount(chartSummary.totalRevenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Orders: {chartSummary.totalOrders}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span>Customers: {chartSummary.totalCustomers}</span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isAnyLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="space-y-4 w-full p-6">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <div className="space-y-4">
                             <ResponsiveContainer width="100%" height={400}>
                 <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                   <XAxis 
                     dataKey="date" 
                     tick={{ fontSize: 12 }}
                     tickLine={false}
                     axisLine={false}
                   />
                   <YAxis 
                     tick={{ fontSize: 12 }}
                     tickLine={false}
                     axisLine={false}
                     label={{ value: 'Count & Amount', angle: -90, position: 'insideLeft' }}
                   />
                   <Tooltip 
                     content={({ active, payload, label }) => {
                       if (active && payload && payload.length) {
                         return (
                           <div className="bg-white p-4 border rounded-lg shadow-lg">
                             <p className="font-semibold text-gray-800 mb-2">{label}</p>
                             <div className="space-y-1">
                               {payload.map((entry: any, index: number) => (
                                 <div key={index} className="flex items-center gap-2">
                                   <div 
                                     className="w-3 h-3 rounded-full" 
                                     style={{ backgroundColor: entry.fill }}
                                   ></div>
                                   <span className="text-sm font-medium">
                                     {entry.name}: {entry.name === 'Revenue' ? formatAmount(entry.value) : 
                                                    entry.name === 'Avg Order' ? formatAmount(entry.value) : 
                                                    entry.value}
                                   </span>
                                 </div>
                               ))}
                             </div>
                           </div>
                         );
                       }
                       return null;
                     }}
                   />
                   <Legend />
                   
                   {/* Revenue Histogram */}
                   <Bar
                     dataKey="revenue"
                     fill="#10b981"
                     fillOpacity={0.8}
                     name="Revenue"
                     radius={[4, 4, 0, 0]}
                   />
                   
                   {/* Orders Histogram */}
                   <Bar
                     dataKey="orders"
                     fill="#3b82f6"
                     fillOpacity={0.8}
                     name="Orders"
                     radius={[4, 4, 0, 0]}
                   />
                   
                   {/* Customers Histogram */}
                   <Bar
                     dataKey="customers"
                     fill="#8b5cf6"
                     fillOpacity={0.8}
                     name="New Customers"
                     radius={[4, 4, 0, 0]}
                   />
                   
                   {/* Average Order Value Histogram */}
                   <Bar
                     dataKey="avgOrder"
                     fill="#f59e0b"
                     fillOpacity={0.8}
                     name="Avg Order"
                     radius={[4, 4, 0, 0]}
                   />
                 </BarChart>
               </ResponsiveContainer>
              
              {/* Chart Insights */}
              <div className="grid gap-4 md:grid-cols-3 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {chartSummary?.totalRevenue ? formatAmount(chartSummary.totalRevenue) : '৳0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {chartSummary?.totalOrders || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Orders</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {chartSummary?.totalCustomers || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">New Customers</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center space-y-2">
                <Package className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">No data available for the selected period</p>
                <p className="text-sm text-muted-foreground">Try adjusting the date range or check your data</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;