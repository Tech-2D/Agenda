import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import { CLASS_NAMES } from './classNames'
import { readPreferredTurma } from './classPreference'
import { digestPreference } from './weeklyDigest'
import { requestPasswordReset } from './passwordReset'

export function WeeklyDigestSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [turmaId, setTurmaId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const revision = useRef(0)
  useEffect(() => {
    const counter = revision
    const unsubscribe = onAuthStateChanged(auth, account => {
      const version = ++revision.current
      setUser(account); setMessage(''); setPassword(''); setTurmaId(''); setReady(false); setBusy(false)
      setLoading(!!account)
      if (!account) return
      void digestPreference(account).then(preference => {
        if (version !== revision.current || auth.currentUser?.uid !== account.uid) return
        setTurmaId(preference.turmaId || readPreferredTurma() || '')
        setEnabled(preference.turmaId ? preference.enabled : true); setReady(true)
      }).catch(() => {
        if (version === revision.current) setMessage('Não foi possível carregar suas preferências. Feche e abra as Configurações para tentar novamente.')
      }).finally(() => { if (version === revision.current) setLoading(false) })
    })
    return () => { counter.current++; unsubscribe() }
  }, [])
  async function login(event: FormEvent, create = false) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (create) await createUserWithEmailAndPassword(auth, email.trim(), password)
      else await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch { setMessage('Confira seu e-mail e senha. Para criar conta, a senha precisa de pelo menos 6 caracteres.') }
    finally { setBusy(false) }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!user || user.uid !== auth.currentUser?.uid || !ready) return
    const version = revision.current
    setBusy(true); setMessage('')
    try {
      await digestPreference(user, { turmaId, enabled })
      if (version === revision.current) setMessage(enabled ? 'Turma salva na sua conta. Você receberá o resumo quando houver atividades na próxima semana.' : 'Resumo por e-mail desativado.')
    } catch (error) { if (version === revision.current) setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') }
    finally { if (version === revision.current) setBusy(false) }
  }
  return <div className="config-section digest-settings">
    <h3>Resumo semanal por e-mail</h3>
    <p>Sexta-feira, às 18h de Brasília: atividades da próxima segunda a domingo, da sua turma e eventos gerais. O envio pode ocorrer até as 19h.</p>
    <p className="config-hint">Sem atividades ou sem turma salva, não há envio. Confira também a caixa de spam.</p>
    {loading ? <p role="status">Carregando sua conta…</p> : user ? <form onSubmit={save}>
      <p className="digest-account">Conta: {user.email}</p>
      <label>Turma do resumo<select value={turmaId} onChange={event => setTurmaId(event.target.value)} disabled={!ready || busy} required><option value="">Escolha sua turma</option>{CLASS_NAMES.map(name => <option key={name}>{name}</option>)}</select></label>
      <label className="a11y-toggle"><span>Receber resumo semanal</span><span className="toggle"><input type="checkbox" checked={enabled} disabled={!ready || busy} onChange={event => setEnabled(event.target.checked)} /><span /></span></label>
      <div className="digest-actions"><button className="primary-button" disabled={!ready || busy || !turmaId}>Salvar preferência</button><button className="secondary-button" type="button" disabled={busy} onClick={() => void signOut(auth)}>Sair da conta</button></div>
      <p className="config-hint">Navegar por outras turmas no calendário não altera a turma salva deste resumo.</p>
    </form> : <form onSubmit={event => void login(event)}>
      <p>Entre ou crie uma conta para salvar sua turma. Isso não concede acesso de representante.</p>
      <label>E-mail<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} /></label>
      <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /></label>
      <div className="digest-actions"><button className="primary-button" disabled={busy}>Entrar</button><button className="secondary-button" type="button" disabled={busy || !email || password.length < 6} onClick={event => void login(event, true)}>Criar conta</button></div>
      <button type="button" className="text-button" disabled={busy || !email} onClick={async () => {
        setBusy(true)
        try { await requestPasswordReset(email.trim()); setMessage('Se houver uma conta, o link será enviado. Confira também o spam.') }
        catch { setMessage('Não foi possível solicitar a redefinição. Tente novamente.') }
        finally { setBusy(false) }
      }}>Esqueci minha senha</button>
    </form>}
    {message && <p role="status" className="config-hint">{message}</p>}
  </div>
}
