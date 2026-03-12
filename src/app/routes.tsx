import { createBrowserRouter } from "react-router";
import Root from "./Root";
import ProtectedRoute from "./components/ProtectedRoute";
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

function P({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true,              element: <Login /> },
      { path: "login",            element: <Login /> },
      { path: "debug",            element: <Debug /> },
      { path: "admin",            element: <P><AdminDashboard /></P> },
      { path: "fulfillment",      element: <P><FulfillmentDashboard /></P> },
      { path: "requestor",        element: <P><RequestorDashboard /></P> },
      { path: "approver",         element: <P><ApproverDashboard /></P> },
      { path: "catalog",          element: <P><ItemCatalog /></P> },
      { path: "items/:id",        element: <P><ItemDetails /></P> },
      { path: "cart",             element: <P><OrderCart /></P> },
      { path: "orders",           element: <P><MyOrders /></P> },
      { path: "orders/:id",       element: <P><OrderDetails /></P> },
      { path: "returns",          element: <P><Returns /></P> },
      { path: "stock",            element: <P><StockManagement /></P> },
      { path: "reports",          element: <P><Reports /></P> },
      { path: "settings",         element: <P><AdminSettings /></P> },
      { path: "purchase-orders",  element: <P><PurchaseOrders /></P> },
      { path: "transfers",        element: <P><Transfers /></P> },
      { path: "cycle-counts",     element: <P><CycleCounts /></P> },
      { path: "vendors",          element: <P><Vendors /></P> },
      { path: "bins",             element: <P><Bins /></P> },
      { path: "lots",             element: <P><Lots /></P> },
      { path: "approvals",        element: <P><Approvals /></P> },
      { path: "*",                element: <NotFound /> },
    ],
  },
]);
