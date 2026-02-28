import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getOrders, getItems, getStock, getUsers } from '../services/api';
import { 
  Package, 
  Users, 
  TrendingUp, 
  AlertCircle,
  Settings,
  ClipboardList,
  BoxIcon,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalItems: 0,
    activeItems: 0,
    totalOrders: 0,
    totalUsers: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [itemsResult, ordersResult, stockResult, usersResult] = await Promise.all([
        getItems(),
        getOrders(),
        getStock(),
        getUsers(),
      ]);

      const items = itemsResult.items || [];
      const activeItems = items.filter((i: any) => i.active);
      const stockRecords = stockResult.stock || [];
      
      // Count low stock items
      const lowStock = stockRecords.filter((s: any) => {
        const item = items.find((i: any) => i.id === s.itemId);
        return item && s.available <= item.reorderThreshold;
      });

      setStats({
        totalItems: items.length,
        activeItems: activeItems.length,
        totalOrders: ordersResult.orders?.length || 0,
        totalUsers: usersResult.users?.length || 0,
        lowStockCount: lowStock.length,
      });
    } catch (error: any) {
      toast.error('Failed to load statistics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">System overview and management</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/catalog')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Items</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalItems}</div>
              <p className="text-xs text-gray-500 mt-1">{stats.activeItems} active</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/my-orders')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/settings?tab=users')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">System Users</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-gray-500 mt-1">Registered</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/reports')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Low Stock Items</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.lowStockCount}</div>
              <p className="text-xs text-gray-500 mt-1">Need attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Item Management
              </CardTitle>
              <CardDescription>Manage inventory catalog</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link to="/catalog">View Catalog</Link>
              </Button>
              <Button className="w-full" asChild>
                <Link to="/catalog?action=create">Add New Item</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BoxIcon className="h-5 w-5 mr-2" />
                Stock Operations
              </CardTitle>
              <CardDescription>Manage inventory levels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link to="/stock">Stock Management</Link>
              </Button>
              <Button className="w-full" asChild>
                <Link to="/stock?action=receive">Receive Stock</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Reports & Analytics
              </CardTitle>
              <CardDescription>View system reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link to="/reports">View Reports</Link>
              </Button>
              <Button className="w-full" asChild>
                <Link to="/reports?type=audit">Audit Log</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ClipboardList className="h-5 w-5 mr-2" />
                Order Management
              </CardTitle>
              <CardDescription>Process and fulfill orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link to="/fulfillment">All Orders</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                User Management
              </CardTitle>
              <CardDescription>Manage system users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link to="/settings?tab=users">View Users</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                System Settings
              </CardTitle>
              <CardDescription>Configure the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" asChild>
                <Link to="/settings">System Settings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {stats.lowStockCount > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-800">
                <AlertCircle className="h-5 w-5 mr-2" />
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700">
                {stats.lowStockCount} items are below reorder threshold. 
                <Link to="/reports" className="ml-2 underline font-medium">
                  Review low stock report →
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}