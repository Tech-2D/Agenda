import { type FormEvent, useEffect, useRef, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore'
import { Send, Trash2 } from 'lucide-react'
import { db } from './firebase'
import { prepareChatMessage } from './chat'
import type { AdminProfile } from './types'

type Message = {
  id: string
  text: string
  senderId: string
  senderEmail: string
  senderRole: AdminProfile['role']
  senderTurma: string | null
  createdAt: Timestamp | null
}

export function RepresentativesChat({ userId, email, profile }: { userId: string; email: string; profile: AdminProfile }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)

  useEffect(() => {
    const latest = query(collection(db, 'representativeChat'), orderBy('createdAt', 'desc'), limit(100))
    return onSnapshot(latest, (snapshot) => {
      setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Message).reverse())
      setLoading(false)
      setConnected(true)
    }, () => {
      setLoading(false)
      setConnected(false)
      setError('Não foi possível carregar o chat. Confira sua conexão e tente abrir esta aba novamente.')
    })
  }, [])

  useEffect(() => {
    if (followLatest.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending || !connected) return
    setError('')
    try {
      const text = prepareChatMessage(draft)
      setSending(true)
      followLatest.current = true
      await addDoc(collection(db, 'representativeChat'), {
        text,
        senderId: userId,
        senderEmail: email,
        senderRole: profile.role,
        senderTurma: profile.role === 'representante' ? profile.turmaId : null,
        createdAt: serverTimestamp(),
      })
      setDraft('')
    } catch (cause) {
      setError(cause instanceof Error && !(cause as { code?: string }).code ? cause.message : 'Não foi possível enviar. Sua mensagem foi mantida para tentar novamente.')
    } finally {
      setSending(false)
    }
  }

  async function remove(item: Message) {
    if (!window.confirm('Remover esta mensagem do grupo?')) return
    try {
      await deleteDoc(doc(db, 'representativeChat', item.id))
    } catch {
      setError('Não foi possível remover a mensagem.')
    }
  }

  return (
    <section className="representatives-chat" aria-labelledby="chat-title">
      <header className="chat-heading"><h3 id="chat-title">Chat dos representantes</h3><p>Grupo privado para trocar ideias e tirar dúvidas com os representantes e administradores. Não envie senhas ou dados pessoais de alunos.</p></header>
      <div className="chat-messages" ref={listRef} role="log" aria-label="Mensagens do grupo" aria-live="polite" tabIndex={0} onScroll={() => {
        const list = listRef.current
        if (list) followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
      }}>
        {loading ? <p className="chat-empty">Carregando mensagens…</p> : messages.length === 0 ? <p className="chat-empty">Ainda não há mensagens. Comece uma conversa com a equipe.</p> : messages.map((item) => (
          <article key={item.id} className={`chat-message${item.senderId === userId ? ' chat-message-own' : ''}`}>
            <div className="chat-message-author"><strong>{item.senderEmail}</strong><span>{item.senderRole === 'superadmin' ? 'Administrador' : item.senderTurma}</span></div>
            <p>{item.text}</p>
            <div className="chat-message-footer"><time>{item.createdAt ? item.createdAt.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Enviando…'}</time>{(item.senderId === userId || profile.role === 'superadmin') && <button type="button" onClick={() => remove(item)} aria-label={`Remover mensagem de ${item.senderEmail}`}><Trash2 size={14} /></button>}</div>
          </article>
        ))}
      </div>
      <form className="chat-compose" onSubmit={send}>
        <label htmlFor="chat-draft">Mensagem para o grupo</label>
        <textarea id="chat-draft" rows={3} maxLength={2000} value={draft} disabled={sending} onChange={(event) => setDraft(event.target.value)} placeholder="Ex.: Como cadastro uma atividade que se repete toda semana?" onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
        }} />
        <div className="chat-compose-actions"><small>Últimas 100 mensagens · {draft.length}/2000</small><button className="primary-button compact" disabled={sending || !connected || !draft.trim()}><Send size={16} /> {sending ? 'Enviando…' : 'Enviar'}</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </section>
  )
}
