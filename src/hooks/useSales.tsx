import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { toast } from "sonner";
import { getCategorizedOrderStatus } from "@/lib/orderStatusCategorization";

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  customer_address: string | null;
  city?: string | null;
  zone?: string | null;
  area?: string | null;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  payment_method: string;
  order_status: string;
  courier_status?: string;
  consignment_id?: string;
  last_status_check?: string;
  fee?: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  rate: number;
  total: number;
  created_at: string;
  variant_id?: string | null;
}

export interface CreateSaleData {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_address?: string;
  city?: string;
  zone?: string;
  area?: string;
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  fee?: number;
  grand_total: number;
  amount_paid?: number;
  amount_due?: number;
  payment_method: string;
  order_status?: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    rate: number;
    total: number;
    variant_id?: string | null;
  }[];
}

export interface UpdateSaleData {
  id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_address?: string;
  city?: string;
  zone?: string;
  area?: string;
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  fee?: number;
  grand_total: number;
  amount_paid?: number;
  amount_due?: number;
  payment_method: string;
  items: {
    id?: string;
    product_id: string;
    product_name: string;
    quantity: number;
    rate: number;
    total: number;
    variant_id?: string | null;
  }[];
}

export const useSales = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // Function to update customer status after sale changes
  const updateCustomerStatus = async (customerId?: string) => {
    if (!customerId) return;
    
    try {
      // Get customer's purchase history to calculate new status
      // Since we're using hard delete, just fetch all sales for this customer
      const { data: sales, error } = await supabase
        .from('sales')
        .select('created_at, order_status, courier_status')
        .eq('customer_id', customerId)
        .not('order_status', 'eq', 'cancelled')
        .not('courier_status', 'in', '(cancelled,returned,lost)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer sales:', error);
        return;
      }

      let newStatus = 'inactive';
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      if (sales && sales.length > 0) {
        const lastPurchase = new Date(sales[0].created_at);
        
        if (lastPurchase >= oneMonthAgo) {
          newStatus = 'active';
        } else if (lastPurchase >= threeMonthsAgo) {
          newStatus = 'neutral';
        } else {
          newStatus = 'inactive';
        }
      }

      // Update customer status
      const { error: updateError } = await supabase
        .from('customers')
        .update({ status: newStatus })
        .eq('id', customerId);

      if (updateError) {
        console.error('Error updating customer status:', updateError);
      }
    } catch (error) {
      console.error('Error in updateCustomerStatus:', error);
    }
  };

  const {
    data: sales = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      // Since we're using hard delete, just fetch all sales
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user,
  });

  const createSale = useMutation({
    mutationFn: async (saleData: CreateSaleData) => {
      // Generate invoice number
      const { data: invoiceData, error: invoiceError } = await supabase
        .rpc('generate_invoice_number');
      
      if (invoiceError) throw invoiceError;

      // Check if a sale with this invoice number already exists (safeguard against duplicates)
      const { data: existingSale } = await supabase
        .from("sales")
        .select("id")
        .eq("invoice_number", invoiceData)
        .maybeSingle();
      
      if (existingSale) {
        throw new Error("A sale with this invoice number already exists. Please try again.");
      }

      const { items, ...saleInfo } = saleData;
      
      // Check if customer exists or create new one if needed
      let finalCustomerId = saleInfo.customer_id;
      
      if (!finalCustomerId && saleInfo.customer_name) {
        // Check if customer already exists by name and phone
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("name", saleInfo.customer_name)
          .eq("phone", saleInfo.customer_phone || "")
          .maybeSingle();
        
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        } else {
          // Extract size information from sales items for additional_info
          let additionalInfo = '';
          if (items && items.length > 0) {
            const sizeValues = new Set<string>();
            
            // Get variant information for items with variants
            for (const item of items) {
              if (item.variant_id) {
                const { data: variant } = await supabase
                  .from("product_variants")
                  .select("attributes")
                  .eq("id", item.variant_id)
                  .single();
                
                if (variant?.attributes) {
                  const attributes = variant.attributes as Record<string, string>;
                  // Look for size-related attributes (case insensitive)
                  for (const [key, value] of Object.entries(attributes)) {
                    if (key.toLowerCase().includes('size') && value) {
                      sizeValues.add(value);
                    }
                  }
                }
              }
            }
            
            if (sizeValues.size > 0) {
              additionalInfo = `Baby Age: ${Array.from(sizeValues).join(', ')}`;
            }
          }
          
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert([{
              name: saleInfo.customer_name,
              phone: saleInfo.customer_phone || null,
              whatsapp: saleInfo.customer_whatsapp || null,
              address: saleInfo.customer_address || null,
              additional_info: additionalInfo || null,
              status: 'active',
              created_by: user?.id
            }])
            .select()
            .single();
          
          if (customerError) throw customerError;
          finalCustomerId = newCustomer.id;
        }
      }
      
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert([{
          ...saleInfo,
          customer_id: finalCustomerId,
          invoice_number: invoiceData,
          order_status: getCategorizedOrderStatus(saleInfo.courier_status || ''),
          created_by: user?.id
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = items.map(item => ({
        ...item,
        sale_id: sale.id
      }));

      const { error: itemsError } = await supabase
        .from("sales_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update stock per item (variant-aware)
      for (const item of items) {
        if (item.variant_id) {
          // Decrement variant stock
          const { data: variant, error: getVarErr } = await supabase
            .from("product_variants")
            .select("stock_quantity, product_id")
            .eq("id", item.variant_id)
            .single();
          if (getVarErr) throw getVarErr;

          const newVarStock = (variant.stock_quantity || 0) - item.quantity;
          if (newVarStock < 0) {
            throw new Error("Insufficient variant stock");
          }

          const { error: updVarErr } = await supabase
            .from("product_variants")
            .update({ stock_quantity: newVarStock })
            .eq("id", item.variant_id);
          if (updVarErr) throw updVarErr;

          // Log inventory change with variant_id
          const { error: logError } = await supabase
            .from("inventory_logs")
            .insert([
              {
                product_id: item.product_id,
                variant_id: item.variant_id,
                type: "sale",
                quantity: -item.quantity,
                reason: `Sale: ${invoiceData}`,
                created_by: user?.id,
              },
            ]);
          if (logError) throw logError;
        } else {
          // Fallback to product-level stock
          const { data: product, error: getError } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (getError) throw getError;

          const newStock = (product.stock_quantity || 0) - item.quantity;
          const { error: stockError } = await supabase
            .from("products")
            .update({ stock_quantity: newStock })
            .eq("id", item.product_id);
          if (stockError) throw stockError;

          // Log inventory change
          const { error: logError } = await supabase
            .from("inventory_logs")
            .insert([
              {
                product_id: item.product_id,
                type: "sale",
                quantity: -item.quantity,
                reason: `Sale: ${invoiceData}`,
                created_by: user?.id,
              },
            ]);
          if (logError) throw logError;
        }
      }

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      
      // Update customer status automatically
      if (sale.customer_id) {
        updateCustomerStatus(sale.customer_id);
      }
      
      toast.success("Sale created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create sale: " + error.message);
    },
  });

  const updateSale = useMutation({
    mutationFn: async (saleData: UpdateSaleData) => {
      const { items, id, ...saleInfo } = saleData;

      // Fetch previous sale status and invoice number before updating
      const { data: prevSale, error: prevSaleError } = await supabase
        .from("sales")
        .select("order_status, invoice_number, courier_status")
        .eq("id", id)
        .single();
      if (prevSaleError) throw prevSaleError;
      const prevStatus = prevSale?.order_status as string | undefined;

      // Update sale record with order status based on courier status
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .update({
          ...saleInfo,
          order_status: getCategorizedOrderStatus(saleInfo.courier_status || prevSale?.courier_status || '')
        })
        .eq("id", id)
        .select()
        .single();

      if (saleError) throw saleError;

      // Get existing sale items
      const { data: existingItems, error: existingError } = await supabase
        .from("sales_items")
        .select("*")
        .eq("sale_id", id);

      if (existingError) throw existingError;

      // Delete existing sale items
      const { error: deleteError } = await supabase
        .from("sales_items")
        .delete()
        .eq("sale_id", id);

      if (deleteError) throw deleteError;

      // Create new sale items (preserve variant_id when present)
      const saleItems = items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        rate: item.rate,
        total: item.total,
        variant_id: item.variant_id ?? null,
        sale_id: id,
      }));

      const { error: itemsError } = await supabase
        .from("sales_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // If previous status was not cancelled, restore stock that was previously deducted
      if (prevStatus !== "cancelled") {
        for (const existingItem of existingItems) {
          if (existingItem.variant_id) {
            const { data: variant, error: getVarErr } = await supabase
              .from("product_variants")
              .select("stock_quantity")
              .eq("id", existingItem.variant_id)
              .single();
            if (getVarErr) throw getVarErr;

            const restoredVarStock = (variant.stock_quantity || 0) + existingItem.quantity;
            const { error: updVarErr } = await supabase
              .from("product_variants")
              .update({ stock_quantity: restoredVarStock })
              .eq("id", existingItem.variant_id);
            if (updVarErr) throw updVarErr;
          } else {
            const { data: product, error: getError } = await supabase
              .from("products")
              .select("stock_quantity")
              .eq("id", existingItem.product_id)
              .single();
            if (getError) throw getError;

            const restoredStock = (product.stock_quantity || 0) + existingItem.quantity;
            const { error: stockError } = await supabase
              .from("products")
              .update({ stock_quantity: restoredStock })
              .eq("id", existingItem.product_id);
            if (stockError) throw stockError;
          }
        }
      }

      // If new status is not cancelled, deduct stock for new items
      const newStatus = (saleInfo.order_status ?? sale.order_status) as string | undefined;
      if (newStatus !== "cancelled") {
        for (const item of items) {
          if (item.variant_id) {
            const { data: variant, error: getVarErr } = await supabase
              .from("product_variants")
              .select("stock_quantity")
              .eq("id", item.variant_id)
              .single();
            if (getVarErr) throw getVarErr;

            const newVarStock = (variant.stock_quantity || 0) - item.quantity;
            if (newVarStock < 0) throw new Error("Insufficient variant stock");

            const { error: updVarErr } = await supabase
              .from("product_variants")
              .update({ stock_quantity: newVarStock })
              .eq("id", item.variant_id);
            if (updVarErr) throw updVarErr;

            // Log inventory change for variant deduction
            const { error: logError } = await supabase
              .from("inventory_logs")
              .insert([
                {
                  product_id: item.product_id,
                  variant_id: item.variant_id,
                  type: "sale",
                  quantity: -item.quantity,
                  reason: `Sale Update: ${sale.invoice_number}`,
                  created_by: user?.id,
                },
              ]);
            if (logError) throw logError;
          } else {
            const { data: product, error: getError } = await supabase
              .from("products")
              .select("stock_quantity")
              .eq("id", item.product_id)
              .single();
            if (getError) throw getError;

            const newStock = (product.stock_quantity || 0) - item.quantity;
            const { error: stockError } = await supabase
              .from("products")
              .update({ stock_quantity: newStock })
              .eq("id", item.product_id);
            if (stockError) throw stockError;

            // Log inventory change for product deduction
            const { error: logError } = await supabase
              .from("inventory_logs")
              .insert([
                {
                  product_id: item.product_id,
                  type: "sale",
                  quantity: -item.quantity,
                  reason: `Sale Update: ${sale.invoice_number}`,
                  created_by: user?.id,
                },
              ]);
            if (logError) throw logError;
          }
        }
      }

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      
      // Update customer status automatically
      if (sale.customer_id) {
        updateCustomerStatus(sale.customer_id);
      }
      
      toast.success("Sale updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update sale: " + error.message);
    },
  });

  const getSaleWithItems = async (saleId: string) => {
    try {
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 8000)
      );

      const salePromise = supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .single();

      const { data: sale, error: saleError } = await Promise.race([salePromise, timeoutPromise]) as any;

      if (saleError) throw saleError;

      const itemsPromise = supabase
        .from("sales_items")
        .select(`
          *,
          product_variants!left(attributes),
          products!left(image_url, name)
        `)
        .eq("sale_id", saleId);

      const { data: items, error: itemsError } = await Promise.race([itemsPromise, timeoutPromise]) as any;

      if (itemsError) throw itemsError;

      const itemsWithVariants = (items || []).map(item => ({
        ...item,
        variant_attributes: (item as any).product_variants?.attributes || null,
        product_image_url: (item as any).products?.image_url || null
      }));

      return { ...sale, items: itemsWithVariants };
    } catch (error) {
      console.error("Error in getSaleWithItems:", error);
      throw error;
    }
  };

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      // Check if user is admin
      if (!isAdmin) {
        throw new Error("Only administrators can delete sales");
      }
      
      // Use hard delete since we're not using soft delete
      const { error } = await supabase
        .from("sales")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Remove and refetch all related queries to ensure fresh data
      queryClient.removeQueries({ queryKey: ["sales"] });
      queryClient.removeQueries({ queryKey: ["customers"] });
      queryClient.removeQueries({ queryKey: ["dashboard"] });
      queryClient.removeQueries({ queryKey: ["reports"] });
      
      // Small delay to ensure database has processed the deletion
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["sales"] });
        queryClient.refetchQueries({ queryKey: ["customers"] });
      }, 100);
      
      toast.success("Sale deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete sale: " + error.message);
    },
  });

  return {
    sales,
    isLoading,
    error,
    createSale,
    updateSale,
    deleteSale,
    getSaleWithItems,
  };
};