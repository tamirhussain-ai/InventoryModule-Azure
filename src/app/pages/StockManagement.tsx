import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { getStock, getItems, getLocations, adjustStock, API_URL, getAuthHeaders } from '../services/api';
import { Package, Plus, Minus, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export default function StockManagement() {
  const [searchParams] = useSearchParams();
  const [stock, setStock] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
    if (searchParams.get('action') === 'receive') {
      setReceiveDialogOpen(true);
    }
  }, []);

  const loadData = async () => {
    try {
      const [stockResult, itemsResult, locationsResult] = await Promise.all([
        getStock(),
        getItems({ active: true }),
        getLocations(),
      ]);
      
      // Filter out stock records for deleted/inactive items
      const activeItemIds = new Set((itemsResult.items || []).map((item: any) => item.id));
      const filteredStock = (stockResult.stock || []).filter((s: any) => activeItemIds.has(s.itemId));
      
      setStock(filteredStock);
      setItems(itemsResult.items || []);
      setLocations(locationsResult.locations || []);
    } catch (error: any) {
      toast.error('Failed to load stock data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getItemName = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    return item?.name || itemId.slice(0, 8);
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || locationId;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
            <p className="text-gray-600 mt-1">View and manage inventory levels</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setAdjustDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adjust Stock
            </Button>
            <Button onClick={() => setReceiveDialogOpen(true)}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Receive Stock
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Stock Levels</CardTitle>
            <CardDescription>All items across all locations</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading stock data...</p>
            ) : stock.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No stock records found</p>
                <p className="text-sm text-gray-400 mt-1">Start by receiving inventory</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stock.map((s, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <p className="font-medium text-gray-900">{getItemName(s.itemId)}</p>
                          <span className="text-sm text-gray-500">@ {getLocationName(s.locationId)}</span>
                          {s.binCode && (
                            <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              Bin: {s.binCode}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex space-x-6 text-sm">
                          <div>
                            <span className="text-gray-600">On Hand: </span>
                            <strong className="text-gray-900">{s.onHand}</strong>
                          </div>
                          <div>
                            <span className="text-gray-600">Reserved: </span>
                            <strong className="text-gray-900">{s.reserved}</strong>
                          </div>
                          <div>
                            <span className="text-gray-600">Available: </span>
                            <strong className="text-green-600">{s.available}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AdjustStockDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        items={items}
        locations={locations}
        onSuccess={() => {
          loadData();
          setAdjustDialogOpen(false);
        }}
      />

      <ReceiveStockDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        items={items}
        locations={locations}
        onSuccess={() => {
          loadData();
          setReceiveDialogOpen(false);
        }}
      />
    </DashboardLayout>
  );
}

function AdjustStockDialog({ open, onOpenChange, items, locations, onSuccess }: any) {
  const [formData, setFormData] = useState({
    itemId: '',
    locationId: '',
    binId: '',
    quantity: 0,
    reason: '',
    type: 'adjustment',
  });
  const [loading, setLoading] = useState(false);
  const [bins, setBins] = useState<any[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);

  // Load bins when location changes
  useEffect(() => {
    if (formData.locationId && formData.locationId !== 'main') {
      loadBins(formData.locationId);
    } else {
      setBins([]);
      setFormData(prev => ({ ...prev, binId: '' }));
    }
  }, [formData.locationId]);

  const loadBins = async (locationId: string) => {
    setLoadingBins(true);
    try {
      const response = await fetch(`${API_URL}/bins?locationId=${locationId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      setBins(data.bins || []);
    } catch (error) {
      console.error('Error loading bins:', error);
      setBins([]);
    } finally {
      setLoadingBins(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await adjustStock(formData);
      toast.success('Stock adjusted successfully');
      onSuccess();
      setFormData({
        itemId: '',
        locationId: '',
        binId: '',
        quantity: 0,
        reason: '',
        type: 'adjustment',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>Make manual stock adjustments with reason codes</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="item">Item *</Label>
            <Select
              value={formData.itemId}
              onValueChange={(value) => setFormData({ ...formData, itemId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item: any) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">Location *</Label>
            <Select
              value={formData.locationId}
              onValueChange={(value) => setFormData({ ...formData, locationId: value, binId: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Storeroom</SelectItem>
                {locations.map((loc: any) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.locationId && formData.locationId !== 'main' && (
            <div>
              <Label htmlFor="bin">Bin Location (Optional)</Label>
              <Select
                value={formData.binId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, binId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingBins ? "Loading bins..." : "Select bin (or leave empty)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific bin</SelectItem>
                  {bins.filter((bin: any) => bin.active).map((bin: any) => (
                    <SelectItem key={bin.id} value={bin.id}>
                      {bin.binCode} - {Math.round((bin.currentOccupancy / bin.capacity) * 100)}% full
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bins.length === 0 && !loadingBins && (
                <p className="text-sm text-gray-500 mt-1">No bins available for this location</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="quantity">Quantity (+ to add, - to remove) *</Label>
            <Input
              id="quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Adjustment Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                <SelectItem value="damage">Damage / Expired</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Explain the reason for this adjustment..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              required
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveStockDialog({ open, onOpenChange, items, locations, onSuccess }: any) {
  const [formData, setFormData] = useState({
    itemId: '',
    locationId: 'main',
    binId: '',
    quantity: 0,
    reason: 'Purchase order receipt',
    type: 'receive',
  });
  const [loading, setLoading] = useState(false);
  const [bins, setBins] = useState<any[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);

  // Load bins when location changes
  useEffect(() => {
    if (formData.locationId && formData.locationId !== 'main') {
      loadBins(formData.locationId);
    } else {
      setBins([]);
      setFormData(prev => ({ ...prev, binId: '' }));
    }
  }, [formData.locationId]);

  const loadBins = async (locationId: string) => {
    setLoadingBins(true);
    try {
      const response = await fetch(`${API_URL}/bins?locationId=${locationId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      setBins(data.bins || []);
    } catch (error) {
      console.error('Error loading bins:', error);
      setBins([]);
    } finally {
      setLoadingBins(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await adjustStock(formData);
      toast.success('Stock received successfully');
      onSuccess();
      setFormData({
        itemId: '',
        locationId: 'main',
        binId: '',
        quantity: 0,
        reason: 'Purchase order receipt',
        type: 'receive',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to receive stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Stock</DialogTitle>
          <DialogDescription>Add inventory from purchases or deliveries</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="item">Item *</Label>
            <Select
              value={formData.itemId}
              onValueChange={(value) => setFormData({ ...formData, itemId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item: any) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">Receiving Location *</Label>
            <Select
              value={formData.locationId}
              onValueChange={(value) => setFormData({ ...formData, locationId: value, binId: '' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Storeroom</SelectItem>
                {locations.map((loc: any) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.locationId && formData.locationId !== 'main' && (
            <div>
              <Label htmlFor="bin">Bin Location (Optional)</Label>
              <Select
                value={formData.binId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, binId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingBins ? "Loading bins..." : "Select bin (or leave empty)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific bin</SelectItem>
                  {bins.filter((bin: any) => bin.active).map((bin: any) => (
                    <SelectItem key={bin.id} value={bin.id}>
                      {bin.binCode} - {Math.round((bin.currentOccupancy / bin.capacity) * 100)}% full
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bins.length === 0 && !loadingBins && (
                <p className="text-sm text-gray-500 mt-1">No bins available for this location</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="quantity">Quantity Received *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              required
            />
          </div>

          <div>
            <Label htmlFor="reason">Notes / PO Reference</Label>
            <Textarea
              id="reason"
              placeholder="Purchase order #, vendor, or other notes..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Receiving...' : 'Receive Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}