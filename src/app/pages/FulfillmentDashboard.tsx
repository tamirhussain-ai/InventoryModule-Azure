import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getOrders, getLowStockReport, updateOrderStatus } from '../services/api';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';

export default function FulfillmentDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersResult, lowStockResult] = await Promise.all([
        getOrders(),
        getLowStockReport(),
      ]);
      setOrders(ordersResult.orders || []);
      setLowStockItems(lowStockResult.lowStockItems || []);
    } catch (error: any) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPicking = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'picking');
      toast.success('Order marked as picking');
      loadData();
    } catch (error: any) {
      toast.error('Failed to update order status');
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'submitted' || o.status === 'approved');
  const pickingOrders = orders.filter(o => o.status === 'picking');
  const fulfilledToday = orders.filter(o => {
    if (o.status !== 'fulfilled' || !o.fulfilledAt) return false;
    const today = new Date().toDateString();
    return new Date(o.fulfilledAt).toDateString() === today;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fulfillment Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage orders and inventory operations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => navigate('/my-orders?status=submitted')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Orders</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingOrders.length}</div>
              <p className="text-xs text-gray-500 mt-1">Need attention</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => navigate('/my-orders?status=picking')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
              <ClipboardList className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pickingOrders.length}</div>
              <p className="text-xs text-gray-500 mt-1">Being picked</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => navigate('/my-orders?status=fulfilled')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Fulfilled Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fulfilledToday.length}</div>
              <p className="text-xs text-gray-500 mt-1">Completed orders</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => navigate('/reports')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockItems.length}</div>
              <p className="text-xs text-gray-500 mt-1">Need reorder</p>
            </CardContent>
          </Card>
        </div>

        {/* Work Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Work Queue</CardTitle>
            <CardDescription>Orders waiting for fulfillment</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading orders...</p>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No pending orders</p>
                <p className="text-sm text-gray-400 mt-1">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <p className="font-medium text-gray-900">
                            Order #{order.id.slice(0, 8)}
                          </p>
                          <Badge variant={order.status === 'approved' ? 'default' : 'secondary'}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                          {order.neededBy && (
                            <span className="text-sm text-gray-500">
                              Needed by: {new Date(order.neededBy).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {order.items?.length || 0} items • {order.deliveryPreference} to {order.deliveryLocation}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/orders/${order.id}`}>View</Link>
                        </Button>
                        <Button size="sm" onClick={() => handleStartPicking(order.id)}>
                          Start Picking
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-800">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Low Stock Alert
              </CardTitle>
              <CardDescription className="text-orange-700">
                {lowStockItems.length} items need reordering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-md">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        Available: {item.stock?.available || 0} • Threshold: {item.reorderThreshold}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/items/${item.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
              {lowStockItems.length > 5 && (
                <Button variant="link" className="mt-3" asChild>
                  <Link to="/reports">
                    View all {lowStockItems.length} items →
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}