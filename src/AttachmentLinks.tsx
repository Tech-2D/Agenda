import { useState } from 'react'
import { Download, LoaderCircle, Paperclip } from 'lucide-react'
import { attachmentDownloadUrl, formatAttachmentSize } from './attachments'
import type { ActivityAttachment } from './types'

export function AttachmentLinks({ activityId, attachments }: { activityId: string; attachments?: ActivityAttachment[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  if (!attachments?.length) return null

  async function open(attachmentId: string) {
    const destination = window.open('', '_blank')
    setLoadingId(attachmentId)
    setError('')
    try {
      const url = await attachmentDownloadUrl(activityId, attachmentId)
      if (destination) {
        destination.opener = null
        destination.location.href = url
      } else window.location.assign(url)
    } catch (cause) {
      destination?.close()
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o anexo.')
    } finally { setLoadingId(null) }
  }

  return <div className="attachment-links" aria-label="Anexos da atividade">
    <span className="attachment-links-title"><Paperclip size={14} /> Anexos ({attachments.length})</span>
    {attachments.map(item => <button type="button" className="attachment-link" key={item.id} onClick={() => open(item.id)} disabled={loadingId === item.id}>
      <span className="attachment-link-name">{item.name}</span>
      <span className="attachment-link-meta">{formatAttachmentSize(item.size)} {loadingId === item.id ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}</span>
    </button>)}
    {error && <span className="attachment-error" role="alert">{error}</span>}
  </div>
}
