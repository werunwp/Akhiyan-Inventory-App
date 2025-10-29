import { Edit, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/hooks/useCurrency";
import { useProductVariants } from "@/hooks/useProductVariants";
import { Product } from "@/hooks/useProducts";

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
}

export const ProductCard = ({ 
  product, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  isDuplicating, 
  isDeleting 
}: ProductCardProps) => {
  const { formatAmount } = useCurrency();
  const { variants } = useProductVariants(product.has_variants ? product.id : undefined);

  const getStatus = () => {
    if (product.has_variants) {
      // For products with variants, check total stock across all variants
      const totalVariantStock = (variants || []).reduce((total, variant) => total + variant.stock_quantity, 0);
      if (totalVariantStock <= 0) return "Stock Out";
      if (totalVariantStock <= product.low_stock_threshold) return "Low Stock";
      return "In Stock";
    } else {
      // For products without variants, use the product's stock_quantity
      if (product.stock_quantity <= 0) return "Stock Out";
      if (product.stock_quantity <= product.low_stock_threshold) return "Low Stock";
      return "In Stock";
    }
  };

  const status = getStatus();
  const stockValue = product.has_variants
    ? (variants || []).reduce((total, variant) => {
        const unitCost = variant.cost ?? variant.rate ?? 0;
        return total + (variant.stock_quantity * unitCost);
      }, 0)
    : product.stock_quantity * (product.cost || product.rate);

  const getVariantLabel = (attributes: Record<string, string>) => {
    // Get the first attribute value (usually Size, Color, etc.)
    const values = Object.values(attributes);
    return values.length > 0 ? values[0] : 'Variant';
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 overflow-hidden">
      <div className="relative">
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
              <span className="text-4xl font-bold text-muted-foreground/50">
                {product.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="absolute top-2 right-2 flex gap-2">
          {product.is_deleted && (
            <Badge variant="destructive" className="shadow-md">
              Deleted
            </Badge>
          )}
          <Badge 
            variant={
              status === "In Stock" ? "default" : 
              status === "Low Stock" ? "secondary" : 
              "destructive"
            }
            className="shadow-md"
          >
            {status}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg leading-tight">{product.name}</h3>
            {product.sku && <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>}
            
            {/* Show variations in the format from the image */}
            {product.has_variants && variants.length > 0 ? (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                  <span>Select {Object.keys(variants[0]?.attributes || {})[0] || 'Variant'}:</span>
                  <span>Stock</span>
                </div>
                <div className="space-y-1">
                  {variants.map((variant) => (
                    <div key={variant.id} className="flex justify-between items-center text-sm py-1 px-2 bg-muted/50 rounded">
                      <span>{getVariantLabel(variant.attributes)}</span>
                      <span className={variant.stock_quantity < 0 ? "text-destructive" : ""}>{variant.stock_quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {product.has_variants && (
                  <div className="mt-1">
                    <Badge variant="secondary">Variations</Badge>
                  </div>
                )}
                {(product.size || product.color) && (
                  <div className="flex flex-col gap-1 mt-1">
                    {product.size && <span className="text-xs bg-muted px-2 py-1 rounded-full w-fit">{product.size}</span>}
                    {product.color && <span className="text-xs bg-muted px-2 py-1 rounded-full w-fit">{product.color}</span>}
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-primary">{formatAmount(product.rate)}</span>
              {!product.has_variants && (
                <span className="text-sm font-medium">Stock: {product.stock_quantity}</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Stock Value: <span className="font-medium text-foreground">{formatAmount(stockValue)}</span>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onEdit(product)}
              aria-label="Edit product"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onDuplicate(product.id)}
              disabled={isDuplicating}
              aria-label="Duplicate product"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => onDelete(product.id)}
              disabled={isDeleting || product.is_deleted}
              className="text-destructive hover:text-destructive"
              aria-label={product.is_deleted ? "Product already deleted" : "Delete product"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};