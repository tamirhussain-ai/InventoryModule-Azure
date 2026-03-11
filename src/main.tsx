import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { msalInstance } from "./lib/authContext";

// Initialize MSAL and handle any redirect responses before rendering
msalInstance.initialize().then(() => {
  return msalInstance.handleRedirectPromise();
}).then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
