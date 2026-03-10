import { createBrowserRouter, redirect } from "react-router";
import Root from "./Root";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import DebugForgotPassword from "./pages/DebugForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import FulfillmentDashboard from "./pages/FulfillmentDashboard";
import RequestorDashboard from "./pages/RequestorDashboard";
import ApproverDashboard from "./pages/ApproverDashboard";
import ItemCatalog from "./pages/ItemCatalog";
import ItemDetails from "./pages/ItemDetails";
import OrderCart from "./pages/OrderCart";
import OrderDetails from "./pages/OrderDetails";
import MyOrders from "./pages/MyOrders";
import Returns from "./pages/Returns";
import StockManagement from "./pages/StockManagement";
import Reports from "./pages/Reports";
import AdminSettings from "./pages/AdminSettings";
import PurchaseOrders from "./pages/PurchaseOrders";
import Transfers from "./pages/Transfers";
import CycleCounts from "./pages/CycleCounts";
import Vendors from "./pages/Vendors";
import Bins from "./pages/Bins";
import Lots from "./pages/Lots";
import Approvals from "./pages/Approvals";
import EmailDiagnostics from "./pages/EmailDiagnostics";
import NotFound from "./pages/NotFound";
import ChangePassword from "./pages/ChangePassword";

// Hydration fallback component
function HydrateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Simple loader that only checks local storage - no async calls
function protectedLoader({ request }: { request: Request }) {
  const token = localStorage.getItem('accessToken');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    console.log('Protected loader - No local auth found, redirecting to login');
    return redirect('/');
  }

  // If user must reset their password, only allow them to access /change-password
  const url = new URL(request.url);
  if (url.pathname !== '/change-password') {
    try {
      const user = JSON.parse(userStr);
      if (user?.mustResetPassword === true) {
        console.log('Protected loader - mustResetPassword=true, redirecting to /change-password');
        return redirect('/change-password');
      }
    } catch {
      // Malformed user data — send to login
      return redirect('/');
    }
  }

  // Token exists, let the page component handle session validation
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    HydrateFallback,
    children: [
      { index: true, Component: Login },
      { path: "login", Component: Login },
      { path: "signup", Component: Signup },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "debug-forgot-password", Component: DebugForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "change-password", Component: ChangePassword, loader: protectedLoader },
      { path: "admin", Component: AdminDashboard, loader: protectedLoader },
      { path: "fulfillment", Component: FulfillmentDashboard, loader: protectedLoader },
      { path: "requestor", Component: RequestorDashboard, loader: protectedLoader },
      { path: "approver", Component: ApproverDashboard, loader: protectedLoader },
      { path: "catalog", Component: ItemCatalog, loader: protectedLoader },
      { path: "items/:id", Component: ItemDetails, loader: protectedLoader },
      { path: "cart", Component: OrderCart, loader: protectedLoader },
      { path: "orders", Component: MyOrders, loader: protectedLoader },
      { path: "orders/:id", Component: OrderDetails, loader: protectedLoader },
      { path: "returns", Component: Returns, loader: protectedLoader },
      { path: "stock", Component: StockManagement, loader: protectedLoader },
      { path: "reports", Component: Reports, loader: protectedLoader },
      { path: "settings", Component: AdminSettings, loader: protectedLoader },
      { path: "purchase-orders", Component: PurchaseOrders, loader: protectedLoader },
      { path: "transfers", Component: Transfers, loader: protectedLoader },
      { path: "cycle-counts", Component: CycleCounts, loader: protectedLoader },
      { path: "vendors", Component: Vendors, loader: protectedLoader },
      { path: "bins", Component: Bins, loader: protectedLoader },
      { path: "lots", Component: Lots, loader: protectedLoader },
      { path: "approvals", Component: Approvals, loader: protectedLoader },
      { path: "email-diagnostics", Component: EmailDiagnostics, loader: protectedLoader },
      { path: "*", Component: NotFound },
    ],
  },
]);