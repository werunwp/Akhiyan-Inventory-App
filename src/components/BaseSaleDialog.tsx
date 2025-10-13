import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Minus, Trash2, Search } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { useCurrency } from "@/hooks/useCurrency";
import { useProductVariants } from "@/hooks/useProductVariants";
import { toast } from "sonner";
import Fuse from "fuse.js";

export interface SaleItem {
  id?: string;
  productId?: string;
  product_id?: string;
  productName?: string;
  product_name?: string;
  rate: number;
  quantity: number;
  total: number;
  variantId?: string | null;
  variant_id?: string | null;
  variantLabel?: string;
  maxStock?: number;
}

export interface SaleFormData {
  customerId?: string;
  customer_id?: string;
  customerName: string;
  customer_name?: string;
  customerPhone?: string;
  customer_phone?: string;
  customerWhatsapp?: string;
  customer_whatsapp?: string;
  customerAddress?: string;
  customer_address?: string;
  city?: string;
  zone?: string;
  area?: string;
  paymentMethod: string;
  payment_method?: string;
  orderStatus: string;
  order_status?: string;
  amountPaid: number;
  amount_paid?: number;
  discountPercent: number;
  discount_percent?: number;
  discountAmount: number;
  discount_amount?: number;
  charge: number;
  subtotal?: number;
  grand_total?: number;
  amount_due?: number;
  items: SaleItem[];
}

interface BaseSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  isEditing?: boolean;
  initialData?: SaleFormData;
  onSubmit: (data: SaleFormData, calculatedValues: {
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
    amountDue: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const BaseSaleDialog = ({ 
  open, 
  onOpenChange, 
  title, 
  isEditing = false,
  initialData,
  onSubmit,
  isLoading = false
}: BaseSaleDialogProps) => {
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { formatAmount, currencySymbol } = useCurrency();
  
  const [formData, setFormData] = useState<SaleFormData>({
    customerId: "",
    customerName: "",
    customerPhone: "",
    customerWhatsapp: "",
    customerAddress: "",
    city: "",
    zone: "",
    area: "",
    paymentMethod: "cash",
    orderStatus: "pending",
    amountPaid: 0,
    discountPercent: 0,
    discountAmount: 0,
    charge: 0,
    items: [],
  });

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("fixed");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productComboOpen, setProductComboOpen] = useState(false);
  const [customerNameDropdownOpen, setCustomerNameDropdownOpen] = useState(false);
  const [customerPhoneDropdownOpen, setCustomerPhoneDropdownOpen] = useState(false);

  // Initialize form data when dialog opens or initial data changes
  useEffect(() => {
    if (!open) {
      setFormData({
        customerId: "",
        customerName: "",
        customerPhone: "",
        customerWhatsapp: "",
        customerAddress: "",
        city: "",
        zone: "",
        area: "",
        paymentMethod: "cash",
        orderStatus: "pending",
        amountPaid: 0,
        discountPercent: 0,
        discountAmount: 0,
        charge: 0,
        items: [],
      });
      setSelectedProductId("");
      setProductSearchTerm("");
      setProductComboOpen(false);
      setSelectedVariantId(null);
      setCustomerNameDropdownOpen(false);
      setCustomerPhoneDropdownOpen(false);
    } else if (initialData) {
      // Map data to consistent format
      const mappedData: SaleFormData = {
        customerId: initialData.customerId || initialData.customer_id || "",
        customerName: initialData.customerName || initialData.customer_name || "",
        customerPhone: initialData.customerPhone || initialData.customer_phone || "",
        customerWhatsapp: initialData.customerWhatsapp || initialData.customer_whatsapp || "",
        customerAddress: initialData.customerAddress || initialData.customer_address || "",
        city: initialData.city || "",
        zone: initialData.zone || "",
        area: initialData.area || "",
        paymentMethod: initialData.paymentMethod || initialData.payment_method || "cash",
        orderStatus: initialData.orderStatus || initialData.order_status || "pending",
        amountPaid: initialData.amountPaid || initialData.amount_paid || 0,
        discountPercent: initialData.discountPercent || initialData.discount_percent || 0,
        discountAmount: initialData.discountAmount || initialData.discount_amount || 0,
        charge: initialData.charge || 0,
        items: initialData.items.map(item => ({
          ...item,
          productId: item.productId || item.product_id,
          productName: item.productName || item.product_name,
          variantId: item.variantId || item.variant_id,
        })),
      };
      setFormData(mappedData);
    }
  }, [open, initialData]);

  // Searchable products functionality
  const normalizeText = useMemo(() => (text: string) => {
    return text.toLowerCase()
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }, []);

  const fuse = useMemo(() => {
    if (!products) return null;
    
    const searchData: any[] = [];
    
    products.forEach(product => {
      searchData.push({
        ...product,
        searchType: 'product',
        searchText: `${product.name} ${product.sku || ''}`.toLowerCase()
      });
    });

    return new Fuse(searchData, {
      keys: ['searchText', 'name', 'sku'],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 1
    });
  }, [products, normalizeText]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    if (!productSearchTerm.trim()) {
      return products;
    }

    const normalizedQuery = normalizeText(productSearchTerm.trim());
    
    const exactMatches = products.filter(product => {
      const normalizedName = normalizeText(product.name);
      return normalizedName === normalizedQuery;
    });
    
    if (exactMatches.length > 0) {
      return exactMatches;
    }
    
    if (!fuse) return [];
    
    const searchResults = fuse.search(productSearchTerm.trim());
    const matchedProductIds = new Set();
    
    searchResults.forEach(result => {
      matchedProductIds.add(result.item.id);
    });
    
    return products.filter(product => matchedProductIds.has(product.id));
  }, [products, productSearchTerm, fuse, normalizeText]);

  const selectedProduct = filteredProducts.find(p => p.id === selectedProductId);
  const { variants: currentVariants = [] } = useProductVariants(selectedProduct?.has_variants ? selectedProductId : undefined as any);

  // Filter customers by name
  const filteredCustomersByName = useMemo(() => {
    if (!customers || !formData.customerName.trim()) return [];
    const searchTerm = formData.customerName.toLowerCase();
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(searchTerm)
    ).slice(0, 5); // Limit to 5 results
  }, [customers, formData.customerName]);

  // Filter customers by phone
  const filteredCustomersByPhone = useMemo(() => {
    if (!customers || !formData.customerPhone?.trim()) return [];
    const searchTerm = formData.customerPhone.toLowerCase();
    return customers.filter(customer => 
      customer.phone?.toLowerCase().includes(searchTerm)
    ).slice(0, 5); // Limit to 5 results
  }, [customers, formData.customerPhone]);

  // Calculate totals
  const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = discountType === "percentage" 
    ? (subtotal * formData.discountPercent) / 100 
    : formData.discountAmount;
  const grandTotal = subtotal - discountAmount + formData.charge;
  const amountDue = grandTotal - formData.amountPaid;

  // Auto-update payment status based on amount paid
  useEffect(() => {
    if (formData.orderStatus === "cancelled") return;
    if (formData.amountPaid === 0) {
      setFormData(prev => ({ ...prev, orderStatus: "pending" }));
    } else if (formData.amountPaid >= grandTotal) {
      setFormData(prev => ({ ...prev, orderStatus: "paid" }));
    } else {
      setFormData(prev => ({ ...prev, orderStatus: "partial" }));
    }
  }, [formData.amountPaid, grandTotal, formData.orderStatus]);


  const handleCustomerSelectFromName = (customer: any) => {
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || "",
      customerWhatsapp: customer.whatsapp || "",
      customerAddress: customer.address || "",
    }));
    setCustomerNameDropdownOpen(false);
  };

  const handleCustomerSelectFromPhone = (customer: any) => {
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || "",
      customerWhatsapp: customer.whatsapp || "",
      customerAddress: customer.address || "",
    }));
    setCustomerPhoneDropdownOpen(false);
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerId,
        customerName: customer.name,
        customerPhone: customer.phone || "",
        customerWhatsapp: customer.whatsapp || "",
        customerAddress: customer.address || "",
      }));
    }
  };

  const addProduct = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    if (product.has_variants) {
      if (!selectedVariantId) {
        toast.error("Please select a variant");
        return;
      }
      const variant = currentVariants.find(v => v.id === selectedVariantId);
      if (!variant) return;
      const maxStock = variant.stock_quantity || 0;
      if (maxStock <= 0) {
        toast.error("Selected variant is out of stock");
        return;
      }

      const existingItemIndex = formData.items.findIndex(
        i => (i.productId || i.product_id) === product.id && (i.variantId || i.variant_id) === selectedVariantId
      );
      const rate = (variant.rate ?? product.rate) as number;
      if (existingItemIndex >= 0) {
        const existing = formData.items[existingItemIndex];
        const newQty = Math.min(existing.quantity + 1, maxStock);
        updateQuantity(existingItemIndex, newQty);
      } else {
        const label = Object.entries(variant.attributes || {})
          .map(([k, v]) => `${v}`)
          .join(" / ");
        setFormData(prev => ({
          ...prev,
          items: [
            ...prev.items,
            {
              productId: product.id,
              productName: product.name,
              rate,
              quantity: 1,
              total: rate,
              variantId: variant.id,
              variantLabel: label,
              maxStock,
            },
          ],
        }));
      }
    } else {
      const existingItem = formData.items.find(item => (item.productId || item.product_id) === selectedProductId);
      if (existingItem) {
        const index = formData.items.indexOf(existingItem);
        updateQuantity(index, existingItem.quantity + 1);
      } else {
        setFormData(prev => ({
          ...prev,
          items: [
            ...prev.items,
            {
              productId: product.id,
              productName: product.name,
              rate: product.rate,
              quantity: 1,
              total: product.rate,
            },
          ],
        }));
      }
    }

    setSelectedProductId("");
    setSelectedVariantId(null);
    setProductSearchTerm("");
    setProductComboOpen(false);
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(index);
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index 
          ? { ...item, quantity: newQuantity, total: newQuantity * item.rate }
          : item
      )
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    if (!formData.customerName.trim()) {
      toast.error("Please enter customer name");
      return;
    }

    await onSubmit(formData, {
      subtotal,
      discountAmount,
      grandTotal,
      amountDue
    });
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <div className="text-muted-foreground">Loading sale data...</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer Details */}
          <Card className="border-2 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <CardHeader className="bg-gradient-to-r from-blue-100/30 to-indigo-100/30 border-b">
              <CardTitle className="text-lg text-blue-900">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select onValueChange={handleCustomerSelect} value={formData.customerId || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} {customer.phone && `- ${customer.phone}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <div className="relative">
                    <Input
                      value={formData.customerName}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, customerName: e.target.value }));
                        setCustomerNameDropdownOpen(true);
                      }}
                      onFocus={() => setCustomerNameDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setCustomerNameDropdownOpen(false), 200)}
                      placeholder="Enter customer name"
                      required
                    />
                    {customerNameDropdownOpen && filteredCustomersByName.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredCustomersByName.map(customer => (
                          <div
                            key={customer.id}
                            className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                            onClick={() => handleCustomerSelectFromName(customer)}
                          >
                            <div className="font-medium">{customer.name}</div>
                            {customer.phone && (
                              <div className="text-sm text-muted-foreground">{customer.phone}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <div className="relative">
                    <Input
                      value={formData.customerPhone || ""}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, customerPhone: e.target.value }));
                        setCustomerPhoneDropdownOpen(true);
                      }}
                      onFocus={() => setCustomerPhoneDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setCustomerPhoneDropdownOpen(false), 200)}
                      placeholder="Customer phone"
                    />
                    {customerPhoneDropdownOpen && filteredCustomersByPhone.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredCustomersByPhone.map(customer => (
                          <div
                            key={customer.id}
                            className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                            onClick={() => handleCustomerSelectFromPhone(customer)}
                          >
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-muted-foreground">{customer.phone}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={formData.customerWhatsapp || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerWhatsapp: e.target.value }))}
                    placeholder="Customer WhatsApp"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={formData.customerAddress || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
                  placeholder="Customer address"
                />
              </div>

              {/* Location Fields */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={formData.city || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zone</Label>
                  <Input
                    value={formData.zone || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, zone: e.target.value }))}
                    placeholder="Zone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Area</Label>
                  <Input
                    value={formData.area || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                    placeholder="Area"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Selection */}
          <Card className="border-2 bg-gradient-to-r from-green-50/50 to-emerald-50/50">
            <CardHeader className="bg-gradient-to-r from-green-100/30 to-emerald-100/30 border-b">
              <CardTitle className="text-lg text-green-900">Add Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Type to search products..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    onFocus={() => setProductComboOpen(true)}
                  />
                  {productComboOpen && productSearchTerm && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          No products found
                        </div>
                      ) : (
                        filteredProducts.map(product => {
                          const isSelected = formData.items.some(item => 
                            (item.productId || item.product_id) === product.id
                          );
                          
                          return (
                            <div
                              key={product.id}
                              className={`p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 flex items-center gap-3 ${
                                isSelected ? 'bg-gray-100 dark:bg-gray-800' : ''
                              }`}
                              onClick={() => {
                                setSelectedProductId(product.id);
                                setProductSearchTerm(product.name);
                                setProductComboOpen(false);
                                setSelectedVariantId(null);
                              }}
                            >
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                              {product.image_url ? (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">No image</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{product.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {currencySymbol}{product.rate}
                              </div>
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <Button type="button" onClick={addProduct} disabled={!selectedProductId || (selectedProduct?.has_variants && !selectedVariantId)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {selectedProduct?.has_variants && (
                <div className="mt-4 space-y-2">
                  <Label>Variant</Label>
                  <Select value={selectedVariantId ?? ""} onValueChange={(v) => setSelectedVariantId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentVariants.map(v => {
                        const label = Object.entries(v.attributes || {}).map(([k, val]) => `${val}`).join(" / ");
                        const disabled = (v.stock_quantity || 0) <= 0;
                        return (
                          <SelectItem key={v.id} value={v.id} disabled={disabled}>
                            {label} - {currencySymbol}{v.rate || selectedProduct.rate} 
                            {disabled ? " (Out of stock)" : ` (${v.stock_quantity} in stock)`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Products */}
          {formData.items.length > 0 && (
            <Card className="border-2 bg-gradient-to-r from-purple-50/50 to-violet-50/50">
              <CardHeader className="bg-gradient-to-r from-purple-100/30 to-violet-100/30 border-b">
                <CardTitle className="text-lg text-purple-900">Selected Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={`${item.productId || item.product_id}-${index}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {(() => {
                              const product = products.find(p => p.id === (item.productId || item.product_id));
                              return (
                                <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                  {product?.image_url ? (
                                    <img 
                                      src={product.image_url} 
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <span className="text-xs text-muted-foreground">No image</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            <div>
                              <div className="font-medium">{item.productName || item.product_name}</div>
                              {item.variantLabel && (
                                <div className="text-sm text-muted-foreground">{item.variantLabel}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                              className="w-16 text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                              disabled={item.maxStock ? item.quantity >= item.maxStock : false}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{formatAmount(item.rate)}</TableCell>
                        <TableCell>{formatAmount(item.total)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Payment & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-2 bg-gradient-to-r from-orange-50/50 to-amber-50/50">
              <CardHeader className="bg-gradient-to-r from-orange-100/30 to-amber-100/30 border-b">
                <CardTitle className="text-lg text-orange-900">Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={discountType === "percentage"}
                        onCheckedChange={(checked) => setDiscountType(checked ? "percentage" : "fixed")}
                      />
                      <Label>Percentage</Label>
                    </div>
                  </div>
                </div>

                {discountType === "percentage" ? (
                  <div className="space-y-2">
                    <Label>Discount Percentage</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.discountPercent}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountPercent: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Discount Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discountAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountAmount: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Charge</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.charge}
                    onChange={(e) => setFormData(prev => ({ ...prev, charge: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={formData.paymentMethod} onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount Paid</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amountPaid}
                    onChange={(e) => setFormData(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Order Status</Label>
                  <Select value={formData.orderStatus} onValueChange={(value) => {
                    if (value === "paid") {
                      // When "Paid" is selected, automatically set amount paid to grand total
                      setFormData(prev => ({ 
                        ...prev, 
                        orderStatus: value,
                        amountPaid: grandTotal
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, orderStatus: value }));
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Order status is automatically updated based on courier status
                  </p>
                </div>

              </CardContent>
            </Card>

            <Card className="border-2 bg-gradient-to-r from-teal-50/50 to-cyan-50/50">
              <CardHeader className="bg-gradient-to-r from-teal-100/30 to-cyan-100/30 border-b">
                <CardTitle className="text-lg text-teal-900">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatAmount(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{formatAmount(discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Charge:</span>
                  <span>{formatAmount(formData.charge)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Grand Total:</span>
                  <span>{formatAmount(grandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span>{formatAmount(formData.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Amount Due:</span>
                  <span className={amountDue > 0 ? "text-destructive" : "text-green-600"}>
                    {formatAmount(amountDue)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formData.items.length === 0}>
              {isEditing ? "Update Sale" : "Create Sale"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};