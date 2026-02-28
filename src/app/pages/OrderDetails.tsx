import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { getOrder, fulfillOrder, getItem } from '../services/api';
import { AuthService } from '../services/auth';
import { Package, Clock, CheckCircle, XCircle, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [fulfillmentItems, setFulfillmentItems] = useState<any[]>([]);
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const user = AuthService.getCurrentUser();
  const canFulfill = user?.role === 'admin' || user?.role === 'fulfillment';

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    if (!id) return;

    try {
      const result = await getOrder(id);
      setOrder(result.order);
      
      // Initialize fulfillment items
      if (result.order.items) {
        const itemsWithDetails = await Promise.all(
          result.order.items.map(async (item: any) => {
            try {
              const itemResult = await getItem(item.itemId);
              return {
                ...item,
                itemDetails: itemResult.item,
                quantityFulfilled: item.quantityFulfilled || item.quantity,
                quantityRequested: item.quantity,
              };
            } catch {
              return {
                ...item,
                quantityFulfilled: item.quantityFulfilled || item.quantity,
                quantityRequested: item.quantity,
              };
            }
          })
        );
        setFulfillmentItems(itemsWithDetails);
      }
    } catch (error: any) {
      toast.error('Failed to load order');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = async () => {
    if (!id) return;

    setSubmitting(true);
    try {
      await fulfillOrder(id, {
        items: fulfillmentItems.map(item => ({
          itemId: item.itemId,
          locationId: item.locationId || 'main',
          quantityRequested: item.quantityRequested,
          quantityFulfilled: item.quantityFulfilled,
        })),
        notes: fulfillmentNotes,
      });
      toast.success('Order fulfilled successfully!');
      setFulfillDialogOpen(false);
      loadOrder();
    } catch (error: any) {
      toast.error(error.message || 'Failed to fulfill order');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; color: string }> = {
      submitted: { variant: 'secondary', icon: Clock, color: 'text-gray-600' },
      approved: { variant: 'default', icon: CheckCircle, color: 'text-blue-600' },
      picking: { variant: 'default', icon: Package, color: 'text-purple-600' },
      fulfilled: { variant: 'default', icon: CheckCircle, color: 'text-green-600' },
      denied: { variant: 'destructive', icon: XCircle, color: 'text-red-600' },
    };
    const config = variants[status] || variants.submitted;
    const Icon = config.icon;
    return (
      <div className="flex items-center space-x-2">
        <Icon className={`h-5 w-5 ${config.color}`} />
        <span className="font-medium">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500">Loading order details...</p>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Order not found</p>
            <Link to="/requestor">
              <Button className="mt-4">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</h1>
            <p className="text-gray-600 mt-1">Submitted on {new Date(order.submittedAt).toLocaleString()}</p>
          </div>
          <div className="flex space-x-2">
            {canFulfill && (order.status === 'submitted' || order.status === 'approved' || order.status === 'picking') && (
              <Button onClick={() => setFulfillDialogOpen(true)}>
                <Package className="h-4 w-4 mr-2" />
                Fulfill Order
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Order Status</CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(order.status)}
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p><strong>Submitted:</strong> {new Date(order.submittedAt).toLocaleString()}</p>
                  {order.approvedAt && (
                    <p><strong>Approved:</strong> {new Date(order.approvedAt).toLocaleString()}</p>
                  )}
                  {order.fulfilledAt && (
                    <p><strong>Fulfilled:</strong> {new Date(order.fulfilledAt).toLocaleString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
                <CardDescription>{order.items?.length || 0} items requested</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items?.map((item: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Item ID: {item.itemId.slice(0, 8)}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Quantity: {item.quantityFulfilled || item.quantity} {item.quantityFulfilled && item.quantity !== item.quantityFulfilled && `(${item.quantity} requested)`}
                          </p>
                          {item.notes && (
                            <p className="text-sm text-gray-500 mt-1">Notes: {item.notes}</p>
                          )}
                        </div>
                        <Link to={`/items/${item.itemId}`}>
                          <Button variant="outline" size="sm">View Item</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {(order.notes || order.fulfillmentNotes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Requestor Notes:</p>
                      <p className="text-gray-900 mt-1">{order.notes}</p>
                    </div>
                  )}
                  {order.fulfillmentNotes && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Fulfillment Notes:</p>
                      <p className="text-gray-900 mt-1">{order.fulfillmentNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Delivery Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Method</p>
                    <p className="text-gray-900">{order.deliveryPreference.charAt(0).toUpperCase() + order.deliveryPreference.slice(1)}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Location</p>
                    <p className="text-gray-900">{order.deliveryLocation}</p>
                  </div>
                </div>
                {order.neededBy && (
                  <div className="flex items-start space-x-3">
                    <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Needed By</p>
                      <p className="text-gray-900">{new Date(order.neededBy).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                {order.department && (
                  <div className="flex items-start space-x-3">
                    <User className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Department</p>
                      <p className="text-gray-900">{order.department}</p>
                    </div>
                  </div>
                )}
                {order.costCenter && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Cost Center</p>
                    <p className="text-gray-900 mt-1">{order.costCenter}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Fulfill Dialog */}
      <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fulfill Order #{order.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>Specify quantities fulfilled and complete the order</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {fulfillmentItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">
                    {item.itemDetails?.name || `Item ${item.itemId.slice(0, 8)}`}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Requested</Label>
                      <Input value={item.quantityRequested} disabled />
                    </div>
                    <div>
                      <Label>Fulfilled</Label>
                      <Input
                        type="number"
                        min="0"
                        max={item.quantityRequested}
                        value={item.quantityFulfilled}
                        onChange={(e) => {
                          const updated = [...fulfillmentItems];
                          updated[index].quantityFulfilled = Number(e.target.value);
                          setFulfillmentItems(updated);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="fulfillmentNotes">Fulfillment Notes</Label>
              <Textarea
                id="fulfillmentNotes"
                placeholder="Any notes about the fulfillment (substitutions, partial fills, etc.)..."
                value={fulfillmentNotes}
                onChange={(e) => setFulfillmentNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleFulfill} disabled={submitting}>
              {submitting ? 'Fulfilling...' : 'Complete Fulfillment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
