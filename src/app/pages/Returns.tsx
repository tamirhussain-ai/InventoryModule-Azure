import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Undo2, Plus, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface ReturnRequest {
  id: string;
  returnNumber: string;
  requestorId: string;
  requestorName: string;
  orderId?: string;
  orderNumber?: string;
  itemId: string;
  itemName: string;
  quantity: number;
  reason: string;
  returnType: 'defective' | 'wrong-item' | 'overage' | 'unused' | 'other';
  status: 'submitted' | 'approved' | 'rejected' | 'completed';
  resolutionType?: 'exchange' | 'credit' | 'restock';
  approverNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export default function Returns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [activeTab, setActiveTab] = useState('my-returns');

  // Form state
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [returnType, setReturnType] = useState<'defective' | 'wrong-item' | 'overage' | 'unused' | 'other'>('defective');
  const [reason, setReason] = useState('');
  const [resolutionType, setResolutionType] = useState<'exchange' | 'credit' | 'restock'>('restock');
  const [approverNotes, setApproverNotes] = useState('');

  const userRole = localStorage.getItem('userRole') || 'requestor';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [returnsRes, ordersRes] = await Promise.all([
        fetch(`${API_URL}/returns`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/orders`, { headers: getAuthHeaders() }),
      ]);

      const returnsData = await returnsRes.json();
      const ordersData = await ordersRes.json();

      setReturns(returnsData.returns || []);
      setMyOrders(ordersData.orders?.filter((o: any) => o.status === 'fulfilled') || []);
    } catch (error: any) {
      toast.error('Failed to load return requests');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReturn = async () => {
    if (!selectedOrder || !selectedItem || !quantity || !reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const order = myOrders.find(o => o.id === selectedOrder);
      const item = order?.items?.find((i: any) => i.id === selectedItem);

      if (!item) {
        toast.error('Selected item not found');
        return;
      }

      const response = await fetch(`${API_URL}/returns`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          orderId: selectedOrder,
          itemId: selectedItem,
          quantity: parseInt(quantity),
          returnType,
          reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create return request');
      }

      toast.success('Return request submitted successfully');
      setCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleProcessReturn = async (returnId: string, approved: boolean) => {
    if (approved && !resolutionType) {
      toast.error('Please select a resolution type');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/returns/${returnId}/process`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          approved,
          resolutionType: approved ? resolutionType : undefined,
          approverNotes: approverNotes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process return');
      }

      toast.success(approved ? 'Return approved' : 'Return rejected');
      setDetailDialogOpen(false);
      setSelectedReturn(null);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCompleteReturn = async (returnId: string) => {
    try {
      const response = await fetch(`${API_URL}/returns/${returnId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete return');
      }

      toast.success('Return completed and item restocked');
      setDetailDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setSelectedOrder('');
    setSelectedItem('');
    setQuantity('');
    setReturnType('defective');
    setReason('');
    setResolutionType('restock');
    setApproverNotes('');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      submitted: { variant: 'secondary', icon: Clock, label: 'Pending Review' },
      approved: { variant: 'default', icon: CheckCircle, label: 'Approved' },
      rejected: { variant: 'destructive', icon: XCircle, label: 'Rejected' },
      completed: { variant: 'default', icon: CheckCircle, label: 'Completed' },
    };
    const config = variants[status] || { variant: 'secondary', icon: Clock, label: status };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant as any}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getReturnTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      defective: 'bg-red-100 text-red-800',
      'wrong-item': 'bg-orange-100 text-orange-800',
      overage: 'bg-blue-100 text-blue-800',
      unused: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || colors.other}`}>
        {type.replace('-', ' ').toUpperCase()}
      </span>
    );
  };

  const myReturns = returns.filter(r => r.requestorId === localStorage.getItem('userId'));
  const pendingReturns = returns.filter(r => r.status === 'submitted');
  const allReturns = returns;

  const stats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'submitted').length,
    approved: returns.filter(r => r.status === 'approved').length,
    rejected: returns.filter(r => r.status === 'rejected').length,
    completed: returns.filter(r => r.status === 'completed').length,
  };

  const selectedOrderData = myOrders.find(o => o.id === selectedOrder);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Returns & Exchanges</h1>
            <p className="text-gray-600 mt-1">Manage return requests and exchanges</p>
          </div>
          {(userRole === 'requestor' || userRole === 'approver') && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Return Request
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Total Returns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setActiveTab('pending')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Returns List */}
        <Card>
          <CardHeader>
            <CardTitle>Return Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="my-returns">My Returns</TabsTrigger>
                {(userRole === 'admin' || userRole === 'approver') && (
                  <TabsTrigger value="pending">Pending Review ({pendingReturns.length})</TabsTrigger>
                )}
                {userRole === 'admin' && (
                  <TabsTrigger value="all">All Returns</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="my-returns">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Return #</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                      </TableRow>
                    ) : myReturns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">No return requests</TableCell>
                      </TableRow>
                    ) : (
                      myReturns.map((ret) => (
                        <TableRow key={ret.id}>
                          <TableCell className="font-mono">{ret.returnNumber}</TableCell>
                          <TableCell className="font-mono">{ret.orderNumber || '-'}</TableCell>
                          <TableCell>{ret.itemName}</TableCell>
                          <TableCell>{ret.quantity}</TableCell>
                          <TableCell>{getReturnTypeBadge(ret.returnType)}</TableCell>
                          <TableCell>{getStatusBadge(ret.status)}</TableCell>
                          <TableCell>{new Date(ret.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReturn(ret);
                                setDetailDialogOpen(true);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {(userRole === 'admin' || userRole === 'approver') && (
                <TabsContent value="pending">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Return #</TableHead>
                        <TableHead>Requestor</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingReturns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">No pending returns</TableCell>
                        </TableRow>
                      ) : (
                        pendingReturns.map((ret) => (
                          <TableRow key={ret.id}>
                            <TableCell className="font-mono">{ret.returnNumber}</TableCell>
                            <TableCell>{ret.requestorName}</TableCell>
                            <TableCell>{ret.itemName}</TableCell>
                            <TableCell>{ret.quantity}</TableCell>
                            <TableCell>{getReturnTypeBadge(ret.returnType)}</TableCell>
                            <TableCell>{new Date(ret.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReturn(ret);
                                  setDetailDialogOpen(true);
                                }}
                              >
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              )}

              {userRole === 'admin' && (
                <TabsContent value="all">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Return #</TableHead>
                        <TableHead>Requestor</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allReturns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">No returns</TableCell>
                        </TableRow>
                      ) : (
                        allReturns.map((ret) => (
                          <TableRow key={ret.id}>
                            <TableCell className="font-mono">{ret.returnNumber}</TableCell>
                            <TableCell>{ret.requestorName}</TableCell>
                            <TableCell>{ret.itemName}</TableCell>
                            <TableCell>{ret.quantity}</TableCell>
                            <TableCell>{getReturnTypeBadge(ret.returnType)}</TableCell>
                            <TableCell>{getStatusBadge(ret.status)}</TableCell>
                            <TableCell>{new Date(ret.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReturn(ret);
                                  setDetailDialogOpen(true);
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* Create Return Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Return Request</DialogTitle>
              <DialogDescription>Submit a return request for a fulfilled order</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Order *</Label>
                <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an order" />
                  </SelectTrigger>
                  <SelectContent>
                    {myOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.orderNumber} - {new Date(order.createdAt).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrder && (
                <div>
                  <Label>Select Item *</Label>
                  <Select value={selectedItem} onValueChange={setSelectedItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an item" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedOrderData?.items?.map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} (Qty: {item.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Return Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <Label>Return Type *</Label>
                <Select value={returnType} onValueChange={(v: any) => setReturnType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defective">Defective</SelectItem>
                    <SelectItem value="wrong-item">Wrong Item</SelectItem>
                    <SelectItem value="overage">Overage</SelectItem>
                    <SelectItem value="unused">Unused/Extra</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reason *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for this return..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReturn}>
                Submit Return Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Return Detail Dialog */}
        {selectedReturn && (
          <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Return Request Details</DialogTitle>
                <DialogDescription>Return #{selectedReturn.returnNumber}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Requestor</p>
                    <p className="font-medium">{selectedReturn.requestorName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    {getStatusBadge(selectedReturn.status)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Order Number</p>
                    <p className="font-medium font-mono">{selectedReturn.orderNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Return Type</p>
                    {getReturnTypeBadge(selectedReturn.returnType)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Item</p>
                    <p className="font-medium">{selectedReturn.itemName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Quantity</p>
                    <p className="font-medium">{selectedReturn.quantity}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Reason</p>
                  <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedReturn.reason}</p>
                </div>

                {selectedReturn.resolutionType && (
                  <div>
                    <p className="text-sm text-gray-600">Resolution Type</p>
                    <p className="font-medium capitalize">{selectedReturn.resolutionType}</p>
                  </div>
                )}

                {selectedReturn.approverNotes && (
                  <div>
                    <p className="text-sm text-gray-600">Approver Notes</p>
                    <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedReturn.approverNotes}</p>
                  </div>
                )}

                {selectedReturn.status === 'submitted' && (userRole === 'admin' || userRole === 'approver') && (
                  <>
                    <div>
                      <Label>Resolution Type *</Label>
                      <Select value={resolutionType} onValueChange={(v: any) => setResolutionType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restock">Restock to Inventory</SelectItem>
                          <SelectItem value="exchange">Exchange for New Item</SelectItem>
                          <SelectItem value="credit">Issue Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Approver Notes (Optional)</Label>
                      <Textarea
                        value={approverNotes}
                        onChange={(e) => setApproverNotes(e.target.value)}
                        placeholder="Add notes or instructions..."
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {selectedReturn.status === 'approved' && userRole === 'fulfillment' && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium">
                      Complete this return to restock the item to inventory
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                {selectedReturn.status === 'submitted' && (userRole === 'admin' || userRole === 'approver') ? (
                  <>
                    <Button variant="outline" onClick={() => handleProcessReturn(selectedReturn.id, false)}>
                      Reject
                    </Button>
                    <Button onClick={() => handleProcessReturn(selectedReturn.id, true)}>
                      Approve Return
                    </Button>
                  </>
                ) : selectedReturn.status === 'approved' && userRole === 'fulfillment' ? (
                  <Button onClick={() => handleCompleteReturn(selectedReturn.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete & Restock
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
