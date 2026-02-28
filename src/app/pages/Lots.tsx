import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { PackageCheck, AlertTriangle, Calendar, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface Lot {
  id: string;
  lotNumber: string;
  itemId: string;
  itemName: string;
  quantity: number;
  available: number;
  expirationDate?: string;
  manufacturingDate?: string;
  status: 'active' | 'recalled' | 'expired';
  createdAt: string;
}

export default function Lots() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [expiringReport, setExpiringReport] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsRes, expiringRes] = await Promise.all([
        fetch(`${API_URL}/items`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/reports/expiring?days=30`, { headers: getAuthHeaders() }),
      ]);

      const itemsData = await itemsRes.json();
      const expiringData = await expiringRes.json();

      setItems(itemsData.items || []);
      setExpiringReport(expiringData.expiringLots || []);

      // Load lots for all items
      if (itemsData.items && itemsData.items.length > 0) {
        const allLots: Lot[] = [];
        for (const item of itemsData.items) {
          try {
            const lotsRes = await fetch(`${API_URL}/lots/${item.id}`, {
              headers: getAuthHeaders(),
            });
            const lotsData = await lotsRes.json();
            if (lotsData.lots) {
              allLots.push(...lotsData.lots);
            }
          } catch (err) {
            console.error(`Failed to load lots for item ${item.id}`, err);
          }
        }
        setLots(allLots);
      }
    } catch (error: any) {
      toast.error('Failed to load lot data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecallLot = async (lotId: string) => {
    try {
      const response = await fetch(`${API_URL}/lots/${lotId}/recall`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'Manual recall from UI' }),
      });

      if (!response.ok) throw new Error('Failed to recall lot');

      toast.success('Lot recalled successfully');
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getDaysUntilExpiration = (expirationDate: string) => {
    const now = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpirationBadge = (expirationDate?: string, status?: string) => {
    if (status === 'recalled') {
      return <Badge variant="destructive">RECALLED</Badge>;
    }
    if (status === 'expired') {
      return <Badge variant="destructive">EXPIRED</Badge>;
    }
    if (!expirationDate) {
      return <Badge variant="secondary">No Expiration</Badge>;
    }

    const daysUntil = getDaysUntilExpiration(expirationDate);
    
    if (daysUntil < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (daysUntil <= 7) {
      return <Badge variant="destructive">Expires in {daysUntil}d</Badge>;
    } else if (daysUntil <= 30) {
      return <Badge variant="default" className="bg-yellow-500">Expires in {daysUntil}d</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-500">Good ({daysUntil}d)</Badge>;
    }
  };

  const filteredLots = selectedItem === 'all'
    ? lots
    : lots.filter(lot => lot.itemId === selectedItem);

  const stats = {
    total: lots.length,
    active: lots.filter(l => l.status === 'active').length,
    expiring: expiringReport.length,
    recalled: lots.filter(l => l.status === 'recalled').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lot Management</h1>
          <p className="text-gray-600 mt-1">Track lot numbers and expiration dates with FEFO logic</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/lots')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Lots</CardTitle>
              <PackageCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">{stats.active} active</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/reports')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Expiring Soon</CardTitle>
              <Calendar className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.expiring}</div>
              <p className="text-xs text-gray-500 mt-1">Within 30 days</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/lots')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Recalled</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recalled}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">FEFO Enabled</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium text-green-600">Active</div>
              <p className="text-xs text-gray-500 mt-1">First Expire First Out</p>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Lots Alert */}
        {expiringReport.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center text-yellow-800">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Lots Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringReport.slice(0, 5).map((lot: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-yellow-900">{lot.itemName}</p>
                      <p className="text-sm text-yellow-700">Lot: {lot.lotNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-yellow-900">
                        {getDaysUntilExpiration(lot.expirationDate)} days left
                      </p>
                      <p className="text-xs text-yellow-700">
                        Expires: {new Date(lot.expirationDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lots List */}
        <Card>
          <CardHeader>
            <CardTitle>Lot Inventory</CardTitle>
            <CardDescription>View all lots with expiration tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label>Filter by Item</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} - {item.sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Mfg Date</TableHead>
                    <TableHead>Exp Date</TableHead>
                    <TableHead>Status</TableHead>
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
                  ) : filteredLots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        No lots found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell className="font-medium font-mono">{lot.lotNumber}</TableCell>
                        <TableCell>{lot.itemName}</TableCell>
                        <TableCell>{lot.quantity}</TableCell>
                        <TableCell className="font-medium">{lot.available}</TableCell>
                        <TableCell>
                          {lot.manufacturingDate
                            ? new Date(lot.manufacturingDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {lot.expirationDate
                            ? new Date(lot.expirationDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>{getExpirationBadge(lot.expirationDate, lot.status)}</TableCell>
                        <TableCell className="text-right">
                          {lot.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRecallLot(lot.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Recall
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
      </div>
    </DashboardLayout>
  );
}