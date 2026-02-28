import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getLowStockReport, getStockMovements, getAuditLog, getOrders, getItems, getStock } from '../services/api';
import { Download, Package, TrendingDown, History, ClipboardList, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Reports() {
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const [lowStockResult, movementsResult, auditResult, ordersResult, itemsResult, stockResult] = await Promise.all([
        getLowStockReport(),
        getStockMovements(),
        getAuditLog(),
        getOrders(),
        getItems(),
        getStock(),
      ]);

      setLowStockItems(lowStockResult.lowStockItems || []);
      setMovements(movementsResult.movements || []);
      setAuditLog(auditResult.auditLogs || []);
      setOrders(ordersResult.orders || []);

      // Create stock summary
      const items = itemsResult.items || [];
      const stock = stockResult.stock || [];
      const summary = items.map((item: any) => {
        const itemStock = stock.filter((s: any) => s.itemId === item.id);
        const totalOnHand = itemStock.reduce((sum: number, s: any) => sum + s.onHand, 0);
        const totalAvailable = itemStock.reduce((sum: number, s: any) => sum + s.available, 0);
        return {
          ...item,
          totalOnHand,
          totalAvailable,
        };
      });
      setStockSummary(summary);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">View system reports and audit trails</p>
        </div>

        <Tabs defaultValue="lowstock" className="w-full">
          <TabsList>
            <TabsTrigger value="lowstock">Low Stock</TabsTrigger>
            <TabsTrigger value="inventory">Inventory Summary</TabsTrigger>
            <TabsTrigger value="movements">Stock Movements</TabsTrigger>
            <TabsTrigger value="orders">Order Report</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="lowstock">
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
                    onClick={() => exportToCSV(lowStockItems, 'low_stock_report')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading report...</p>
                ) : lowStockItems.length === 0 ? (
                  <p className="text-gray-500 py-8 text-center">No low stock items</p>
                ) : (
                  <div className="space-y-3">
                    {lowStockItems.map((item) => (
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
                    onClick={() => exportToCSV(stockSummary, 'inventory_summary')}
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
                        {stockSummary.map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="py-3 px-4">{item.name}</td>
                            <td className="py-3 px-4">{item.sku || 'N/A'}</td>
                            <td className="py-3 px-4">{item.category}</td>
                            <td className="py-3 px-4 text-right">{item.totalOnHand}</td>
                            <td className="py-3 px-4 text-right">{item.totalAvailable}</td>
                          </tr>
                        ))}
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
                    onClick={() => exportToCSV(movements, 'stock_movements')}
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
                  <div className="space-y-2">
                    {movements.slice(0, 50).map((movement) => (
                      <div key={movement.id} className="border-b py-3">
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
                    onClick={() => exportToCSV(orders, 'orders_report')}
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
                          <th className="text-left py-3 px-4">Order ID</th>
                          <th className="text-left py-3 px-4">Status</th>
                          <th className="text-left py-3 px-4">Items</th>
                          <th className="text-left py-3 px-4">Department</th>
                          <th className="text-left py-3 px-4">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
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
                      Audit Log
                    </CardTitle>
                    <CardDescription>Complete audit trail of all system changes</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportToCSV(auditLog, 'audit_log')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading audit log...</p>
                ) : auditLog.length === 0 ? (
                  <p className="text-gray-500 py-8 text-center">No audit entries</p>
                ) : (
                  <div className="space-y-2">
                    {auditLog.slice(0, 100).map((entry) => (
                      <div key={entry.id} className="border-b py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {entry.action} - {entry.entityType} ({entry.entityId.slice(0, 8)})
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              By user: {entry.userId.slice(0, 8)}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
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
