import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { getOrders, getLowStockReport, updateOrderStatus, API_URL, getAuthHeaders } from '../services/api';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  ClipboardList,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuthService } from '../services/auth';

export default function FulfillmentDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUser = AuthService.getCurrentUser();
  const canApprove = currentUser && ['admin', 'fulfillment'].includes(currentUser.role);

  useEffect(() => {
    loadData();

    // Set up automatic refresh every 60 seconds
    const intervalId = setInterval(() => {
      // Only refresh if the tab is visible to save resources
      if (document.visibilityState === 'visible') {
        console.log('Auto-refreshing dashboard data...');
        loadData();
      }
    }, 60000); // 60 seconds

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  const loadData = async () => {
    try {
      const [ordersResult, lowStockResult] = await Promise.all([
        getOrders(),
        getLowStockReport(),
      ]);
      setOrders(ordersResult.orders || []);
      
      // Deduplicate low stock items by ID to prevent React key warnings
      const items = lowStockResult.lowStockItems || [];
      const uniqueItems = Array.from(
        new Map(items.map((item: any) => [item.id, item])).values()
      );
      setLowStockItems(uniqueItems);
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

  const handleApproveReject = async () => {
    if (!selectedOrder) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/orders/${selectedOrder.id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          decision: approvalAction === 'approve' ? 'approved' : 'rejected',
          comments: comments || '',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process approval');
      }

      toast.success(`Order ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      setApprovalDialogOpen(false);
      setSelectedOrder(null);
      setComments('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process approval');
      console.error(error);
    } finally {
      setSubmitting(false);
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
            onClick={() => navigate('/orders?status=submitted')}
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
            onClick={() => navigate('/orders?status=picking')}
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
            onClick={() => navigate('/orders?status=fulfilled')}
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
                  <div 
                    key={order.id} 
                    className={`border rounded-lg p-4 ${
                      order.status === 'submitted' ? 'border-orange-300 bg-orange-50' : ''
                    }`}
                  >
                    {order.status === 'submitted' && (
                      <div className="flex items-center space-x-2 mb-3 text-orange-800">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">⚠️ Approval Required Before Fulfillment</span>
                      </div>
                    )}
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
                        {canApprove && order.status === 'submitted' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setSelectedOrder(order);
                                setApprovalAction('approve');
                                setApprovalDialogOpen(true);
                              }}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => {
                                setSelectedOrder(order);
                                setApprovalAction('reject');
                                setApprovalDialogOpen(true);
                              }}
                            >
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {order.status === 'approved' && (
                          <Button size="sm" onClick={() => handleStartPicking(order.id)}>
                            Start Picking
                          </Button>
                        )}
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

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approvalAction === 'approve' ? 'Approve' : 'Reject'} Order</DialogTitle>
            <DialogDescription>
              {selectedOrder && (
                <span className="text-sm text-gray-500">
                  Order #{selectedOrder.id.slice(0, 8)} - {selectedOrder.items?.length || 0} items
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Button
                variant={approvalAction === 'approve' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setApprovalAction('approve')}
                className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <ThumbsUp className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant={approvalAction === 'reject' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setApprovalAction('reject')}
              >
                <ThumbsDown className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
            
            {approvalAction === 'reject' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <span className="font-medium block mb-1">Stock will be returned to inventory</span>
                    <span className="text-xs block">Reserved items will automatically be released back to available stock when this order is rejected.</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="comments">
                Comments {approvalAction === 'reject' ? '(required for rejection)' : '(optional)'}
              </Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={approvalAction === 'reject' 
                  ? "Provide a reason for rejection..." 
                  : "Enter any comments or notes..."}
                required={approvalAction === 'reject'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setApprovalDialogOpen(false);
                setComments('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApproveReject}
              disabled={submitting || (approvalAction === 'reject' && !comments.trim())}
              className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
            >
              {submitting ? 'Processing...' : approvalAction === 'approve' ? 'Approve Order' : 'Reject Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}