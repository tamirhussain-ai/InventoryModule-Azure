import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { getUsers, getCategories, getLocations, createCategory, createLocation, updateCategory, updateLocation, createUser, updateUser } from '../services/api';
import { Users, Tag, MapPin, Plus, Pencil, UserCog, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { AuthService } from '../services/auth';
import { Alert, AlertDescription } from '../components/ui/alert';

export default function AdminSettings() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  const defaultTab = searchParams.get('tab') || 'users';

  // Get current user and check for impersonation
  const currentUser = AuthService.getCurrentUser();
  const isImpersonating = localStorage.getItem('impersonatedRole') !== null;
  const actualRole = localStorage.getItem('actualRole') || currentUser?.role;
  const displayRole = currentUser?.role;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResult, categoriesResult, locationsResult] = await Promise.all([
        getUsers(),
        getCategories(),
        getLocations(),
      ]);
      setUsers(usersResult.users || []);
      setCategories(categoriesResult.categories || []);
      setLocations(locationsResult.locations || []);
    } catch (error: any) {
      toast.error('Failed to load settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">Manage users, categories, locations, and configuration</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            {actualRole === 'admin' && <TabsTrigger value="impersonate">Role Impersonation</TabsTrigger>}
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      System Users
                    </CardTitle>
                    <CardDescription>View and manage user accounts and roles</CardDescription>
                  </div>
                  <Button onClick={() => setUserDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading users...</p>
                ) : users.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No users found</p>
                    <Button className="mt-4" onClick={() => setUserDialogOpen(true)}>
                      Add First User
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div key={user.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <Badge variant={
                                user.role === 'admin' ? 'default' :
                                user.role === 'fulfillment' ? 'secondary' :
                                user.role === 'approver' ? 'outline' :
                                'secondary'
                              }>
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                            {user.department && (
                              <p className="text-sm text-gray-500">Department: {user.department}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right text-sm text-gray-500">
                              <p>Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingUser(user);
                                setUserDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Tag className="h-5 w-5 mr-2" />
                      Item Categories
                    </CardTitle>
                    <CardDescription>Manage inventory categories</CardDescription>
                  </div>
                  <Button onClick={() => setCategoryDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading categories...</p>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8">
                    <Tag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No categories defined</p>
                    <Button className="mt-4" onClick={() => setCategoryDialogOpen(true)}>
                      Create First Category
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map((category) => (
                      <div key={category.id} className="border rounded-lg p-4 flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{category.name}</p>
                          {category.description && (
                            <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(category);
                            setCategoryDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <MapPin className="h-5 w-5 mr-2" />
                      Storage Locations
                    </CardTitle>
                    <CardDescription>Manage inventory storage locations</CardDescription>
                  </div>
                  <Button onClick={() => setLocationDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-gray-500">Loading locations...</p>
                ) : locations.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No locations defined</p>
                    <Button className="mt-4" onClick={() => setLocationDialogOpen(true)}>
                      Create First Location
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {locations.map((location) => (
                      <div key={location.id} className="border rounded-lg p-4 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-medium text-gray-900">{location.name}</p>
                            <Badge variant="outline">{location.type}</Badge>
                          </div>
                          {location.description && (
                            <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingLocation(location);
                            setLocationDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {actualRole === 'admin' && (
            <TabsContent value="impersonate">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <UserCog className="h-5 w-5 mr-2" />
                    Role Impersonation
                  </CardTitle>
                  <CardDescription>
                    Test the system from different role perspectives. Switch between roles to see what users with different permissions can access.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isImpersonating && displayRole && (
                    <Alert className="bg-orange-50 border-orange-200">
                      <UserCog className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <div className="flex items-center justify-between">
                          <span>
                            <strong>Currently impersonating:</strong> {displayRole.charAt(0).toUpperCase() + displayRole.slice(1)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              localStorage.removeItem('impersonatedRole');
                              localStorage.removeItem('actualRole');
                              toast.success('Stopped impersonating. Returning to Admin view.');
                              window.location.reload();
                            }}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Stop Impersonating
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Select a Role to Test</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <RoleCard
                        title="Fulfillment Staff"
                        description="Manage inventory operations, fulfill orders, process receiving, and execute cycle counts."
                        badge="fulfillment"
                        onImpersonate={() => impersonateRole('fulfillment')}
                        isActive={displayRole === 'fulfillment'}
                      />
                      
                      <RoleCard
                        title="Approver"
                        description="Review and approve/reject internal requests, monitor fulfillment status, and place own requests."
                        badge="approver"
                        onImpersonate={() => impersonateRole('approver')}
                        isActive={displayRole === 'approver'}
                      />
                      
                      <RoleCard
                        title="Requestor"
                        description="Browse catalog, submit inventory requests, track request status, and receive items."
                        badge="requestor"
                        onImpersonate={() => impersonateRole('requestor')}
                        isActive={displayRole === 'requestor'}
                      />
                      
                      <RoleCard
                        title="Admin (Current)"
                        description="Full system access including configuration, user management, and all operational functions."
                        badge="admin"
                        onImpersonate={() => {
                          if (isImpersonating) {
                            localStorage.removeItem('impersonatedRole');
                            localStorage.removeItem('actualRole');
                            toast.success('Returned to Admin view.');
                            window.location.reload();
                          }
                        }}
                        isActive={!isImpersonating}
                        isCurrent={true}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">How it works:</h4>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Click on any role card to switch to that role's view</li>
                      <li>Navigate through the system to test different permissions and workflows</li>
                      <li>The navigation menu and available features will update based on the selected role</li>
                      <li>Click "Stop Impersonating" or return to Admin to exit impersonation mode</li>
                      <li>Impersonation state persists until you manually stop or log out</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSuccess={() => {
          loadData();
          setCategoryDialogOpen(false);
        }}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
      />

      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        onSuccess={() => {
          loadData();
          setLocationDialogOpen(false);
        }}
        editingLocation={editingLocation}
        setEditingLocation={setEditingLocation}
      />

      <UserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        onSuccess={() => {
          loadData();
          setUserDialogOpen(false);
        }}
        editingUser={editingUser}
        setEditingUser={setEditingUser}
      />
    </DashboardLayout>
  );
}

function CategoryDialog({ open, onOpenChange, onSuccess, editingCategory, setEditingCategory }: any) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || '',
        description: editingCategory.description || '',
      });
    } else {
      setFormData({ name: '', description: '' });
    }
  }, [editingCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData.name, formData.description);
        toast.success('Category updated successfully');
      } else {
        await createCategory(formData.name, formData.description);
        toast.success('Category created successfully');
      }
      onSuccess();
      setFormData({ name: '', description: '' });
      setEditingCategory(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>{editingCategory ? 'Update an existing item category' : 'Create a new item category'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Category Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Medical Supplies, Pharmaceuticals"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (editingCategory ? 'Updating...' : 'Creating...') : (editingCategory ? 'Update Category' : 'Create Category')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LocationDialog({ open, onOpenChange, onSuccess, editingLocation, setEditingLocation }: any) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'storeroom',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingLocation) {
      setFormData({
        name: editingLocation.name || '',
        type: editingLocation.type || 'storeroom',
        description: editingLocation.description || '',
      });
    } else {
      setFormData({ name: '', type: 'storeroom', description: '' });
    }
  }, [editingLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, formData.name, formData.type, formData.description);
        toast.success('Location updated successfully');
      } else {
        await createLocation(formData.name, formData.type, formData.description);
        toast.success('Location created successfully');
      }
      onSuccess();
      setFormData({ name: '', type: 'storeroom', description: '' });
      setEditingLocation(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingLocation(null);
      setFormData({ name: '', type: 'storeroom', description: '' });
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
          <DialogDescription>{editingLocation ? 'Update an existing storage location' : 'Create a new storage location'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Location Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Main Storeroom, Clinic Closet"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Input
              id="type"
              placeholder="e.g., storeroom, clinic, pharmacy"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (editingLocation ? 'Updating...' : 'Creating...') : (editingLocation ? 'Update Location' : 'Create Location')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserDialog({ open, onOpenChange, onSuccess, editingUser, setEditingUser }: any) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'fulfillment',
    department: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setFormData({
        name: editingUser.name || '',
        email: editingUser.email || '',
        role: editingUser.role || 'fulfillment',
        department: editingUser.department || '',
      });
    } else {
      setFormData({ name: '', email: '', role: 'fulfillment', department: '' });
    }
  }, [editingUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
        });
        toast.success('User updated successfully');
      } else {
        await createUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
        });
        toast.success('User created successfully');
      }
      onSuccess();
      setFormData({ name: '', email: '', role: 'fulfillment', department: '' });
      setEditingUser(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingUser(null);
      setFormData({ name: '', email: '', role: 'fulfillment', department: '' });
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          <DialogDescription>{editingUser ? 'Update an existing user account' : 'Create a new user account'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              placeholder="e.g., john.doe@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue>{formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="fulfillment">Fulfillment</SelectItem>
                <SelectItem value="approver">Approver</SelectItem>
                <SelectItem value="requestor">Requestor</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.role === 'admin' && 'Full system access and configuration'}
              {formData.role === 'fulfillment' && 'Manage inventory, fulfill orders, and process receiving'}
              {formData.role === 'approver' && 'Review and approve orders, place orders'}
              {formData.role === 'requestor' && 'Browse catalog and place orders only'}
            </p>
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="e.g., IT, HR"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (editingUser ? 'Updating...' : 'Creating...') : (editingUser ? 'Update User' : 'Create User')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to impersonate a role
function impersonateRole(role: string) {
  const currentUser = AuthService.getCurrentUser();
  if (!currentUser) return;

  // Store actual role if not already impersonating
  if (!localStorage.getItem('actualRole')) {
    localStorage.setItem('actualRole', currentUser.role);
  }

  // Store the impersonated role
  localStorage.setItem('impersonatedRole', role);

  // Update the user object with new role
  const impersonatedUser = { ...currentUser, role };
  localStorage.setItem('user', JSON.stringify(impersonatedUser));

  toast.success(`Now viewing as ${role.charAt(0).toUpperCase() + role.slice(1)}`);
  
  // Reload to apply changes
  window.location.href = getRoleDashboard(role);
}

// Helper function to get dashboard for role
function getRoleDashboard(role: string): string {
  switch (role) {
    case 'fulfillment':
      return '/fulfillment';
    case 'approver':
      return '/approver';
    case 'requestor':
      return '/requestor';
    case 'admin':
    default:
      return '/admin';
  }
}

// Role Card Component
function RoleCard({ title, description, badge, onImpersonate, isActive, isCurrent = false }: any) {
  return (
    <div className={`border rounded-lg p-4 transition-all ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:border-gray-400'}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <Badge variant={
          badge === 'admin' ? 'default' :
          badge === 'fulfillment' ? 'secondary' :
          badge === 'approver' ? 'outline' :
          'secondary'
        }>
          {badge.charAt(0).toUpperCase() + badge.slice(1)}
        </Badge>
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <Button
        onClick={onImpersonate}
        variant={isActive ? 'default' : 'outline'}
        size="sm"
        className="w-full"
        disabled={isActive && !isCurrent}
      >
        {isActive && !isCurrent ? 'Current View' : isCurrent && !isActive ? 'Return to Admin' : 'Switch to this Role'}
      </Button>
    </div>
  );
}