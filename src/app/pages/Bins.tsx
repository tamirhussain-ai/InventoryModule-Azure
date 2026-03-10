import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Grid3x3, Plus, MapPin, Box, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, getAuthHeaders } from '../services/api';

interface Bin {
  id: string;
  binCode: string;
  locationId: string;
  locationName: string;
  aisle: string;
  rack: string;
  shelf: string;
  capacity: number;
  currentOccupancy: number;
  active: boolean;
  createdAt: string;
}

export default function Bins() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>('all');

  const [newBin, setNewBin] = useState({
    locationId: '',
    aisle: '',
    rack: '',
    shelf: '',
    capacity: 100,
  });

  const [editBin, setEditBin] = useState({
    locationId: '',
    aisle: '',
    rack: '',
    shelf: '',
    capacity: 100,
    active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [binsRes, locationsRes] = await Promise.all([
        fetch(`${API_URL}/bins`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/locations`, { headers: getAuthHeaders() }),
      ]);

      const binsData = await binsRes.json();
      const locationsData = await locationsRes.json();

      setBins(binsData.bins || []);
      setLocations(locationsData.locations || []);
    } catch (error: any) {
      toast.error('Failed to load bins');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBin = async () => {
    try {
      if (!newBin.locationId || !newBin.aisle || !newBin.rack || !newBin.shelf) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await fetch(`${API_URL}/bins`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newBin),
      });

      if (!response.ok) throw new Error('Failed to create bin');

      toast.success('Bin created successfully');
      setDialogOpen(false);
      setNewBin({ locationId: '', aisle: '', rack: '', shelf: '', capacity: 100 });
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditBin = (bin: Bin) => {
    setSelectedBin(bin);
    setEditBin({
      locationId: bin.locationId,
      aisle: bin.aisle,
      rack: bin.rack,
      shelf: bin.shelf,
      capacity: bin.capacity,
      active: bin.active,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateBin = async () => {
    if (!selectedBin) return;

    try {
      if (!editBin.locationId || !editBin.aisle || !editBin.rack || !editBin.shelf) {
        toast.error('Please fill all required fields');
        return;
      }

      const response = await fetch(`${API_URL}/bins/${selectedBin.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editBin),
      });

      if (!response.ok) throw new Error('Failed to update bin');

      toast.success('Bin updated successfully');
      setEditDialogOpen(false);
      setSelectedBin(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredBins = filterLocation === 'all'
    ? bins
    : bins.filter(bin => bin.locationId === filterLocation);

  const getOccupancyColor = (occupancy: number, capacity: number) => {
    const percentage = (occupancy / capacity) * 100;
    if (percentage >= 90) return 'text-red-600 font-medium';
    if (percentage >= 70) return 'text-yellow-600 font-medium';
    return 'text-green-600';
  };

  const stats = {
    total: bins.length,
    active: bins.filter(b => b.active).length,
    nearCapacity: bins.filter(b => (b.currentOccupancy / b.capacity) >= 0.9).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
            <p className="text-gray-600 mt-1">Manage warehouse locations and storage bins</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Bin
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Bins</CardTitle>
              <Grid3x3 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">{stats.active} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Locations</CardTitle>
              <MapPin className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{locations.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Near Capacity</CardTitle>
              <Box className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.nearCapacity}</div>
              <p className="text-xs text-gray-500 mt-1">≥90% full</p>
            </CardContent>
          </Card>
        </div>

        {/* Bins List */}
        <Card>
          <CardHeader>
            <CardTitle>Bin Directory</CardTitle>
            <CardDescription>View and manage storage bins</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label>Filter by Location</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bin Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Aisle</TableHead>
                    <TableHead>Rack</TableHead>
                    <TableHead>Shelf</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredBins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        No bins found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBins.map((bin) => (
                      <TableRow key={bin.id}>
                        <TableCell className="font-medium font-mono">{bin.binCode}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {bin.locationName}
                          </div>
                        </TableCell>
                        <TableCell>{bin.aisle}</TableCell>
                        <TableCell>{bin.rack}</TableCell>
                        <TableCell>{bin.shelf}</TableCell>
                        <TableCell>
                          <span className={getOccupancyColor(bin.currentOccupancy, bin.capacity)}>
                            {bin.currentOccupancy}
                          </span>
                        </TableCell>
                        <TableCell>{bin.capacity}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${bin.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {bin.active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditBin(bin)}
                          >
                            <Pencil className="h-4 w-4" />
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

        {/* Create Bin Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Bin</DialogTitle>
              <DialogDescription>Add a new storage bin location</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Location *</Label>
                <Select value={newBin.locationId} onValueChange={(value) => setNewBin({ ...newBin, locationId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Aisle *</Label>
                  <Input
                    placeholder="A1"
                    value={newBin.aisle}
                    onChange={(e) => setNewBin({ ...newBin, aisle: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Rack *</Label>
                  <Input
                    placeholder="R01"
                    value={newBin.rack}
                    onChange={(e) => setNewBin({ ...newBin, rack: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Shelf *</Label>
                  <Input
                    placeholder="S1"
                    value={newBin.shelf}
                    onChange={(e) => setNewBin({ ...newBin, shelf: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Capacity (units)</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={newBin.capacity}
                  onChange={(e) => setNewBin({ ...newBin, capacity: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  Bin code will be auto-generated: <span className="font-mono font-bold">
                    {newBin.aisle && newBin.rack && newBin.shelf
                      ? `${newBin.aisle}-${newBin.rack}-${newBin.shelf}`
                      : 'XX-XX-XX'}
                  </span>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBin}>Create Bin</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Bin Dialog */}
        {selectedBin && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Bin</DialogTitle>
                <DialogDescription>Update bin location details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Bin Code: <span className="font-mono font-bold">{selectedBin.binCode}</span>
                  </p>
                </div>

                <div>
                  <Label>Location *</Label>
                  <Select value={editBin.locationId} onValueChange={(value) => setEditBin({ ...editBin, locationId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Aisle *</Label>
                    <Input
                      placeholder="A1"
                      value={editBin.aisle}
                      onChange={(e) => setEditBin({ ...editBin, aisle: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Rack *</Label>
                    <Input
                      placeholder="R01"
                      value={editBin.rack}
                      onChange={(e) => setEditBin({ ...editBin, rack: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Shelf *</Label>
                    <Input
                      placeholder="S1"
                      value={editBin.shelf}
                      onChange={(e) => setEditBin({ ...editBin, shelf: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Capacity (units)</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={editBin.capacity}
                    onChange={(e) => setEditBin({ ...editBin, capacity: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={editBin.active ? 'active' : 'inactive'} onValueChange={(value) => setEditBin({ ...editBin, active: value === 'active' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    New bin code will be: <span className="font-mono font-bold">
                      {editBin.aisle && editBin.rack && editBin.shelf
                        ? `${editBin.aisle}-${editBin.rack}-${editBin.shelf}`
                        : 'XX-XX-XX'}
                    </span>
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateBin}>Update Bin</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}