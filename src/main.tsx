import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SiteSession } from './SiteSession'
import { observeStoredAppearance } from './appearance'
import { isAdminRoute, legacyAdminUrl } from './adminRoute'
import './styles.css'
import './interface.css'
import './siteNavigation.css'
import './sitePalette.css'

const redirect = legacyAdminUrl(window.location)
if (redirect) window.history.replaceState(null, '', redirect)

observeStoredAppearance()
const destination = isAdminRoute(window.location.pathname) ? 'o Painel da Agenda'
  : window.location.hash.split('?')[0] === '#kanban' ? 'o Kanban' : 'a Agenda'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteSession destination={destination}><App /></SiteSession>
  </StrictMode>,
)
