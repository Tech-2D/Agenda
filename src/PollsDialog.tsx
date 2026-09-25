import { type FormEvent, useEffect, useState } from 'react'
import { BarChart3, Check, LoaderCircle, LockKeyhole, Plus, UserCheck, Vote, X } from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth, db } from './firebase'
import { canVoteInClass, countPollVotes, preparePollOptions, type Poll, type PollVote, type PollVoterAccess } from './polls'
import type { AdminProfile } from './types'

type Props = {
  turmaId: string
  loadAdminProfile: (account: User) => Promise<AdminProfile | null>
  onClose: () => void
}

function authErrorMessage(cause: unknown): string {
  if (cause instanceof FirebaseError) {
    if (cause.code === 'auth/email-already-in-use') return 'Este e-mail já tem conta. Entre com sua senha.'
    if (cause.code === 'auth/weak-password') return 'Escolha uma senha com pelo menos 6 caracteres.'
    if (cause.code === 'auth/network-request-failed') return 'Sem conexão com o Firebase. Tente novamente.'
  }
  return 'Não foi possível entrar. Confira o e-mail e a senha.'
}

export function PollsDialog({ turmaId, loadAdminProfile, onClose }: Props) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [account, setAccount] = useState<User | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [voterAccess, setVoterAccess] = useState<PollVoterAccess | null>(null)
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [voterRequests, setVoterRequests] = useState<PollVoterAccess[]>([])
  const [reviewBusyId, setReviewBusyId] = useState('')
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let active = true
    let requestId = 0
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const currentRequest = ++requestId
      setAccount(user)
      setProfile(null)
      setAuthChecked(!user)
      if (!user) return
      try {
        const result = await loadAdminProfile(user)
        if (active && currentRequest === requestId) setProfile(result)
      } catch {
        if (active && currentRequest === requestId) setProfile(null)
      } finally {
        if (active && currentRequest === requestId) setAuthChecked(true)
      }
    })
    return () => { active = false; unsubscribe() }
  }, [loadAdminProfile])

  useEffect(() => {
    setLoading(true)
    const pollsQuery = query(collection(db, 'polls'), where('turmaId', '==', turmaId))
    return onSnapshot(pollsQuery, (snapshot) => {
      setPolls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Poll)
        .sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0)))
      setLoading(false)
      setLoadError('')
    }, () => {
      setLoading(false)
      setLoadError('Não foi possível carregar as enquetes. Confira a conexão e as regras do Firestore.')
    })
  }, [turmaId])

  const canManage = profile?.role === 'superadmin' || (profile?.role === 'representante' && profile.turmaId === turmaId)
  const approvedToVote = !accessLoading && !accessError && canVoteInClass(voterAccess, turmaId, account?.email ?? null)

  useEffect(() => {
    if (!account) {
      setVoterAccess(null)
      setAccessLoading(false)
      return
    }
    setAccessLoading(true)
    return onSnapshot(doc(db, 'pollVoterAccess', account.uid), (snapshot) => {
      setVoterAccess(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PollVoterAccess) : null)
      setAccessLoading(false)
      setAccessError('')
    }, () => {
      setAccessLoading(false)
      setAccessError('Não foi possível verificar sua autorização para votar.')
    })
  }, [account])

  useEffect(() => {
    if (!canManage) { setVoterRequests([]); return }
    return onSnapshot(query(collection(db, 'pollVoterAccess'), where('turmaId', '==', turmaId)), (snapshot) => {
      setVoterRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as PollVoterAccess)
        .sort((a, b) => (b.requestedAt?.toDate().getTime() ?? 0) - (a.requestedAt?.toDate().getTime() ?? 0)))
      setReviewError('')
    }, () => setReviewError('Não foi possível carregar as solicitações de voto.'))
  }, [canManage, turmaId])

  async function requestVoteAccess() {
    if (!account?.email) return
    setAccessBusy(true)
    setAccessError('')
    try {
      if (voterAccess) {
        await updateDoc(doc(db, 'pollVoterAccess', account.uid), { turmaId, status: 'pending', requestedAt: serverTimestamp() })
      } else {
        await setDoc(doc(db, 'pollVoterAccess', account.uid), {
          email: account.email.toLowerCase(), turmaId, status: 'pending', requestedAt: serverTimestamp(),
        })
      }
    } catch {
      setAccessError('Não foi possível enviar a solicitação. Confira a conexão e tente novamente.')
    } finally {
      setAccessBusy(false)
    }
  }

  async function reviewAccess(item: PollVoterAccess, status: 'approved' | 'rejected' | 'revoked') {
    if (!account || !canManage) return
    setReviewBusyId(item.id)
    setReviewError('')
    try {
      await updateDoc(doc(db, 'pollVoterAccess', item.id), {
        status, reviewedAt: serverTimestamp(), reviewedBy: account.uid,
      })
    } catch {
      setReviewError(`Não foi possível atualizar o acesso de ${item.email}. Tente novamente.`)
    } finally {
      setReviewBusyId('')
    }
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      if (authMode === 'register') await createUserWithEmailAndPassword(auth, email.trim(), password)
      else await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch (cause) {
      setAuthError(authErrorMessage(cause))
    } finally {
      setAuthBusy(false)
    }
  }

  async function recoverPassword() {
    if (!email.trim()) { setAuthError('Informe seu e-mail para recuperar a senha.'); return }
    setAuthBusy(true)
    setAuthError('')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setAuthNotice('Se o e-mail tiver uma conta, você receberá um link para redefinir a senha.')
    } catch {
      setAuthError('Não foi possível enviar o link agora. Tente novamente.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function createPoll(event: FormEvent) {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    const trimmedOptions = preparePollOptions(options)
    if (!account || !canManage) { setSaveError('Entre com a conta representante desta turma.'); return }
    if (!trimmedQuestion || trimmedQuestion.length > 160) { setSaveError('Escreva uma pergunta de até 160 caracteres.'); return }
    if (trimmedOptions.length < 2 || trimmedOptions.length > 5 || trimmedOptions.some((item) => item.length > 100)) {
      setSaveError('Informe de 2 a 5 alternativas, com até 100 caracteres cada.')
      return
    }
    if (new Set(trimmedOptions.map((item) => item.toLocaleLowerCase('pt-BR'))).size !== trimmedOptions.length) {
      setSaveError('As alternativas precisam ser diferentes.'); return
    }
    setSaveBusy(true)
    setSaveError('')
    try {
      await addDoc(collection(db, 'polls'), {
        turmaId, question: trimmedQuestion, options: trimmedOptions,
        status: 'open', createdBy: account.uid, createdAt: serverTimestamp(),
      })
      setQuestion('')
      setOptions(['', ''])
      setCreating(false)
    } catch {
      setSaveError('Não foi possível publicar a enquete. Confira sua permissão e tente novamente.')
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="polls-dialog" role="dialog" aria-modal="true" aria-labelledby="polls-title">
        <div className="dialog-header">
          <div><p className="eyebrow">VOTAÇÃO · {turmaId}</p><h2 id="polls-title">Enquetes da turma</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="polls-content">
          <div className="polls-intro">
            <p>Veja as votações da sua turma. Para votar, entre com sua conta e peça aprovação ao representante.</p>
            {canManage && <button type="button" className="secondary-button" onClick={() => { setCreating((value) => !value); setSaveError('') }}><Plus size={16} /> {creating ? 'Cancelar' : 'Criar enquete'}</button>}
          </div>

          {canManage && creating && (
            <form className="poll-create" onSubmit={createPoll}>
              <h3>Nova enquete para {turmaId}</h3>
              <label>Pergunta<input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={160} placeholder="Ex.: Qual tema vamos revisar primeiro?" required /></label>
              <div className="poll-create-options"><strong>Alternativas</strong>
                {options.map((value, index) => (
                  <label key={index}><span>{String(index + 1).padStart(2, '0')}</span><input value={value} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={100} placeholder={`Alternativa ${index + 1}`} required />
                    {options.length > 2 && <button type="button" className="icon-button" onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover alternativa ${index + 1}`}><X size={16} /></button>}
                  </label>
                ))}
              </div>
              {options.length < 5 && <button type="button" className="poll-add-option" onClick={() => setOptions((current) => [...current, ''])}><Plus size={15} /> Adicionar alternativa</button>}
              {saveError && <p className="form-error" role="alert">{saveError}</p>}
              <button type="submit" className="primary-button compact" disabled={saveBusy}>{saveBusy ? <LoaderCircle className="spin" /> : 'Publicar enquete'}</button>
            </form>
          )}

          {!authChecked && <p className="polls-note"><LoaderCircle className="spin" size={15} /> Conferindo sua conta…</p>}
          {authChecked && !account && (
            <form className="poll-auth" onSubmit={authenticate}>
              <div className="poll-auth-heading"><LockKeyhole size={18} /><strong>{authMode === 'register' ? 'Criar conta para votar' : 'Entre para votar'}</strong></div>
              <div className="poll-auth-fields">
                <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
                <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={6} required /></label>
                <button type="submit" className="primary-button compact" disabled={authBusy}>{authBusy ? <LoaderCircle className="spin" /> : authMode === 'register' ? 'Criar conta' : 'Entrar'}</button>
              </div>
              {authError && <p className="form-error" role="alert">{authError}</p>}
              {authNotice && <p className="polls-note" role="status">{authNotice}</p>}
              <div className="poll-auth-links"><button type="button" onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthError('') }}>{authMode === 'register' ? 'Já tenho conta' : 'Criar uma conta'}</button>{authMode === 'login' && <button type="button" onClick={recoverPassword}>Esqueci a senha</button>}</div>
            </form>
          )}
          {authChecked && account && <div className="poll-account"><Check size={15} /> Conectado como {account.email}<button type="button" onClick={() => signOut(auth)}>Sair</button></div>}

          {account && !accessLoading && !accessError && !approvedToVote && (
            <div className="poll-access-card">
              <div><UserCheck size={19} /><strong>{voterAccess?.turmaId && voterAccess.turmaId !== turmaId ? 'Peça acesso para esta turma' : voterAccess?.status === 'pending' ? 'Aguardando aprovação' : voterAccess?.status === 'rejected' ? 'Solicitação recusada' : voterAccess?.status === 'revoked' ? 'Acesso revogado' : 'Peça acesso para votar'}</strong></div>
              <p>{voterAccess?.turmaId && voterAccess.turmaId !== turmaId ? `O representante de ${turmaId} precisa aprovar sua conta.` : voterAccess?.status === 'pending' ? 'O representante da turma verá seu e-mail e decidirá se você pode votar.' : voterAccess?.status === 'rejected' || voterAccess?.status === 'revoked' ? 'Se você faz parte desta turma, pode solicitar uma nova análise.' : `O representante de ${turmaId} precisa aprovar sua conta antes do primeiro voto.`}</p>
              {voterAccess?.turmaId && voterAccess.turmaId !== turmaId && <p>Sua solicitação atual pertence à turma {voterAccess.turmaId}. Você pode pedir acesso para esta turma; a autorização anterior será substituída.</p>}
              {(!voterAccess || voterAccess.turmaId !== turmaId || ['rejected', 'revoked'].includes(voterAccess.status)) && <button type="button" className="secondary-button" onClick={requestVoteAccess} disabled={accessBusy}>{accessBusy ? <LoaderCircle className="spin" size={16} /> : null}{voterAccess ? 'Solicitar acesso para esta turma' : 'Pedir aprovação para votar'}</button>}
            </div>
          )}
          {account && accessLoading && <p className="polls-note"><LoaderCircle className="spin" size={15} /> Conferindo autorização para votar…</p>}
          {account && approvedToVote && <p className="polls-note poll-access-approved"><Check size={15} /> Sua conta foi aprovada para votar em {turmaId}.</p>}
          {accessError && <p className="form-error" role="alert">{accessError}</p>}

          {canManage && (
            <section className="poll-voter-manager" aria-labelledby="poll-voters-title">
              <div className="poll-voter-heading"><h3 id="poll-voters-title">Pessoas que podem votar</h3><span>{voterRequests.filter((item) => item.status === 'pending').length} aguardando</span></div>
              {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
              {voterRequests.length === 0 ? <p className="polls-note">Ainda não há pedidos para esta turma.</p> : (
                <div className="poll-voter-list">{voterRequests.map((item) => <div key={item.id} className="poll-voter-row">
                  <div><strong>{item.email}</strong><span>{item.status === 'pending' ? 'Aguardando' : item.status === 'approved' ? 'Aprovado' : item.status === 'rejected' ? 'Recusado' : 'Revogado'}</span></div>
                  <div className="poll-voter-actions">
                    {item.status !== 'approved' && <button type="button" onClick={() => reviewAccess(item, 'approved')} disabled={Boolean(reviewBusyId)}>Aprovar</button>}
                    {item.status === 'pending' && <button type="button" onClick={() => reviewAccess(item, 'rejected')} disabled={Boolean(reviewBusyId)}>Recusar</button>}
                    {item.status === 'approved' && <button type="button" onClick={() => reviewAccess(item, 'revoked')} disabled={Boolean(reviewBusyId)}>Revogar</button>}
                  </div>
                </div>)}</div>
              )}
            </section>
          )}

          {loading ? <p className="polls-note"><LoaderCircle className="spin" size={16} /> Carregando enquetes…</p>
            : loadError ? <p className="form-error" role="alert">{loadError}</p>
              : polls.length === 0 ? <div className="polls-empty"><Vote size={25} /><strong>Nenhuma enquete por enquanto</strong><span>Quando o representante publicar uma votação, ela aparecerá aqui.</span></div>
                : <div className="polls-list">{polls.map((poll) => <PollCard key={poll.id} poll={poll} account={account} canManage={Boolean(canManage)} approvedToVote={approvedToVote} />)}</div>}
        </div>
      </section>
    </div>
  )
}

function PollCard({ poll, account, canManage, approvedToVote }: { poll: Poll; account: User | null; canManage: boolean; approvedToVote: boolean }) {
  const [votes, setVotes] = useState<PollVote[]>([])
  const [votesError, setVotesError] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => onSnapshot(collection(db, 'polls', poll.id, 'votes'), (snapshot) => {
    setVotes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as PollVote))
    setVotesError('')
  }, () => setVotesError('Não foi possível carregar os votos.')), [poll.id])

  const counts = countPollVotes(poll.options.length, votes)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const myVote = votes.find((vote) => vote.id === account?.uid)

  async function vote(optionIndex: number) {
    if (!account || !approvedToVote || myVote || poll.status !== 'open') return
    setBusy(true)
    setActionError('')
    try {
      await setDoc(doc(db, 'polls', poll.id, 'votes', account.uid), { optionIndex, createdAt: serverTimestamp() })
    } catch {
      setActionError('Não foi possível registrar o voto. Confira sua aprovação ou se a enquete foi encerrada.')
    } finally {
      setBusy(false)
    }
  }

  async function closePoll() {
    if (!window.confirm('Encerrar esta enquete? Os votos e resultados continuarão visíveis.')) return
    setBusy(true)
    setActionError('')
    try {
      await updateDoc(doc(db, 'polls', poll.id), { status: 'closed' })
    } catch {
      setActionError('Não foi possível encerrar a enquete. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return <article className="poll-card">
    <div className="poll-card-top"><span className={`poll-status ${poll.status === 'open' ? 'is-open' : ''}`}>{poll.status === 'open' ? 'Em votação' : 'Encerrada'}</span><span className="poll-total"><BarChart3 size={14} /> {total} voto{total === 1 ? '' : 's'}</span></div>
    <h3>{poll.question}</h3>
    <div className="poll-choices">{poll.options.map((option, index) => {
      const selected = myVote?.optionIndex === index
      return <div className={`poll-choice ${selected ? 'selected' : ''}`} key={index}>
        <div className="poll-choice-line"><span>{option}{selected && <small> · seu voto</small>}</span><strong>{total ? Math.round((counts[index] / total) * 100) : 0}%</strong></div>
        <div className="poll-meter" role="img" aria-label={`${counts[index]} voto${counts[index] === 1 ? '' : 's'} para ${option}`}><span style={{ width: `${total ? counts[index] / total * 100 : 0}%` }} /></div>
        <div className="poll-choice-bottom"><small>{counts[index]} voto{counts[index] === 1 ? '' : 's'}</small>{approvedToVote && !myVote && poll.status === 'open' && <button type="button" onClick={() => vote(index)} disabled={busy || Boolean(votesError)}>Votar nesta opção</button>}</div>
      </div>
    })}</div>
    {!account && poll.status === 'open' && <p className="poll-hint">Entre com sua conta e peça aprovação para votar.</p>}
    {votesError && <p className="form-error" role="alert">{votesError}</p>}
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
    {canManage && poll.status === 'open' && <button type="button" className="poll-close" onClick={closePoll} disabled={busy}>Encerrar votação</button>}
  </article>
}
