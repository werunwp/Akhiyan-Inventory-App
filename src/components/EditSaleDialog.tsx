import { useState, useEffect } from "react";
import { useSales, type UpdateSaleData } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseSaleDialog, type SaleFormData, type SaleItem } from "./BaseSaleDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

interface EditSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}

export const EditSaleDialog = ({ open, onOpenChange, saleId }: EditSaleDialogProps) => {
  const [initialData, setInitialData] = useState<SaleFormData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updateSale, getSaleWithItems } = useSales();

  useEffect(() => {
    if (!open || !saleId) {
      setInitialData(undefined);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Load data when dialog opens
    const loadSaleData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Add timeout protection
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );
        
        const dataPromise = getSaleWithItems(saleId);
        const saleWithItems = await Promise.race([dataPromise, timeoutPromise]) as any;

        const baseItems = saleWithItems.items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          rate: item.rate,
          total: item.total,
          variant_id: item.variant_id || null,
        } as SaleItem));

        const variantIds = baseItems.filter(i => i.variant_id).map(i => i.variant_id!) as string[];
        let variantMap: Record<string, { label: string; stock: number }> = {};
        
        if (variantIds.length > 0) {
          try {
            const { data: vars, error: varErr } = await supabase
              .from("product_variants")
              .select("id, attributes, stock_quantity")
              .in("id", variantIds);
              
            if (varErr) {
              console.warn("Warning: Could not load variant data:", varErr);
              // Continue without variant data rather than failing completely
            } else {
              variantMap = (vars || []).reduce((acc: any, v: any) => {
                const label = Object.entries(v.attributes || {})
                  .map(([_, val]) => `${val}`)
                  .join(" / ");
                acc[v.id] = { label, stock: v.stock_quantity || 0 };
                return acc;
              }, {});
            }
          } catch (variantError) {
            console.warn("Warning: Could not load variant data:", variantError);
            // Continue without variant data
          }
        }

        const enrichedItems: SaleItem[] = baseItems.map(i =>
          i.variant_id
            ? {
                ...i,
                variantLabel: variantMap[i.variant_id]?.label,
                maxStock: variantMap[i.variant_id]?.stock,
              }
            : i
        );

        setInitialData({
          customerId: saleWithItems.customer_id || "",
          customerName: saleWithItems.customer_name,
          customerPhone: saleWithItems.customer_phone || "",
          customerWhatsapp: saleWithItems.customer_whatsapp || "",
          customerAddress: saleWithItems.customer_address || "",
          city: saleWithItems.city || "",
          zone: saleWithItems.zone || "",
          area: saleWithItems.area || "",
          paymentMethod: saleWithItems.payment_method,
          orderStatus: saleWithItems.order_status || "pending", // Use order_status field
          amountPaid: saleWithItems.amount_paid,
          discountPercent: saleWithItems.discount_percent,
          discountAmount: saleWithItems.discount_amount,
          charge: saleWithItems.fee || 0,
          items: enrichedItems,
        });
      } catch (error) {
        console.error("Error loading sale data:", error);
        setError(error instanceof Error ? error.message : "Failed to load sale data");
        toast.error("Failed to load sale data");
        
        // Close dialog on error to prevent infinite loading
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } finally {
        setIsLoading(false);
      }
    };

    loadSaleData();
  }, [open, saleId]); // Removed problematic dependencies

  // Cleanup effect to prevent memory leaks and infinite states
  useEffect(() => {
    if (!open) {
      // Reset all states when dialog closes
      setInitialData(undefined);
      setIsLoading(false);
      setError(null);
    }
  }, [open]);

  // Additional safeguard: reset loading if it takes too long
  useEffect(() => {
    if (isLoading && open) {
      const loadingTimeout = setTimeout(() => {
        if (isLoading) {
          console.warn("Loading timeout - resetting state");
          setIsLoading(false);
          setError("Loading took too long. Please try again.");
        }
      }, 15000); // 15 second timeout

      return () => clearTimeout(loadingTimeout);
    }
  }, [isLoading, open]);

  const handleSubmit = async (data: SaleFormData, calculatedValues: {
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
    amountDue: number;
  }) => {
    if (!saleId) return;

    try {
      const updateData: UpdateSaleData = {
        id: saleId,
        customer_id: data.customerId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        customer_whatsapp: data.customerWhatsapp,
        customer_address: data.customerAddress,
        city: data.city,
        zone: data.zone,
        area: data.area,
        subtotal: calculatedValues.subtotal,
        discount_percent: data.discountPercent,
        discount_amount: calculatedValues.discountAmount,
        grand_total: calculatedValues.grandTotal,
        amount_paid: data.amountPaid,
        amount_due: calculatedValues.amountDue,
        payment_method: data.paymentMethod,
        order_status: data.orderStatus,
        fee: data.charge || 0,
        items: data.items.map(item => ({
          id: item.id,
          product_id: item.productId || item.product_id!,
          product_name: item.productName || item.product_name!,
          quantity: item.quantity,
          rate: item.rate,
          total: item.total,
          variant_id: (item.variantId || item.variant_id) ?? null,
        }))
      };

      await updateSale.mutateAsync(updateData);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  // Show error state if there's an error
  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Sale - Error</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="text-center space-y-2">
              <div className="text-destructive text-lg">Failed to load sale data</div>
              <div className="text-muted-foreground">{error}</div>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setError(null);
                  // Trigger reload by toggling open state
                  onOpenChange(false);
                  setTimeout(() => onOpenChange(true), 100);
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <BaseSaleDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Sale"
      isEditing={true}
      initialData={initialData}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
};