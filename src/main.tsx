import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { msalInstance } from "./lib/authContext";

// Initialize MSAL before rendering — popup flow, no redirects
msalInstance.initialize().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
