import { createBrowserRouter, redirect } from "react-router";
import Root from "./Root";
import Login from "./pages/Login";
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
import NotFound from "./pages/NotFound";
import Debug from "./pages/Debug";
import { msalInstance, getAllowedUsers, isEmailAllowed } from "../lib/authContext";

function HydrateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function protectedLoader() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return redirect('/');

  // Check allowlist
  const email = accounts[0].username;
  const allowed = isEmailAllowed(email);
  const allUsers = getAllowedUsers();

  // Allow bootstrap (first user) or if on allowlist
  if (allUsers.length === 0 || allowed) return null;

  return redirect('/');
}

// After redirect login lands on /, check if already authenticated and route to dashboard
function loginLoader() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;

  const email = accounts[0].username;
  const allUsers = getAllowedUsers();
  const allowed = isEmailAllowed(email);

  // Bootstrap or allowed — redirect to correct dashboard
  if (allUsers.length === 0 || allowed) {
    const role = allowed?.role || 'admin';
    switch (role) {
      case 'admin':       return redirect('/admin');
      case 'fulfillment': return redirect('/fulfillment');
      case 'approver':    return redirect('/approver');
      default:            return redirect('/requestor');
    }
  }

  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    HydrateFallback,
    children: [
      { index: true, Component: Login, loader: loginLoader },
      { path: "login", Component: Login, loader: loginLoader },
      { path: "admin",           Component: AdminDashboard,       loader: protectedLoader },
      { path: "fulfillment",     Component: FulfillmentDashboard, loader: protectedLoader },
      { path: "requestor",       Component: RequestorDashboard,   loader: protectedLoader },
      { path: "approver",        Component: ApproverDashboard,    loader: protectedLoader },
      { path: "catalog",         Component: ItemCatalog,          loader: protectedLoader },
      { path: "items/:id",       Component: ItemDetails,          loader: protectedLoader },
      { path: "cart",            Component: OrderCart,            loader: protectedLoader },
      { path: "orders",          Component: MyOrders,             loader: protectedLoader },
      { path: "orders/:id",      Component: OrderDetails,         loader: protectedLoader },
      { path: "returns",         Component: Returns,              loader: protectedLoader },
      { path: "stock",           Component: StockManagement,      loader: protectedLoader },
      { path: "reports",         Component: Reports,              loader: protectedLoader },
      { path: "settings",        Component: AdminSettings,        loader: protectedLoader },
      { path: "purchase-orders", Component: PurchaseOrders,       loader: protectedLoader },
      { path: "transfers",       Component: Transfers,            loader: protectedLoader },
      { path: "cycle-counts",    Component: CycleCounts,          loader: protectedLoader },
      { path: "vendors",         Component: Vendors,              loader: protectedLoader },
      { path: "bins",            Component: Bins,                 loader: protectedLoader },
      { path: "lots",            Component: Lots,                 loader: protectedLoader },
      { path: "approvals",       Component: Approvals,            loader: protectedLoader },
      { path: "debug",           Component: Debug },
      { path: "*",               Component: NotFound },
    ],
  },
]);
