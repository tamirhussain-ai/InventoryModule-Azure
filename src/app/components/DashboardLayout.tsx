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
import { getNotifications, markNotificationRead } from '../services/api';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const currentUser = AuthService.getCurrentUser();
    const token = AuthService.getAccessToken();
    
    console.log('DashboardLayout - User loaded:', currentUser?.email, 'Has token:', !!token);
    
    if (currentUser) {
      setUser(currentUser);
      loadNotifications();
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
      console.error('Failed to load notifications:', error.message || error);
      setNotifications([]);
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
      
      // Navigate to relevant page if notification has a link
      if (notification.link) {
        navigate(notification.link);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleGoBack = () => {
    // Check if we can go back in history
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to dashboard based on role
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
        { label: 'Reports', path: '/reports', icon: TrendingUp },
      );
    } else if (role === 'approver') {
      items.push(
        { label: 'Dashboard', path: '/approver', icon: LayoutDashboard },
        { label: 'Pending Approvals', path: '/approvals', icon: CheckSquare },
        { label: 'Browse Catalog', path: '/catalog', icon: Package },
        { label: 'My Orders', path: '/orders', icon: ClipboardList },
        { label: 'My Cart', path: '/cart', icon: ShoppingCart },
      );
    } else {
      items.push(
        { label: 'Dashboard', path: '/requestor', icon: LayoutDashboard },
        { label: 'Browse Catalog', path: '/catalog', icon: Package },
        { label: 'My Orders', path: '/orders', icon: ClipboardList },
        { label: 'My Cart', path: '/cart', icon: ShoppingCart },
      );
    }

    return items;
  };

  const navItems = getNavItems();

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
                  <h1 className="text-xl font-bold text-gray-900">SHC Inventory</h1>
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
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.label}
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
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="font-medium">{item.label}</span>
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
              <div className="mb-4">
                <Button
                  variant="ghost"
                  onClick={handleGoBack}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
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