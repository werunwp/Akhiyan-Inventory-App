import { Plus, Search, Filter, Edit, Trash2, Download, Upload, Copy, Image as ImageIcon, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProducts } from "@/hooks/useProducts";
import { useProductVariants } from "@/hooks/useProductVariants";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { ProductDialog } from "@/components/ProductDialog";
import { ProductCard } from "@/components/ProductCard";
import { useCurrency } from "@/hooks/useCurrency";
import * as ExcelJS from "exceljs";
import { compressImage } from "@/lib/imageCompression";
import { supabase } from "@/integrations/supabase/client";

const Products = () => {
  const { products, isLoading, deleteProduct, createProduct, updateProduct, duplicateProduct } = useProducts();
  const { formatAmount } = useCurrency();
  const { businessSettings } = useBusinessSettings();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    logs: [] as Array<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; timestamp: string }>,
    stats: {
      compressed: 0,
      skipped: 0,
      errors: 0,
      originalSize: 0,
      compressedSize: 0
    }
  });
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressRef = useRef<number>(0);
  const itemsPerPage = 20;

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination calculations
  const totalProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const totalStockValue = useMemo(() => {
    return products.reduce((total, product) => {
      return total + (product.stock_quantity * (product.cost || product.rate));
    }, 0);
  }, [products]);

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
  };

  const addLog = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setOptimizationProgress(prev => ({
      ...prev,
      logs: [...prev.logs, { message, type, timestamp }]
    }));
  };

  const updateProgress = (current: number, total: number) => {
    const percentage = Math.round((current / total) * 100);
    setOptimizationProgress(prev => ({
      ...prev,
      current,
      total,
      percentage
    }));
    lastProgressRef.current = Date.now();
  };

  const resetStuckDetection = () => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    // Set a timeout to detect stuck processing (30 seconds per image)
    processingTimeoutRef.current = setTimeout(() => {
      const timeSinceLastProgress = Date.now() - lastProgressRef.current;
      if (timeSinceLastProgress > 30000 && isOptimizing) {
        addLog('⚠️ Processing appears to be stuck. This might be due to a large image or network issues.', 'warning');
        addLog('💡 Tip: Try refreshing the page if it stays stuck for more than a minute.', 'info');
      }
    }, 30000);
  };

  const handleOptimizeImages = async () => {
    if (isOptimizing) {
      toast.info("Image optimization already in progress");
      return;
    }

    if (!products || products.length === 0) {
      toast.error("No products found to optimize");
      return;
    }

    const confirm = window.confirm(
      `This will compress all product images to under 50KB.\n\n` +
      `Found ${products.length} products.\n\n` +
      `This may take a few minutes. Continue?`
    );

    if (!confirm) return;

    // Reset progress state
    setOptimizationProgress({
      current: 0,
      total: 0,
      percentage: 0,
      logs: [],
      stats: {
        compressed: 0,
        skipped: 0,
        errors: 0,
        originalSize: 0,
        compressedSize: 0
      }
    });
    
    setIsOptimizing(true);
    setShowProgressDialog(true);
    lastProgressRef.current = Date.now();
    
    addLog('🚀 Starting image optimization...', 'info');

    try {
      // Get all unique image URLs from products
      const imageUrls = new Set<string>();
      products.forEach(product => {
        if (product.image_url && product.image_url !== '/placeholder.svg') {
          imageUrls.add(product.image_url);
        }
      });

      const total = imageUrls.size;
      
      if (total === 0) {
        addLog('⚠️ No images found to optimize', 'warning');
        setIsOptimizing(false);
        setShowProgressDialog(false);
        return;
      }

      addLog(`📂 Found ${total} unique images to process`, 'info');
      updateProgress(0, total);

      // Process each image
      let processed = 0;
      for (const imageUrl of Array.from(imageUrls)) {
        resetStuckDetection();
        
        try {
          // Extract the file path from the URL
          const urlObj = new URL(imageUrl);
          const pathParts = urlObj.pathname.split('/');
          const fileName = pathParts[pathParts.length - 1];

          addLog(`📥 Processing: ${fileName}`, 'info');

          // Download the image
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const originalSize = blob.size;

          // Skip if already small enough
          if (originalSize <= 50 * 1024) {
            const sizeKB = (originalSize / 1024).toFixed(2);
            addLog(`⏭️ Skipped ${fileName} (already ${sizeKB}KB)`, 'info');
            
            setOptimizationProgress(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                skipped: prev.stats.skipped + 1,
                originalSize: prev.stats.originalSize + originalSize,
                compressedSize: prev.stats.compressedSize + originalSize
              }
            }));
            
            processed++;
            updateProgress(processed, total);
            continue;
          }

          // Compress the image
          addLog(`🗜️ Compressing ${fileName} (${(originalSize / 1024).toFixed(2)}KB)...`, 'info');
          
          const compressedBlob = await compressImage(
            new File([blob], fileName, { type: blob.type }),
            600,
            600,
            0.6,
            50
          );

          const compressedSize = compressedBlob.size;

          // Upload the compressed image (replace existing)
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, compressedBlob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            throw uploadError;
          }

          const savedKB = ((originalSize - compressedSize) / 1024).toFixed(2);
          const savedPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);
          
          addLog(
            `✅ ${fileName}: ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB (saved ${savedKB}KB, ${savedPercent}%)`,
            'success'
          );

          setOptimizationProgress(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              compressed: prev.stats.compressed + 1,
              originalSize: prev.stats.originalSize + originalSize,
              compressedSize: prev.stats.compressedSize + compressedSize
            }
          }));

          processed++;
          updateProgress(processed, total);

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          addLog(`❌ Error: ${errorMessage}`, 'error');
          
          setOptimizationProgress(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              errors: prev.stats.errors + 1
            }
          }));
          
          processed++;
          updateProgress(processed, total);
        }
      }

      // Clear timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }

      // Show summary
      const { stats } = optimizationProgress;
      const totalSavedMB = ((stats.originalSize - stats.compressedSize) / (1024 * 1024)).toFixed(2);
      const percentSaved = stats.originalSize > 0 
        ? ((1 - stats.compressedSize / stats.originalSize) * 100).toFixed(1) 
        : 0;

      addLog('━'.repeat(50), 'info');
      addLog('🎉 Optimization Complete!', 'success');
      addLog(`📊 Total images: ${total}`, 'info');
      addLog(`✅ Compressed: ${stats.compressed}`, 'success');
      addLog(`⏭️ Skipped: ${stats.skipped}`, 'info');
      if (stats.errors > 0) {
        addLog(`❌ Errors: ${stats.errors}`, 'error');
      }
      addLog(`💾 Space saved: ${totalSavedMB} MB (${percentSaved}%)`, 'success');
      addLog('━'.repeat(50), 'info');

      toast.success(`Optimization complete! Saved ${totalSavedMB} MB`, { duration: 5000 });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Fatal error: ${errorMessage}`, 'error');
      addLog('💡 Please check your network connection and try again.', 'info');
      toast.error(`Optimization failed: ${errorMessage}`);
    } finally {
      setIsOptimizing(false);
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
      toast.error("Please upload a valid XLSX or CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let jsonData: any[] = [];

        if (fileExtension === 'csv') {
          // Handle CSV files
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
              const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              jsonData.push(row);
            }
          }
        } else {
          // Handle XLSX/XLS files using ExcelJS
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(data);
          const worksheet = workbook.worksheets[0];
          
          if (!worksheet) {
            throw new Error('No worksheet found in the file');
          }
          
          // Convert worksheet to JSON
          const headers: string[] = [];
          const rows: any[] = [];
          
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
              // First row contains headers
              row.eachCell((cell, colNumber) => {
                headers[colNumber - 1] = cell.text || '';
              });
            } else {
              // Data rows
              const rowData: any = {};
              row.eachCell((cell, colNumber) => {
                const header = headers[colNumber - 1];
                if (header) {
                  rowData[header] = cell.text || '';
                }
              });
              if (Object.keys(rowData).length > 0) {
                rows.push(rowData);
              }
            }
          });
          
          jsonData = rows;
        }

        if (jsonData.length === 0) {
          toast.error("No data found in the file");
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        let updatedCount = 0;
        let processedCount = 0;

        const processBatch = async (items: any[], batchIndex: number) => {
          const batchPromises = items.map(async (row: any, rowIndex: number) => {
            try {
              // Skip completely empty rows
              const hasAnyData = Object.values(row).some(value => 
                value !== null && value !== undefined && String(value).trim() !== ''
              );
              
              if (!hasAnyData) {
                console.log(`Skipping empty row ${rowIndex + 1}`);
                return;
              }

              // Map the data to product structure with flexible field matching
              const productData = {
                name: String(row.Name || row.name || row.PRODUCT_NAME || row['Product Name'] || '').trim(),
                sku: row.SKU || row.sku || row['Product Code'] || row.code || undefined,
                rate: parseFloat(String(row.Rate || row.rate || row.RATE || row.price || row.Price || '0').replace(/[^0-9.-]/g, '')) || 0,
                cost: row.Cost || row.cost || row.COST ? parseFloat(String(row.Cost || row.cost || row.COST || '0').replace(/[^0-9.-]/g, '')) || undefined : undefined,
                stock_quantity: parseInt(String(row['Stock Quantity'] || row.stock_quantity || row.stock || row.Stock || row.STOCK || '0').replace(/[^0-9]/g, '')) || 0,
                low_stock_threshold: parseInt(String(row['Low Stock Threshold'] || row.low_stock_threshold || row.threshold || row.Threshold || (businessSettings?.low_stock_alert_quantity || 10)).replace(/[^0-9]/g, '')) || (businessSettings?.low_stock_alert_quantity || 10),
                size: row.Size || row.size || row.SIZE ? String(row.Size || row.size || row.SIZE).trim() : undefined,
                color: row.Color || row.color || row.COLOR ? String(row.Color || row.color || row.COLOR).trim() : undefined,
                image_url: row['Image URL'] || row.image_url || row.image || row.Image || row.IMAGE_URL ? String(row['Image URL'] || row.image_url || row.image || row.Image || row.IMAGE_URL).trim() : undefined,
              };

              // Clean up empty string values
              if (productData.sku === '') productData.sku = undefined;
              if (productData.size === '') productData.size = undefined;
              if (productData.color === '') productData.color = undefined;
              if (productData.image_url === '') productData.image_url = undefined;

              console.log(`Processing row ${rowIndex + 1}:`, productData);

              // Validate required fields
              if (!productData.name || productData.name === '') {
                console.log(`Row ${rowIndex + 1} failed: Missing product name`);
                errorCount++;
                return;
              }

              if (productData.rate <= 0) {
                console.log(`Row ${rowIndex + 1} failed: Invalid rate (${productData.rate})`);
                errorCount++;
                return;
              }

              // Check for existing products (by name or SKU)
              const existingProduct = products.find(p => 
                p.name.toLowerCase().trim() === productData.name.toLowerCase().trim() ||
                (productData.sku && p.sku && p.sku.toLowerCase().trim() === String(productData.sku).toLowerCase().trim())
              );

              if (existingProduct) {
                // Check if any data has changed
                const hasChanges = 
                  existingProduct.name !== productData.name ||
                  existingProduct.sku !== productData.sku ||
                  existingProduct.rate !== productData.rate ||
                  existingProduct.cost !== productData.cost ||
                  existingProduct.stock_quantity !== productData.stock_quantity ||
                  existingProduct.low_stock_threshold !== productData.low_stock_threshold ||
                  existingProduct.size !== productData.size ||
                  existingProduct.color !== productData.color ||
                  existingProduct.image_url !== productData.image_url;

                if (!hasChanges) {
                  console.log(`Row ${rowIndex + 1} skipped: No changes detected (${productData.name})`);
                  skippedCount++;
                  return;
                }

                // Update the existing product
                return new Promise((resolve, reject) => {
                  updateProduct.mutate({ id: existingProduct.id, data: productData }, {
                    onSuccess: () => {
                      console.log(`Row ${rowIndex + 1} success: Updated product ${productData.name}`);
                      updatedCount++;
                      resolve(true);
                    },
                    onError: (error) => {
                      console.error(`Row ${rowIndex + 1} failed: Product update error:`, error);
                      errorCount++;
                      reject(error);
                    },
                  });
                });
              }

              // Create the product
              return new Promise((resolve, reject) => {
                createProduct.mutate(productData, {
                  onSuccess: () => {
                    console.log(`Row ${rowIndex + 1} success: Created product ${productData.name}`);
                    successCount++;
                    resolve(true);
                  },
                  onError: (error) => {
                    console.error(`Row ${rowIndex + 1} failed: Product creation error:`, error);
                    errorCount++;
                    reject(error);
                  },
                });
              });

            } catch (error) {
              console.error(`Row ${rowIndex + 1} failed: Row processing error:`, error);
              errorCount++;
            }
          });

          await Promise.allSettled(batchPromises);
          processedCount += items.length;
        };

        // Process in batches to avoid overwhelming the server
        const batchSize = 5;
        const batches = [];
        for (let i = 0; i < jsonData.length; i += batchSize) {
          batches.push(jsonData.slice(i, i + batchSize));
        }

        // Process all batches
        for (let i = 0; i < batches.length; i++) {
          await processBatch(batches[i], i);
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Show summary toast after processing
        setTimeout(() => {
          let message = '';
          if (successCount > 0) {
            message += `Successfully imported ${successCount} new products. `;
          }
          if (updatedCount > 0) {
            message += `Updated ${updatedCount} existing products. `;
          }
          if (skippedCount > 0) {
            message += `Skipped ${skippedCount} products (no changes). `;
          }
          if (errorCount > 0) {
            message += `${errorCount} products failed due to invalid data.`;
          }

          if (successCount > 0 || updatedCount > 0) {
            toast.success(message || "Import completed successfully");
          } else if (skippedCount > 0 && errorCount === 0) {
            toast.info(message || "All products were already up to date");
          } else {
            toast.error(message || "Import failed. Please check your data format");
          }
        }, 500);

      } catch (error) {
        console.error('File processing error:', error);
        toast.error("Failed to parse file. Please check the format and try again");
      }
    };

    if (fileExtension === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleExport = () => {
    // Prepare data for export
    const exportData = products.map(product => ({
      Name: product.name,
      SKU: product.sku || '',
      Rate: product.rate,
      Cost: product.cost || '',
      'Stock Quantity': product.stock_quantity,
      'Low Stock Threshold': product.low_stock_threshold,
      Size: product.size || '',
      Color: product.color || '',
      'Image URL': product.image_url || '',
      'Stock Value': product.stock_quantity * (product.cost || product.rate),
      Status: product.stock_quantity <= 0 ? 'Stock Out' : 
              product.stock_quantity <= product.low_stock_threshold ? 'Low Stock' : 'In Stock',
      'Created At': new Date(product.created_at).toLocaleDateString(),
      'Updated At': new Date(product.updated_at).toLocaleDateString()
    }));

    // Create workbook and worksheet using ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");
    
    // Add headers
    const headers = Object.keys(exportData[0] || {});
    worksheet.addRow(headers);
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data rows
    exportData.forEach(row => {
      worksheet.addRow(Object.values(row));
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    // Generate filename with current date
    const filename = `products_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Download file
    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your product inventory and stock levels
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Total Stock Value: <span className="font-semibold text-foreground">
              {isLoading ? <span className="inline-block w-16 h-4 bg-muted rounded animate-pulse" /> : formatAmount(totalStockValue)}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button 
            variant="outline" 
            onClick={handleOptimizeImages}
            disabled={!products.length || isOptimizing}
            className="w-full sm:w-auto"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            {isOptimizing ? "Optimizing..." : "Optimize Images"}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleImport}
            className="w-full sm:w-auto"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExport}
            disabled={!products.length}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search products..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-5">
        {isLoading ? (
          [...Array(10)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-square w-full bg-muted animate-pulse" />
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : paginatedProducts.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center py-12">
                <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">No products found</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          paginatedProducts.map((product) => <ProductCard key={product.id} product={product} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={duplicateProduct.mutate} isDuplicating={duplicateProduct.isPending} isDeleting={deleteProduct.isPending} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalProducts)} of {totalProducts} items
            </p>
          </div>
          <div className="flex-1 flex justify-center sm:justify-end">
            <Pagination className="mx-0">
              <PaginationContent className="flex-wrap gap-1">
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className={`${currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} hidden sm:flex`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="sm:hidden"
                  >
                    Prev
                  </Button>
                </PaginationItem>
                
                <div className="sm:hidden flex items-center px-3 py-2 text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                
                <div className="hidden sm:flex items-center gap-1">
                  {(() => {
                    const maxVisiblePages = 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                    
                    // Adjust start page if we're near the end
                    if (endPage - startPage + 1 < maxVisiblePages) {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1);
                    }
                    
                    const pages = [];
                    
                    // Add first page and ellipsis if needed
                    if (startPage > 1) {
                      pages.push(
                        <PaginationItem key={1}>
                          <PaginationLink
                            onClick={() => setCurrentPage(1)}
                            className={currentPage === 1 ? "bg-muted text-primary font-medium" : "cursor-pointer"}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                      );
                      
                      if (startPage > 2) {
                        pages.push(
                          <span key="ellipsis-start" className="flex h-9 w-9 items-center justify-center text-sm">
                            ...
                          </span>
                        );
                      }
                    }
                    
                    // Add visible page numbers
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <PaginationItem key={i}>
                          <PaginationLink
                            onClick={() => setCurrentPage(i)}
                            className={currentPage === i ? "bg-muted text-primary font-medium" : "cursor-pointer"}
                          >
                            {i}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    
                    // Add ellipsis and last page if needed
                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pages.push(
                          <span key="ellipsis-end" className="flex h-9 w-9 items-center justify-center text-sm">
                            ...
                          </span>
                        );
                      }
                      
                      pages.push(
                        <PaginationItem key={totalPages}>
                          <PaginationLink
                            onClick={() => setCurrentPage(totalPages)}
                            className={currentPage === totalPages ? "bg-muted text-primary font-medium" : "cursor-pointer"}
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    
                    return pages;
                  })()}
                </div>
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className={`${currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} hidden sm:flex`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="sm:hidden"
                  >
                    Next
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
      />

      <ProductDialog 
        open={isDialogOpen} 
        onOpenChange={handleCloseDialog}
        product={editingProduct}
      />

      {/* Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={(open) => {
        if (!isOptimizing) {
          setShowProgressDialog(open);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Image Optimization Progress
            </DialogTitle>
            <DialogDescription>
              Compressing product images to under 50KB
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Progress: {optimizationProgress.current} / {optimizationProgress.total}
                </span>
                <span className="font-medium">{optimizationProgress.percentage}%</span>
              </div>
              <Progress value={optimizationProgress.percentage} className="h-2" />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-lg font-bold">{optimizationProgress.stats.compressed}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Compressed</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-lg font-bold">{optimizationProgress.stats.skipped}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Skipped</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-lg font-bold">{optimizationProgress.stats.errors}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Errors</p>
                </CardContent>
              </Card>
            </div>

            {/* Space Saved */}
            {optimizationProgress.stats.originalSize > 0 && (
              <Card className="bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Space Saved:</span>
                    <span className="text-lg font-bold text-primary">
                      {((optimizationProgress.stats.originalSize - optimizationProgress.stats.compressedSize) / (1024 * 1024)).toFixed(2)} MB
                      {optimizationProgress.stats.originalSize > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({((1 - optimizationProgress.stats.compressedSize / optimizationProgress.stats.originalSize) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Log Messages */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Activity Log</span>
                <Badge variant="outline" className="text-xs">
                  {optimizationProgress.logs.length} entries
                </Badge>
              </div>
              
              <ScrollArea className="h-[250px] w-full rounded-md border p-3">
                <div className="space-y-1">
                  {optimizationProgress.logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No activity yet...
                    </p>
                  ) : (
                    optimizationProgress.logs.map((log, index) => (
                      <div
                        key={index}
                        className={`text-xs p-2 rounded flex items-start gap-2 ${
                          log.type === 'success' ? 'bg-green-50 text-green-700' :
                          log.type === 'error' ? 'bg-red-50 text-red-700' :
                          log.type === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="text-muted-foreground shrink-0 font-mono">
                          {log.timestamp}
                        </span>
                        <span className="flex-1 break-words">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              {isOptimizing ? (
                <Button disabled className="w-full">
                  <span className="animate-pulse">Processing...</span>
                </Button>
              ) : (
                <Button onClick={() => setShowProgressDialog(false)} className="w-full">
                  Close
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;