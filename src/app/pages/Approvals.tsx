import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { CheckSquare, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface PendingApproval {
  id: string;
  type: 'order' | 'cycle-count';
  orderNumber?: string;
  countNumber?: string;
  requestedBy: string;
  requestedByName: string;
  department?: string;
  totalAmount?: number;
  variance?: number;
  items: Array<{
    itemName: string;
    quantity: number;
  }>;
  createdAt: string;
  priority: 'low' | 'medium' | 'high';
}

export default function Approvals() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      const response = await fetch(`${API_URL}/approvals/pending`, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      setApprovals(data.pendingApprovals || []);
    } catch (error: any) {
      toast.error('Failed to load pending approvals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedApproval) return;

    try {
      const endpoint = selectedApproval.type === 'order'
        ? `${API_URL}/orders/${selectedApproval.id}/approve`
        : `${API_URL}/cycle-counts/${selectedApproval.id}/approve`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          approved: action === 'approve',
          comments,
        }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} request`);

      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setDialogOpen(false);
      setSelectedApproval(null);
      setComments('');
      loadApprovals();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: any = {
      low: 'secondary',
      medium: 'default',
      high: 'destructive',
    };
    const colors: any = {
      low: 'bg-gray-500',
      medium: 'bg-yellow-500',
      high: 'bg-red-500',
    };
    return (
      <Badge variant={variants[priority]} className={colors[priority]}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge variant="outline">
        {type === 'order' ? 'Order Request' : 'Cycle Count'}
      </Badge>
    );
  };

  const stats = {
    total: approvals.length,
    high: approvals.filter(a => a.priority === 'high').length,
    orders: approvals.filter(a => a.type === 'order').length,
    counts: approvals.filter(a => a.type === 'cycle-count').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve pending requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Pending</CardTitle>
              <CheckSquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">High Priority</CardTitle>
              <Clock className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.high}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Order Requests</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.orders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Cycle Counts</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.counts}</div>
            </CardContent>
          </Card>
        </div>

        {/* Approvals List */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Review requests requiring your approval</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : approvals.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
                <p className="text-gray-600">No pending approvals at this time.</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals.map((approval) => (
                      <TableRow key={approval.id}>
                        <TableCell className="font-medium">
                          {approval.orderNumber || approval.countNumber}
                        </TableCell>
                        <TableCell>{getTypeBadge(approval.type)}</TableCell>
                        <TableCell>{approval.requestedByName}</TableCell>
                        <TableCell>{approval.department || '-'}</TableCell>
                        <TableCell>
                          <span className="text-sm">{approval.items.length} items</span>
                        </TableCell>
                        <TableCell>{getPriorityBadge(approval.priority)}</TableCell>
                        <TableCell>
                          {new Date(approval.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedApproval(approval);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Dialog */}
        {selectedApproval && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Review Request</DialogTitle>
                <DialogDescription>
                  {selectedApproval.type === 'order' ? 'Order Request' : 'Cycle Count'} #{' '}
                  {selectedApproval.orderNumber || selectedApproval.countNumber}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Requested By</p>
                    <p className="font-medium">{selectedApproval.requestedByName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Department</p>
                    <p className="font-medium">{selectedApproval.department || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Priority</p>
                    <div className="mt-1">{getPriorityBadge(selectedApproval.priority)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date Requested</p>
                    <p className="font-medium">
                      {new Date(selectedApproval.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {selectedApproval.totalAmount && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">Total Amount</p>
                    <p className="text-2xl font-bold text-blue-900">
                      ${selectedApproval.totalAmount.toFixed(2)}
                    </p>
                  </div>
                )}

                {selectedApproval.variance !== undefined && (
                  <div className={`p-4 rounded-lg ${
                    selectedApproval.variance === 0 
                      ? 'bg-green-50' 
                      : 'bg-yellow-50'
                  }`}>
                    <p className="text-sm font-medium">
                      Variance: {selectedApproval.variance > 0 ? '+' : ''}
                      {selectedApproval.variance}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                    {selectedApproval.items.map((item, index) => (
                      <div key={index} className="flex justify-between py-2 border-b last:border-0">
                        <span>{item.itemName}</span>
                        <span className="font-medium">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Comments (Optional)</Label>
                  <Textarea
                    placeholder="Add any comments or notes..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setSelectedApproval(null);
                    setComments('');
                  }}
                >
                  Cancel
                </Button>
                <div className="flex space-x-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setAction('reject');
                      handleApproval();
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setAction('approve');
                      handleApproval();
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
