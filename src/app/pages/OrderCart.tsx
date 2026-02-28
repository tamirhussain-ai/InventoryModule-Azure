import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { createOrder } from '../services/api';
import { ShoppingCart, Trash2, Plus, Minus, PackageX } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderCart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<any[]>([]);
  const [orderDetails, setOrderDetails] = useState({
    deliveryPreference: 'delivery',
    deliveryLocation: '',
    neededBy: '',
    department: '',
    costCenter: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCart();
  }, []);

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

  const updateQuantity = (itemId: string, delta: number) => {
    const updatedCart = cart.map(item => {
      if (item.itemId === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    saveCart(updatedCart);
  };

  const removeItem = (itemId: string) => {
    const updatedCart = cart.filter(item => item.itemId !== itemId);
    saveCart(updatedCart);
    toast.success('Item removed from cart');
  };

  const clearCart = () => {
    saveCart([]);
    toast.success('Cart cleared');
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!orderDetails.deliveryLocation) {
      toast.error('Please specify a delivery location');
      return;
    }

    setSubmitting(true);

    try {
      const orderData = {
        ...orderDetails,
        items: cart.map(item => ({
          itemId: item.itemId,
          locationId: item.locationId,
          quantity: item.quantity,
        })),
      };

      const result = await createOrder(orderData);
      toast.success('Order submitted successfully!');
      clearCart();
      navigate(`/orders/${result.order.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
            <p className="text-gray-600 mt-1">Review and submit your order</p>
          </div>
          {cart.length > 0 && (
            <Button variant="outline" onClick={clearCart}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cart
            </Button>
          )}
        </div>

        {cart.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-500 mb-6">Browse the catalog to add items</p>
              <Button onClick={() => navigate('/catalog')}>
                Browse Catalog
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmitOrder}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Items ({cart.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.itemId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                            <p className="text-sm text-gray-500">{item.unit}</p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.itemId, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-12 text-center font-medium">{item.quantity}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.itemId, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.itemId)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Order Details */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Order Details</CardTitle>
                    <CardDescription>Provide delivery and fulfillment information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="deliveryPreference">Delivery Preference *</Label>
                      <Select
                        value={orderDetails.deliveryPreference}
                        onValueChange={(value) => setOrderDetails({ ...orderDetails, deliveryPreference: value })}
                      >
                        <SelectTrigger id="deliveryPreference" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delivery">Delivery</SelectItem>
                          <SelectItem value="pickup">Pickup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="deliveryLocation">
                        {orderDetails.deliveryPreference === 'delivery' ? 'Delivery' : 'Pickup'} Location *
                      </Label>
                      <Input
                        id="deliveryLocation"
                        placeholder="e.g., Room 302, Main Clinic"
                        value={orderDetails.deliveryLocation}
                        onChange={(e) => setOrderDetails({ ...orderDetails, deliveryLocation: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="neededBy">Needed By Date</Label>
                      <Input
                        id="neededBy"
                        type="date"
                        value={orderDetails.neededBy}
                        onChange={(e) => setOrderDetails({ ...orderDetails, neededBy: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        placeholder="e.g., Medical, CAPS, Pharmacy"
                        value={orderDetails.department}
                        onChange={(e) => setOrderDetails({ ...orderDetails, department: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="costCenter">Cost Center</Label>
                      <Input
                        id="costCenter"
                        placeholder="Optional"
                        value={orderDetails.costCenter}
                        onChange={(e) => setOrderDetails({ ...orderDetails, costCenter: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes / Special Instructions</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any special handling or delivery instructions..."
                        value={orderDetails.notes}
                        onChange={(e) => setOrderDetails({ ...orderDetails, notes: e.target.value })}
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Order'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
