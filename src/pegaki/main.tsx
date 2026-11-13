import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AccountSiteNavigation } from "../AccountSiteNavigation";
import "../siteNavigation.css";
import "../sitePalette.css";
import { observeStoredAppearance } from "../appearance";

import { auth } from "../firebase";
import { recordSiteAccess } from "../agendaAccess";
import { SQL_ENABLED } from "../dataBackend";

observeStoredAppearance();

if (SQL_ENABLED) {
  void auth.authStateReady().then(() => recordSiteAccess("pegaki", auth.currentUser)).catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="pegaki-shell">
      <AccountSiteNavigation active="pegaki" />
      <App />
      {SQL_ENABLED && <footer className="mx-auto max-w-3xl px-4 py-4 text-xs text-muted">
        Registramos a conta em acessos com login. Em visitas anônimas, usamos um código diário da rede. Os registros ficam disponíveis por 90 dias.
      </footer>}
    </div>
  </StrictMode>,
);
