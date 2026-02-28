import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { getOrders, updateOrderStatus } from '../services/api';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ApproverDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

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

  const handleApprove = async (orderId: string) => {
    setProcessing(true);
    try {
      await updateOrderStatus(orderId, 'approved', approvalNotes);
      toast.success('Order approved');
      setSelectedOrder(null);
      setApprovalNotes('');
      loadOrders();
    } catch (error: any) {
      toast.error('Failed to approve order');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async (orderId: string) => {
    if (!approvalNotes.trim()) {
      toast.error('Please provide a reason for denial');
      return;
    }
    setProcessing(true);
    try {
      await updateOrderStatus(orderId, 'denied', approvalNotes);
      toast.success('Order denied');
      setSelectedOrder(null);
      setApprovalNotes('');
      loadOrders();
    } catch (error: any) {
      toast.error('Failed to deny order');
    } finally {
      setProcessing(false);
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'submitted');
  const approvedOrders = orders.filter(o => o.status === 'approved');
  const deniedOrders = orders.filter(o => o.status === 'denied');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Approver Dashboard</h1>
          <p className="text-gray-600 mt-1">Review and approve order requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/approvals')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Approval</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingOrders.length}</div>
              <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/my-orders?status=approved')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedOrders.length}</div>
              <p className="text-xs text-gray-500 mt-1">In fulfillment</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/my-orders?status=denied')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Denied</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deniedOrders.length}</div>
              <p className="text-xs text-gray-500 mt-1">Rejected</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Orders waiting for your review</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading orders...</p>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No pending approvals</p>
                <p className="text-sm text-gray-400 mt-1">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <p className="font-medium text-gray-900">
                            Order #{order.id.slice(0, 8)}
                          </p>
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending Review
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <p><strong>Submitted:</strong> {new Date(order.submittedAt).toLocaleString()}</p>
                          <p><strong>Items:</strong> {order.items?.length || 0}</p>
                          <p><strong>Delivery:</strong> {order.deliveryPreference} to {order.deliveryLocation}</p>
                          {order.neededBy && (
                            <p><strong>Needed by:</strong> {new Date(order.neededBy).toLocaleDateString()}</p>
                          )}
                          {order.department && (
                            <p><strong>Department:</strong> {order.department}</p>
                          )}
                          {order.notes && (
                            <p><strong>Notes:</strong> {order.notes}</p>
                          )}
                        </div>

                        {selectedOrder?.id === order.id && (
                          <div className="mt-4 space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-2">
                                Approval Notes (required for denial)
                              </label>
                              <Textarea
                                placeholder="Enter approval or denial notes..."
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value)}
                                rows={3}
                              />
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="default"
                                onClick={() => handleApprove(order.id)}
                                disabled={processing}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDeny(order.id)}
                                disabled={processing}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Deny
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(null);
                                  setApprovalNotes('');
                                }}
                                disabled={processing}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        {selectedOrder?.id !== order.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrder(order)}
                          >
                            Review
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

        {/* Recently Reviewed */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Reviewed</CardTitle>
            <CardDescription>Your recent approval decisions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...approvedOrders, ...deniedOrders]
                .sort((a, b) => {
                  const aDate = new Date(a.approvedAt || a.submittedAt).getTime();
                  const bDate = new Date(b.approvedAt || b.submittedAt).getTime();
                  return bDate - aDate;
                })
                .slice(0, 5)
                .map((order) => (
                  <Link key={order.id} to={`/orders/${order.id}`}>
                    <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <p className="font-medium text-gray-900">
                            Order #{order.id.slice(0, 8)}
                          </p>
                          <Badge variant={order.status === 'approved' ? 'default' : 'destructive'}>
                            {order.status === 'approved' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="sm">View</Button>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}