import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getItem, getStock, updateItem, deactivateItem, API_URL, getAuthHeaders, getCategories, uploadProductImage } from '../services/api';
import { AuthService } from '../services/auth';
import { Package, MapPin, TrendingDown, Edit, Trash2, ShoppingCart, AlertCircle, PackageCheck, X, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [stock, setStock] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  const user = AuthService.getCurrentUser();
  const canManage = user?.role === 'admin' || user?.role === 'fulfillment';

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    
    try {
      const [itemResult, stockResult, lotsResult, categoriesResult] = await Promise.all([
        getItem(id),
        getStock(id),
        fetch(`${API_URL}/lots/${id}`, { headers: getAuthHeaders() }),
        getCategories(),
      ]);
      setItem(itemResult.item);
      setStock(stockResult.stock || []);
      
      const lotsData = await lotsResult.json();
      setLots(lotsData.lots || []);
      setCategories(categoriesResult.categories || []);
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
        unit: item.unitOfMeasure,
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

  const getDaysUntilExpiration = (expirationDate?: string) => {
    if (!expirationDate) return null;
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
    if (daysUntil === null) return <Badge variant="secondary">No Expiration</Badge>;
    
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
                <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
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
              <p className="text-xs text-gray-500">{item.unitOfMeasure}(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAvailable}</div>
              <p className="text-xs text-gray-500">{item.unitOfMeasure}(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Reserved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReserved}</div>
              <p className="text-xs text-gray-500">{item.unitOfMeasure}(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Reorder Point</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.reorderThreshold}</div>
              <p className="text-xs text-gray-500">{item.unitOfMeasure}(s)</p>
            </CardContent>
          </Card>
        </div>

        {/* Details Tabs */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList>
            <TabsTrigger value="details">Item Details</TabsTrigger>
            <TabsTrigger value="stock">Stock by Location</TabsTrigger>
            <TabsTrigger value="lots">Lots</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Product Image */}
                  {item.imageUrl && (
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-600 mb-2">Product Image</p>
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-64 h-64 object-cover rounded-lg border-2 border-gray-200"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-600">Category</p>
                    <p className="text-gray-900 mt-1">{item.category}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">SKU</p>
                    <p className="text-gray-900 mt-1">{item.sku || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Internal Code</p>
                    <p className="text-gray-900 mt-1">{item.itemNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unit of Measure</p>
                    <p className="text-gray-900 mt-1">{item.unitOfMeasure}</p>
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
                    <p className="text-gray-900 mt-1">{item.leadTimeDays} days</p>
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

          <TabsContent value="lots">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Lot Tracking</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">All lots for this item sorted by expiration (FEFO)</p>
                  </div>
                  {lots.length > 0 && (
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {lots.length} {lots.length === 1 ? 'Lot' : 'Lots'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {lots.length === 0 ? (
                  <div className="text-center py-8">
                    <PackageCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No lots found for this item</p>
                    <p className="text-sm text-gray-400 mt-1">Lots will appear here when inventory is received with lot numbers</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lot Number</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Available</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Received Date</TableHead>
                          <TableHead>Expiration Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lots.map((lot) => (
                          <TableRow key={lot.id}>
                            <TableCell className="font-medium font-mono">{lot.lotNumber}</TableCell>
                            <TableCell>{lot.quantityRemaining || lot.quantity || 0}</TableCell>
                            <TableCell className="font-medium">{lot.available || lot.quantityRemaining || 0}</TableCell>
                            <TableCell>{lot.locationId}</TableCell>
                            <TableCell>
                              {lot.receivedDate 
                                ? new Date(lot.receivedDate).toLocaleDateString() 
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {lot.expirationDate 
                                ? new Date(lot.expirationDate).toLocaleDateString() 
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {getExpirationBadge(lot.expirationDate, lot.status)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Item Dialog */}
      <EditItemDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={item}
        categories={categories}
        onSuccess={() => {
          loadData();
          setEditDialogOpen(false);
        }}
      />
    </DashboardLayout>
  );
}

function EditItemDialog({ open, onOpenChange, item, categories, onSuccess }: any) {
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
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update formData when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || 'uncategorized',
        unitOfMeasure: item.unitOfMeasure || 'each',
        packSize: item.packSize || 1,
        sku: item.sku || '',
        internalCode: item.internalCode || '',
        vendor: item.vendor || '',
        cost: item.cost || 0,
        reorderThreshold: item.reorderThreshold || 10,
        maxPar: item.maxPar || 100,
        leadTimeDays: item.leadTimeDays || 7,
        imageUrl: item.imageUrl || '',
      });
      // Set preview if image URL exists
      if (item.imageUrl) {
        setPreviewUrl(item.imageUrl);
      }
    }
  }, [item]);

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
      await updateItem(item.id, formData);
      toast.success('Item updated successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>Update inventory item information</DialogDescription>
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
                          {previewUrl ? 'Change Image' : 'Upload Image'}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}