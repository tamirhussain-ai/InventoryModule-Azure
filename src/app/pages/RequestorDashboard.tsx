import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getOrders } from '../services/api';
import { ShoppingCart, Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RequestorDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const result = await getOrders();
      setOrders(result.orders || []);
    } catch (error: any) {
      toast.error('Failed to load orders');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      submitted: { variant: 'secondary', icon: Clock },
      approved: { variant: 'default', icon: CheckCircle },
      picking: { variant: 'default', icon: Package },
      fulfilled: { variant: 'default', icon: CheckCircle },
      denied: { variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || { variant: 'secondary', icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant as any}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const recentOrders = orders.slice(0, 5);
  const pendingOrders = orders.filter(o => ['submitted', 'approved', 'picking'].includes(o.status));
  const fulfilledOrders = orders.filter(o => o.status === 'fulfilled');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
          <p className="text-gray-600 mt-1">Browse inventory and submit orders for your department</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/my-orders')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Orders</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingOrders.length}</div>
              <p className="text-xs text-gray-500 mt-1">Awaiting fulfillment</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/my-orders?status=fulfilled')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Fulfilled Orders</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fulfilledOrders.length}</div>
              <p className="text-xs text-gray-500 mt-1">Successfully completed</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/my-orders')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button className="w-full" size="lg" asChild>
              <Link to="/catalog">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Browse Catalog
              </Link>
            </Button>
            <Button className="w-full" variant="outline" size="lg" asChild>
              <Link to="/cart">
                <Package className="h-5 w-5 mr-2" />
                View Cart
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Your latest order requests</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading orders...</p>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No orders yet</p>
                <Button className="mt-4" asChild>
                  <Link to="/catalog">Start Shopping</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link key={order.id} to={`/orders/${order.id}`}>
                    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-gray-900">
                              Order #{order.id.slice(0, 8)}
                            </p>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {order.items?.length || 0} items • {new Date(order.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">View Details</Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}