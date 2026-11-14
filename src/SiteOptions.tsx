import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Settings, UserRound } from 'lucide-react'
import { readPreferredTurma } from './classPreference'
import { IntegratedMenu } from './IntegratedMenu'
import { menuOptionSections } from './menuCatalog'
import { agendaMenuUrl, readMenuShortcuts, storeMenuShortcuts } from './menuShortcuts'
import { SiteOptionsButton } from './SiteOptionsButton'
import { teacherFinderTodayUrl } from './teacherFinder'
import './integratedMenu.css'

export function SiteOptions() {
  const [open, setOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState(readMenuShortcuts)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const drawer = drawerRef.current
    if (!open || !drawer) return
    const trigger = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawer.querySelector<HTMLButtonElement>('.icon-button')?.focus()
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const controls = drawer.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
        event.preventDefault()
        if (event.shiftKey) last.focus()
        else first.focus()
      }
    }
    drawer.addEventListener('keydown', trapTab)
    return () => {
      drawer.removeEventListener('keydown', trapTab)
      document.body.style.overflow = overflow
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [open])

  const close = () => setOpen(false)
  const turma = open ? readPreferredTurma() : null
  const options = open ? menuOptionSections({
    hasTurma: Boolean(turma),
    todayClassesUrl: teacherFinderTodayUrl(turma),
    actions: {},
    unreadCount: 0,
    hasUnseenUpdate: false,
  }).flatMap(section => section.items)
    .map(option => ({ ...option, disabled: false, href: option.href || agendaMenuUrl(option.id) })) : []
  const localLinks = [
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'profiles', label: 'Perfis da comunidade', icon: UserRound },
  ] as const

  return (
    <>
      <SiteOptionsButton open={open} onOpen={() => setOpen(true)} />
      {open && createPortal(
        <div className="site-options-drawer" ref={drawerRef}>
          <IntegratedMenu onClose={close} options={options} shortcuts={shortcuts}
            onOpenMoreOptions={() => window.location.assign(agendaMenuUrl('options'))}
            onReorder={next => { setShortcuts(next); storeMenuShortcuts(next) }}
            localLinks={<>
              <a href={agendaMenuUrl()} onClick={close}><CalendarDays size={18} /> Agenda da turma</a>
              {localLinks.filter(link => !shortcuts.includes(link.id)).map(({ id, label, icon: Icon }) => (
                <a key={id} href={agendaMenuUrl(id)} onClick={close}><Icon size={18} /> {label}</a>
              ))}
            </>} />
        </div>, document.body,
      )}
    </>
  )
}
