import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { getItems, createItem, getCategories, getLocations, getStock, searchOnline } from '../services/api';
import { AuthService } from '../services/auth';
import { Search, Plus, ShoppingCart, Package, AlertCircle, Globe, Loader2, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';

export default function ItemCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [onlineResults, setOnlineResults] = useState<any[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [showOnlineResults, setShowOnlineResults] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const user = AuthService.getCurrentUser();
  const canManage = user?.role === 'admin' || user?.role === 'fulfillment';

  useEffect(() => {
    loadData();
    loadCart();
    if (searchParams.get('action') === 'create' && canManage) {
      setCreateDialogOpen(true);
    }
  }, []);

  const loadData = async () => {
    try {
      const [itemsResult, categoriesResult, stockResult] = await Promise.all([
        getItems({ active: true }),
        getCategories(),
        getStock(),
      ]);
      setItems(itemsResult.items || []);
      setCategories(categoriesResult.categories || []);
      setStock(stockResult.stock || []);
    } catch (error: any) {
      toast.error('Failed to load catalog');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const saveCart = (updatedCart: any[]) => {
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    setCart(updatedCart);
  };

  const addToCart = (item: any, quantity: number = 1) => {
    const existingItem = cart.find(c => c.itemId === item.id);
    let updatedCart;
    
    if (existingItem) {
      updatedCart = cart.map(c =>
        c.itemId === item.id
          ? { ...c, quantity: c.quantity + quantity }
          : c
      );
    } else {
      updatedCart = [...cart, {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity,
        locationId: 'main',
      }];
    }
    
    saveCart(updatedCart);
    toast.success(`${item.name} added to cart`);
  };

  const getItemStock = (itemId: string) => {
    const itemStock = stock.filter(s => s.itemId === itemId);
    const totalAvailable = itemStock.reduce((sum, s) => sum + (s.available || 0), 0);
    return totalAvailable;
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleSearchOnline = async () => {
    if (!searchTerm || searchTerm.trim() === '') {
      toast.error('Please enter a SKU to search');
      return;
    }

    setSearchingOnline(true);
    setOnlineResults([]);
    
    try {
      const result = await searchOnline(searchTerm.trim());
      setOnlineResults(result.results || []);
      setShowOnlineResults(true);
      
      if (result.results && result.results.length > 0) {
        toast.success(result.message || `Found ${result.results.length} product(s) online`);
      } else {
        toast.info(result.message || 'No products found online for this SKU');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to search online');
      console.error(error);
    } finally {
      setSearchingOnline(false);
    }
  };

  const importOnlineItem = (onlineItem: any) => {
    // First close the online results
    setShowOnlineResults(false);
    
    // Update the form data
    const importedData = {
      name: onlineItem.name || '',
      description: onlineItem.description || '',
      category: onlineItem.category || 'uncategorized',
      unit: 'each',
      packSize: 1,
      sku: onlineItem.sku || '',
      vendor: onlineItem.brand || '',
      cost: 0,
      reorderThreshold: 10,
      maxPar: 100,
      leadTime: 7,
    };
    
    setFormData(importedData);
    
    // Small delay to ensure state updates before opening dialog
    setTimeout(() => {
      setCreateDialogOpen(true);
      toast.success('Product information imported - review and save');
    }, 100);
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'uncategorized',
    unit: 'each',
    packSize: 1,
    sku: '',
    vendor: '',
    cost: 0,
    reorderThreshold: 10,
    maxPar: 100,
    leadTime: 7,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Item Catalog</h1>
            <p className="text-gray-600 mt-1">Browse and search available inventory</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" className="relative" asChild>
              <Link to="/cart">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Cart
                {cart.length > 0 && (
                  <Badge className="ml-2">{cart.length}</Badge>
                )}
              </Link>
            </Button>
            {canManage && (
              <Button onClick={() => {
                // Reset form data before opening
                setFormData({
                  name: '',
                  description: '',
                  category: 'uncategorized',
                  unit: 'each',
                  packSize: 1,
                  sku: '',
                  vendor: '',
                  cost: 0,
                  reorderThreshold: 10,
                  maxPar: 100,
                  leadTime: 7,
                });
                setCreateDialogOpen(true);
              }}>
                <Plus className="h-5 w-5 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Filters</h3>
                <div className="flex items-center gap-1 border rounded-lg p-1">
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('grid')}
                    className="h-8 px-3"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('list')}
                    className="h-8 px-3"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="search">Search</Label>
                  <div className="space-y-2 mt-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder="Search by name, description, or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSearchOnline}
                        disabled={searchingOnline || !searchTerm}
                        className="w-full"
                      >
                        {searchingOnline ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Searching Online...
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            Search Online (SKU/UPC/EAN/Barcode)
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Online Search Results */}
        {showOnlineResults && onlineResults.length > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center">
                    <Globe className="h-5 w-5 mr-2 text-blue-600" />
                    Online Search Results
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Found {onlineResults.length} product(s) matching "{searchTerm}"
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOnlineResults(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {onlineResults.map((result, index) => (
                  <Card key={index} className="bg-white">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{result.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {result.source}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.imageUrl && (
                        <img
                          src={result.imageUrl}
                          alt={result.name}
                          className="w-full h-32 object-contain rounded"
                        />
                      )}
                      {result.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                      <div className="space-y-1 text-xs text-gray-700">
                        <p><strong>SKU:</strong> {result.sku}</p>
                        {result.brand && <p><strong>Brand:</strong> {result.brand}</p>}
                        {result.category && <p><strong>Category:</strong> {result.category}</p>}
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => importOnlineItem(result)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Import to Catalog
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items Display */}
        {loading ? (
          <p className="text-gray-500">Loading items...</p>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No items found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const available = getItemStock(item.id);
              const isLowStock = available <= item.reorderThreshold;
              const isOutOfStock = available === 0;

              return (
                <Card key={item.id} className={isOutOfStock ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{item.category}</Badge>
                      {isOutOfStock ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : isLowStock ? (
                        <Badge variant="outline" className="border-orange-500 text-orange-700">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Low Stock
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                    <div className="space-y-1 text-sm text-gray-700">
                      <p><strong>SKU:</strong> {item.sku || 'N/A'}</p>
                      <p><strong>Unit:</strong> {item.unit} ({item.packSize} per pack)</p>
                      <p><strong>Available:</strong> {available} {item.unit}(s)</p>
                      {item.vendor && <p><strong>Vendor:</strong> {item.vendor}</p>}
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        className="w-full"
                        onClick={() => addToCart(item)}
                        disabled={isOutOfStock}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Add to Cart
                      </Button>
                      <Button variant="outline" className="w-full" asChild>
                        <Link to={`/items/${item.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredItems.map((item) => {
                      const available = getItemStock(item.id);
                      const isLowStock = available <= item.reorderThreshold;
                      const isOutOfStock = available === 0;

                      return (
                        <tr key={item.id} className={isOutOfStock ? 'opacity-60' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">{item.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.sku || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="secondary">{item.category}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {available} {item.unit}(s)
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isOutOfStock ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : isLowStock ? (
                              <Badge variant="outline" className="border-orange-500 text-orange-700">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-500 text-green-700">In Stock</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <Button
                              size="sm"
                              onClick={() => addToCart(item)}
                              disabled={isOutOfStock}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/items/${item.id}`}>
                                Details
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Item Dialog */}
      <CreateItemDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        categories={categories}
        onSuccess={() => {
          loadData();
          setCreateDialogOpen(false);
        }}
        initialData={formData}
        onDataChange={setFormData}
      />
    </DashboardLayout>
  );
}

function CreateItemDialog({ open, onOpenChange, categories, onSuccess, initialData, onDataChange }: any) {
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Update formData when initialData changes (e.g., when importing from online search)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createItem(formData);
      toast.success('Item created successfully');
      onSuccess();
      setFormData({
        name: '',
        description: '',
        category: 'uncategorized',
        unit: 'each',
        packSize: 1,
        sku: '',
        vendor: '',
        cost: 0,
        reorderThreshold: 10,
        maxPar: 100,
        leadTime: 7,
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
          <DialogDescription>Create a new inventory item</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sku">SKU / Internal Code</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit of Measure</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="packSize">Pack Size</Label>
              <Input
                id="packSize"
                type="number"
                value={formData.packSize}
                onChange={(e) => setFormData({ ...formData, packSize: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cost">Cost per Unit</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="reorderThreshold">Reorder Threshold</Label>
              <Input
                id="reorderThreshold"
                type="number"
                value={formData.reorderThreshold}
                onChange={(e) => setFormData({ ...formData, reorderThreshold: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="maxPar">Max Par Level</Label>
              <Input
                id="maxPar"
                type="number"
                value={formData.maxPar}
                onChange={(e) => setFormData({ ...formData, maxPar: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="leadTime">Lead Time (days)</Label>
              <Input
                id="leadTime"
                type="number"
                value={formData.leadTime}
                onChange={(e) => setFormData({ ...formData, leadTime: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}