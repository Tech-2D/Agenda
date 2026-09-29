import { useEffect, useState, type FormEvent } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { Calendar, Check, LoaderCircle, X } from 'lucide-react'
import { db } from './firebase'
import { isValidClassName, normalizeClassName } from './classRequests'
import { isValidRepresentativeEmail, normalizeRepresentativeEmail } from './representativeAccess'

export function ClassRequestDialog({ classNames, onClose }: { classNames: string[]; onClose: () => void }) {
  const [className, setClassName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = normalizeClassName(className)
    const contact = normalizeRepresentativeEmail(email)
    if (!isValidClassName(name)) { setError('Informe o nome da turma com 3 a 60 caracteres, sem barras ou símbolos especiais.'); return }
    if (classNames.includes(name)) { setError('Essa turma já tem agenda. Escolha-a no seletor de turmas.'); return }
    if (!isValidRepresentativeEmail(contact)) { setError('Informe um e-mail válido para contato.'); return }
    setBusy(true)
    setError('')
    try {
      await addDoc(collection(db, 'agendaClassRequests'), {
        className: name, email: contact, status: 'pendente', createdAt: serverTimestamp(),
      })
      setSent(true)
    } catch {
      setError('Não foi possível enviar o pedido. Confira sua conexão; se continuar, avise os administradores.')
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="class-request-title">
      <div className="dialog-header">
        <div><p className="eyebrow dark">NOVA TURMA</p><h2 id="class-request-title">Pedir agenda para minha turma</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
      </div>
      {sent ? <div className="state-card"><Check /><p>Pedido enviado! Os administradores vão analisar. Se aprovado, a turma aparecerá no seletor para todos.</p><button type="button" className="secondary-button" onClick={onClose}>Fechar</button></div> :
        <form className="activity-form standalone" onSubmit={submit}>
          <p className="config-hint">Não encontrou sua turma? Peça a criação da agenda. Isso não dá acesso para editar atividades; o representante poderá solicitar acesso depois.</p>
          <div className="form-grid">
            <label className="wide">Nome da turma<input required maxLength={60} value={className} onChange={event => setClassName(event.target.value)} placeholder="Ex.: 3º Tech DS E" autoFocus /></label>
            <label className="wide">Seu e-mail para contato<input required type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@escola.com" /></label>
          </div>
          <p className="config-hint">Seu e-mail será visto apenas pelos administradores para avaliar o pedido.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <><Calendar size={16} /> Enviar pedido</>}</button></div>
        </form>}
    </section>
  </div>
}
