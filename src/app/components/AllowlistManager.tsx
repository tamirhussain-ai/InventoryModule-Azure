import { useState, useEffect } from 'react';
import { getAllowedUsers, addAllowedUser, removeAllowedUser, AllowedUser, AppRole } from '../../lib/authContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { UserPlus, Trash2, Upload, Users, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_COLORS: Record<AppRole, string> = {
  admin:       'bg-red-100 text-red-700',
  approver:    'bg-purple-100 text-purple-700',
  fulfillment: 'bg-blue-100 text-blue-700',
  requestor:   'bg-green-100 text-green-700',
};

export default function AllowlistManager() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('requestor');
  const [department, setDepartment] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [search, setSearch] = useState('');

  const reload = () => setUsers(getAllowedUsers());

  useEffect(() => { reload(); }, []);

  const handleAdd = () => {
    if (!email.trim()) { toast.error('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Please enter a valid email address'); return;
    }
    addAllowedUser({ email: email.trim().toLowerCase(), role, department: department || undefined, addedAt: new Date().toISOString() });
    toast.success(`${email.trim()} added to allowlist`);
    setEmail(''); setRole('requestor'); setDepartment('');
    setDialogOpen(false);
    reload();
  };

  const handleRemove = (emailToRemove: string) => {
    removeAllowedUser(emailToRemove);
    toast.success(`${emailToRemove} removed`);
    reload();
  };

  const handleBulkImport = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    let added = 0;
    for (const line of lines) {
      // Support: email, email role, email role department
      const parts = line.split(/[\s,]+/);
      const emailPart = parts[0];
      const rolePart = (parts[1] as AppRole) || 'requestor';
      const deptPart = parts[2] || undefined;
      const validRoles: AppRole[] = ['admin', 'fulfillment', 'requestor', 'approver'];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPart)) continue;
      addAllowedUser({
        email: emailPart.toLowerCase(),
        role: validRoles.includes(rolePart) ? rolePart : 'requestor',
        department: deptPart,
        addedAt: new Date().toISOString(),
      });
      added++;
    }
    toast.success(`${added} user${added !== 1 ? 's' : ''} imported`);
    setBulkText('');
    setBulkDialogOpen(false);
    reload();
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-base">Access Control</CardTitle>
              <CardDescription>Only pre-registered emails can sign in</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Bulk Import
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Add User
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by email or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-sm text-gray-500 ml-auto flex items-center gap-1">
            <Users className="h-4 w-4" /> {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        </div>

        {users.length === 0 && (
          <Alert>
            <AlertDescription>
              No users on the allowlist yet. Add at least one admin email to get started.
            </AlertDescription>
          </Alert>
        )}

        <div className="divide-y rounded-lg border overflow-hidden">
          {filtered.map(u => (
            <div key={u.email} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                {u.department && <p className="text-xs text-gray-500">{u.department}</p>}
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                  {u.role}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-red-600"
                  onClick={() => handleRemove(u.email)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && users.length > 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No results for "{search}"</p>
          )}
        </div>
      </CardContent>

      {/* Add User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Allowed User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>University Email *</Label>
              <Input
                placeholder="name@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={v => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="requestor">Requestor</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                  <SelectItem value="fulfillment">Fulfillment</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Nursing, Radiology"
                value={department}
                onChange={e => setDepartment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Users</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              One entry per line. Format: <code className="bg-gray-100 px-1 rounded">email role department</code>
            </p>
            <div className="bg-gray-50 rounded p-3 text-xs text-gray-500 font-mono space-y-1">
              <p>jane@university.edu requestor Nursing</p>
              <p>bob@university.edu approver Radiology</p>
              <p>alice@university.edu fulfillment</p>
            </div>
            <p className="text-xs text-gray-400">Role defaults to "requestor" if not specified. Valid roles: admin, approver, fulfillment, requestor</p>
            <textarea
              className="w-full border rounded-md p-3 text-sm font-mono min-h-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@university.edu role department"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={!bulkText.trim()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
