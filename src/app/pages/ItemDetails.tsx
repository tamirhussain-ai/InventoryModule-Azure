import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getItem, getStock, updateItem, deactivateItem } from '../services/api';
import { AuthService } from '../services/auth';
import { Package, MapPin, TrendingDown, Edit, Trash2, ShoppingCart, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const user = AuthService.getCurrentUser();
  const canManage = user?.role === 'admin' || user?.role === 'fulfillment';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    
    try {
      const [itemResult, stockResult] = await Promise.all([
        getItem(id),
        getStock(id),
      ]);
      setItem(itemResult.item);
      setStock(stockResult.stock || []);
    } catch (error: any) {
      toast.error('Failed to load item details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!id || !confirm('Are you sure you want to deactivate this item?')) return;

    try {
      await deactivateItem(id);
      toast.success('Item deactivated');
      navigate('/catalog');
    } catch (error: any) {
      toast.error('Failed to deactivate item');
    }
  };

  const addToCart = () => {
    if (!item) return;
    
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find((c: any) => c.itemId === item.id);
    
    let updatedCart;
    if (existingItem) {
      updatedCart = cart.map((c: any) =>
        c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
      );
    } else {
      updatedCart = [...cart, {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: 1,
        locationId: 'main',
      }];
    }
    
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    toast.success('Added to cart');
  };

  const totalAvailable = stock.reduce((sum, s) => sum + (s.available || 0), 0);
  const totalOnHand = stock.reduce((sum, s) => sum + (s.onHand || 0), 0);
  const totalReserved = stock.reduce((sum, s) => sum + (s.reserved || 0), 0);

  const isLowStock = item && totalAvailable <= item.reorderThreshold;
  const isOutOfStock = totalAvailable === 0;

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500">Loading item details...</p>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Item not found</p>
            <Link to="/catalog">
              <Button className="mt-4">Back to Catalog</Button>
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
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{item.name}</h1>
              {!item.active && <Badge variant="destructive">Inactive</Badge>}
              {isOutOfStock && <Badge variant="destructive">Out of Stock</Badge>}
              {isLowStock && !isOutOfStock && (
                <Badge variant="outline" className="border-orange-500 text-orange-700">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Low Stock
                </Badge>
              )}
            </div>
            <p className="text-gray-600">{item.description}</p>
          </div>
          <div className="flex space-x-2">
            {!canManage && (
              <Button onClick={addToCart} disabled={isOutOfStock}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            )}
            {canManage && (
              <>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="destructive" onClick={handleDeactivate}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">On Hand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOnHand}</div>
              <p className="text-xs text-gray-500">{item.unit}(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAvailable}</div>
              <p className="text-xs text-gray-500">{item.unit}(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Reserved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReserved}</div>
              <p className="text-xs text-gray-500">{item.unit}(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Reorder Point</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.reorderThreshold}</div>
              <p className="text-xs text-gray-500">{item.unit}(s)</p>
            </CardContent>
          </Card>
        </div>

        {/* Details Tabs */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList>
            <TabsTrigger value="details">Item Details</TabsTrigger>
            <TabsTrigger value="stock">Stock by Location</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Category</p>
                    <p className="text-gray-900 mt-1">{item.category}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">SKU / Internal Code</p>
                    <p className="text-gray-900 mt-1">{item.sku || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unit of Measure</p>
                    <p className="text-gray-900 mt-1">{item.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pack Size</p>
                    <p className="text-gray-900 mt-1">{item.packSize}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Vendor</p>
                    <p className="text-gray-900 mt-1">{item.vendor || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Cost per Unit</p>
                    <p className="text-gray-900 mt-1">${item.cost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Max Par Level</p>
                    <p className="text-gray-900 mt-1">{item.maxPar}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Lead Time</p>
                    <p className="text-gray-900 mt-1">{item.leadTime} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock">
            <Card>
              <CardContent className="pt-6">
                {stock.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No stock records found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stock.map((s, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Location: {s.locationId}</p>
                            <div className="flex space-x-4 mt-2 text-sm text-gray-600">
                              <span>On Hand: <strong>{s.onHand}</strong></span>
                              <span>Reserved: <strong>{s.reserved}</strong></span>
                              <span>Available: <strong>{s.available}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
