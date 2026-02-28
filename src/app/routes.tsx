import { createBrowserRouter } from "react-router";
import Root from "./Root";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/AdminDashboard";
import FulfillmentDashboard from "./pages/FulfillmentDashboard";
import RequestorDashboard from "./pages/RequestorDashboard";
import ApproverDashboard from "./pages/ApproverDashboard";
import ItemCatalog from "./pages/ItemCatalog";
import ItemDetails from "./pages/ItemDetails";
import OrderCart from "./pages/OrderCart";
import OrderDetails from "./pages/OrderDetails";
import MyOrders from "./pages/MyOrders";
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
import ProtectedRoute from "./components/ProtectedRoute";

// Wrapper component for protected routes
const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Login },
      { path: "signup", Component: Signup },
      { path: "admin", element: <Protected><AdminDashboard /></Protected> },
      { path: "fulfillment", element: <Protected><FulfillmentDashboard /></Protected> },
      { path: "requestor", element: <Protected><RequestorDashboard /></Protected> },
      { path: "approver", element: <Protected><ApproverDashboard /></Protected> },
      { path: "catalog", element: <Protected><ItemCatalog /></Protected> },
      { path: "items/:id", element: <Protected><ItemDetails /></Protected> },
      { path: "cart", element: <Protected><OrderCart /></Protected> },
      { path: "orders/:id", element: <Protected><OrderDetails /></Protected> },
      { path: "orders", element: <Protected><MyOrders /></Protected> },
      { path: "stock", element: <Protected><StockManagement /></Protected> },
      { path: "reports", element: <Protected><Reports /></Protected> },
      { path: "settings", element: <Protected><AdminSettings /></Protected> },
      { path: "purchase-orders", element: <Protected><PurchaseOrders /></Protected> },
      { path: "transfers", element: <Protected><Transfers /></Protected> },
      { path: "cycle-counts", element: <Protected><CycleCounts /></Protected> },
      { path: "vendors", element: <Protected><Vendors /></Protected> },
      { path: "bins", element: <Protected><Bins /></Protected> },
      { path: "lots", element: <Protected><Lots /></Protected> },
      { path: "approvals", element: <Protected><Approvals /></Protected> },
      { path: "*", Component: NotFound },
    ],
  },
]);