import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './integratedMenu.css'
import './sharedAppearance.css'
import './professorAdmin.css'
import './interface.css'
import '../siteNavigation.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
