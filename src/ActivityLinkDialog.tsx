import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, X } from 'lucide-react'
import { loadLinkedActivity } from './activityLinks'
import { ActivityDetails } from './ActivityDetails'
import type { Activity } from './types'

export function LinkedActivityDetails({ activity }: { activity: Activity }) {
  return <ActivityDetails activity={activity} />
}

export function ActivityLinkDialog({ id, onClose, onViewCalendar }: { id: string; onClose: () => void; onViewCalendar: (activity: Activity) => void }) {
  const [activity, setActivity] = useState<Activity | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const close = useRef(onClose), button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    button.current?.focus()
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
      if (event.key !== 'Tab') return
      const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')
      if (!items?.length) return
      const first = items[0], last = items[items.length - 1]
      if (!panel.current?.contains(document.activeElement) || event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('keydown', escape); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setActivity(null)
    void loadLinkedActivity(id, controller.signal).then(value => { if (!controller.signal.aborted) setActivity(value) }).catch(() => {
      if (!controller.signal.aborted) setError('Não foi possível carregar a atividade. Confira a conexão e tente novamente.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, retry])
  return createPortal(<div className="modal-backdrop activity-link-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={panel} className="day-dialog activity-link-dialog" role="dialog" aria-modal="true" aria-labelledby="linked-activity-title">
      <div className="dialog-header"><h2 id="linked-activity-title">Detalhes da atividade</h2><button ref={button} className="icon-button" aria-label="Fechar detalhes da atividade" onClick={onClose}><X /></button></div>
      <div className="day-dialog-list">
        {loading ? <p className="linked-activity-state" role="status"><LoaderCircle size={20} className="spin" />Carregando atividade…</p> : error ? <div role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></div> : activity ? <LinkedActivityDetails activity={activity} /> : <p role="status">Esta atividade não está mais disponível. Ela pode ter sido excluída ou arquivada.</p>}
      </div>
      <div className="activity-link-footer">{activity && <button className="primary-button" onClick={() => onViewCalendar(activity)}>Ver na agenda</button>}<button className="secondary-button" onClick={onClose}>{activity ? 'Fechar' : 'Voltar para a agenda'}</button></div>
    </section>
  </div>, document.body)
}
