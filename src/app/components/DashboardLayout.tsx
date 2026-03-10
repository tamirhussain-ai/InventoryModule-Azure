import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { AuthService, User } from '../services/auth';
import { getNotifications, markNotificationRead, getBadgeCounts, getAppSettings, checkPasswordExpiry } from '../services/api';
import { 
  Package, 
  ShoppingCart, 
  ClipboardList, 
  TrendingUp, 
  Settings, 
  Bell, 
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Box,
  FileText,
  ArrowRightLeft,
  ClipboardCheck,
  Building2,
  Grid3x3,
  PackageCheck,
  CheckSquare,
  ArrowLeft,
  Undo2,
  UserCog,
  AlertCircle,
  User as UserIcon,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<any>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appName, setAppName] = useState('SHC Inventory');

  // Check for impersonation
  const isImpersonating = localStorage.getItem('impersonatedRole') !== null;
  const actualRole = localStorage.getItem('actualRole');

  const handleStopImpersonating = () => {
    // Get the actual role before removing from storage
    const actualRoleValue = localStorage.getItem('actualRole');
    const currentUser = AuthService.getCurrentUser();
    
    if (actualRoleValue && currentUser) {
      // Restore the user object with the actual admin role
      const restoredUser = { ...currentUser, role: actualRoleValue };
      localStorage.setItem('user', JSON.stringify(restoredUser));
    }
    
    // Remove impersonation flags
    localStorage.removeItem('impersonatedRole');
    localStorage.removeItem('actualRole');
    
    toast.success('Stopped impersonating. Returning to Admin view.');
    window.location.reload();
  };

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    const token = AuthService.getAccessToken();
    
    console.log('DashboardLayout - User loaded:', currentUser?.email, 'Has token:', !!token);
    
    if (currentUser) {
      setUser(currentUser);
      loadNotifications();
      loadBadgeCounts();
      loadAppSettings();
      checkPasswordExpiryStatus();

      // Set up automatic refresh for notifications and badge counts every 60 seconds
      const intervalId = setInterval(() => {
        // Only refresh if the tab is visible to save resources
        if (document.visibilityState === 'visible') {
          console.log('Auto-refreshing notifications and badge counts...');
          loadNotifications();
          loadBadgeCounts();
        }
      }, 60000); // 60 seconds

      // Clean up interval on unmount
      return () => clearInterval(intervalId);
    }
  }, []);

  const loadNotifications = async () => {
    try {
      // Only load notifications if user is authenticated with a valid token
      const token = AuthService.getAccessToken();
      if (!token) {
        console.log('Skipping notifications load - no access token');
        return;
      }
      
      console.log('Loading notifications...');
      const result = await getNotifications();
      
      if (result && result.notifications) {
        const unread = result.notifications.filter((n: any) => !n.read);
        setNotifications(unread);
        console.log(`Loaded ${unread.length} unread notifications`);
      } else {
        console.warn('Unexpected notifications response format:', result);
        setNotifications([]);
      }
    } catch (error: any) {
      // Silently handle notification errors - it's not critical functionality
      // Don't log if it's a connection error (server may be starting)
      if (!error.message?.includes('Cannot connect to server')) {
        console.error('Failed to load notifications:', error.message || error);
      }
      setNotifications([]);
    }
  };

  const loadBadgeCounts = async () => {
    try {
      // Only load badge counts if user is authenticated with a valid token
      const token = AuthService.getAccessToken();
      if (!token) {
        console.log('Skipping badge counts load - no access token');
        return;
      }
      
      console.log('Loading badge counts...');
      const result = await getBadgeCounts();
      
      if (result && result.counts) {
        setBadgeCounts(result.counts);
        console.log('Loaded badge counts:', result.counts);
      } else {
        console.warn('Unexpected badge counts response format:', result);
        setBadgeCounts({});
      }
    } catch (error: any) {
      // Silently handle badge count errors - it's not critical functionality
      // Don't log if it's a connection error (server may be starting)
      if (!error.message?.includes('Cannot connect to server')) {
        console.error('Failed to load badge counts:', error.message || error);
      }
      setBadgeCounts({});
    }
  };

  const loadAppSettings = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) return;
      const result = await getAppSettings();
      if (result && result.settings && result.settings.appName) {
        setAppName(result.settings.appName);
      }
    } catch (error: any) {
      console.error('Failed to load app settings:', error.message || error);
    }
  };

  const checkPasswordExpiryStatus = async () => {
    try {
      const token = AuthService.getAccessToken();
      if (!token) return;
      const result = await checkPasswordExpiry();
      if (result?.expired) {
        toast.warning('Your password has expired. You must set a new password to continue.', { duration: 6000 });
        navigate('/change-password?reason=expired');
      }
    } catch (error: any) {
      // Non-critical — silently ignore
      console.log('Password expiry check skipped:', error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await AuthService.signout();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Sign out failed');
    }
  };

  const handleNotificationClick = async (notification: any) => {
    try {
      await markNotificationRead(notification.id);
      // Remove from unread list
      setNotifications(notifications.filter(n => n.id !== notification.id));
      toast.success('Notification marked as read');
      
      // Determine where to navigate
      let targetPath = notification.link;
      
      // If no link provided, try to construct one based on notification type and message
      if (!targetPath) {
        if (notification.type.includes('order') || notification.message.includes('order')) {
          // Try to extract order ID from message
          const orderIdMatch = notification.message.match(/order ([a-f0-9-]+)/i);
          if (orderIdMatch) {
            targetPath = `/orders/${orderIdMatch[1]}`;
          } else {
            targetPath = '/orders';
          }
        } else if (notification.type.includes('approval') || notification.message.includes('approval')) {
          targetPath = '/approvals';
        } else if (notification.type.includes('return') || notification.message.includes('return')) {
          targetPath = '/returns';
        } else if (notification.type.includes('lot') || notification.message.includes('lot')) {
          targetPath = '/lots';
        } else if (notification.type.includes('cycle') || notification.message.includes('cycle count')) {
          targetPath = '/cycle-counts';
        } else if (notification.type.includes('transfer') || notification.message.includes('transfer')) {
          targetPath = '/transfers';
        }
      }
      
      // Navigate to the target page if we have one
      if (targetPath) {
        navigate(targetPath);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleGoBack = () => {
    // Use navigate(-1) to go back in browser history
    // If there's no previous page in the app, React Router will handle it gracefully
    try {
      navigate(-1);
    } catch (error) {
      // Fallback to dashboard based on role if navigation fails
      const role = user?.role;
      switch (role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'fulfillment':
          navigate('/fulfillment');
          break;
        case 'approver':
          navigate('/approver');
          break;
        case 'requestor':
        default:
          navigate('/requestor');
          break;
      }
    }
  };

  // Check if we should show the back button (not on dashboard pages)
  const isDashboardPage = location.pathname === '/admin' || 
                          location.pathname === '/fulfillment' || 
                          location.pathname === '/approver' || 
                          location.pathname === '/requestor';

  const getNavItems = () => {
    const role = user?.role;
    const items = [];

    if (role === 'admin') {
      items.push(
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { label: 'Item Catalog', path: '/catalog', icon: Package },
        { label: 'Stock Management', path: '/stock', icon: Box },
        { label: 'Bins & Locations', path: '/bins', icon: Grid3x3 },
        { label: 'Lot Management', path: '/lots', icon: PackageCheck },
        { label: 'Purchase Orders', path: '/purchase-orders', icon: FileText },
        { label: 'Stock Transfers', path: '/transfers', icon: ArrowRightLeft },
        { label: 'Cycle Counts', path: '/cycle-counts', icon: ClipboardCheck },
        { label: 'All Orders', path: '/fulfillment', icon: ClipboardList },
        { label: 'Returns', path: '/returns', icon: Undo2 },
        { label: 'Vendors', path: '/vendors', icon: Building2 },
        { label: 'Reports', path: '/reports', icon: TrendingUp },
        { label: 'Settings', path: '/settings', icon: Settings },
      );
    } else if (role === 'fulfillment') {
      items.push(
        { label: 'Dashboard', path: '/fulfillment', icon: LayoutDashboard },
        { label: 'Item Catalog', path: '/catalog', icon: Package },
        { label: 'Stock Management', path: '/stock', icon: Box },
        { label: 'Bins & Locations', path: '/bins', icon: Grid3x3 },
        { label: 'Lot Management', path: '/lots', icon: PackageCheck },
        { label: 'Purchase Orders', path: '/purchase-orders', icon: FileText },
        { label: 'Stock Transfers', path: '/transfers', icon: ArrowRightLeft },
        { label: 'Cycle Counts', path: '/cycle-counts', icon: ClipboardCheck },
        { label: 'Returns', path: '/returns', icon: Undo2 },
        { label: 'Reports', path: '/reports', icon: TrendingUp },
      );
    } else if (role === 'approver') {
      items.push(
        { label: 'Dashboard', path: '/approver', icon: LayoutDashboard },
        { label: 'Pending Approvals', path: '/approvals', icon: CheckSquare },
        { label: 'Browse Catalog', path: '/catalog', icon: Package },
        { label: 'My Orders', path: '/orders', icon: ClipboardList },
        { label: 'Returns', path: '/returns', icon: Undo2 },
        { label: 'My Cart', path: '/cart', icon: ShoppingCart },
      );
    } else {
      items.push(
        { label: 'Dashboard', path: '/requestor', icon: LayoutDashboard },
        { label: 'Browse Catalog', path: '/catalog', icon: Package },
        { label: 'My Orders', path: '/orders', icon: ClipboardList },
        { label: 'Returns', path: '/returns', icon: Undo2 },
        { label: 'My Cart', path: '/cart', icon: ShoppingCart },
      );
    }

    return items;
  };

  const navItems = getNavItems();

  // Helper to get badge count for a specific path
  const getBadgeCount = (path: string, label: string) => {
    const role = user?.role;
    
    // Map specific paths/labels to badge count keys
    if (path === '/fulfillment' || label === 'All Orders') {
      return badgeCounts.orders || 0;
    }
    if (path === '/approvals' || label === 'Pending Approvals') {
      return badgeCounts.approvals || 0;
    }
    if (path === '/returns' || label === 'Returns') {
      return badgeCounts.returns || 0;
    }
    if (path === '/purchase-orders' || label === 'Purchase Orders') {
      return badgeCounts.purchaseOrders || 0;
    }
    if (path === '/cycle-counts' || label === 'Cycle Counts') {
      return badgeCounts.cycleCounts || 0;
    }
    if (path === '/transfers' || label === 'Stock Transfers') {
      return badgeCounts.transfers || 0;
    }
    if (path === '/orders' || label === 'My Orders') {
      return badgeCounts.orders || 0;
    }
    
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                className="md:hidden mr-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div className="flex items-center space-x-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{appName}</h1>
                  {user && (
                    <p className="text-xs text-gray-500">
                      {user.name} • {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {notifications.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b">
                        <p className="font-semibold text-sm">Notifications</p>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.map((notification) => (
                          <DropdownMenuItem
                            key={notification.id}
                            className="px-4 py-3 cursor-pointer flex-col items-start"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <p className="font-medium text-sm">{notification.type}</p>
                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {isImpersonating && (
                <Button
                  variant="outline"
                  onClick={handleStopImpersonating}
                  className="flex items-center"
                >
                  <UserCog className="h-4 w-4 mr-2" />
                  Stop Impersonating
                </Button>
              )}

              {/* User profile dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3">
                    <div className="bg-blue-100 rounded-full p-1.5">
                      <UserIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                      {user?.name || user?.email || 'Account'}
                    </span>
                    <ChevronDown className="h-3 w-3 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b">
                    <p className="font-semibold text-sm text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    <p className="text-xs text-blue-600 font-medium mt-0.5 capitalize">{user?.role}</p>
                  </div>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center gap-2 px-3 py-2"
                    onClick={() => navigate('/change-password')}
                  >
                    <KeyRound className="h-4 w-4 text-gray-500" />
                    <span>Change Password</span>
                  </DropdownMenuItem>
                  <div className="border-t" />
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 text-red-600 focus:text-red-600"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Impersonation Warning Banner */}
      {isImpersonating && (
        <div className="bg-orange-500 text-white sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    Impersonation Mode Active
                  </p>
                  <p className="text-xs text-orange-100">
                    Viewing as <strong>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}</strong> • 
                    Actual role: <strong>{actualRole ? actualRole.charAt(0).toUpperCase() + actualRole.slice(1) : 'Admin'}</strong>
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStopImpersonating}
                className="flex items-center bg-white text-orange-600 hover:bg-orange-50 flex-shrink-0"
              >
                <UserCog className="h-4 w-4 mr-2" />
                Exit Impersonation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const count = getBadgeCount(item.path, item.label);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && (
                    <Badge className="ml-auto bg-red-600 text-white h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
                      {count}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Side Navigation - Desktop */}
        <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const count = getBadgeCount(item.path, item.label);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="font-medium flex-1">{item.label}</span>
                  {count > 0 && (
                    <Badge className="ml-auto bg-red-600 text-white h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
                      {count}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Back Button */}
            {!isDashboardPage && (
              <div className="mb-6">
                <Button
                  variant="ghost"
                  onClick={handleGoBack}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                  aria-label="Go back to previous page"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Button>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}