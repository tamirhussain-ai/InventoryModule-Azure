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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { FileText, Plus, Package, CheckCircle, Clock, XCircle, Eye, Edit, Trash2, MoreVertical } from 'lucide-react';
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
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [receiveQuantities, setReceiveQuantities] = useState<{ [key: string]: number }>({});

  // Form state for creating PO
  const [newPO, setNewPO] = useState({
    customPONumber: '',
    vendorId: '',
    expectedDate: '',
    items: [] as Array<{ itemId: string; quantity: number }>,
  });

  // Form state for editing PO
  const [editPO, setEditPO] = useState({
    customPONumber: '',
    vendorId: '',
    expectedDate: '',
    status: '',
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

      const vendorsList = vendorsData.vendors || [];
      const itemsList = itemsData.items || [];
      
      // Create lookup maps for quick access
      const vendorMap = new Map(vendorsList.map((v: any) => [v.id, v.name]));
      const itemMap = new Map(itemsList.map((i: any) => [i.id, i]));

      // Enrich purchase orders with vendor and item names
      const enrichedOrders = (ordersData.purchaseOrders || []).map((po: any) => ({
        ...po,
        vendorName: vendorMap.get(po.vendorId) || 'Unknown Vendor',
        items: (po.items || []).map((item: any) => ({
          ...item,
          itemName: itemMap.get(item.itemId)?.name || 'Unknown Item',
        })),
      }));

      setOrders(enrichedOrders);
      setVendors(vendorsList);
      setItems(itemsList);
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
      setNewPO({ customPONumber: '', vendorId: '', expectedDate: '', items: [] });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReceivePO = async (poId: string, poItems: any[]) => {
    try {
      console.log('Receiving PO:', { poId, receiveQuantities });
      
      // Build receivedItems array from receiveQuantities
      const receivedItems = poItems
        .map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          quantityReceived: receiveQuantities[item.itemId] || 0,
          condition: 'good',
        }))
        .filter(item => item.quantityReceived > 0);

      if (receivedItems.length === 0) {
        toast.error('Please enter at least one quantity to receive');
        return;
      }

      console.log('Request URL:', `${API_URL}/purchase-orders/${poId}/receive`);
      console.log('Sending items:', receivedItems);

      const response = await fetch(`${API_URL}/purchase-orders/${poId}/receive`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items: receivedItems }),
      });

      console.log('Receive PO response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Receive PO error:', errorData);
        throw new Error(`Failed to receive PO: ${errorData}`);
      }

      toast.success('Purchase order received successfully');
      setReceiveDialogOpen(false);
      setSelectedPO(null);
      setReceiveQuantities({});
      loadData();
    } catch (error: any) {
      console.error('Receive PO exception:', error);
      toast.error(error.message || 'Failed to receive PO');
    }
  };

  const handleViewPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setViewDialogOpen(true);
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setEditPO({
      customPONumber: po.poNumber,
      vendorId: po.vendorId,
      expectedDate: po.expectedDate.split('T')[0],
      status: po.status,
      items: po.items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
      })),
    });
    setEditDialogOpen(true);
  };

  const handleUpdatePO = async () => {
    try {
      if (!selectedPO) return;
      
      if (!editPO.vendorId || !editPO.expectedDate || editPO.items.length === 0) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await fetch(`${API_URL}/purchase-orders/${selectedPO.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editPO),
      });

      if (!response.ok) throw new Error('Failed to update PO');

      toast.success('Purchase order updated successfully');
      setEditDialogOpen(false);
      setSelectedPO(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStatusChange = async () => {
    try {
      if (!selectedPO || !newStatus) return;

      console.log('Changing PO status:', { poId: selectedPO.id, newStatus });
      console.log('Request URL:', `${API_URL}/purchase-orders/${selectedPO.id}/status`);

      const response = await fetch(`${API_URL}/purchase-orders/${selectedPO.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      console.log('Status change response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Status change error:', errorData);
        throw new Error(`Failed to update PO status: ${errorData}`);
      }

      toast.success('Purchase order status updated successfully');
      setStatusDialogOpen(false);
      setSelectedPO(null);
      setNewStatus('');
      loadData();
    } catch (error: any) {
      console.error('Status change exception:', error);
      toast.error(error.message || 'Failed to update PO status');
    }
  };

  const openStatusDialog = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setNewStatus(po.status);
    setStatusDialogOpen(true);
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

  const addItemToEditPO = () => {
    setEditPO({
      ...editPO,
      items: [...editPO.items, { itemId: '', quantity: 0 }],
    });
  };

  const updateEditPOItem = (index: number, field: string, value: any) => {
    const updatedItems = [...editPO.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setEditPO({ ...editPO, items: updatedItems });
  };

  const removeEditPOItem = (index: number) => {
    setEditPO({
      ...editPO,
      items: editPO.items.filter((_, i) => i !== index),
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
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewPO(po)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(po.status === 'draft' || po.status === 'submitted') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditPO(po)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openStatusDialog(po)}>
                                  Change Status
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                <Label>Custom PO Number (Optional)</Label>
                <Input
                  placeholder="Leave blank for auto-generated PO number"
                  value={newPO.customPONumber}
                  onChange={(e) => setNewPO({ ...newPO, customPONumber: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  If left blank, system will auto-generate a PO number
                </p>
              </div>

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
        {selectedPO && receiveDialogOpen && (
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
                        min={0}
                        max={item.quantity - item.received}
                        value={receiveQuantities[item.itemId] || ''}
                        onChange={(e) => setReceiveQuantities({
                          ...receiveQuantities,
                          [item.itemId]: parseInt(e.target.value) || 0
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleReceivePO(selectedPO.id, selectedPO.items)}>
                  Receive Items
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* View PO Dialog */}
        {selectedPO && viewDialogOpen && (
          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Purchase Order Details</DialogTitle>
                <DialogDescription>PO: {selectedPO.poNumber}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Vendor</Label>
                    <p className="font-medium">{selectedPO.vendorName}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedPO.status)}</div>
                  </div>
                  <div>
                    <Label className="text-gray-600">Expected Date</Label>
                    <p className="font-medium">{new Date(selectedPO.expectedDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Created Date</Label>
                    <p className="font-medium">{new Date(selectedPO.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-600 mb-2 block">Items</Label>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPO.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{item.received}</TableCell>
                            <TableCell className="text-right">{item.quantity - item.received}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
                {(selectedPO.status === 'draft' || selectedPO.status === 'submitted') && (
                  <Button onClick={() => {
                    setViewDialogOpen(false);
                    handleEditPO(selectedPO);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit PO
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit PO Dialog */}
        {selectedPO && editDialogOpen && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Purchase Order</DialogTitle>
                <DialogDescription>Modify purchase order: {selectedPO.poNumber}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>PO Number</Label>
                  <Input
                    value={editPO.customPONumber}
                    onChange={(e) => setEditPO({ ...editPO, customPONumber: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Vendor</Label>
                  <Select value={editPO.vendorId} onValueChange={(value) => setEditPO({ ...editPO, vendorId: value })}>
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
                    value={editPO.expectedDate}
                    onChange={(e) => setEditPO({ ...editPO, expectedDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={editPO.status} onValueChange={(value) => setEditPO({ ...editPO, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItemToEditPO}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editPO.items.map((item, index) => (
                      <div key={index} className="flex space-x-2">
                        <Select
                          value={item.itemId}
                          onValueChange={(value) => updateEditPOItem(index, 'itemId', value)}
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
                          onChange={(e) => updateEditPOItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeEditPOItem(index)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdatePO}>
                  Update Purchase Order
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Change Status Dialog */}
        {selectedPO && statusDialogOpen && (
          <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Purchase Order Status</DialogTitle>
                <DialogDescription>
                  Update status for PO: {selectedPO.poNumber}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Current Status</Label>
                  <div className="mt-2">{getStatusBadge(selectedPO.status)}</div>
                </div>
                <div>
                  <Label>New Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleStatusChange}>
                  Update Status
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
