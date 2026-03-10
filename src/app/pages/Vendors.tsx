import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Building2, Plus, Mail, Phone, MapPin, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  active: boolean;
  createdAt: string;
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkVendorNames, setBulkVendorNames] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const [newVendor, setNewVendor] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
  });

  const [editVendor, setEditVendor] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const response = await fetch(`${API_URL}/vendors`, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      setVendors(data.vendors || []);
    } catch (error: any) {
      toast.error('Failed to load vendors');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVendor = async () => {
    try {
      if (!newVendor.name || !newVendor.contactPerson || !newVendor.email) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await fetch(`${API_URL}/vendors`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newVendor),
      });

      if (!response.ok) throw new Error('Failed to create vendor');

      toast.success('Vendor created successfully');
      setDialogOpen(false);
      setNewVendor({ name: '', contactPerson: '', email: '', phone: '', address: '' });
      loadVendors();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBulkCreateVendor = async () => {
    try {
      if (!bulkVendorNames) {
        toast.error('Please enter vendor names');
        return;
      }

      setBulkLoading(true);

      const vendorNames = bulkVendorNames.split('\n').map(name => name.trim()).filter(name => name);
      const promises = vendorNames.map(name => {
        return fetch(`${API_URL}/vendors`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name }),
        });
      });

      const responses = await Promise.all(promises);
      const successfulResponses = responses.filter(response => response.ok);

      if (successfulResponses.length > 0) {
        toast.success(`${successfulResponses.length} vendors created successfully`);
      }

      if (responses.length - successfulResponses.length > 0) {
        toast.error(`${responses.length - successfulResponses.length} vendors failed to create`);
      }

      setBulkDialogOpen(false);
      setBulkVendorNames('');
      setBulkLoading(false);
      loadVendors();
    } catch (error: any) {
      toast.error(error.message);
      setBulkLoading(false);
    }
  };

  const handleEditClick = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setEditVendor({
      name: vendor.name,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdateVendor = async () => {
    try {
      if (!selectedVendor) return;
      
      if (!editVendor.name) {
        toast.error('Vendor name is required');
        return;
      }

      const response = await fetch(`${API_URL}/vendors/${selectedVendor.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editVendor.name,
          contactName: editVendor.contactPerson,
          email: editVendor.email,
          phone: editVendor.phone,
          address: editVendor.address,
        }),
      });

      if (!response.ok) throw new Error('Failed to update vendor');

      toast.success('Vendor updated successfully');
      setEditDialogOpen(false);
      setSelectedVendor(null);
      setEditVendor({ name: '', contactPerson: '', email: '', phone: '', address: '' });
      loadVendors();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeVendors = vendors.filter(v => v.active).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
            <p className="text-gray-600 mt-1">Manage supplier and vendor information</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Bulk Add
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Vendors</CardTitle>
              <Building2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendors.length}</div>
              <p className="text-xs text-gray-500 mt-1">{activeVendors} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Search Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search by name, contact, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Vendors List */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Directory</CardTitle>
            <CardDescription>View all registered vendors and suppliers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No vendors found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                            {vendor.name}
                          </div>
                        </TableCell>
                        <TableCell>{vendor.contactPerson}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {vendor.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {vendor.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {vendor.address}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${vendor.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {vendor.active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(vendor)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Create Vendor Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
              <DialogDescription>Register a new supplier or vendor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vendor Name *</Label>
                <Input
                  placeholder="Enter vendor name"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Contact Person *</Label>
                <Input
                  placeholder="Enter contact person name"
                  value={newVendor.contactPerson}
                  onChange={(e) => setNewVendor({ ...newVendor, contactPerson: e.target.value })}
                />
              </div>

              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="vendor@example.com"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                />
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                />
              </div>

              <div>
                <Label>Address</Label>
                <Textarea
                  placeholder="Enter vendor address"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVendor}>Add Vendor</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Create Vendor Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Add Vendors</DialogTitle>
              <DialogDescription>Register multiple suppliers or vendors at once. Contact person and email can be updated later.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Vendor Names (one per line) *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const vendorList = `MCKESSON
SHORELAND
ProOptics
Graston Technique
Guy Brown
HP PRODUCTS
ZIMMER
DOC SVCS
TABCO
LPS
Pharmex
LABSCO
FOOD STORES
MIDWEST
FISHER
NIKON
EVERGREEN
PSS
STAPLES
CVHP
DOCUMENT SVC
PRINT
ORTHO DEPOT
DJ ORTHO
SAMMONS PRESTON
TRI-HAWK
ALIMED
OPTP
PERFORMANCE HEALTH - MEDCO SPORTS MEDICINE
RBJ ATHLETICS`;
                      setBulkVendorNames(vendorList);
                    }}
                  >
                    Load Sample List
                  </Button>
                </div>
                <Textarea
                  placeholder="Enter vendor names, one per line"
                  value={bulkVendorNames}
                  onChange={(e) => setBulkVendorNames(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tip: You can paste a list of vendor names here. Contact details can be added later by clicking on each vendor.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkCreateVendor} disabled={bulkLoading}>
                {bulkLoading ? 'Adding...' : 'Add Vendors'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Vendor Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
              <DialogDescription>Update vendor information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vendor Name *</Label>
                <Input
                  placeholder="Enter vendor name"
                  value={editVendor.name}
                  onChange={(e) => setEditVendor({ ...editVendor, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Contact Person *</Label>
                <Input
                  placeholder="Enter contact person name"
                  value={editVendor.contactPerson}
                  onChange={(e) => setEditVendor({ ...editVendor, contactPerson: e.target.value })}
                />
              </div>

              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="vendor@example.com"
                  value={editVendor.email}
                  onChange={(e) => setEditVendor({ ...editVendor, email: e.target.value })}
                />
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={editVendor.phone}
                  onChange={(e) => setEditVendor({ ...editVendor, phone: e.target.value })}
                />
              </div>

              <div>
                <Label>Address</Label>
                <Textarea
                  placeholder="Enter vendor address"
                  value={editVendor.address}
                  onChange={(e) => setEditVendor({ ...editVendor, address: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateVendor}>Update Vendor</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}