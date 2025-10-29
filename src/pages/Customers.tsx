import { Plus, Users, Phone, Search, Edit, Trash2, MessageCircle, Download, Eye, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useCustomers } from "@/hooks/useCustomers";
import { useState, useMemo, useRef, useEffect } from "react";
import { CustomerDialog } from "@/components/CustomerDialog";
import { CustomerHistoryDialog } from "@/components/CustomerHistoryDialog";
import { useCurrency } from "@/hooks/useCurrency";
import { SimpleDateRangeFilter } from "@/components/SimpleDateRangeFilter";
import { isWithinInterval, parseISO } from "date-fns";
import * as ExcelJS from "exceljs";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const Customers = () => {
  const { customers, isLoading, deleteCustomer, updateCustomer, createCustomer, updateCustomerStats, isUpdatingStats, updateCustomerAdditionalInfo, isUpdatingAdditionalInfo } = useCustomers();
  const { formatAmount } = useCurrency();
  const { hasPermission, isAdmin } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasRefreshedStats = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Automatically refresh customer stats when the page loads
  useEffect(() => {
    // Only refresh if customers are loaded, we have customers, stats are not being updated, and we haven't refreshed yet
    if (!isLoading && customers.length > 0 && !isUpdatingStats && !hasRefreshedStats.current) {
      hasRefreshedStats.current = true;
      updateCustomerStats(false); // Pass false to hide notification for auto refresh
    }
  }, [isLoading, customers.length, isUpdatingStats]); // Dependencies to ensure we wait for data to load

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      // Search filter (includes name, phone, whatsapp, additional info, and total spent)
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm)) ||
        (customer.whatsapp && customer.whatsapp.includes(searchTerm)) ||
        (customer.additional_info && customer.additional_info.toLowerCase().includes(searchTerm.toLowerCase())) ||
        customer.total_spent.toString().includes(searchTerm);

      // Date filter
      const matchesDate = !startDate || !endDate || isWithinInterval(parseISO(customer.created_at), {
        start: startDate,
        end: endDate,
      });

      return matchesSearch && matchesDate;
    });
  }, [customers, searchTerm, startDate, endDate]);

  // Pagination calculations
  const totalCustomers = filteredCustomers.length;
  const totalPages = Math.ceil(totalCustomers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate]);

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      deleteCustomer.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleDateRangeChange = (start?: Date, end?: Date) => {
    setStartDate(start);
    setEndDate(end);
  };


  const handleViewHistory = (customer) => {
    setSelectedCustomer(customer);
    setIsHistoryDialogOpen(true);
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
          const data = e.target?.result as ArrayBuffer;
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

              // Map the data to customer structure with flexible field matching
              const customerData = {
                name: String(row.Name || row.name || row.CUSTOMER_NAME || row['Customer Name'] || '').trim(),
                phone: row.Phone || row.phone || row.PHONE || row['Phone Number'] || undefined,
                whatsapp: row.WhatsApp || row.whatsapp || row.WHATSAPP || row['WhatsApp Number'] || undefined,
                address: row.Address || row.address || row.ADDRESS || undefined,
                tags: row.Tags || row.tags || row.TAGS ? String(row.Tags || row.tags || row.TAGS).split(',').map(tag => tag.trim()) : [],
                status: row.Status || row.status || row.STATUS || 'inactive',
              };

              // Clean up empty string values
              if (customerData.phone === '') customerData.phone = undefined;
              if (customerData.whatsapp === '') customerData.whatsapp = undefined;
              if (customerData.address === '') customerData.address = undefined;
              
              // Ensure status is valid
              if (!['active', 'inactive', 'neutral'].includes(customerData.status.toLowerCase())) {
                customerData.status = 'inactive';
              }

              console.log(`Processing row ${rowIndex + 1}:`, customerData);

              // Validate required fields
              if (!customerData.name || customerData.name === '') {
                console.log(`Row ${rowIndex + 1} failed: Missing customer name`);
                errorCount++;
                return;
              }

              // Check for existing customers (by name or phone)
              const existingCustomer = customers.find(c => 
                c.name.toLowerCase().trim() === customerData.name.toLowerCase().trim() ||
                (customerData.phone && c.phone && c.phone.replace(/[^\d]/g, '') === customerData.phone.replace(/[^\d]/g, ''))
              );

              if (existingCustomer) {
                // Check if any data has changed
                const hasChanges = 
                  existingCustomer.name !== customerData.name ||
                  existingCustomer.phone !== customerData.phone ||
                  existingCustomer.whatsapp !== customerData.whatsapp ||
                  existingCustomer.address !== customerData.address ||
                  existingCustomer.status !== customerData.status ||
                  JSON.stringify(existingCustomer.tags?.sort()) !== JSON.stringify(customerData.tags?.sort());

                if (!hasChanges) {
                  console.log(`Row ${rowIndex + 1} skipped: No changes detected (${customerData.name})`);
                  skippedCount++;
                  return;
                }

                // Update the existing customer
                return new Promise((resolve, reject) => {
                  updateCustomer.mutate({ id: existingCustomer.id, data: customerData }, {
                    onSuccess: () => {
                      console.log(`Row ${rowIndex + 1} success: Updated customer ${customerData.name}`);
                      updatedCount++;
                      resolve(true);
                    },
                    onError: (error) => {
                      console.error(`Row ${rowIndex + 1} failed: Customer update error:`, error);
                      errorCount++;
                      reject(error);
                    },
                  });
                });
              }

              // Create the customer
              return new Promise((resolve, reject) => {
                createCustomer.mutate(customerData, {
                  onSuccess: () => {
                    console.log(`Row ${rowIndex + 1} success: Created customer ${customerData.name}`);
                    successCount++;
                    resolve(true);
                  },
                  onError: (error) => {
                    console.error(`Row ${rowIndex + 1} failed: Customer creation error:`, error);
                    errorCount++;
                    reject(error);
                  },
                });
              });

            } catch (error) {
              console.error(`Row ${rowIndex + 1} failed: Processing error:`, error);
              errorCount++;
            }
          });

          await Promise.allSettled(batchPromises);
        };

        // Process in batches of 10
        const batchSize = 10;
        for (let i = 0; i < jsonData.length; i += batchSize) {
          const batch = jsonData.slice(i, i + batchSize);
          await processBatch(batch, Math.floor(i / batchSize));
          
          // Small delay between batches to prevent overwhelming the system
          if (i + batchSize < jsonData.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Show final result
        const totalProcessed = successCount + updatedCount + skippedCount + errorCount;
        let message = `Import completed: ${successCount} created`;
        if (updatedCount > 0) message += `, ${updatedCount} updated`;
        if (skippedCount > 0) message += `, ${skippedCount} skipped`;
        if (errorCount > 0) message += `, ${errorCount} failed`;
        
        if (errorCount > 0) {
          toast.error(message);
        } else {
          toast.success(message);
        }

      } catch (error) {
        console.error("Import error:", error);
        toast.error("Failed to import customer data: " + (error as Error).message);
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

  const handleExport = async () => {
    try {
      const exportData = filteredCustomers.map(customer => ({
        Name: customer.name,
        'Additional Info': customer.additional_info || '',
        Phone: customer.phone || '',
        WhatsApp: customer.whatsapp || '',
        Address: customer.address || '',
        'Order Count': customer.order_count,
        'Total Spent': customer.total_spent,
        Tags: customer.tags?.join(', ') || '',
        Status: customer.status,
        'Created At': new Date(customer.created_at).toLocaleDateString(),
      }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Customers');

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

      // Add data
      exportData.forEach(row => {
        worksheet.addRow(Object.values(row));
      });

      // Auto-size columns
      worksheet.columns.forEach(column => {
        column.width = 15;
      });

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Customer data exported successfully");
    } catch (error) {
      toast.error("Failed to export customer data");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer database and relationships
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {hasPermission('customers.import_export') && (
            <Button variant="outline" onClick={handleImport} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}
          {hasPermission('customers.import_export') && (
            <Button variant="outline" onClick={handleExport} disabled={filteredCustomers.length === 0} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          <Button 
            onClick={() => updateCustomerStats(true)} 
            disabled={isUpdatingStats}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isUpdatingStats ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            onClick={() => updateCustomerAdditionalInfo(true)} 
            disabled={isUpdatingAdditionalInfo}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isUpdatingAdditionalInfo ? 'Updating...' : 'Update Baby Ages'}
          </Button>
          {hasPermission('customers.add') && (
            <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Filtered Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredCustomers.length}</div>
                <p className="text-xs text-muted-foreground">
                  Selected period customers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customers.length}</div>
                <p className="text-xs text-muted-foreground">
                  All time customers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredCustomers.filter(c => c.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active status customers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(filteredCustomers.length > 0 ? 
                    (filteredCustomers.filter(c => c.order_count > 0).reduce((sum, c) => sum + c.total_spent, 0) / 
                    filteredCustomers.filter(c => c.order_count > 0).length || 1) : 
                    0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average spent per customer
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredCustomers.filter(c => c.total_spent > 5000).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  High-value customers
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>



      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <SimpleDateRangeFilter onDateRangeChange={handleDateRangeChange} defaultPreset="all" />
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search customers by name, phone, WhatsApp, additional info, or total spent..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Additional Info</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Delivered</TableHead>
            <TableHead>Cancelled</TableHead>
            <TableHead>Total Spent</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((customer) => {
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        {customer.additional_info ? (
                          <Badge variant="secondary" className="capitalize">
                            {customer.additional_info}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {customer.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.whatsapp ? (
                          <a
                            href={`https://wa.me/${customer.whatsapp.replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4 text-white" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    <TableCell>{customer.order_count}</TableCell>
                    <TableCell>{customer.delivered_count ?? 0}</TableCell>
                    <TableCell>{customer.cancelled_count ?? 0}</TableCell>
                    <TableCell>{formatAmount(customer.total_spent)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {hasPermission('customers.view_history') && (
                            <Button variant="ghost" size="sm" onClick={() => handleViewHistory(customer)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('customers.edit') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(customer.id)}
                              disabled={deleteCustomer.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </TooltipProvider>

          {/* Pagination */}
          {!isLoading && totalCustomers > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalCustomers)} of {totalCustomers} customers
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNumber = i + 1;
                    // Show first page, last page, current page, and pages around current
                    const showPage = pageNumber === 1 || 
                                   pageNumber === totalPages || 
                                   (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1);
                    
                    if (!showPage) {
                      // Show ellipsis
                      if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                        return (
                          <PaginationItem key={i}>
                            <span className="px-4">...</span>
                          </PaginationItem>
                        );
                      }
                      return null;
                    }
                    
                    return (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className="cursor-pointer"
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDialog 
        open={isDialogOpen} 
        onOpenChange={handleCloseDialog}
        customer={editingCustomer}
      />

      <CustomerHistoryDialog
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        customer={selectedCustomer}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default Customers;