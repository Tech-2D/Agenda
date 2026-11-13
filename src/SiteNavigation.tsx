import { Calculator, CalendarDays, KeyRound, MapPin } from 'lucide-react'
import { sitePaths } from './sitePaths'

export function SiteNavigation({ active }: { active: 'agenda' | 'professores' | 'pegaki' | 'admin' }) {
  return (
    <nav className="site-navigation" aria-label="Navegação principal">
      <a className="site-brand" href={sitePaths.agenda} aria-label="Tech 2D, início">Tech 2D</a>
      <div className="site-navigation-pages">
        <a href={sitePaths.agenda} aria-current={active === 'agenda' ? 'page' : undefined}><CalendarDays size={17} aria-hidden="true" />Agenda</a>
        <a href={sitePaths.professores} aria-current={active === 'professores' ? 'page' : undefined}><MapPin size={17} aria-hidden="true" />Professores</a>
        <a href={sitePaths.pegaki} aria-current={active === 'pegaki' ? 'page' : undefined}><Calculator size={17} aria-hidden="true" />Pegaki</a>
        {active === 'admin' && <a href={sitePaths.admin} aria-current="page"><KeyRound size={17} aria-hidden="true" />Painel</a>}
      </div>
    </nav>
  )
}
