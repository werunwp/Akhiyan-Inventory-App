import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProducts, Product, CreateProductData } from "@/hooks/useProducts";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { Loader2, X, Plus } from "lucide-react";
import { ImagePicker } from "./ImagePicker";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useProductVariants, AttributeDefinition } from "@/hooks/useProductVariants";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export const ProductDialog = ({ open, onOpenChange, product }: ProductDialogProps) => {
  const { createProduct, updateProduct } = useProducts();
  const { businessSettings } = useBusinessSettings();
  const [formData, setFormData] = useState<CreateProductData>({
    name: "",
    sku: "",
    rate: 0,
    cost: 0,
    stock_quantity: 0,
    low_stock_threshold: businessSettings?.low_stock_alert_quantity || 10,
    image_url: "",
  });

  const isEditing = !!product;

  // Variations state
  const [hasVariants, setHasVariants] = useState<boolean>(product?.has_variants ?? false);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  type VariantFormRow = { sku?: string; rate?: number | null; cost?: number | null; quantity: number; low_stock_threshold?: number | null; image_url?: string };
  const [variantState, setVariantState] = useState<Record<string, VariantFormRow>>({});
  const [bulkRate, setBulkRate] = useState<string>("");
  const [bulkCost, setBulkCost] = useState<string>("");
  const [bulkLow, setBulkLow] = useState<string>("");
  const [bulkQty, setBulkQty] = useState<string>("");

  const setVariant = (key: string, patch: Partial<VariantFormRow>) => {
    setVariantState((prev) => ({
      ...prev,
      [key]: { quantity: 0, ...prev[key], ...patch },
    }));
  };

  const applyBulk = () => {
    const r = bulkRate ? parseFloat(bulkRate) : undefined;
    const c = bulkCost ? parseFloat(bulkCost) : undefined;
    const l = bulkLow ? parseInt(bulkLow) : undefined;
    const q = bulkQty ? parseInt(bulkQty) : undefined;
    const next: Record<string, VariantFormRow> = {};
    combos.forEach((attrs) => {
      const key = JSON.stringify(attrs);
      const cur = variantState[key] || { quantity: 0 };
      next[key] = {
        ...cur,
        rate: r ?? cur.rate ?? formData.rate,
        cost: c ?? cur.cost ?? (formData.cost || null),
        low_stock_threshold: l ?? cur.low_stock_threshold ?? (businessSettings?.low_stock_alert_quantity || formData.low_stock_threshold),
        quantity: q ?? cur.quantity,
      };
    });
    setVariantState(next);
  };

  const { variants: existingVariants, isLoading: variantsLoading, bulkUpsert, clearVariants } = useProductVariants(product?.id);

  const combos = useMemo(() => {
    if (!attributes.length) return [] as Array<Record<string,string>>;
    const lists = attributes.map(a => a.values.filter(v => v?.trim()).map(v => ({ [a.name]: v.trim() })));
    if (lists.some(l => l.length === 0)) return [] as Array<Record<string,string>>;
    // cartesian product of list of objects where we merge keys
    const allCombos = lists.reduce((acc, list) => {
      const out: Array<Record<string,string>> = [];
      for (const a of acc) {
        for (const b of list) {
          out.push({ ...a, ...b });
        }
      }
      return out;
    }, [{} as Record<string,string>]);
    
    // Deduplicate combinations by converting to JSON strings and back
    const uniqueCombos = Array.from(
      new Map(allCombos.map(combo => [JSON.stringify(combo), combo])).values()
    );
    
    return uniqueCombos;
  }, [attributes]);

  const totalVariantQty = useMemo(() => {
    return combos.reduce((sum, attrs) => sum + (variantState[JSON.stringify(attrs)]?.quantity || 0), 0);
  }, [combos, variantState]);

  const lowWarnings = useMemo(() => {
    return combos.reduce((acc, attrs) => {
      const key = JSON.stringify(attrs);
      const v = variantState[key];
      const threshold = (v?.low_stock_threshold ?? formData.low_stock_threshold) || 0;
      const qty = v?.quantity || 0;
      return acc + (qty <= threshold ? 1 : 0);
    }, 0);
  }, [combos, variantState, formData.low_stock_threshold]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku || "",
        rate: product.rate,
        cost: product.cost || 0,
        stock_quantity: product.stock_quantity,
        low_stock_threshold: product.low_stock_threshold,
        image_url: product.image_url || "",
        has_variants: product.has_variants,
      });
      setHasVariants(!!product.has_variants);
    } else {
      setFormData({
        name: "",
        sku: "",
        rate: 0,
        cost: 0,
        stock_quantity: 0,
        low_stock_threshold: businessSettings?.low_stock_alert_quantity || 10,
        image_url: "",
        has_variants: false,
      });
      setHasVariants(false);
    }
  }, [product]);

  // Update form data when business settings change (for new products)
  useEffect(() => {
    if (!product && businessSettings?.low_stock_alert_quantity) {
      setFormData(prev => ({
        ...prev,
        low_stock_threshold: businessSettings.low_stock_alert_quantity
      }));
    }
  }, [businessSettings?.low_stock_alert_quantity, product]);

  useEffect(() => {
    if (isEditing && product?.id && hasVariants) {
      (async () => {
        const { data, error } = await supabase
          .from('product_attributes')
          .select('id,name, product_attribute_values ( value )')
          .eq('product_id', product.id);
        if (!error && data) {
          const defs: AttributeDefinition[] = (data as any[]).map((row: any) => ({
            name: row.name,
            values: (row.product_attribute_values || []).map((v: any) => v.value),
          }));
          if (defs.length) setAttributes(defs);
        }
      })();
    }
  }, [isEditing, product?.id, hasVariants]);

  useEffect(() => {
    if (hasVariants && existingVariants && existingVariants.length) {
      const vs: Record<string, VariantFormRow> = {};
      existingVariants.forEach((v) => {
        const key = JSON.stringify(v.attributes);
        vs[key] = {
          sku: v.sku ?? undefined,
          rate: v.rate,
          cost: v.cost,
          quantity: v.stock_quantity,
          low_stock_threshold: v.low_stock_threshold ?? undefined,
          image_url: v.image_url ?? undefined,
        };
      });
      setVariantState(vs);

      if (!attributes.length) {
        const nameSet = new Set<string>();
        existingVariants.forEach((v) => {
          Object.keys(v.attributes || {}).forEach((k) => nameSet.add(k));
        });
        const attrDefs: AttributeDefinition[] = Array.from(nameSet).map((name) => ({
          name,
          values: Array.from(new Set(existingVariants.map((v) => v.attributes[name]).filter(Boolean))),
        }));
        if (attrDefs.length) setAttributes(attrDefs);
      }
    }
  }, [existingVariants, hasVariants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (hasVariants) {
        if (isEditing && product) {
          // Update product base fields, mark has_variants
          await updateProduct.mutateAsync({ id: product.id, data: { ...formData, has_variants: true } });
          // Prepare variants payload
          const variantPayload = combos.map((attrs) => {
            const key = JSON.stringify(attrs);
            const v = variantState[key] || { quantity: 0 };
            return {
              product_id: product.id,
              attributes: attrs,
              sku: v.sku || null,
              rate: v.rate ?? null,
              cost: v.cost ?? null,
              stock_quantity: v.quantity || 0,
              low_stock_threshold: v.low_stock_threshold ?? null,
              image_url: v.image_url || null,
            };
          });
          await bulkUpsert.mutateAsync({
            productId: product.id,
            hasVariants: true,
            attributes,
            variants: variantPayload as any,
          });
        } else {
          // Create base product first
          const created = await createProduct.mutateAsync({ ...formData, has_variants: true, stock_quantity: 0 });
          const productId = (created as any)?.id;
          if (productId) {
            const variantPayload = combos.map((attrs) => {
              const key = JSON.stringify(attrs);
              const v = variantState[key] || { quantity: 0 };
              return {
                product_id: productId,
                attributes: attrs,
                sku: v.sku?.trim() || null,
                rate: v.rate ?? null,
                cost: v.cost ?? null,
                stock_quantity: v.quantity || 0,
                low_stock_threshold: v.low_stock_threshold ?? null,
                image_url: v.image_url || null,
              };
            });
            await bulkUpsert.mutateAsync({ productId, hasVariants: true, attributes, variants: variantPayload as any });
          }
        }
      } else {
        // No variants path
        if (isEditing && product) {
          // Convert empty SKU to null
          const processedFormData = {
            ...formData,
            sku: formData.sku?.trim() || null,
            has_variants: false
          };
          await updateProduct.mutateAsync({ id: product.id, data: processedFormData });
          if (product.has_variants) {
            await clearVariants.mutateAsync(product.id);
          }
        } else {
          // Convert empty SKU to null
          const processedFormData = {
            ...formData,
            sku: formData.sku?.trim() || null,
            has_variants: false
          };
          await createProduct.mutateAsync(processedFormData);
        }
      }
    } catch (error) {
      // handled in hooks
    }
    
    onOpenChange(false);
  };

  const handleChange = (field: keyof CreateProductData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isLoading = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the product information below." : "Enter the details for the new product."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Enter product name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU (Optional)</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) => handleChange("sku", e.target.value)}
              placeholder="Enter SKU (leave empty if not needed)"
            />
            <p className="text-xs text-muted-foreground">
              SKU is optional. Leave empty if you don't need to track this product with a specific code.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rate">Selling Price *</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.rate}
                onChange={(e) => handleChange("rate", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cost">Cost Price</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost}
                onChange={(e) => handleChange("cost", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock_quantity">Stock Quantity</Label>
              <Input
                id="stock_quantity"
                type="number"
                min="0"
                value={hasVariants ? totalVariantQty : formData.stock_quantity}
                onChange={(e) => handleChange("stock_quantity", parseInt(e.target.value) || 0)}
                placeholder="0"
                disabled={hasVariants}
              />
              {hasVariants && (
                <p className="text-xs text-muted-foreground">Auto-calculated from variants</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="low_stock_threshold">Low Stock Alert</Label>
              <Input
                id="low_stock_threshold"
                type="number"
                min="0"
                value={formData.low_stock_threshold}
                onChange={(e) => handleChange("low_stock_threshold", parseInt(e.target.value) || (businessSettings?.low_stock_alert_quantity || 10))}
                placeholder={businessSettings?.low_stock_alert_quantity?.toString() || "10"}
              />
            </div>
          </div>

          {/* Variations Toggle */}
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Variations</Label>
              <p className="text-xs text-muted-foreground">Add attributes (e.g., Size, Color) and manage variant stock.</p>
            </div>
            <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
          </div>

          {hasVariants ? (
            <>
              {/* Attributes Panel */}
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Attributes</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAttributes([...attributes, { name: "", values: [] }])}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Attribute
                  </Button>
                </div>

                {/* Custom Attributes */}
                <div className="space-y-3">
                  {attributes.map((attr, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div className="space-y-1">
                        <Label>Attribute Name</Label>
                        <Input
                          value={attr.name}
                          onChange={(e) => {
                            const copy = [...attributes];
                            copy[idx] = { ...copy[idx], name: e.target.value };
                            setAttributes(copy);
                          }}
                          placeholder="e.g., Size"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Values (comma separated)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={attr.values.join(", ")}
                            onChange={(e) => {
                              const vals = e.target.value.split(",").map((v) => v.trim());
                              const copy = [...attributes];
                              copy[idx] = { ...copy[idx], values: vals };
                              setAttributes(copy);
                            }}
                            placeholder="e.g., Small, Medium, Large"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const copy = attributes.filter((_, i) => i !== idx);
                              setAttributes(copy);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!attributes.length && (
                    <p className="text-xs text-muted-foreground">No attributes yet. Add one to start creating variants.</p>
                  )}
                </div>
              </div>

              {/* Bulk Actions + Variants Matrix */}
              {combos.length > 0 && (
                <>
                  <div className="rounded-lg bg-muted p-3 grid grid-cols-1 sm:grid-cols-9 gap-2 items-end">
                    <div className="sm:col-span-2">
                      <Label>Bulk Price</Label>
                      <Input type="number" step="0.01" value={bulkRate} onChange={(e) => setBulkRate(e.target.value)} placeholder={`${formData.rate}`} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Bulk Cost</Label>
                      <Input type="number" step="0.01" value={bulkCost} onChange={(e) => setBulkCost(e.target.value)} placeholder={`${formData.cost || 0}`} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Bulk Low Stock</Label>
                      <Input type="number" value={bulkLow} onChange={(e) => setBulkLow(e.target.value)} placeholder={`${formData.low_stock_threshold}`} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Bulk Qty</Label>
                      <Input type="number" min="0" value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} placeholder="0" />
                    </div>
                    <div className="sm:col-span-1">
                      <Button type="button" className="w-full" onClick={applyBulk}>Apply</Button>
                    </div>
                  </div>

                  <div className="rounded-lg border overflow-x-auto">
                    <div className="max-h-96 overflow-auto">
                      <Table className="min-w-[900px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variant</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Low Stock</TableHead>
                            <TableHead>Image</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {combos.map((attrs, i) => {
                            const key = JSON.stringify(attrs);
                            const v = variantState[key] || { quantity: 0 };
                            const name = attributes.map((a) => (attrs as any)[a.name]).filter(Boolean).join(" | ");
                            return (
                              <TableRow key={key + i}>
                                <TableCell className="whitespace-nowrap">{name}</TableCell>
                                <TableCell>
                                  <Input value={v.sku || ""} onChange={(e) => setVariant(key, { sku: e.target.value })} placeholder={formData.sku ? `${formData.sku}-${i + 1}` : `Variant-${i + 1}`} />
                                </TableCell>
                                <TableCell>
                                  <Input type="number" step="0.01" value={v.rate ?? ""} onChange={(e) => setVariant(key, { rate: e.target.value ? parseFloat(e.target.value) : null })} placeholder={`${formData.rate}`} />
                                </TableCell>
                                <TableCell>
                                  <Input type="number" step="0.01" value={v.cost ?? ""} onChange={(e) => setVariant(key, { cost: e.target.value ? parseFloat(e.target.value) : null })} placeholder={`${formData.cost || 0}`} />
                                </TableCell>
                                <TableCell>
                                  <Input type="number" min={0} value={v.quantity} onChange={(e) => setVariant(key, { quantity: parseInt(e.target.value) || 0 })} />
                                </TableCell>
                                <TableCell>
                                  <Input type="number" min={0} value={v.low_stock_threshold ?? ""} onChange={(e) => setVariant(key, { low_stock_threshold: e.target.value ? parseInt(e.target.value) : null })} placeholder={`${formData.low_stock_threshold}`} />
                                </TableCell>
                                <TableCell>
                                  <div className="min-w-[120px]">
                                    <ImagePicker
                                      value={v.image_url || ""}
                                      onChange={(url) => setVariant(key, { image_url: url })}
                                      onRemove={() => setVariant(key, { image_url: "" })}
                                      placeholder="Select variant image"
                                      iconOnly={true}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Variants: {combos.length}</Badge>
                        <Badge variant="secondary">Total Stock: {totalVariantQty}</Badge>
                      </div>
                      {lowWarnings > 0 && <span className="text-destructive">{lowWarnings} variants at or below low stock</span>}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="image_url">Featured Image</Label>
            <ImagePicker
              value={formData.image_url}
              onChange={(url) => handleChange("image_url", url)}
              onRemove={() => handleChange("image_url", "")}
              placeholder="Select a product image"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Product" : "Create Product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};