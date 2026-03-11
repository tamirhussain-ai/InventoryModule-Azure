import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { msalInstance } from "./lib/authContext";

// Initialize MSAL before rendering the app to prevent redirect loops
msalInstance.initialize().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
