import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShoppingCart, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";

interface CustomerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any | null;
}

interface Sale {
  id: string;
  invoice_number: string;
  grand_total: number;
  amount_paid: number;
  order_status: string;
  payment_method: string;
  created_at: string;
  items: SaleItem[];
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  rate: number;
  total: number;
  variant_id: string | null;
  variant_attributes?: Record<string, string>;
}

export const CustomerHistoryDialog = ({ open, onOpenChange, customer }: CustomerHistoryDialogProps) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { formatAmount } = useCurrency();

  useEffect(() => {
    if (open && customer) {
      loadCustomerSales();
    }
  }, [open, customer]);

  const loadCustomerSales = async () => {
    if (!customer) return;
    
    setIsLoading(true);
    try {
      // Fetch sales for this customer
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(`
          id,
          invoice_number,
          grand_total,
          amount_paid,
          order_status,
          payment_method,
          created_at
        `)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });

      if (salesError) throw salesError;

      // Fetch items for each sale
      const salesWithItems = await Promise.all(
        (salesData || []).map(async (sale) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from("sales_items")
            .select(`
              id, 
              product_name, 
              quantity, 
              rate, 
              total, 
              variant_id,
              product_variants!left(attributes)
            `)
            .eq("sale_id", sale.id);

          if (itemsError) throw itemsError;

          const itemsWithVariants = (itemsData || []).map(item => ({
            ...item,
            variant_attributes: (item as any).product_variants?.attributes || null
          }));

          return {
            ...sale,
            items: itemsWithVariants
          };
        })
      );

      setSales(salesWithItems);
    } catch (error) {
      console.error("Error loading customer sales:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals for all orders and paid orders
  const totalOrders = sales.length;
  const paidOrders = sales.filter(sale => sale.order_status === 'paid');
  const successfulOrders = paidOrders.length;
  const totalSpent = paidOrders.reduce((sum, sale) => sum + sale.grand_total, 0);
  const avgOrderValue = successfulOrders > 0 ? totalSpent / successfulOrders : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase History - {customer?.name}
          </DialogTitle>
          <DialogDescription>
            Complete purchase history and transaction details for this customer
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading customer history...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total order</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">All orders count</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Successful orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{successfulOrders}</div>
                  <p className="text-xs text-muted-foreground">Paid orders count</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total spent</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatAmount(totalSpent)}</div>
                  <p className="text-xs text-muted-foreground">Paid orders total</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Order value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatAmount(avgOrderValue)}</div>
                  <p className="text-xs text-muted-foreground">Paid orders average</p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Sales History */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Order History
              </h3>
              
              {sales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No purchase history found for this customer.
                </div>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <Card key={sale.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">
                              Invoice: {sale.invoice_number}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(sale.created_at), "PPp")}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{formatAmount(sale.grand_total)}</div>
                            <div className="flex gap-2">
                              <Badge 
                                variant={sale.order_status === 'paid' ? 'default' : 'secondary'}
                              >
                                {sale.order_status}
                              </Badge>
                              <Badge variant="outline">
                                {sale.payment_method}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Variation</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Rate</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sale.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.product_name}</TableCell>
                                <TableCell>
                                  {item.variant_attributes ? (
                                    <div className="text-sm">
                                      {Object.entries(item.variant_attributes)
                                        .map(([key, value]) => `${key}: ${value}`)
                                        .join(', ')}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Standard</span>
                                  )}
                                </TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{formatAmount(item.rate)}</TableCell>
                                <TableCell>{formatAmount(item.total)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};