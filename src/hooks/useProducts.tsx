import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  rate: number;
  cost: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  size: string | null;
  color: string | null;
  image_url: string | null;
  has_variants: boolean; 
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateProductData {
  name: string;
  sku?: string;
  rate: number;
  cost?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  size?: string;
  color?: string;
  image_url?: string;
  has_variants?: boolean;
}

// Helper function to generate intelligent SKU
const generateIntelligentSku = async (originalSku: string, supabase: any): Promise<string | null> => {
  if (!originalSku || originalSku.trim() === '') {
    return null;
  }
  
  const base = originalSku.trim();
  
  // Strategy 1: Try to increment the last character
  const lastChar = base.slice(-1);
  const isNumeric = /^\d$/.test(lastChar);
  
  let candidate = '';
  if (isNumeric) {
    const numericPart = parseInt(lastChar);
    if (numericPart < 9) {
      candidate = base.slice(0, -1) + (numericPart + 1);
    } else {
      candidate = base + '1';
    }
  } else {
    const charCode = lastChar.charCodeAt(0);
    if (charCode >= 65 && charCode < 90) { // A to Y
      candidate = base.slice(0, -1) + String.fromCharCode(charCode + 1);
    } else {
      candidate = base + '1';
    }
  }
  
  // Check if this candidate is unique
  const { data: existingSku } = await supabase
    .from("products")
    .select("id")
    .eq("sku", candidate)
    .single();
    
  if (!existingSku) {
    return candidate;
  }
  
  // Strategy 2: Try adding single digits (1-9)
  for (let i = 1; i <= 9; i++) {
    const digitCandidate = base + i;
    const { data: existingDigit } = await supabase
      .from("products")
      .select("id")
      .eq("sku", digitCandidate)
      .single();
      
    if (!existingDigit) {
      return digitCandidate;
    }
  }
  
  // Strategy 3: Try adding single letters (A-Z)
  for (let i = 65; i <= 90; i++) { // A to Z
    const letterCandidate = base + String.fromCharCode(i);
    const { data: existingLetter } = await supabase
      .from("products")
      .select("id")
      .eq("sku", letterCandidate)
      .single();
      
    if (!existingLetter) {
      return letterCandidate;
    }
  }
  
  // Fallback: Add small random suffix (2-3 characters max)
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
  return base + suffix;
};

export const useProducts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  const createProduct = useMutation({
    mutationFn: async (productData: CreateProductData) => {
      // Convert empty SKU to null to avoid unique constraint issues
      const processedData = {
        ...productData,
        sku: productData.sku?.trim() || null,
        created_by: user?.id
      };
      
      const { data, error } = await supabase
        .from("products")
        .insert([processedData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create product: " + error.message);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateProductData> }) => {
      // Convert empty SKU to null to avoid unique constraint issues
      const processedData = {
        ...data,
        sku: data.sku !== undefined ? (data.sku?.trim() || null) : undefined
      };
      
      const { data: updated, error } = await supabase
        .from("products")
        .update(processedData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update product: " + error.message);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete the product by marking it as deleted
      const { error } = await supabase
        .from("products")
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["reusable-attributes"] }); // Refresh attribute usage
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('productDeleted'));
      toast.success("Product deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete product: " + error.message);
    },
  });

  const restoreProduct = useMutation({
    mutationFn: async (id: string) => {
      // Restore the product by marking it as not deleted
      const { error } = await supabase
        .from("products")
        .update({ 
          is_deleted: false, 
          deleted_at: null 
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["all_products"] });
      queryClient.invalidateQueries({ queryKey: ["reusable-attributes"] }); // Refresh attribute usage
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('productRestored'));
      toast.success("Product restored successfully");
    },
    onError: (error) => {
      toast.error("Failed to restore product: " + error.message);
    },
  });

  const duplicateProduct = useMutation({
    mutationFn: async (productId: string) => {
      // First, get the original product
      const { data: originalProduct, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (productError) throw productError;

      // Generate new SKU for the duplicated product using intelligent logic
      const newSku = await generateIntelligentSku(originalProduct.sku || '', supabase);

      // Create the new product
      const { data: newProduct, error: createError } = await supabase
        .from("products")
        .insert([{
          name: `${originalProduct.name} (duplicated)`,
          sku: newSku,
          rate: originalProduct.rate,
          cost: originalProduct.cost,
          stock_quantity: originalProduct.stock_quantity,
          low_stock_threshold: originalProduct.low_stock_threshold,
          size: originalProduct.size,
          color: originalProduct.color,
          image_url: originalProduct.image_url,
          has_variants: originalProduct.has_variants,
          created_by: user?.id
        }])
        .select()
        .single();

      if (createError) throw createError;

      // If the original product has variants, duplicate them too
      if (originalProduct.has_variants) {
        const { data: originalVariants, error: variantsError } = await supabase
          .from("product_variants")
          .select("*")
          .eq("product_id", productId);

        if (variantsError) throw variantsError;

        if (originalVariants && originalVariants.length > 0) {
          const newVariants = originalVariants.map(variant => ({
            product_id: newProduct.id,
            attributes: variant.attributes,
            rate: variant.rate,
            cost: variant.cost,
            stock_quantity: variant.stock_quantity,
            low_stock_threshold: variant.low_stock_threshold,
            sku: variant.sku ? `${variant.sku}-${suffix}` : null,
            image_url: variant.image_url
          }));

          const { error: createVariantsError } = await supabase
            .from("product_variants")
            .insert(newVariants);

          if (createVariantsError) throw createVariantsError;
        }
      }

      return newProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["all_product_variants"] });
      toast.success("Product duplicated successfully with all variants");
    },
    onError: (error) => {
      toast.error("Failed to duplicate product: " + error.message);
    },
  });

  return {
    products,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
    duplicateProduct,
  };
};

// Hook to get all products including deleted ones (for sales/invoices)
export const useAllProducts = () => {
  const { user } = useAuth();

  const {
    data: allProducts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["all_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  return {
    allProducts,
    isLoading,
    error,
  };
};