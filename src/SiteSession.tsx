import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { ArrowRight, CalendarDays, Calculator, Columns3, Eye, EyeOff, MapPin } from 'lucide-react'
import { auth } from './firebase'
import { requestPasswordReset } from './passwordReset'
import './siteSession.css'

type Mode = 'login' | 'register' | 'reset'

function accountError(error: unknown, mode: Mode) {
  const code = error instanceof FirebaseError ? error.code : ''
  if (code === 'auth/network-request-failed') return 'Confira sua conexão e tente novamente.'
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (code === 'auth/email-already-in-use') return 'Este e-mail já tem uma conta. Entre com a sua senha ou solicite a recuperação.'
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'Escolha uma senha mais forte para criar sua conta.'
  if (code === 'auth/user-disabled') return 'Esta conta está desativada. Fale com a administração.'
  if (mode === 'login' && ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) return 'Confira seu e-mail e sua senha.'
  return mode === 'reset' ? 'O link não pôde ser enviado agora. Tente novamente.' : 'Não foi possível continuar. Tente novamente.'
}

export function SiteSession({ destination, children }: { destination: string; children: ReactNode }) {
  const [session, setSession] = useState<string | null | undefined>()
  useEffect(() => onAuthStateChanged(auth, user => setSession(user && !user.isAnonymous ? user.uid : null), () => setSession(null)), [])
  if (session === undefined) return <main className="site-entry-check" role="status">Verificando sua sessão…</main>
  return session ? <div key={session}>{children}</div> : <AccountEntry destination={destination} />
}

function AccountEntry({ destination }: { destination: string }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function selectMode(next: Mode) {
    setMode(next)
    setPassword('')
    setVisible(false)
    setError('')
    setMessage('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const address = email.trim()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'register') await createUserWithEmailAndPassword(auth, address, password)
      else if (mode === 'login') await signInWithEmailAndPassword(auth, address, password)
      else {
        await requestPasswordReset(address)
        setMessage('Se este e-mail estiver cadastrado, você receberá um link. Confira também a pasta de spam.')
      }
    } catch (error) {
      if (mode === 'reset' && error instanceof FirebaseError && error.code === 'auth/user-not-found') {
        setMessage('Se este e-mail estiver cadastrado, você receberá um link. Confira também a pasta de spam.')
      } else setError(accountError(error, mode))
    } finally {
      setBusy(false)
    }
  }

  const action = mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link'
  return (
    <main className="site-entry">
      <section className="site-entry-intro" aria-labelledby="site-entry-title">
        <p className="site-entry-brand">Tech 2D</p>
        <h1 id="site-entry-title">Uma conta para o seu dia na Tech.</h1>
        <p>Entre para abrir {destination}.</p>
        <ul>
          <li><CalendarDays aria-hidden="true" /> Agenda</li>
          <li><MapPin aria-hidden="true" /> Professores</li>
          <li><Calculator aria-hidden="true" /> Pegaki</li>
          <li><Columns3 aria-hidden="true" /> Kanban</li>
        </ul>
      </section>
      <section className="site-entry-card" aria-labelledby="site-entry-form-title">
        <h2 id="site-entry-form-title">{mode === 'reset' ? 'Recuperar senha' : mode === 'register' ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
        <p>{mode === 'reset' ? 'Informe o e-mail usado no cadastro.' : mode === 'register' ? 'Informe seu e-mail e escolha uma senha.' : 'Use o mesmo login em todas as áreas.'}</p>
        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="site-entry-email">E-mail</label>
          <input id="site-entry-email" name="email" type="email" autoComplete="username" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
          {mode !== 'reset' && <>
            <label htmlFor="site-entry-password">Senha</label>
            <div className="site-entry-password">
              <input id="site-entry-password" name="password" type={visible ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 6 : undefined} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy}
                aria-describedby={mode === 'register' ? 'site-entry-password-help' : undefined} />
              <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
                {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            </div>
            {mode === 'register' && <small id="site-entry-password-help">Use pelo menos 6 caracteres.</small>}
          </>}
          {error && <p className="site-entry-error" role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          <button className="site-entry-submit" disabled={busy}>{busy ? 'Aguarde…' : action}<ArrowRight size={17} aria-hidden="true" /></button>
          {mode === 'login' && <button type="button" className="site-entry-link" disabled={busy} onClick={() => selectMode('reset')}>Esqueci minha senha</button>}
        </form>
        <div className="site-entry-switch">
          {mode === 'login' ? <>Primeiro acesso? <button type="button" className="site-entry-link" disabled={busy} onClick={() => selectMode('register')}>Criar conta</button></> :
            <button type="button" className="site-entry-link" disabled={busy} onClick={() => selectMode('login')}>Voltar para entrar</button>}
        </div>
      </section>
    </main>
  )
}
