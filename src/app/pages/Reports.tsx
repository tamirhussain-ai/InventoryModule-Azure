import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { getLowStockReport, getStockMovements, getAuditLog, getOrders, getItems, getStock } from '../services/api';
import { Download, Package, TrendingDown, History, ClipboardList, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Reports() {
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('type') || 'low-stock';
  
  // Audit log date range state
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [filteredAuditLog, setFilteredAuditLog] = useState<any[]>([]);
  const [auditDateError, setAuditDateError] = useState('');

  // Stock movements date range state
  const [movementsStartDate, setMovementsStartDate] = useState('');
  const [movementsEndDate, setMovementsEndDate] = useState('');
  const [filteredMovements, setFilteredMovements] = useState<any[]>([]);
  const [movementsDateError, setMovementsDateError] = useState('');

  // Orders date range state
  const [ordersStartDate, setOrdersStartDate] = useState('');
  const [ordersEndDate, setOrdersEndDate] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [ordersDateError, setOrdersDateError] = useState('');
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [lowStockResult, movementsResult, auditResult, ordersResult, itemsResult, stockResult] = await Promise.all([
        getLowStockReport(),
        getStockMovements(),
        getAuditLog(),
        getOrders(),
        getItems(),
        getStock(),
      ]);

      setLowStock(lowStockResult.lowStockItems || []);
      setMovements(movementsResult.movements || []);
      setAuditLog(auditResult.auditLogs || []);
      setOrders(ordersResult.orders || []);
      setItems(itemsResult.items || []);
      setStock(stockResult.stock || []);
    } catch (error: any) {
      toast.error('Failed to load reports');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const filterAuditLog = () => {
    if (!auditStartDate || !auditEndDate) {
      setAuditDateError('Please select both start and end dates');
      return;
    }

    const startDate = new Date(auditStartDate);
    startDate.setHours(0, 0, 0, 0); // Start of day
    
    const endDate = new Date(auditEndDate);
    endDate.setHours(23, 59, 59, 999); // End of day

    if (startDate > endDate) {
      setAuditDateError('Start date must be before or equal to end date');
      return;
    }

    setAuditDateError('');

    const filtered = auditLog.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= startDate && entryDate <= endDate;
    });

    setFilteredAuditLog(filtered);
    toast.success(`Found ${filtered.length} activit${filtered.length === 1 ? 'y' : 'ies'}`);
  };

  const filterMovements = () => {
    if (!movementsStartDate || !movementsEndDate) {
      setMovementsDateError('Please select both start and end dates');
      return;
    }

    const startDate = new Date(movementsStartDate);
    startDate.setHours(0, 0, 0, 0); // Start of day
    
    const endDate = new Date(movementsEndDate);
    endDate.setHours(23, 59, 59, 999); // End of day

    if (startDate > endDate) {
      setMovementsDateError('Start date must be before or equal to end date');
      return;
    }

    setMovementsDateError('');

    const filtered = movements.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= startDate && entryDate <= endDate;
    });

    setFilteredMovements(filtered);
    toast.success(`Found ${filtered.length} movement${filtered.length === 1 ? '' : 's'}`);
  };

  const filterOrders = () => {
    if (!ordersStartDate || !ordersEndDate) {
      setOrdersDateError('Please select both start and end dates');
      return;
    }

    const startDate = new Date(ordersStartDate);
    startDate.setHours(0, 0, 0, 0); // Start of day
    
    const endDate = new Date(ordersEndDate);
    endDate.setHours(23, 59, 59, 999); // End of day

    if (startDate > endDate) {
      setOrdersDateError('Start date must be before or equal to end date');
      return;
    }

    setOrdersDateError('');

    const filtered = orders.filter((entry) => {
      const entryDate = new Date(entry.submittedAt);
      return entryDate >= startDate && entryDate <= endDate;
    });

    setFilteredOrders(filtered);
    toast.success(`Found ${filtered.length} order${filtered.length === 1 ? '' : 's'}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">View system reports and audit trails</p>
        </div>

        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList>
            <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
            <TabsTrigger value="inventory">Inventory Summary</TabsTrigger>
            <TabsTrigger value="movements">Stock Movements</TabsTrigger>
            <TabsTrigger value="orders">Order Report</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="low-stock">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                      Low Stock Report
                    </CardTitle>
                    <CardDescription>Items at or below reorder threshold</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportToCSV(lowStock, 'low_stock_report')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading report...</p>
                ) : lowStock.length === 0 ? (
                  <p className="text-gray-500 py-8 text-center">No low stock items</p>
                ) : (
                  <div className="space-y-3">
                    {lowStock.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Available: {item.stock?.available || 0} • Threshold: {item.reorderThreshold}
                            </p>
                            {item.vendor && (
                              <p className="text-sm text-gray-500">Vendor: {item.vendor}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Lead Time</p>
                            <p className="font-medium">{item.leadTime} days</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2" />
                      Inventory Summary
                    </CardTitle>
                    <CardDescription>Current stock levels for all items</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportToCSV(stock.map(s => ({
                      ...items.find(i => i.id === s.itemId),
                      totalOnHand: s.onHand,
                      totalAvailable: s.available,
                    })), 'inventory_summary')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading report...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Item Name</th>
                          <th className="text-left py-3 px-4">SKU</th>
                          <th className="text-left py-3 px-4">Category</th>
                          <th className="text-right py-3 px-4">On Hand</th>
                          <th className="text-right py-3 px-4">Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.filter(s => items.find(i => i.id === s.itemId)).map((s) => {
                          const item = items.find(i => i.id === s.itemId);
                          return (
                            <tr key={s.itemId || s.id} className="border-b">
                              <td className="py-3 px-4">{item?.name}</td>
                              <td className="py-3 px-4">{item?.sku || 'N/A'}</td>
                              <td className="py-3 px-4">{item?.category}</td>
                              <td className="py-3 px-4 text-right">{s.onHand}</td>
                              <td className="py-3 px-4 text-right">{s.available}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <TrendingDown className="h-5 w-5 mr-2" />
                      Stock Movements
                    </CardTitle>
                    <CardDescription>All inventory transactions and movements</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportToCSV(filteredMovements, 'stock_movements')}
                    disabled={filteredMovements.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading report...</p>
                ) : movements.length === 0 ? (
                  <p className="text-gray-500 py-8 text-center">No stock movements recorded</p>
                ) : (
                  <div className="space-y-4">
                    {/* Date Range Filter */}
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-semibold text-gray-700">
                              Select Date Range <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-xs text-gray-600 mt-1">
                              Choose a date range to view stock movements
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Label htmlFor="startDate" className="text-xs text-gray-600">
                                Start Date
                              </Label>
                              <Input
                                id="startDate"
                                type="date"
                                value={movementsStartDate}
                                onChange={(e) => setMovementsStartDate(e.target.value)}
                                className="mt-1"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor="endDate" className="text-xs text-gray-600">
                                End Date
                              </Label>
                              <Input
                                id="endDate"
                                type="date"
                                value={movementsEndDate}
                                onChange={(e) => setMovementsEndDate(e.target.value)}
                                className="mt-1"
                                required
                              />
                            </div>
                            <div className="pt-5">
                              <Button
                                onClick={filterMovements}
                              >
                                Generate Report
                              </Button>
                            </div>
                          </div>
                          {movementsDateError && (
                            <Alert className="bg-red-50 border-red-200">
                              <AlertDescription className="text-red-700 text-sm">
                                {movementsDateError}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Results */}
                    {filteredMovements.length === 0 && !movementsDateError && movementsStartDate && movementsEndDate ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No movements found in the selected date range</p>
                          <p className="text-sm text-gray-400 mt-1">Try selecting a different date range</p>
                        </CardContent>
                      </Card>
                    ) : filteredMovements.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700">
                            Found {filteredMovements.length} movement{filteredMovements.length === 1 ? '' : 's'} from{' '}
                            {new Date(movementsStartDate).toLocaleDateString()} to{' '}
                            {new Date(movementsEndDate).toLocaleDateString()}
                          </p>
                        </div>
                        {filteredMovements.slice(0, 200).map((movement, index) => (
                          <div key={movement.id || `movement-${index}`} className="border-b py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {movement.type.charAt(0).toUpperCase() + movement.type.slice(1)} - Item {movement.itemId.slice(0, 8)}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {movement.reason} • Location: {movement.locationId}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(movement.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredMovements.length > 200 && (
                          <p className="text-center text-sm text-gray-500 py-4">
                            Showing 200 most recent movements. Export CSV for full history.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <ClipboardList className="h-5 w-5 mr-2" />
                      Order Report
                    </CardTitle>
                    <CardDescription>All orders and their statuses</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportToCSV(filteredOrders, 'orders_report')}
                    disabled={filteredOrders.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading report...</p>
                ) : (
                  <div className="space-y-4">
                    {/* Date Range Filter */}
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-semibold text-gray-700">
                              Select Date Range <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-xs text-gray-600 mt-1">
                              Choose a date range to view orders
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Label htmlFor="startDate" className="text-xs text-gray-600">
                                Start Date
                              </Label>
                              <Input
                                id="startDate"
                                type="date"
                                value={ordersStartDate}
                                onChange={(e) => setOrdersStartDate(e.target.value)}
                                className="mt-1"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor="endDate" className="text-xs text-gray-600">
                                End Date
                              </Label>
                              <Input
                                id="endDate"
                                type="date"
                                value={ordersEndDate}
                                onChange={(e) => setOrdersEndDate(e.target.value)}
                                className="mt-1"
                                required
                              />
                            </div>
                            <div className="pt-5">
                              <Button
                                onClick={filterOrders}
                              >
                                Generate Report
                              </Button>
                            </div>
                          </div>
                          {ordersDateError && (
                            <Alert className="bg-red-50 border-red-200">
                              <AlertDescription className="text-red-700 text-sm">
                                {ordersDateError}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Results */}
                    {filteredOrders.length === 0 && !ordersDateError && ordersStartDate && ordersEndDate ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No orders found in the selected date range</p>
                          <p className="text-sm text-gray-400 mt-1">Try selecting a different date range</p>
                        </CardContent>
                      </Card>
                    ) : filteredOrders.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700">
                            Found {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} from{' '}
                            {new Date(ordersStartDate).toLocaleDateString()} to{' '}
                            {new Date(ordersEndDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-3 px-4">Order ID</th>
                                <th className="text-left py-3 px-4">Status</th>
                                <th className="text-left py-3 px-4">Items</th>
                                <th className="text-left py-3 px-4">Department</th>
                                <th className="text-left py-3 px-4">Submitted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredOrders.slice(0, 200).map((order) => (
                                <tr key={order.id} className="border-b">
                                  <td className="py-3 px-4">{order.id.slice(0, 8)}</td>
                                  <td className="py-3 px-4">{order.status}</td>
                                  <td className="py-3 px-4">{order.items?.length || 0}</td>
                                  <td className="py-3 px-4">{order.department || 'N/A'}</td>
                                  <td className="py-3 px-4">{new Date(order.submittedAt).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {filteredOrders.length > 200 && (
                          <p className="text-center text-sm text-gray-500 py-4">
                            Showing 200 most recent orders. Export CSV for full history.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <History className="h-5 w-5 mr-2" />
                      Activity Log
                    </CardTitle>
                    <CardDescription>Complete audit trail of all system activities</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportToCSV(filteredAuditLog, 'activity_log')}
                    disabled={filteredAuditLog.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading activity log...</p>
                ) : auditLog.length === 0 ? (
                  <p className="text-gray-500 py-8 text-center">No activity entries</p>
                ) : (
                  <div className="space-y-4">
                    {/* Date Range Filter */}
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-semibold text-gray-700">
                              Select Date Range <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-xs text-gray-600 mt-1">
                              Choose a date range to view audit log entries
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Label htmlFor="startDate" className="text-xs text-gray-600">
                                Start Date
                              </Label>
                              <Input
                                id="startDate"
                                type="date"
                                value={auditStartDate}
                                onChange={(e) => setAuditStartDate(e.target.value)}
                                className="mt-1"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor="endDate" className="text-xs text-gray-600">
                                End Date
                              </Label>
                              <Input
                                id="endDate"
                                type="date"
                                value={auditEndDate}
                                onChange={(e) => setAuditEndDate(e.target.value)}
                                className="mt-1"
                                required
                              />
                            </div>
                            <div className="pt-5">
                              <Button
                                onClick={filterAuditLog}
                              >
                                Generate Report
                              </Button>
                            </div>
                          </div>
                          {auditDateError && (
                            <Alert className="bg-red-50 border-red-200">
                              <AlertDescription className="text-red-700 text-sm">
                                {auditDateError}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Results */}
                    {filteredAuditLog.length === 0 && !auditDateError && auditStartDate && auditEndDate ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No activities found in the selected date range</p>
                          <p className="text-sm text-gray-400 mt-1">Try selecting a different date range</p>
                        </CardContent>
                      </Card>
                    ) : filteredAuditLog.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700">
                            Found {filteredAuditLog.length} activit{filteredAuditLog.length === 1 ? 'y' : 'ies'} from{' '}
                            {new Date(auditStartDate).toLocaleDateString()} to{' '}
                            {new Date(auditEndDate).toLocaleDateString()}
                          </p>
                        </div>
                        {filteredAuditLog.slice(0, 200).map((entry, index) => {
                          // Format action description
                          const actionDescriptions: any = {
                            'create': 'Created',
                            'update': 'Updated',
                            'delete': 'Deleted',
                            'deactivate': 'Deactivated',
                            'adjust': 'Adjusted',
                            'fulfill': 'Fulfilled',
                            'status_change': 'Changed Status',
                            'update_fulfilled': 'Modified (Post-Fulfillment)',
                          };
                          
                          const actionText = actionDescriptions[entry.action] || entry.action;
                          const entityTypeText = entry.entityType.charAt(0).toUpperCase() + entry.entityType.slice(1);
                          
                          return (
                            <div key={entry.id || `audit-${index}`} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-semibold text-gray-900">{entry.userEmail}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-sm text-gray-600">{actionText}</span>
                                    <span className="text-sm font-medium text-blue-600">{entityTypeText}</span>
                                  </div>
                                  
                                  <p className="text-sm text-gray-700 mb-2">
                                    <strong>{entry.entityName}</strong>
                                  </p>
                                  
                                  {/* Show changes for updates */}
                                  {entry.action === 'update' && entry.before && entry.after && (
                                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                                      <p className="font-medium mb-1">Changes:</p>
                                      {Object.keys(entry.after).filter(key => 
                                        JSON.stringify(entry.before[key]) !== JSON.stringify(entry.after[key]) &&
                                        !['lastEditedAt', 'lastEditedBy', 'updatedAt'].includes(key)
                                      ).map(key => (
                                        <div key={key} className="ml-2">
                                          <span className="font-medium">{key}:</span>{' '}
                                          <span className="text-red-600">{String(entry.before[key] || 'null')}</span>
                                          {' → '}
                                          <span className="text-green-600">{String(entry.after[key] || 'null')}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Show status changes for orders */}
                                  {entry.action === 'status_change' && entry.before?.status && entry.after?.status && (
                                    <div className="mt-2 text-xs">
                                      <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                        {entry.before.status}
                                      </span>
                                      <span className="mx-2">→</span>
                                      <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                        {entry.after.status}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="text-right ml-4">
                                  <p className="text-xs text-gray-500">
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {filteredAuditLog.length > 200 && (
                          <p className="text-center text-sm text-gray-500 py-4">
                            Showing 200 most recent activities. Export CSV for full history.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}