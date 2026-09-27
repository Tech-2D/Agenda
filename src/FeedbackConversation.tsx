import { useEffect, useState, type FormEvent } from 'react'
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, where, type Timestamp } from 'firebase/firestore'
import { Send } from 'lucide-react'
import { auth, db } from './firebase'
import type { Feedback } from './types'

type Message = { id: string; text: string; senderId: string; createdAt: Timestamp | null }

export function FeedbackConversation({ feedback }: { feedback: Feedback }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setMessages([]); setDraft(''); setReady(false); setError('')
    return onSnapshot(query(collection(db, 'feedback', feedback.id, 'messages'), orderBy('createdAt', 'desc'), limit(100)), snapshot => {
      setMessages(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Message).reverse())
      setReady(true)
    }, () => setError('Não foi possível abrir a conversa. Tente novamente.'))
  }, [feedback.id])
  async function send(event: FormEvent) {
    event.preventDefault()
    const user = auth.currentUser
    if (!user || busy || !ready || !draft.trim()) return
    setBusy(true); setError('')
    try {
      await addDoc(collection(db, 'feedback', feedback.id, 'messages'), { text: draft.trim(), senderId: user.uid, createdAt: serverTimestamp() })
      setDraft('')
    } catch { setError('Não foi possível enviar. Sua mensagem foi mantida para tentar novamente.') }
    finally { setBusy(false) }
  }
  return <section className="representatives-chat" aria-label="Conversa privada sobre a melhoria">
    <header className="chat-heading"><h3>Conversa sobre a melhoria</h3><p>{feedback.message}</p><small>Somente o autor e os administradores podem ler e responder. Não envie senhas.</small></header>
    <div className="chat-messages" role="log" aria-live="polite" aria-label="Mensagens da conversa" tabIndex={0}>
      {!ready && !error ? <p>Carregando…</p> : !messages.length ? <p>Ainda não há mensagens. Envie uma pergunta ou mais detalhes sobre a ideia.</p> : messages.map(item => <article key={item.id} className={`chat-message${item.senderId === auth.currentUser?.uid ? ' chat-message-own' : ''}`}>
        <strong>{item.senderId === feedback.createdBy ? 'Autor da sugestão' : 'Administração'}</strong><p>{item.text}</p><time>{item.createdAt?.toDate().toLocaleString('pt-BR') ?? 'Enviando…'}</time>
      </article>)}
    </div>
    <form className="chat-compose" onSubmit={send}>
      <label htmlFor={`feedback-message-${feedback.id}`}>Sua mensagem</label>
      <textarea id={`feedback-message-${feedback.id}`} rows={3} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} required />
      <div className="chat-compose-actions"><small>{draft.length}/2000</small><button className="primary-button compact" disabled={busy || !ready || !draft.trim()}><Send size={16} />{busy ? 'Enviando…' : 'Enviar'}</button></div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </form>
  </section>
}

export function MyFeedbackConversations({ userId }: { userId: string }) {
  const [items, setItems] = useState<Feedback[]>([])
  const [selected, setSelected] = useState<Feedback | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setItems([]); setSelected(null); setError('')
    return onSnapshot(query(collection(db, 'feedback'), where('createdBy', '==', userId)), snapshot => {
      setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Feedback))
    }, () => setError('Não foi possível carregar suas conversas.'))
  }, [userId])
  return <div className="feedback-conversations"><h3>Minhas conversas com a administração</h3>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!items.length && !error && <p>Suas sugestões de melhoria aparecerão aqui depois do envio.</p>}
    {items.map(item => <button className="secondary-button" type="button" key={item.id} onClick={() => setSelected(item)} aria-pressed={selected?.id === item.id}>{item.message.slice(0, 100)}{item.message.length > 100 ? '…' : ''}</button>)}
    {selected && <FeedbackConversation key={selected.id} feedback={selected} />}
  </div>
}
