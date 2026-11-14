import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SiteSession } from '../SiteSession'
import { observeStoredAppearance } from '../appearance'
import './styles.css'
import './sharedAppearance.css'
import './professorAdmin.css'
import './interface.css'
import '../siteNavigation.css'

observeStoredAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteSession destination="Professores"><App /></SiteSession>
  </StrictMode>,
)
