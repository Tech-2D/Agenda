import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronRight, ExternalLink, GripVertical, LayoutGrid, X } from 'lucide-react'
import type { MenuShortcutId } from './menuShortcuts'
import type { MoreOption } from './menuCatalog'

export function IntegratedMenu({ onClose, options, shortcuts, onOpenMoreOptions, onReorder, localLinks }: {
  onClose: () => void
  options: MoreOption[]
  shortcuts: MenuShortcutId[]
  onOpenMoreOptions: () => void
  onReorder: (ids: MenuShortcutId[]) => void
  localLinks?: ReactNode
}) {
  const [organizing, setOrganizing] = useState(false)
  const [draggedId, setDraggedId] = useState<MenuShortcutId | null>(null)
  const [dropTarget, setDropTarget] = useState<MenuShortcutId | null>(null)
  const [orderStatus, setOrderStatus] = useState('')
  const hasPendingOutsideShortcuts = options.some(option => option.pendingLabel && !shortcuts.includes(option.id))

  function moveShortcut(id: MenuShortcutId, targetId: MenuShortcutId) {
    const from = shortcuts.indexOf(id)
    const to = shortcuts.indexOf(targetId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...shortcuts]
    next.splice(from, 1)
    next.splice(to, 0, id)
    onReorder(next)
    setOrderStatus(`${options.find(item => item.id === id)?.title ?? 'Atalho'} na posição ${to + 1}. Ordem salva.`)
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="side-menu" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <div className="dialog-header">
          <h2 id="menu-title">Menu</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        {localLinks && <nav className="side-menu-list side-menu-local" aria-label="Neste site">{localLinks}</nav>}
        {shortcuts.length > 1 && <div className="side-menu-organize">
          <button type="button" className="secondary-button" aria-pressed={organizing} onClick={() => { setOrganizing(!organizing); setDraggedId(null); setDropTarget(null) }}>
            {organizing ? <Check size={16} /> : <GripVertical size={16} />}{organizing ? 'Concluir organização' : 'Organizar atalhos'}
          </button>
          {organizing && <p>Arraste pela alça ou use as setas. A ordem é salva automaticamente.</p>}
        </div>}
        <span className="sr-only" role="status" aria-live="polite">{orderStatus}</span>
        <nav className="side-menu-list" aria-label="Atalhos principais">
          {shortcuts.map((id, index) => {
            const option = options.find(item => item.id === id)
            if (!option) return null
            const content = <><span className="side-menu-shortcut-icon" aria-hidden="true">{option.icon}</span><span>{option.title}</span>
              {option.pendingLabel && <span className="menu-pending-badge">{option.pendingLabel}</span>}
              {option.href && !option.href.startsWith('/') && <ExternalLink size={14} className="external-icon" aria-hidden="true" />}
            </>
            if (organizing) return <div key={id} className={`side-menu-sort-row${draggedId === id ? ' dragging' : ''}${dropTarget === id ? ' drop-target' : ''}`}
              onDragOver={event => { if (draggedId && draggedId !== id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(id) } }}
              onDrop={event => { event.preventDefault(); if (draggedId) moveShortcut(draggedId, id); setDraggedId(null); setDropTarget(null) }}>
              <button type="button" className="side-menu-drag-handle" draggable aria-label={`Arrastar ${option.title}`} title="Arraste para mudar a posição"
                onDragStart={event => { event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; setDraggedId(id) }}
                onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}><GripVertical size={18} /></button>
              <span className="side-menu-sort-label">{content}</span>
              <div className="side-menu-sort-actions">
                <button type="button" aria-label={`Mover ${option.title} para cima`} disabled={index === 0} onClick={() => moveShortcut(id, shortcuts[index - 1])}><ArrowUp size={16} /></button>
                <button type="button" aria-label={`Mover ${option.title} para baixo`} disabled={index === shortcuts.length - 1} onClick={() => moveShortcut(id, shortcuts[index + 1])}><ArrowDown size={16} /></button>
              </div>
            </div>
            return option.href
              ? <a key={id} className="side-menu-external" href={option.href} target={option.href.startsWith('/') ? undefined : '_blank'} rel={option.href.startsWith('/') ? undefined : 'noopener noreferrer'} onClick={onClose}>{content}</a>
              : <button type="button" key={id} onClick={option.onClick} disabled={option.disabled} title={option.disabled ? option.description : undefined}>{content}</button>
          })}
          {shortcuts.length === 0 && <p className="side-menu-empty">Escolha seus atalhos em “Ver mais opções”.</p>}
        </nav>
        <div className="side-menu-more">
          <p>Precisa de outra ferramenta?</p>
          <button type="button" className="side-menu-more-button" onClick={onOpenMoreOptions}>
            <span className="side-menu-more-icon"><LayoutGrid size={19} /></span>
            <span className="side-menu-more-copy">
              <strong>Ver mais opções</strong>
              {hasPendingOutsideShortcuts ? <span className="menu-pending-badge">Há novidades</span> : <small>Todos os recursos e atalhos compartilhados</small>}
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>
  )
}
