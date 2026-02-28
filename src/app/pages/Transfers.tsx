import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ArrowRightLeft, Plus, CheckCircle, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface Transfer {
  id: string;
  transferNumber: string;
  itemId: string;
  itemName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  quantity: number;
  status: 'pending' | 'in-transit' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

export default function Transfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [newTransfer, setNewTransfer] = useState({
    itemId: '',
    fromLocationId: '',
    toLocationId: '',
    quantity: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [transfersRes, locationsRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/transfers`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/locations`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/items`, { headers: getAuthHeaders() }),
      ]);

      const transfersData = await transfersRes.json();
      const locationsData = await locationsRes.json();
      const itemsData = await itemsRes.json();

      setTransfers(transfersData.transfers || []);
      setLocations(locationsData.locations || []);
      setItems(itemsData.items || []);
    } catch (error: any) {
      toast.error('Failed to load transfers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransfer = async () => {
    try {
      if (!newTransfer.itemId || !newTransfer.fromLocationId || !newTransfer.toLocationId || !newTransfer.quantity) {
        toast.error('Please fill all required fields');
        return;
      }

      if (newTransfer.fromLocationId === newTransfer.toLocationId) {
        toast.error('Source and destination locations must be different');
        return;
      }

      const response = await fetch(`${API_URL}/transfers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newTransfer),
      });

      if (!response.ok) throw new Error('Failed to create transfer');

      toast.success('Stock transfer created successfully');
      setCreateDialogOpen(false);
      setNewTransfer({ itemId: '', fromLocationId: '', toLocationId: '', quantity: 0 });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCompleteTransfer = async (transferId: string) => {
    try {
      const response = await fetch(`${API_URL}/transfers/${transferId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to complete transfer');

      toast.success('Transfer completed successfully');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: 'secondary',
      'in-transit': 'default',
      completed: 'default',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
  };

  const filteredTransfers = filterStatus === 'all'
    ? transfers
    : transfers.filter(t => t.status === filterStatus);

  const stats = {
    total: transfers.length,
    pending: transfers.filter(t => t.status === 'pending' || t.status === 'in-transit').length,
    completed: transfers.filter(t => t.status === 'completed').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stock Transfers</h1>
            <p className="text-gray-600 mt-1">Transfer inventory between locations</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Transfer
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Transfers</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Transfers List */}
        <Card>
          <CardHeader>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>View and manage stock transfers</CardDescription>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-transit">In Transit</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer #</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        No transfers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-medium">{transfer.transferNumber}</TableCell>
                        <TableCell>{transfer.itemName}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                            {transfer.fromLocationName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                            {transfer.toLocationName}
                          </div>
                        </TableCell>
                        <TableCell>{transfer.quantity}</TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell>{new Date(transfer.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {(transfer.status === 'pending' || transfer.status === 'in-transit') && (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteTransfer(transfer.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Create Transfer Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Stock Transfer</DialogTitle>
              <DialogDescription>Transfer inventory between locations</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Item</Label>
                <Select value={newTransfer.itemId} onValueChange={(value) => setNewTransfer({ ...newTransfer, itemId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} - {item.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>From Location</Label>
                <Select value={newTransfer.fromLocationId} onValueChange={(value) => setNewTransfer({ ...newTransfer, fromLocationId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>To Location</Label>
                <Select value={newTransfer.toLocationId} onValueChange={(value) => setNewTransfer({ ...newTransfer, toLocationId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  placeholder="Enter quantity"
                  value={newTransfer.quantity || ''}
                  onChange={(e) => setNewTransfer({ ...newTransfer, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTransfer}>Create Transfer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
