import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CSVUpload } from '../components/CSVUpload';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { getUsers, getCategories, getLocations, createCategory, createLocation, updateCategory, updateLocation, createUser, updateUser, deleteUser, getEmailSettings, updateEmailSettings, getEmailPreferences, updateEmailPreferences, getRequestorCategorySettings, updateRequestorCategorySettings, getAppSettings, updateAppSettings, purgeInactiveItems, getEmailTemplates, updateEmailTemplate, resetEmailTemplate, getEmailTemplatePreview, getWorkflowSettings, updateWorkflowSettings, forcePasswordReset, getSecuritySettings, updateSecuritySettings } from '../services/api';
import { Users, Tag, MapPin, Plus, Pencil, UserCog, LogOut, Mail, Shield, Settings, Trash2, AlertTriangle, GitBranch, CheckCircle2, Clock, Eye, EyeOff, Copy, KeyRound, RotateCcw, Lock, Timer } from 'lucide-react';
import AllowlistManager from '../components/AllowlistManager';
import { toast } from 'sonner';
import { AuthService } from '../services/auth';
import { Alert, AlertDescription } from '../components/ui/alert';

export default function AdminSettings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [emailSettings, setEmailSettings] = useState<any>(null);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [categoryRestrictions, setCategoryRestrictions] = useState<any>(null);
  const [updatingRestrictions, setUpdatingRestrictions] = useState(false);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [updatingAppSettings, setUpdatingAppSettings] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [updatingTemplate, setUpdatingTemplate] = useState(false);
  const [workflowSettings, setWorkflowSettings] = useState<any>(null);
  const [updatingWorkflow, setUpdatingWorkflow] = useState(false);

  // Security / password expiry settings
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [updatingSecuritySettings, setUpdatingSecuritySettings] = useState(false);

  // Delete user dialog state
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Force-reset password dialog state
  const [forceResetDialogOpen, setForceResetDialogOpen] = useState(false);
  const [forceResetUser, setForceResetUser] = useState<any>(null);
  const [forceResetTempPassword, setForceResetTempPassword] = useState('');
  const [showForceResetPassword, setShowForceResetPassword] = useState(false);
  const [forceResetLoading, setForceResetLoading] = useState(false);
  const [forceResetCredentials, setForceResetCredentials] = useState<{ email: string; password: string } | null>(null);

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
      const promises = [
        getUsers(),
        getCategories(),
        getLocations(),
        getEmailSettings(),
        getRequestorCategorySettings(),
        getAppSettings(),
        getEmailTemplates(),
        getWorkflowSettings(),
        getSecuritySettings(),
      ];
      const [usersResult, categoriesResult, locationsResult, emailSettingsResult, categoryRestrictionsResult, appSettingsResult, emailTemplatesResult, workflowSettingsResult, securitySettingsResult] = await Promise.all(promises);
      // Deduplicate all collections by ID to prevent duplicate-key warnings
      const rawUsers = usersResult.users || [];
      const uniqueUsers = Array.from(
        new Map(rawUsers.map((u: any) => [u.id, u])).values()
      );
      setUsers(uniqueUsers);

      const rawCategories = categoriesResult.categories || [];
      const uniqueCategories = Array.from(
        new Map(rawCategories.map((cat: any) => [cat.id, cat])).values()
      );
      setCategories(uniqueCategories);

      const rawLocations = locationsResult.locations || [];
      const uniqueLocations = Array.from(
        new Map(rawLocations.map((loc: any) => [loc.id, loc])).values()
      );
      setLocations(uniqueLocations);
      setEmailSettings(emailSettingsResult.settings || { enabled: false });
      setCategoryRestrictions(categoryRestrictionsResult.settings || { enabled: false, allowedCategories: [] });
      setAppSettings(appSettingsResult.settings || { theme: 'light' });
      setEmailTemplates(emailTemplatesResult.templates || {});
      setWorkflowSettings(workflowSettingsResult.settings || { approvalRequired: true });
      setSecuritySettings(securitySettingsResult.settings || { passwordExpiryEnabled: false, passwordExpiryDays: 365 });
    } catch (error: any) {
      toast.error('Failed to load settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleForcePasswordReset = async () => {
    if (!forceResetUser) return;
    setForceResetLoading(true);
    try {
      const result = await forcePasswordReset(forceResetUser.id, forceResetTempPassword || undefined);
      setForceResetCredentials({
        email: forceResetUser.email,
        password: result.tempPassword,
      });
      // Update the local user list to reflect mustResetPassword=true
      setUsers((prev) => prev.map((u) =>
        u.id === forceResetUser.id ? { ...u, mustResetPassword: true } : u
      ));
      toast.success(`Password reset for ${forceResetUser.name}. Share the temporary credentials with them.`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
      console.error('Force password reset error:', error);
    } finally {
      setForceResetLoading(false);
    }
  };

  const handleCloseForceResetDialog = () => {
    setForceResetDialogOpen(false);
    setForceResetUser(null);
    setForceResetTempPassword('');
    setShowForceResetPassword(false);
    setForceResetCredentials(null);
  };

  const handleToggleEmailNotifications = async (enabled: boolean) => {
    setUpdatingEmail(true);
    try {
      await updateEmailSettings(enabled);
      setEmailSettings({ ...emailSettings, enabled });
      toast.success(`Email notifications ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error('Failed to update email settings');
      console.error(error);
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleToggleCategoryRestrictions = async (enabled: boolean) => {
    setUpdatingRestrictions(true);
    try {
      await updateRequestorCategorySettings(categoryRestrictions?.allowedCategories || [], enabled);
      setCategoryRestrictions({ ...categoryRestrictions, enabled });
      toast.success(`Category restrictions ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error('Failed to update category restrictions');
      console.error(error);
    } finally {
      setUpdatingRestrictions(false);
    }
  };

  const handleUpdateAllowedCategories = async (categoryId: string, allowed: boolean) => {
    setUpdatingRestrictions(true);
    try {
      const currentAllowed = categoryRestrictions?.allowedCategories || [];
      let newAllowed;
      
      if (allowed) {
        // Add category to allowed list
        newAllowed = [...currentAllowed, categoryId];
      } else {
        // Remove category from allowed list
        newAllowed = currentAllowed.filter((id: string) => id !== categoryId);
      }
      
      await updateRequestorCategorySettings(newAllowed, categoryRestrictions?.enabled || false);
      setCategoryRestrictions({ ...categoryRestrictions, allowedCategories: newAllowed });
      toast.success('Category access updated');
    } catch (error: any) {
      toast.error('Failed to update category access');
      console.error(error);
    } finally {
      setUpdatingRestrictions(false);
    }
  };

  const handleUpdateAppSettings = async (newAppName: string) => {
    setUpdatingAppSettings(true);
    try {
      await updateAppSettings(newAppName);
      setAppSettings({ ...appSettings, appName: newAppName });
      toast.success('App settings updated');
    } catch (error: any) {
      toast.error('Failed to update app settings');
      console.error(error);
    } finally {
      setUpdatingAppSettings(false);
    }
  };

  const handleToggleApprovalWorkflow = async (enabled: boolean) => {
    setUpdatingWorkflow(true);
    try {
      await updateWorkflowSettings({ approvalRequired: enabled });
      setWorkflowSettings({ ...workflowSettings, approvalRequired: enabled });
      toast.success(`Order approval ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error('Failed to update workflow settings');
      console.error(error);
    } finally {
      setUpdatingWorkflow(false);
    }
  };

  const handlePurgeInactiveItems = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete all inactive items and their stock records from the database. This action cannot be undone.\n\nAre you sure you want to continue?')) {
      return;
    }

    const [purging, setPurging] = [true, () => {}];
    try {
      const result = await purgeInactiveItems();
      toast.success(`Successfully purged ${result.deletedCount} inactive items and their stock records`);
      loadData(); // Refresh the data
    } catch (error: any) {
      toast.error(error.message || 'Failed to purge inactive items');
      console.error(error);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser || !deletingUser.id) {
      toast.error('Cannot delete: user ID is missing.');
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteUser(deletingUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      toast.success(`User "${deletingUser.name}" has been permanently deleted.`);
      setDeleteUserDialogOpen(false);
      setDeletingUser(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
      console.error('Delete user error:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUpdateSecuritySettings = async (updates: { passwordExpiryEnabled?: boolean; passwordExpiryDays?: number }) => {
    setUpdatingSecuritySettings(true);
    try {
      const merged = { ...securitySettings, ...updates };
      const result = await updateSecuritySettings({
        passwordExpiryEnabled: merged.passwordExpiryEnabled,
        passwordExpiryDays: merged.passwordExpiryDays,
      });
      setSecuritySettings(result.settings);
      toast.success('Security settings updated');
    } catch (error: any) {
      toast.error('Failed to update security settings');
      console.error(error);
    } finally {
      setUpdatingSecuritySettings(false);
    }
  };

  const handleEditTemplate = async (templateType: string) => {
    try {
      // Fetch the template preview (default or custom)
      const response = await getEmailTemplatePreview(templateType);
      const template = response.template;
      
      setEditingTemplate({
        type: templateType,
        subject: template.subject || '',
        htmlBody: template.htmlBody || '',
        textBody: template.textBody || '',
        isCustom: template.isCustom,
      });
      setTemplateDialogOpen(true);
    } catch (error: any) {
      toast.error('Failed to load template');
      console.error(error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    
    setUpdatingTemplate(true);
    try {
      await updateEmailTemplate(
        editingTemplate.type,
        editingTemplate.subject,
        editingTemplate.htmlBody,
        editingTemplate.textBody
      );
      toast.success('Email template updated successfully');
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      loadData(); // Refresh templates
    } catch (error: any) {
      toast.error('Failed to update email template');
      console.error(error);
    } finally {
      setUpdatingTemplate(false);
    }
  };

  const handleResetTemplate = async (templateType: string) => {
    if (!confirm('Are you sure you want to reset this template to the default? This action cannot be undone.')) {
      return;
    }
    
    try {
      await resetEmailTemplate(templateType);
      toast.success('Email template reset to default');
      loadData(); // Refresh templates
    } catch (error: any) {
      toast.error('Failed to reset email template');
      console.error(error);
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
          <TabsList key="tabs-list">
            <TabsTrigger key="general" value="general">General</TabsTrigger>
            <TabsTrigger key="users" value="users">Users</TabsTrigger>
            <TabsTrigger key="categories" value="categories">Categories</TabsTrigger>
            <TabsTrigger key="locations" value="locations">Locations</TabsTrigger>
            <TabsTrigger key="permissions" value="permissions">Requestor Permissions</TabsTrigger>
            <TabsTrigger key="email" value="email">Email Notifications</TabsTrigger>
            <TabsTrigger key="security" value="security">Security</TabsTrigger>
            {actualRole === 'admin' && <TabsTrigger key="csv-upload" value="csv-upload">CSV Upload</TabsTrigger>}
            {actualRole === 'admin' && <TabsTrigger key="impersonate" value="impersonate">Role Impersonation</TabsTrigger>}
            {actualRole === 'admin' && <TabsTrigger key="access-control" value="access-control">Access Control</TabsTrigger>}
          </TabsList>

          <TabsContent key="general" value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Configure general application settings and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <Label htmlFor="appName" className="text-base font-semibold">Application Name</Label>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      Customize the name that appears in the header and throughout the application
                    </p>
                    <div className="flex items-center space-x-3">
                      <Input
                        id="appName"
                        placeholder="SHC Inventory"
                        value={appSettings?.appName || 'SHC Inventory'}
                        onChange={(e) => setAppSettings({ ...appSettings, appName: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => handleUpdateAppSettings(appSettings?.appName || 'SHC Inventory')}
                        disabled={updatingAppSettings}
                      >
                        {updatingAppSettings ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 About Application Name</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>The application name appears in the header/navigation bar</li>
                      <li>Changes take effect immediately after saving</li>
                      <li>This helps brand the system for your organization</li>
                      <li>Default name is "SHC Inventory" if left blank</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <GitBranch className="h-5 w-5 mr-2" />
                    Order Workflow Configuration
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Configure the steps in your order fulfillment process. Disable optional steps to streamline your workflow.
                  </p>
                  
                  <div className="space-y-4">
                    {/* Step 1: Order Placed - Always On */}
                    <Card className="border-2 border-blue-200 bg-blue-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="bg-blue-600 rounded-full p-2">
                              <CheckCircle2 className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-blue-900">Step 1: Order Placed</h4>
                              <p className="text-sm text-blue-700">User submits an order request</p>
                            </div>
                          </div>
                          <Badge className="bg-blue-600">Always On</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Step 2: Order Approval - Optional */}
                    <Card className={`border-2 ${workflowSettings?.approvalRequired ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`rounded-full p-2 ${workflowSettings?.approvalRequired ? 'bg-green-600' : 'bg-gray-400'}`}>
                              <Clock className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h4 className={`font-semibold ${workflowSettings?.approvalRequired ? 'text-green-900' : 'text-gray-700'}`}>
                                Step 2: Order Approval
                              </h4>
                              <p className={`text-sm ${workflowSettings?.approvalRequired ? 'text-green-700' : 'text-gray-600'}`}>
                                {workflowSettings?.approvalRequired 
                                  ? 'Approver reviews and approves the order' 
                                  : 'Orders skip approval and go directly to fulfillment'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Switch
                              checked={workflowSettings?.approvalRequired !== false}
                              onCheckedChange={handleToggleApprovalWorkflow}
                              disabled={updatingWorkflow}
                            />
                            <Badge className={workflowSettings?.approvalRequired ? 'bg-green-600' : 'bg-gray-400'}>
                              {workflowSettings?.approvalRequired ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Step 3: Order Fulfillment - Always On */}
                    <Card className="border-2 border-purple-200 bg-purple-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="bg-purple-600 rounded-full p-2">
                              <CheckCircle2 className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-purple-900">Step 3: Order Fulfillment</h4>
                              <p className="text-sm text-purple-700">Fulfillment team picks and delivers the order</p>
                            </div>
                          </div>
                          <Badge className="bg-purple-600">Always On</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Workflow Configuration Tips</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li><strong>Approval Enabled:</strong> Orders require approval before fulfillment (recommended for most organizations)</li>
                      <li><strong>Approval Disabled:</strong> Orders go directly to fulfillment after submission (faster for trusted requestors)</li>
                      <li>This setting only affects <strong>new orders</strong> - existing orders in the approval queue remain unchanged</li>
                      <li>When approval is disabled, fulfillment teams receive immediate notifications</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4">Database Maintenance</h3>
                  <div className="border rounded-lg p-4 bg-red-50 border-red-200">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <Label className="text-base font-semibold text-red-900">Purge Deleted Items</Label>
                        <p className="text-sm text-red-800 mt-1 mb-3">
                          Permanently remove all inactive/deleted items and their associated stock records from the database. This will clean up items that were previously deactivated but are still taking up storage space.
                        </p>
                        <Button
                          variant="destructive"
                          onClick={handlePurgeInactiveItems}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Purge Inactive Items
                        </Button>
                        <div className="mt-3 bg-red-100 border border-red-300 rounded p-3">
                          <p className="text-xs text-red-900 font-medium">⚠️ Warning: This action cannot be undone!</p>
                          <ul className="text-xs text-red-800 mt-2 space-y-1 list-disc list-inside">
                            <li>All inactive items will be permanently deleted</li>
                            <li>All associated stock records will be removed</li>
                            <li>Historical orders referencing these items will remain intact</li>
                            <li>This will free up database storage space</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent key="users" value="users">
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
                    {users.map((user, index) => (
                      <div key={user.id ?? `user-${index}`} className="border rounded-lg p-4">
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
                                {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
                              </Badge>
                              {user.active === false && (
                                <Badge variant="destructive">Inactive</Badge>
                              )}
                              {user.mustResetPassword && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                                  <KeyRound className="h-3 w-3 mr-1" />
                                  Temp Password
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                            {user.department && (
                              <p className="text-sm text-gray-500">Department: {user.department}</p>
                            )}
                            {/* Show password age when expiry policy is active */}
                            {securitySettings?.passwordExpiryEnabled && securitySettings?.passwordExpiryDays > 0 && (() => {
                              const lastChanged = user.passwordLastChanged || user.createdAt;
                              if (!lastChanged) return null;
                              const days = Math.floor((Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24));
                              const limit = securitySettings.passwordExpiryDays;
                              const remaining = limit - days;
                              const expired = remaining <= 0;
                              const nearExpiry = remaining > 0 && remaining <= 14;
                              if (!expired && !nearExpiry) return null;
                              return (
                                <span className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${expired ? 'text-red-600' : 'text-amber-600'}`}>
                                  <Timer className="h-3 w-3" />
                                  {expired ? `Password expired ${Math.abs(remaining)} day${Math.abs(remaining) !== 1 ? 's' : ''} ago` : `Password expires in ${remaining} day${remaining !== 1 ? 's' : ''}`}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-right text-sm text-gray-500 mr-2">
                              <p>Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Force password reset"
                              onClick={() => {
                                setForceResetUser(user);
                                setForceResetTempPassword('');
                                setForceResetCredentials(null);
                                setForceResetDialogOpen(true);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 text-amber-600" />
                            </Button>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete user"
                              onClick={() => {
                                setDeletingUser(user);
                                setDeleteUserDialogOpen(true);
                              }}
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
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

          <TabsContent key="categories" value="categories">
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
                    {categories.map((category, index) => (
                      <div key={category.id ?? `cat-${index}`} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{category.name}</p>
                              <Badge variant={category.active === false ? 'secondary' : 'outline'}>
                                {category.active === false ? 'Inactive' : 'Active'}
                              </Badge>
                            </div>
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
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent key="locations" value="locations">
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
                    {locations.map((location, index) => (
                      <div key={location.id ?? `loc-${index}`} className="border rounded-lg p-4 flex items-start justify-between">
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

          <TabsContent key="permissions" value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Requestor Permissions
                </CardTitle>
                <CardDescription>
                  Control which categories requestors can order from. By default, all categories are accessible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Enable Category Restrictions</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        When enabled, only selected categories will be available for requestors to order from.
                        When disabled, requestors can order from all categories.
                      </p>
                    </div>
                    <Switch
                      checked={categoryRestrictions?.enabled || false}
                      onCheckedChange={handleToggleCategoryRestrictions}
                      disabled={updatingRestrictions}
                    />
                  </div>

                  {categoryRestrictions?.enabled && (
                    <Alert className="bg-orange-50 border-orange-200">
                      <Shield className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <strong>Category restrictions are active.</strong> Only categories checked below are accessible to requestors.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!categoryRestrictions?.enabled && (
                    <Alert className="bg-green-50 border-green-200">
                      <Shield className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>All categories are accessible.</strong> Requestors can order from any category in the system.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Available Categories</h3>
                  {loading ? (
                    <p className="text-gray-500">Loading categories...</p>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-8">
                      <Tag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No categories defined yet</p>
                      <Button className="mt-4" variant="outline" onClick={() => window.location.href = '/settings?tab=categories'}>
                        Create Categories
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {categories.map((category, index) => {
                        const isAllowed = !categoryRestrictions?.enabled || 
                          (categoryRestrictions?.allowedCategories || []).includes(category.id);
                        
                        return (
                          <div 
                            key={category.id ?? `perm-cat-${index}`} 
                            className={`border rounded-lg p-4 transition-colors ${
                              categoryRestrictions?.enabled && !isAllowed ? 'bg-gray-50 opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <p className="font-medium text-gray-900">{category.name}</p>
                                  {categoryRestrictions?.enabled && (
                                    <Badge variant={isAllowed ? 'default' : 'secondary'}>
                                      {isAllowed ? 'Accessible' : 'Restricted'}
                                    </Badge>
                                  )}
                                </div>
                                {category.description && (
                                  <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-3">
                                <Switch
                                  checked={isAllowed}
                                  onCheckedChange={(checked) => handleUpdateAllowedCategories(category.id, checked)}
                                  disabled={!categoryRestrictions?.enabled || updatingRestrictions}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">💡 How it works</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>When restrictions are disabled, all categories are visible to requestors</li>
                    <li>Enable restrictions to limit which categories requestors can see and order from</li>
                    <li>Toggle individual categories on/off to control access</li>
                    <li>Other roles (Admin, Fulfillment, Approver) can always see all categories</li>
                    <li>Changes take effect immediately for all requestor users</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent key="email" value="email">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Configure email notifications for order events. Users can customize their individual preferences in their profile settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Enable Email Notifications</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Master switch for all email notifications. When disabled, no emails will be sent regardless of user preferences.
                      </p>
                    </div>
                    <Switch
                      checked={emailSettings?.enabled || false}
                      onCheckedChange={handleToggleEmailNotifications}
                      disabled={updatingEmail}
                    />
                  </div>

                  {emailSettings?.enabled && (
                    <Alert className="bg-blue-50 border-blue-200">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <strong>Email notifications are enabled.</strong> Users will receive emails based on their individual preferences.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Diagnostics Link */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-purple-900 mb-1">🔍 Email System Diagnostics</h4>
                        <p className="text-sm text-purple-700">
                          Having trouble receiving emails? Run diagnostics to check your configuration.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-300 text-purple-700 hover:bg-purple-100"
                        onClick={() => navigate('/email-diagnostics')}
                      >
                        Run Diagnostics
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Configuration Instructions</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">📧 Email Provider Setup</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        This system uses <strong>Resend</strong> for sending emails. To enable email notifications:
                      </p>
                      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside ml-2">
                        <li>Sign up for a free account at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">resend.com</a> (3,000 emails/month free)</li>
                        <li>Get your API key from the Resend dashboard</li>
                        <li>The RESEND_API_KEY environment variable should already be configured in your Supabase environment</li>
                        <li>Toggle the switch above to enable notifications</li>
                      </ol>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">📬 Notification Types</h4>
                      <p className="text-sm text-gray-600 mb-2">Users will receive emails for:</p>
                      <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside ml-2">
                        <li><strong>Order Submitted:</strong> Approvers receive notification when new order requires approval</li>
                        <li><strong>Order Approved:</strong> Requestor receives notification when their order is approved</li>
                        <li><strong>Order Denied:</strong> Requestor receives notification when their order is denied</li>
                        <li><strong>Order Fulfilled:</strong> Requestor receives notification when their order is ready for pickup</li>
                      </ul>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">⚙️ User Preferences</h4>
                      <p className="text-sm text-gray-600">
                        Each user can customize which emails they want to receive by editing their profile in the Users tab. 
                        Click the edit button next to any user to manage their email address and notification preferences.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Email Templates Section */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Email Templates</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Customize the email templates sent to users. Use placeholders like {`{{orderId}}`}, {`{{requestorName}}`}, etc.
                  </p>
                  <div className="space-y-3">
                    {[
                      { type: 'submitted', label: 'Order Submitted (to Approver)', icon: '📬' },
                      { type: 'submitted_confirmation', label: 'Order Confirmation (to Requestor)', icon: '✅' },
                      { type: 'submitted_direct', label: 'Order Submitted Direct (to Fulfillment, No Approval)', icon: '📦' },
                      { type: 'approved', label: 'Order Approved (to Requestor)', icon: '👍' },
                      { type: 'denied', label: 'Order Denied (to Requestor)', icon: '❌' },
                      { type: 'fulfilled', label: 'Order Fulfilled (to Requestor)', icon: '🎉' },
                    ].map(({ type, label, icon }) => (
                      <div key={type} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{icon} {label}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {emailTemplates?.[type] ? 
                              <Badge variant="secondary" className="bg-green-100 text-green-800">Custom Template</Badge> : 
                              <Badge variant="outline">Default Template</Badge>
                            }
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTemplate(type)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          {emailTemplates?.[type] && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetTemplate(type)}
                              className="text-gray-600"
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <h4 className="font-medium text-blue-900 mb-2">📝 Available Placeholders</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                      <div><code className="bg-blue-100 px-1 rounded">{`{{orderId}}`}</code> - Order ID</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{orderDate}}`}</code> - Order date</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{requestorName}}`}</code> - Requestor name</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{requestorEmail}}`}</code> - Requestor email</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{approverName}}`}</code> - Approver name</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{notes}}`}</code> - Notes/comments</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{itemsList}}`}</code> - Items (text)</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{itemsListHtml}}`}</code> - Items (HTML)</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{baseUrl}}`}</code> - App base URL</div>
                      <div><code className="bg-blue-100 px-1 rounded">{`{{today}}`}</code> - Current date</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent key="security" value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="h-5 w-5 mr-2" />
                  Security Policy
                </CardTitle>
                <CardDescription>
                  Configure organization-wide security policies including password expiry requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Password Expiry */}
                <div className="border rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Timer className="h-4 w-4 text-blue-600" />
                        Password Expiry Policy
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Require users to change their password after a set number of days. Users will be prompted to update their password on their next login once their password expires.
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings?.passwordExpiryEnabled || false}
                      onCheckedChange={(enabled) => handleUpdateSecuritySettings({ passwordExpiryEnabled: enabled })}
                      disabled={updatingSecuritySettings}
                    />
                  </div>

                  {securitySettings?.passwordExpiryEnabled && (
                    <div className="pt-4 border-t space-y-3">
                      <Label htmlFor="expiryDays" className="text-sm font-medium text-gray-700">
                        Password expires after (days)
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="expiryDays"
                          type="number"
                          min={1}
                          max={9999}
                          value={securitySettings?.passwordExpiryDays ?? 365}
                          onChange={(e) =>
                            setSecuritySettings({ ...securitySettings, passwordExpiryDays: Math.max(1, parseInt(e.target.value) || 365) })
                          }
                          className="w-32"
                        />
                        <span className="text-sm text-gray-500">days</span>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateSecuritySettings({ passwordExpiryDays: securitySettings?.passwordExpiryDays ?? 365 })}
                          disabled={updatingSecuritySettings}
                        >
                          {updatingSecuritySettings ? 'Saving…' : 'Save'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {[30, 90, 180, 365, 730, 0].map((days) => (
                          <Button
                            key={days}
                            variant={securitySettings?.passwordExpiryDays === days ? 'default' : 'outline'}
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              if (days === 0) return;
                              setSecuritySettings({ ...securitySettings, passwordExpiryDays: days });
                              handleUpdateSecuritySettings({ passwordExpiryDays: days });
                            }}
                          >
                            {days === 30 ? '30 days' : days === 90 ? '90 days' : days === 180 ? '6 months' : days === 365 ? '1 year' : days === 730 ? '2 years' : 'Custom'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">💡 How Password Expiry Works</h4>
                  <ul className="text-sm text-blue-800 space-y-1.5 list-disc list-inside">
                    <li>When enabled, the expiry timer starts from when the user last changed their password (or their account creation date if they've never changed it)</li>
                    <li>Expired users are redirected to the Change Password screen immediately after logging in</li>
                    <li>Admins using "Force Password Reset" also resets the expiry clock</li>
                    <li>This policy applies to all roles — Admin, Fulfillment, Approver, and Requestor</li>
                    <li>Disabling the policy does <strong>not</strong> change or clear existing password dates</li>
                  </ul>
                </div>

                {/* Danger Zone: individual user deletion reminder */}
                <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-1 flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Account Deletion
                  </h4>
                  <p className="text-sm text-red-800">
                    To permanently delete a user account, go to the <strong>Users</strong> tab and click the{' '}
                    <Trash2 className="inline h-3 w-3" /> delete icon next to the user. Deletion removes the account from
                    both the KV store and Supabase Auth and cannot be undone.
                  </p>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {actualRole === 'admin' && (
            <TabsContent key="csv-upload" value="csv-upload">
              <CSVUpload onUploadComplete={loadData} />
            </TabsContent>
          )}

          {actualRole === 'admin' && (
            <TabsContent key="impersonate" value="impersonate">
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
                            <strong>Currently impersonating:</strong> {displayRole ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1) : 'Unknown'}
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

          {actualRole === 'admin' && (
            <TabsContent key="access-control" value="access-control">
              <AllowlistManager />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Email Template Edit Dialog — rendered outside <Tabs> to avoid Radix UI key warnings */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>
              Customize the email template. Use placeholders like {`{{orderId}}`} to insert dynamic content.
              {editingTemplate?.isCustom === false && (
                <span className="block mt-2 text-blue-600 font-medium">
                  📋 Currently showing default template - edit and save to create your custom version
                </span>
              )}
              {editingTemplate?.isCustom === true && (
                <span className="block mt-2 text-green-600 font-medium">
                  ✏️ Currently editing your custom template
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder={`e.g., Order #{{orderId}} Submitted`}
                />
              </div>
              <div>
                <Label htmlFor="htmlBody">HTML Body</Label>
                <Textarea
                  id="htmlBody"
                  value={editingTemplate.htmlBody}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, htmlBody: e.target.value })}
                  placeholder="HTML template..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="textBody">Text Body (Plain Text Fallback)</Label>
                <Textarea
                  id="textBody"
                  value={editingTemplate.textBody}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, textBody: e.target.value })}
                  placeholder="Plain text template..."
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={updatingTemplate}>
              {updatingTemplate ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteUserDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteUserDialogOpen(false); setDeletingUser(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingUser && (
            <div className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm space-y-1">
                  <p>You are about to permanently delete:</p>
                  <p className="font-semibold">{deletingUser.name} ({deletingUser.email})</p>
                  <p>Role: <span className="capitalize">{deletingUser.role}</span></p>
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-700 space-y-1">
                <p className="font-medium text-gray-900">What gets deleted:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                  <li>User profile and all settings</li>
                  <li>Login credentials (Supabase Auth)</li>
                  <li>Active sessions</li>
                </ul>
                <p className="font-medium text-gray-900 mt-2">What is preserved:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                  <li>Historical orders and audit logs</li>
                  <li>Notifications already sent</li>
                </ul>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setDeleteUserDialogOpen(false); setDeletingUser(null); }}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteUser}
                  disabled={deleteLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteLoading ? (
                    <><span className="animate-spin mr-2">⟳</span>Deleting…</>
                  ) : (
                    <><Trash2 className="h-4 w-4 mr-2" />Delete Permanently</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Force Password Reset Dialog */}
      <Dialog open={forceResetDialogOpen} onOpenChange={(open) => { if (!open) handleCloseForceResetDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {forceResetCredentials ? 'Temporary Credentials Ready' : 'Force Password Reset'}
            </DialogTitle>
            <DialogDescription>
              {forceResetCredentials
                ? 'Share these credentials with the user. They will be required to set a new password on their next login.'
                : forceResetUser
                ? `Reset the password for ${forceResetUser.name} (${forceResetUser.email}). They will be required to set a new password on their next login.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {forceResetCredentials ? (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <KeyRound className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-sm">
                  <strong>Important:</strong> Copy these credentials now. The password cannot be retrieved again after closing this dialog.
                </AlertDescription>
              </Alert>
              <div className="space-y-3 bg-gray-50 rounded-lg p-4 border">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-white border rounded px-3 py-2 text-gray-800">{forceResetCredentials.email}</code>
                    <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(forceResetCredentials.email); toast.success('Email copied!'); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Temporary Password</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-white border rounded px-3 py-2 text-gray-800 break-all">{forceResetCredentials.password}</code>
                    <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(forceResetCredentials.password); toast.success('Password copied!'); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">The user will be required to set a new password upon their next login.</p>
              <DialogFooter>
                <Button onClick={handleCloseForceResetDialog} className="w-full">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 text-sm">
                  This will immediately invalidate the user's current password. They will need to use the temporary credentials below to log in and will be forced to set a new password.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="forceResetTempPw" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                  Temporary Password
                  <span className="text-xs text-gray-400 font-normal">(optional — will auto-generate if blank)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="forceResetTempPw"
                    type={showForceResetPassword ? 'text' : 'password'}
                    placeholder="Leave blank to auto-generate"
                    value={forceResetTempPassword}
                    onChange={(e) => setForceResetTempPassword(e.target.value)}
                    minLength={8}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowForceResetPassword(!showForceResetPassword)}
                    tabIndex={-1}
                  >
                    {showForceResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {forceResetTempPassword.length > 0 && forceResetTempPassword.length < 8 && (
                  <p className="text-xs text-red-500">Temporary password must be at least 8 characters</p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCloseForceResetDialog} disabled={forceResetLoading}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleForcePasswordReset}
                  disabled={forceResetLoading || (forceResetTempPassword.length > 0 && forceResetTempPassword.length < 8)}
                >
                  {forceResetLoading ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Resetting…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Password
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CategoryDialog({ open, onOpenChange, onSuccess, editingCategory, setEditingCategory }: any) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || '',
        description: editingCategory.description || '',
        active: editingCategory.active !== undefined ? editingCategory.active : true,
      });
    } else {
      setFormData({ name: '', description: '', active: true });
    }
  }, [editingCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData.name, formData.description, formData.active);
        toast.success('Category updated successfully');
      } else {
        await createCategory(formData.name, formData.description);
        toast.success('Category created successfully');
      }
      onSuccess();
      setFormData({ name: '', description: '', active: true });
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
      setFormData({ name: '', description: '', active: true });
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
          {editingCategory && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="active" className="text-sm font-medium text-gray-900">Category Status</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Inactive categories will be hidden from dropdowns and catalog filters
                </p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          )}
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
    active: true,
  });
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({
    onOrderSubmitted: true,
    onOrderApproved: true,
    onOrderDenied: true,
    onOrderFulfilled: true,
  });
  const [loading, setLoading] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (editingUser) {
      setFormData({
        name: editingUser.name || '',
        email: editingUser.email || '',
        role: editingUser.role || 'fulfillment',
        department: editingUser.department || '',
        active: editingUser.active !== false, // Default to true if not set
      });
      
      // Load email preferences for existing user
      loadEmailPreferences(editingUser.id);
    } else {
      setFormData({ name: '', email: '', role: 'fulfillment', department: '', active: true });
      setTempPassword('');
      setShowTempPassword(false);
      setEmailPrefs({
        onOrderSubmitted: true,
        onOrderApproved: true,
        onOrderDenied: true,
        onOrderFulfilled: true,
      });
    }
  }, [editingUser]);

  const loadEmailPreferences = async (userId: string) => {
    setLoadingPrefs(true);
    try {
      const result = await getEmailPreferences(userId);
      setEmailPrefs(result.preferences);
    } catch (error) {
      console.error('Failed to load email preferences:', error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate optional temp password length before submitting
    if (!editingUser && tempPassword.length > 0 && tempPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
          active: formData.active,
        });
        
        // Update email preferences
        await updateEmailPreferences(editingUser.id, emailPrefs);
        
        toast.success('User updated successfully');
      } else {
        const result = await createUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
          tempPassword: tempPassword || undefined,
        });
        
        // Set email preferences for new user
        if (result.user?.id) {
          await updateEmailPreferences(result.user.id, emailPrefs);
        }

        // Show credentials modal so admin can share with the user
        setCreatedCredentials({
          email: formData.email,
          password: result.tempPassword || tempPassword,
        });

        onSuccess();
        setFormData({ name: '', email: '', role: 'fulfillment', department: '', active: true });
        setTempPassword('');
        setEditingUser(null);
        return; // keep dialog open to show credentials
      }
      onSuccess();
      setFormData({ name: '', email: '', role: 'fulfillment', department: '', active: true });
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
      setFormData({ name: '', email: '', role: 'fulfillment', department: '', active: true });
      setTempPassword('');
      setShowTempPassword(false);
      setCreatedCredentials(null);
      setEmailPrefs({
        onOrderSubmitted: true,
        onOrderApproved: true,
        onOrderDenied: true,
        onOrderFulfilled: true,
      });
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{createdCredentials ? 'User Created Successfully' : editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          <DialogDescription>{createdCredentials ? 'Share these credentials with the new user. They will be required to change their password on first login.' : editingUser ? 'Update an existing user account' : 'Create a new user account'}</DialogDescription>
        </DialogHeader>

        {/* Credentials reveal panel shown after creation */}
        {createdCredentials && (
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <KeyRound className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                <strong>Important:</strong> Copy these credentials now. The password cannot be retrieved later. The user will be prompted to change it on first login.
              </AlertDescription>
            </Alert>
            <div className="space-y-3 bg-gray-50 rounded-lg p-4 border">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white border rounded px-3 py-2 text-gray-800">{createdCredentials.email}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdCredentials.email); toast.success('Email copied!'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white border rounded px-3 py-2 text-gray-800 break-all">{createdCredentials.password}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdCredentials.password); toast.success('Password copied!'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">The user will be required to set a new password upon first login.</p>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        )}

        {/* Regular form (hidden after creation) */}
        {!createdCredentials && (
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
                <SelectValue>{formData.role ? formData.role.charAt(0).toUpperCase() + formData.role.slice(1) : 'Select Role'}</SelectValue>
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

          {!editingUser && (
            <div className="border rounded-lg p-4 bg-amber-50 border-amber-200 space-y-2">
              <Label htmlFor="tempPassword" className="flex items-center gap-2 text-amber-900">
                <KeyRound className="h-4 w-4" />
                Temporary Password
                <span className="text-xs text-amber-600 font-normal">(optional — auto-generates if blank)</span>
              </Label>
              <div className="relative">
                <Input
                  id="tempPassword"
                  type={showTempPassword ? 'text' : 'password'}
                  placeholder="Leave blank to auto-generate"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  minLength={tempPassword.length > 0 ? 8 : undefined}
                  className="pr-10 bg-white"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowTempPassword(!showTempPassword)}
                  tabIndex={-1}
                >
                  {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {tempPassword.length > 0 && tempPassword.length < 8 && (
                <p className="text-xs text-red-500">Temporary password must be at least 8 characters</p>
              )}
              <p className="text-xs text-amber-700">
                The user will be required to change this password on their first login. Share it with them securely.
              </p>
            </div>
          )}

          {editingUser && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-base">Account Status</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.active 
                      ? 'This user can sign in and access the system' 
                      : 'This user cannot sign in (account deactivated)'}
                  </p>
                </div>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="text-base flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Email Notification Preferences
              </Label>
              <p className="text-xs text-gray-500 mt-1">Choose which email notifications this user will receive</p>
            </div>
            
            {loadingPrefs ? (
              <p className="text-sm text-gray-500">Loading preferences...</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Order Submitted (for Approvers)</p>
                    <p className="text-xs text-gray-500">Get notified when new orders need approval</p>
                  </div>
                  <Switch
                    checked={emailPrefs.onOrderSubmitted}
                    onCheckedChange={(checked) => setEmailPrefs({ ...emailPrefs, onOrderSubmitted: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Order Approved</p>
                    <p className="text-xs text-gray-500">Get notified when your order is approved</p>
                  </div>
                  <Switch
                    checked={emailPrefs.onOrderApproved}
                    onCheckedChange={(checked) => setEmailPrefs({ ...emailPrefs, onOrderApproved: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Order Denied</p>
                    <p className="text-xs text-gray-500">Get notified when your order is not approved</p>
                  </div>
                  <Switch
                    checked={emailPrefs.onOrderDenied}
                    onCheckedChange={(checked) => setEmailPrefs({ ...emailPrefs, onOrderDenied: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Order Fulfilled</p>
                    <p className="text-xs text-gray-500">Get notified when your order is ready for pickup</p>
                  </div>
                  <Switch
                    checked={emailPrefs.onOrderFulfilled}
                    onCheckedChange={(checked) => setEmailPrefs({ ...emailPrefs, onOrderFulfilled: checked })}
                  />
                </div>
              </div>
            )}
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
        )}
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

  toast.success(`Now viewing as ${role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown'}`);
  
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
          {badge ? badge.charAt(0).toUpperCase() + badge.slice(1) : 'Unknown'}
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