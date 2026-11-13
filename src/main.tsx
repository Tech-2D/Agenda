import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { legacyAdminUrl } from './adminRoute'
import './styles.css'
import './interface.css'
import './siteNavigation.css'
import './sitePalette.css'

const redirect = legacyAdminUrl(window.location)
if (redirect) window.history.replaceState(null, '', redirect)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
