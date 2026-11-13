import { Calculator, CalendarDays, MapPin } from 'lucide-react'

export function SiteNavigation({ active }: { active: 'agenda' | 'professores' | 'pegaki' }) {
  return (
    <nav className="site-navigation" aria-label="Navegação principal">
      <a className="site-brand" href="/" aria-label="Tech 2D, início">Tech 2D</a>
      <div className="site-navigation-pages">
        <a href="/" aria-current={active === 'agenda' ? 'page' : undefined}><CalendarDays size={17} aria-hidden="true" />Agenda</a>
        <a href="/professores/" aria-current={active === 'professores' ? 'page' : undefined}><MapPin size={17} aria-hidden="true" />Professores</a>
        <a href="/pegaki/" aria-current={active === 'pegaki' ? 'page' : undefined}><Calculator size={17} aria-hidden="true" />Pegaki</a>
      </div>
    </nav>
  )
}
