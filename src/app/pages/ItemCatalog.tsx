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
import { Alert, AlertDescription } from '../components/ui/alert';
import { Textarea } from '../components/ui/textarea';
import { getItems, createItem, getCategories, getLocations, getStock, searchOnline, uploadProductImage, getRequestorCategorySettings } from '../services/api';
import { AuthService } from '../services/auth';
import { Search, Plus, ShoppingCart, Package, AlertCircle, Globe, Loader2, LayoutGrid, List, Camera, X, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    // Load saved view preference from localStorage
    const saved = localStorage.getItem('itemCatalogView');
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerElementId = 'barcode-scanner';
  const [categoryRestrictions, setCategoryRestrictions] = useState<any>(null);

  const user = AuthService.getCurrentUser();
  const canManage = user?.role === 'admin' || user?.role === 'fulfillment';
  const isRequestor = user?.role === 'requestor';

  useEffect(() => {
    loadData();
    loadCart();
    if (searchParams.get('action') === 'create' && canManage) {
      setCreateDialogOpen(true);
    }
  }, []);

  // Save view mode preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('itemCatalogView', viewMode);
  }, [viewMode]);

  const loadData = async () => {
    try {
      const promises = [
        getItems({ active: true }),
        getCategories(),
        getStock(),
      ];
      
      // Load category restrictions if user is a requestor
      if (isRequestor) {
        promises.push(getRequestorCategorySettings());
      }
      
      const results = await Promise.all(promises);
      const [itemsResult, categoriesResult, stockResult, restrictionsResult] = results;
      
      setItems(itemsResult.items || []);
      
      // Deduplicate categories by ID to prevent React key warnings
      const rawCategories = categoriesResult.categories || [];
      const uniqueCategories = Array.from(
        new Map(rawCategories.map((cat: any) => [cat.id, cat])).values()
      );
      setCategories(uniqueCategories);
      
      setStock(stockResult.stock || []);
      
      if (isRequestor && restrictionsResult) {
        setCategoryRestrictions(restrictionsResult.settings);
      }
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
        unit: item.unitOfMeasure,
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
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.internalCode && item.internalCode.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    // Apply category restrictions for requestors
    let allowedByRole = true;
    if (isRequestor && categoryRestrictions?.enabled) {
      const allowedCategories = categoryRestrictions.allowedCategories || [];
      if (allowedCategories.length > 0) {
        // Find the category object for this item
        const itemCategory = categories.find(cat => cat.name === item.category);
        allowedByRole = itemCategory ? allowedCategories.includes(itemCategory.id) : false;
      }
    }
    
    return matchesSearch && matchesCategory && allowedByRole;
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
      unitOfMeasure: 'each',
      packSize: 1,
      sku: onlineItem.sku || '',
      vendor: onlineItem.brand || '',
      cost: 0,
      reorderThreshold: 10,
      maxPar: 100,
      leadTimeDays: 7,
      imageUrl: onlineItem.imageUrl || '',
    };
    
    setFormData(importedData);
    
    // Small delay to ensure state updates before opening dialog
    setTimeout(() => {
      setCreateDialogOpen(true);
      toast.success('Product information imported - review and save');
    }, 100);
  };

  const startScanner = useCallback(async () => {
    try {
      setScanning(true);
      
      // Create scanner instance if it doesn't exist
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerElementId);
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scannerRef.current.start(
        { facingMode: 'environment' }, // Use back camera
        config,
        (decodedText) => {
          // Successfully scanned
          toast.success('Barcode scanned!');
          setSearchTerm(decodedText);
          stopScanner();
          
          // Optionally trigger online search automatically
          setTimeout(() => {
            handleSearchOnline();
          }, 300);
        },
        (errorMessage) => {
          // Scanning error (usually just "not found"), ignore
        }
      );
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      toast.error('Failed to start camera. Please check permissions.');
      setScannerOpen(false);
      setScanning(false);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setScanning(false);
    setScannerOpen(false);
  }, [scanning]);

  const handleOpenScanner = () => {
    setScannerOpen(true);
    // Start scanner after dialog is open
    setTimeout(() => {
      startScanner();
    }, 100);
  };

  const handleCloseScanner = () => {
    stopScanner();
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'uncategorized',
    unitOfMeasure: 'each',
    packSize: 1,
    sku: '',
    internalCode: '',
    vendor: '',
    cost: 0,
    reorderThreshold: 10,
    maxPar: 100,
    leadTimeDays: 7,
    imageUrl: '',
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
                  unitOfMeasure: 'each',
                  packSize: 1,
                  sku: '',
                  internalCode: '',
                  vendor: '',
                  cost: 0,
                  reorderThreshold: 10,
                  maxPar: 100,
                  leadTimeDays: 7,
                  imageUrl: '',
                });
                setCreateDialogOpen(true);
              }}>
                <Plus className="h-5 w-5 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Category Restriction Notice for Requestors */}
        {isRequestor && categoryRestrictions?.enabled && categoryRestrictions.allowedCategories?.length > 0 && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Limited catalog access:</strong> You can only view and order items from specific categories. 
              If you need access to additional categories, please contact your administrator.
            </AlertDescription>
          </Alert>
        )}

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
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenScanner}
                          className="flex-1"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Scan Barcode
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSearchOnline}
                          disabled={searchingOnline || !searchTerm}
                          className="flex-1"
                        >
                          {searchingOnline ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4 mr-2" />
                              Search Online
                            </>
                          )}
                        </Button>
                      </div>
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
                      {categories
                        .filter((cat) => {
                          // Filter categories for requestors based on restrictions
                          if (isRequestor && categoryRestrictions?.enabled) {
                            const allowedCategories = categoryRestrictions.allowedCategories || [];
                            return allowedCategories.length === 0 || allowedCategories.includes(cat.id);
                          }
                          return true;
                        })
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Barcode Scanner Dialog */}
            <Dialog open={scannerOpen} onOpenChange={handleCloseScanner}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <Camera className="h-5 w-5 mr-2" />
                    Scan Barcode
                  </DialogTitle>
                  <DialogDescription>
                    Point your camera at a barcode (UPC, EAN, Code128, etc.)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div 
                    id={scannerElementId} 
                    className="w-full rounded-lg overflow-hidden bg-black"
                    style={{ minHeight: '300px' }}
                  />
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={handleCloseScanner}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
                  {/* Product Image */}
                  {item.imageUrl ? (
                    <div className="w-full h-48 overflow-hidden rounded-t-lg bg-gray-50">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-t-lg">
                      <Package className="h-16 w-16 text-gray-300" />
                    </div>
                  )}
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
                      <p><strong>Internal Code:</strong> {item.internalCode || 'N/A'}</p>
                      <p><strong>Unit:</strong> {item.unitOfMeasure} ({item.packSize} per pack)</p>
                      <p><strong>Available:</strong> {available} {item.unitOfMeasure}(s)</p>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded">
                                <Package className="h-6 w-6 text-gray-300" />
                              </div>
                            )}
                          </td>
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
                            {available} {item.unitOfMeasure}(s)
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update formData when initialData changes (e.g., when importing from online search)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      // Set preview if image URL exists in initial data
      if (initialData.imageUrl) {
        setPreviewUrl(initialData.imageUrl);
      }
    }
  }, [initialData]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploadingImage(true);
    try {
      const result = await uploadProductImage(file);
      setFormData({ ...formData, imageUrl: result.imageUrl });
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
      setPreviewUrl(''); // Clear preview on error
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, imageUrl: '' });
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, imageUrl: url });
    setPreviewUrl(url);
  };

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
        unitOfMeasure: 'each',
        packSize: 1,
        sku: '',
        internalCode: '',
        vendor: '',
        cost: 0,
        reorderThreshold: 10,
        maxPar: 100,
        leadTimeDays: 7,
        imageUrl: '',
      });
      setPreviewUrl('');
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
            
            {/* Product Image Upload */}
            <div className="col-span-2">
              <Label htmlFor="productImage">Product Image</Label>
              <div className="mt-2 space-y-3">
                {previewUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Product preview"
                      className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                      onError={(e) => {
                        // If image fails to load, show broken image placeholder
                        e.currentTarget.style.display = 'none';
                        toast.error('Failed to load image from URL');
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Image
                        </>
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="productImage"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600 font-medium">Or enter image URL:</p>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      disabled={uploadingImage}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Upload: Maximum file size 5MB. Supported formats: JPEG, PNG, WebP, GIF
                </p>
              </div>
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
                  {categories
                    .filter((cat: any) => cat.active !== false)
                    .map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                placeholder="Manufacturer SKU"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="internalCode">Internal Code</Label>
              <Input
                id="internalCode"
                placeholder="Your internal reference code"
                value={formData.internalCode}
                onChange={(e) => setFormData({ ...formData, internalCode: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
              <Input
                id="unitOfMeasure"
                value={formData.unitOfMeasure}
                onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
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
              <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
              <Input
                id="leadTimeDays"
                type="number"
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
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