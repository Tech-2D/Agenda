import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { SiteSession } from "../SiteSession";
import { onAuthStateChanged } from "firebase/auth";
import { AccountSiteNavigation } from "../AccountSiteNavigation";
import "../siteNavigation.css";
import "../sitePalette.css";
import { observeStoredAppearance } from "../appearance";

import { auth } from "../firebase";
import { recordSiteAccess } from "../agendaAccess";
import { SQL_ENABLED } from "../dataBackend";

observeStoredAppearance();

if (SQL_ENABLED) {
  onAuthStateChanged(auth, user => { if (user && !user.isAnonymous) void recordSiteAccess("pegaki", user); });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SiteSession destination="o Pegaki">
      <div className="pegaki-shell">
        <AccountSiteNavigation active="pegaki" />
        <App />
      </div>
    </SiteSession>
  </StrictMode>,
);
