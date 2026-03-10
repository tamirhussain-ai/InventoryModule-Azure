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
import { getOrder, fulfillOrder, updateFulfilledOrder, cancelOrder, getItem, getStock } from '../services/api';
import { AuthService } from '../services/auth';
import { Package, Clock, CheckCircle, XCircle, MapPin, User, AlertCircle, Edit, Ban } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pickingMode, setPickingMode] = useState(false);
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [fulfillmentItems, setFulfillmentItems] = useState<any[]>([]);
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const user = AuthService.getCurrentUser();
  const canFulfill = user?.role === 'admin' || user?.role === 'fulfillment';
  const isAdmin = user?.role === 'admin';

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
              const stockResult = await getStock(item.itemId);
              
              // Calculate total stock from all locations
              const totalStock = Array.isArray(stockResult.stock) 
                ? stockResult.stock.reduce((sum: number, record: any) => sum + (record.value?.quantity || 0), 0)
                : 0;
              
              return {
                ...item,
                itemDetails: itemResult.item,
                quantityFulfilled: item.quantityFulfilled || item.quantity,
                quantityRequested: item.quantity,
                stock: totalStock,
                picked: false,
              };
            } catch (error) {
              console.error('Error loading item details:', error);
              return {
                ...item,
                quantityFulfilled: item.quantityFulfilled || item.quantity,
                quantityRequested: item.quantity,
                stock: 0,
                picked: false,
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

  const handleEditFulfilledOrder = async () => {
    if (!id) return;

    setSubmitting(true);
    try {
      await updateFulfilledOrder(id, {
        items: fulfillmentItems.map(item => ({
          itemId: item.itemId,
          locationId: item.locationId || 'main',
          quantityRequested: item.quantityRequested,
          quantityFulfilled: item.quantityFulfilled,
        })),
        notes: fulfillmentNotes,
      });
      toast.success('Order updated successfully!');
      setEditDialogOpen(false);
      loadOrder();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!id) return;

    setSubmitting(true);
    try {
      await cancelOrder(id, cancellationReason);
      toast.success('Order cancelled successfully! Items returned to inventory.');
      setCancelDialogOpen(false);
      loadOrder();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel order');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = () => {
    setFulfillmentNotes(order.fulfillmentNotes || '');
    setEditDialogOpen(true);
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
            {order.lastEditedAt && (
              <p className="text-sm text-amber-600 mt-1">
                ⚠️ Last edited on {new Date(order.lastEditedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            {canFulfill && (order.status === 'submitted' || order.status === 'approved' || order.status === 'picking') && (
              <Button onClick={() => setFulfillDialogOpen(true)}>
                <Package className="h-4 w-4 mr-2" />
                Fulfill Order
              </Button>
            )}
            {isAdmin && order.status === 'fulfilled' && (
              <Button onClick={openEditDialog} variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Order
              </Button>
            )}
            {isAdmin && order.status !== 'fulfilled' && order.status !== 'cancelled' && (
              <Button onClick={() => setCancelDialogOpen(true)} variant="outline" className="text-red-600">
                <Ban className="h-4 w-4 mr-2" />
                Cancel Order
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
                  {order.lastEditedAt && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-amber-800 font-medium">
                        ⚠️ <strong>Admin Modified:</strong> {new Date(order.lastEditedAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        This order was edited after fulfillment. See audit logs for full details.
                      </p>
                    </div>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pick & Fulfill Order #{order.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>
              Check off items as you pick them. Adjust quantities if needed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Picking Progress</span>
                <span className="text-gray-600">
                  {fulfillmentItems.filter(i => i.picked).length} / {fulfillmentItems.length} items
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all" 
                  style={{ width: `${(fulfillmentItems.filter(i => i.picked).length / fulfillmentItems.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Pick List */}
            <div className="space-y-3">
              {fulfillmentItems.map((item, index) => (
                <div 
                  key={index} 
                  className={`border rounded-lg p-4 transition-all ${item.picked ? 'bg-green-50 border-green-300' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Pick Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...fulfillmentItems];
                          updated[index].picked = !updated[index].picked;
                          setFulfillmentItems(updated);
                        }}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                          item.picked 
                            ? 'bg-green-600 border-green-600 text-white' 
                            : 'bg-white border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {item.picked && (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Item Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.itemDetails?.name || `Item ${item.itemId.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            SKU: {item.itemDetails?.sku || 'N/A'}
                          </p>
                          {item.itemDetails?.location && (
                            <p className="text-sm text-blue-600 font-medium mt-1">
                              📍 {item.itemDetails.location}
                            </p>
                          )}
                        </div>
                        {item.picked && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Picked
                          </Badge>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">Requested</Label>
                          <Input 
                            value={item.quantityRequested} 
                            disabled 
                            className="h-9 bg-gray-100"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Available</Label>
                          <Input 
                            value={item.stock || 0} 
                            disabled 
                            className={`h-9 ${(item.stock || 0) < item.quantityRequested ? 'bg-red-50 text-red-600' : 'bg-gray-100'}`}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fulfilled *</Label>
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
                            className="h-9"
                          />
                        </div>
                      </div>

                      {/* Stock Warning */}
                      {(item.stock || 0) < item.quantityRequested && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <p className="text-xs text-yellow-800">
                            Low stock! Only {item.stock || 0} available.
                          </p>
                        </div>
                      )}

                      {/* Item Notes */}
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-2 italic">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fulfillment Notes */}
            <div>
              <Label htmlFor="fulfillmentNotes">Fulfillment Notes (Optional)</Label>
              <Textarea
                id="fulfillmentNotes"
                placeholder="Enter notes about substitutions, short picks, or special handling..."
                value={fulfillmentNotes}
                onChange={(e) => setFulfillmentNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFulfillDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleFulfill} 
              disabled={submitting || fulfillmentItems.filter(i => i.picked).length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? 'Processing...' : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Fulfillment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fulfilled Order Dialog (Admin Only) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Fulfilled Order #{order.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>
              <span className="text-amber-600 font-medium">⚠️ Warning: Editing this fulfilled order will adjust inventory levels.</span>
              <br />
              <span className="text-sm text-gray-600">Previous fulfillment quantities will be reversed and new quantities will be applied.</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Order Items */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Order Items</h3>
              {fulfillmentItems.map((item, index) => (
                <div 
                  key={index} 
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    {/* Item Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.itemDetails?.name || `Item ${item.itemId.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            SKU: {item.itemDetails?.sku || 'N/A'}
                          </p>
                          {item.itemDetails?.location && (
                            <p className="text-sm text-blue-600 font-medium mt-1">
                              📍 {item.itemDetails.location}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">Originally Requested</Label>
                          <Input 
                            value={item.quantityRequested} 
                            disabled 
                            className="h-9 bg-gray-100"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Current Stock</Label>
                          <Input 
                            value={item.stock || 0} 
                            disabled 
                            className="h-9 bg-gray-100"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fulfilled Quantity *</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.quantityFulfilled}
                            onChange={(e) => {
                              const updated = [...fulfillmentItems];
                              updated[index].quantityFulfilled = Number(e.target.value);
                              setFulfillmentItems(updated);
                            }}
                            className="h-9"
                          />
                        </div>
                      </div>

                      {/* Item Notes */}
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-2 italic">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fulfillment Notes */}
            <div>
              <Label htmlFor="editFulfillmentNotes">Fulfillment Notes</Label>
              <Textarea
                id="editFulfillmentNotes"
                placeholder="Enter notes about this order modification..."
                value={fulfillmentNotes}
                onChange={(e) => setFulfillmentNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Audit Warning */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>Audit Trail:</strong> All changes to this fulfilled order will be logged with your user ID and timestamp for compliance and traceability.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditFulfilledOrder} 
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {submitting ? 'Updating...' : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog (Admin Only) */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cancel Order #{order.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>
              <span className="text-amber-600 font-medium">⚠️ Warning: Canceling this order will remove it from the system.</span>
              <br />
              <span className="text-sm text-gray-600">Please provide a reason for canceling this order.</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Cancellation Reason */}
            <div>
              <Label htmlFor="cancellationReason">Reason for Cancellation</Label>
              <Textarea
                id="cancellationReason"
                placeholder="Enter the reason for canceling this order..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCancelOrder} 
              disabled={submitting || !cancellationReason}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Canceling...' : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}