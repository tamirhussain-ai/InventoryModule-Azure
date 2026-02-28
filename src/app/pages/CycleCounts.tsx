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
import { ClipboardCheck, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface CycleCount {
  id: string;
  countNumber: string;
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  expectedQuantity: number;
  countedQuantity?: number;
  variance?: number;
  status: 'pending' | 'in-progress' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
  createdBy: string;
}

export default function CycleCounts() {
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null);
  const [countedQuantity, setCountedQuantity] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [newCount, setNewCount] = useState({
    itemId: '',
    locationId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [countsRes, locationsRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/cycle-counts`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/locations`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/items`, { headers: getAuthHeaders() }),
      ]);

      const countsData = await countsRes.json();
      const locationsData = await locationsRes.json();
      const itemsData = await itemsRes.json();

      setCounts(countsData.cycleCounts || []);
      setLocations(locationsData.locations || []);
      setItems(itemsData.items || []);
    } catch (error: any) {
      toast.error('Failed to load cycle counts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCount = async () => {
    try {
      if (!newCount.itemId || !newCount.locationId) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await fetch(`${API_URL}/cycle-counts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newCount),
      });

      if (!response.ok) throw new Error('Failed to create cycle count');

      toast.success('Cycle count created successfully');
      setCreateDialogOpen(false);
      setNewCount({ itemId: '', locationId: '' });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSubmitCount = async () => {
    if (!selectedCount) return;

    try {
      const response = await fetch(`${API_URL}/cycle-counts/${selectedCount.id}/submit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ countedQuantity }),
      });

      if (!response.ok) throw new Error('Failed to submit count');

      toast.success('Cycle count submitted successfully');
      setSubmitDialogOpen(false);
      setSelectedCount(null);
      setCountedQuantity(0);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApproveCount = async (countId: string) => {
    try {
      const response = await fetch(`${API_URL}/cycle-counts/${countId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to approve count');

      toast.success('Cycle count approved and stock adjusted');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: 'secondary',
      'in-progress': 'default',
      submitted: 'default',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
  };

  const getVarianceBadge = (variance?: number) => {
    if (variance === undefined || variance === null) return null;
    
    if (variance === 0) {
      return <Badge variant="default" className="bg-green-500">No Variance</Badge>;
    } else if (Math.abs(variance) <= 5) {
      return <Badge variant="default" className="bg-yellow-500">Minor: {variance > 0 ? '+' : ''}{variance}</Badge>;
    } else {
      return <Badge variant="destructive">Major: {variance > 0 ? '+' : ''}{variance}</Badge>;
    }
  };

  const filteredCounts = filterStatus === 'all'
    ? counts
    : counts.filter(c => c.status === filterStatus);

  const stats = {
    total: counts.length,
    pending: counts.filter(c => c.status === 'pending' || c.status === 'in-progress').length,
    submitted: counts.filter(c => c.status === 'submitted').length,
    withVariance: counts.filter(c => c.variance && c.variance !== 0).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cycle Counts</h1>
            <p className="text-gray-600 mt-1">Perform regular inventory cycle counts</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Cycle Count
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Counts</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-blue-500" />
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
              <CardTitle className="text-sm font-medium text-gray-600">Awaiting Approval</CardTitle>
              <CheckCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.submitted}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">With Variance</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.withVariance}</div>
            </CardContent>
          </Card>
        </div>

        {/* Cycle Counts List */}
        <Card>
          <CardHeader>
            <CardTitle>Cycle Count Records</CardTitle>
            <CardDescription>View and manage inventory cycle counts</CardDescription>
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
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Count #</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Counted</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredCounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        No cycle counts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCounts.map((count) => (
                      <TableRow key={count.id}>
                        <TableCell className="font-medium">{count.countNumber}</TableCell>
                        <TableCell>{count.itemName}</TableCell>
                        <TableCell>{count.locationName}</TableCell>
                        <TableCell>{count.expectedQuantity}</TableCell>
                        <TableCell>{count.countedQuantity ?? '-'}</TableCell>
                        <TableCell>{getVarianceBadge(count.variance)}</TableCell>
                        <TableCell>{getStatusBadge(count.status)}</TableCell>
                        <TableCell>{new Date(count.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            {count.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedCount(count);
                                  setCountedQuantity(count.expectedQuantity);
                                  setSubmitDialogOpen(true);
                                }}
                              >
                                Submit Count
                              </Button>
                            )}
                            {count.status === 'submitted' && (
                              <Button
                                size="sm"
                                onClick={() => handleApproveCount(count.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
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

        {/* Create Cycle Count Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Cycle Count</DialogTitle>
              <DialogDescription>Initiate a new inventory cycle count</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Item</Label>
                <Select value={newCount.itemId} onValueChange={(value) => setNewCount({ ...newCount, itemId: value })}>
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
                <Label>Location</Label>
                <Select value={newCount.locationId} onValueChange={(value) => setNewCount({ ...newCount, locationId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCount}>Create Cycle Count</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Submit Count Dialog */}
        {selectedCount && (
          <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Cycle Count</DialogTitle>
                <DialogDescription>
                  {selectedCount.itemName} at {selectedCount.locationName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Expected Quantity</p>
                  <p className="text-2xl font-bold">{selectedCount.expectedQuantity}</p>
                </div>

                <div>
                  <Label>Counted Quantity</Label>
                  <Input
                    type="number"
                    placeholder="Enter counted quantity"
                    value={countedQuantity || ''}
                    onChange={(e) => setCountedQuantity(parseInt(e.target.value) || 0)}
                    autoFocus
                  />
                </div>

                {countedQuantity !== selectedCount.expectedQuantity && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">
                      Variance Detected: {countedQuantity - selectedCount.expectedQuantity > 0 ? '+' : ''}
                      {countedQuantity - selectedCount.expectedQuantity}
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      This count will require manager approval before stock adjustment.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitCount}>Submit Count</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
