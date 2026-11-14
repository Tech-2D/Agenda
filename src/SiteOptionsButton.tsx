import { Menu } from 'lucide-react'

export function SiteOptionsButton({ open, onOpen, hasPending }: { open: boolean; onOpen: () => void; hasPending?: boolean }) {
  return (
    <button type="button" className="site-options-button"
      aria-label={hasPending ? 'Abrir menu, há novidades' : 'Abrir menu'}
      aria-haspopup="dialog" aria-expanded={open} title="Menu" onClick={onOpen}>
      <Menu size={22} strokeWidth={2.3} aria-hidden="true" />
      {hasPending && <span className="site-options-pending" aria-hidden="true" />}
    </button>
  )
}
