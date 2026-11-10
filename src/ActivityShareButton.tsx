import { useEffect, useRef, useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { activityLink } from './activityLinks'
import { pendingActivityStates, QUEUED_CHANGED } from './optimisticActivities'

const unpublished = (id: string) => pendingActivityStates().some(s => s.value.id === id && !s.confirmed)
export function ActivityShareButton({ activityId }: { activityId: string }) {
  const [waiting, setWaiting] = useState(() => unpublished(activityId))
  const [copied, setCopied] = useState(false), [manual, setManual] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const change = () => setWaiting(unpublished(activityId))
    window.addEventListener(QUEUED_CHANGED, change)
    return () => window.removeEventListener(QUEUED_CHANGED, change)
  }, [activityId])
  useEffect(() => { if (manual) { input.current?.focus(); input.current?.select() } }, [manual])
  async function copy() {
    const url = activityLink(activityId, window.location.href)
    try { await navigator.clipboard.writeText(url); setCopied(true); setManual('') }
    catch { setManual(url); setCopied(false) }
  }
  return <div className="activity-share">
    <button type="button" className="secondary-button" disabled={waiting} onClick={() => void copy()} aria-label={`Copiar link da atividade${waiting ? ' (aguardando salvar)' : ''}`}>
      {copied ? <Check size={16} /> : <Link2 size={16} />}{waiting ? 'Aguardando salvar…' : copied ? 'Link copiado' : 'Copiar link'}
    </button>
    {copied && <span className="activity-share-status" role="status">Pronto para compartilhar.</span>}
    {manual && <label className="activity-share-manual">Copie o link abaixo:<input ref={input} aria-label="Link direto da atividade" readOnly value={manual} onFocus={e => e.target.select()} /></label>}
  </div>
}
