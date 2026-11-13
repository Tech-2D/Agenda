import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { SiteNavigation } from "../SiteNavigation";
import "../siteNavigation.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="pegaki-shell">
      <SiteNavigation active="pegaki" />
      <App />
    </div>
  </StrictMode>,
);
