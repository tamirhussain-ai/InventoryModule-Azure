import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { FileText, Plus, Package, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: 'draft' | 'submitted' | 'approved' | 'received' | 'cancelled';
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    received: number;
  }>;
  totalAmount: number;
  createdAt: string;
  expectedDate: string;
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state for creating PO
  const [newPO, setNewPO] = useState({
    vendorId: '',
    expectedDate: '',
    items: [] as Array<{ itemId: string; quantity: number }>,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersRes, vendorsRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/purchase-orders`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/vendors`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/items`, { headers: getAuthHeaders() }),
      ]);

      const ordersData = await ordersRes.json();
      const vendorsData = await vendorsRes.json();
      const itemsData = await itemsRes.json();

      setOrders(ordersData.purchaseOrders || []);
      setVendors(vendorsData.vendors || []);
      setItems(itemsData.items || []);
    } catch (error: any) {
      toast.error('Failed to load purchase orders');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async () => {
    try {
      if (!newPO.vendorId || !newPO.expectedDate || newPO.items.length === 0) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await fetch(`${API_URL}/purchase-orders`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPO),
      });

      if (!response.ok) throw new Error('Failed to create PO');

      toast.success('Purchase order created successfully');
      setCreateDialogOpen(false);
      setNewPO({ vendorId: '', expectedDate: '', items: [] });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReceivePO = async (poId: string, receivedItems: any[]) => {
    try {
      const response = await fetch(`${API_URL}/purchase-orders/${poId}/receive`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ receivedItems }),
      });

      if (!response.ok) throw new Error('Failed to receive PO');

      toast.success('Purchase order received successfully');
      setReceiveDialogOpen(false);
      setSelectedPO(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const addItemToPO = () => {
    setNewPO({
      ...newPO,
      items: [...newPO.items, { itemId: '', quantity: 0 }],
    });
  };

  const updatePOItem = (index: number, field: string, value: any) => {
    const updatedItems = [...newPO.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setNewPO({ ...newPO, items: updatedItems });
  };

  const removePOItem = (index: number) => {
    setNewPO({
      ...newPO,
      items: newPO.items.filter((_, i) => i !== index),
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      draft: 'secondary',
      submitted: 'default',
      approved: 'default',
      received: 'default',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(po => po.status === filterStatus);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'submitted' || o.status === 'approved').length,
    received: orders.filter(o => o.status === 'received').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-600 mt-1">Manage purchase orders and receiving</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create PO
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total POs</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Received</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.received}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders List</CardTitle>
            <CardDescription>View and manage all purchase orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label>Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No purchase orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                        <TableCell>{po.vendorName}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(po.status)}
                            {getStatusBadge(po.status)}
                          </div>
                        </TableCell>
                        <TableCell>{po.items.length} items</TableCell>
                        <TableCell>{new Date(po.expectedDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(po.status === 'approved' || po.status === 'submitted') && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedPO(po);
                                  setReceiveDialogOpen(true);
                                }}
                              >
                                <Package className="h-4 w-4 mr-1" />
                                Receive
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Create PO Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
              <DialogDescription>Create a new purchase order for inventory replenishment</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vendor</Label>
                <Select value={newPO.vendorId} onValueChange={(value) => setNewPO({ ...newPO, vendorId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={newPO.expectedDate}
                  onChange={(e) => setNewPO({ ...newPO, expectedDate: e.target.value })}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItemToPO}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {newPO.items.map((item, index) => (
                    <div key={index} className="flex space-x-2">
                      <Select
                        value={item.itemId}
                        onValueChange={(value) => updatePOItem(index, 'itemId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} - {i.sku}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Quantity"
                        className="w-32"
                        value={item.quantity || ''}
                        onChange={(e) => updatePOItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removePOItem(index)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePO}>Create Purchase Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receive PO Dialog */}
        {selectedPO && (
          <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Receive Purchase Order</DialogTitle>
                <DialogDescription>PO: {selectedPO.poNumber} - {selectedPO.vendorName}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Mark items as received. You can do partial receiving.
                </p>
                <div className="border rounded-lg p-4">
                  {selectedPO.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-sm text-gray-500">
                          Ordered: {item.quantity} | Received: {item.received}
                        </p>
                      </div>
                      <Input
                        type="number"
                        className="w-24"
                        placeholder="Qty"
                        max={item.quantity - item.received}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleReceivePO(selectedPO.id, [])}>
                  Receive Items
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
