import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { registerServiceWorker } from "@/lib/offline";
import "./index.css";

registerServiceWorker();

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
